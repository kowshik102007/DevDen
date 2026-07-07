import base64
import json
import os
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.core.provider import stream_chat
from app.services.auth_service import get_current_user
from app.services.provider_service import has_enabled_providers
from app.services.router_service import route_chat
from app.services.conversation_service import (
    create_conversation,
    get_conversation,
    add_message,
    auto_title_conversation,
)
from app.services.llm_service import get_provider_config
from app.services.memory_service import build_memory_context
from app.services.request_logger import RequestTimer, log_request
from app.models.attachment import Attachment
from app.schemas.conversation import ConversationCreate
from app.schemas.chat import ChatRequest

router = APIRouter(prefix="/chat", tags=["chat"])
security = HTTPBearer()


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, credentials.credentials)
    provider = get_provider_config(db, user.id)

    # Two ways to chat: multi-provider routing (Phase 3+) or a single-provider config.
    # Routing only needs a model (from the request); the single config needs base_url + model.
    using_router = has_enabled_providers(db, user.id)
    effective_model = request.model or provider.model
    if using_router:
        if not effective_model:
            raise HTTPException(
                status_code=400,
                detail="No model selected. Pick a model from the model picker.",
            )
    elif not provider.base_url or not effective_model:
        raise HTTPException(
            status_code=400,
            detail="Provider not configured. Open Settings to set your API key and model.",
        )

    if request.conversation_id:
        conv = get_conversation(db, request.conversation_id, user.id)
    else:
        conv = create_conversation(db, user.id, ConversationCreate(model=effective_model))

    # Build message content (prepend attachment text if any)
    user_content = request.message
    attachment_refs = []
    if request.attachment_ids:
        for att_id in request.attachment_ids:
            att = db.query(Attachment).filter(
                Attachment.id == att_id, Attachment.user_id == user.id
            ).first()
            if att:
                attachment_refs.append(att)
                if att.content_type.startswith("text/") or att.content_type == "application/json":
                    try:
                        with open(att.file_path, "r", encoding="utf-8", errors="replace") as f:
                            file_text = f.read(8000)
                        user_content = f"[Attachment: {att.filename}]\n```\n{file_text}\n```\n\n{user_content}"
                    except Exception:
                        pass
                elif att.content_type == "application/pdf":
                    try:
                        import fitz  # PyMuPDF
                        doc = fitz.open(att.file_path)
                        pages_text = []
                        char_budget = 12000
                        for page in doc:
                            page_text = page.get_text()
                            if char_budget <= 0:
                                break
                            pages_text.append(page_text[:char_budget])
                            char_budget -= len(page_text)
                        doc.close()
                        pdf_text = "\n".join(pages_text).strip()
                        if pdf_text:
                            user_content = f"[PDF: {att.filename}]\n{pdf_text}\n\n{user_content}"
                        else:
                            user_content = f"[PDF: {att.filename} — no extractable text (scanned/image-only)]\n\n{user_content}"
                    except Exception:
                        user_content = f"[PDF: {att.filename} — could not extract text]\n\n{user_content}"
                elif att.content_type.startswith("image/"):
                    pass  # handled below when building the message content array
                else:
                    user_content = f"[Attachment: {att.filename} ({att.content_type})]\n\n{user_content}"

    # Build multipart content for images (OpenAI vision format)
    image_parts = []
    for att in attachment_refs:
        if att.content_type.startswith("image/"):
            try:
                file_size = os.path.getsize(att.file_path)
                if file_size > 10 * 1024 * 1024:
                    continue
                with open(att.file_path, "rb") as img_f:
                    b64 = base64.b64encode(img_f.read()).decode("utf-8")
                image_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{att.content_type};base64,{b64}"},
                })
            except Exception:
                pass

    # Save the original message (no file content) so the UI shows clean text
    user_msg = add_message(db, conv.id, "user", request.message)
    # Link attachments to the saved message
    for att in attachment_refs:
        att.message_id = user_msg.id
    if attachment_refs:
        db.commit()

    auto_title_conversation(db, conv.id, request.message)

    db.refresh(conv)

    system_prompt = (
        "You are a helpful assistant with access to real-time web search and browser tools.\n\n"
        "## Tool Results — ABSOLUTE RULES\n"
        "When you have tools available, you MUST use them to answer questions that require live data, browser interaction, or any information you cannot be 100% certain of from memory.\n"
        "- Tool results are the ONLY ground truth. NEVER answer from memory when a tool can provide the real answer.\n"
        "- NEVER fabricate, guess, or hallucinate tool output. If a tool hasn't been called yet, call it — do not invent what it would return.\n"
        "- After receiving tool results, your answer MUST be derived exclusively from those results. Do not blend in training-data guesses.\n"
        "- If a task requires multiple tool calls (navigate, click, screenshot, evaluate…), keep calling tools until you have every piece of data requested. Do not stop early.\n"
        "- If the user explicitly says to use a specific tool (e.g. 'use Playwright', 'use Terminal'), use ONLY that tool for the task — do not substitute web_search or any other tool.\n"
        "- NEVER output citation markers like 【1†source】 or 【3†L1-L3】. Do not fabricate source references.\n\n"
        "## Web Search — CRITICAL RULES\n"
        "You have `web_search` and `web_fetch` tools available at all times.\n"
        "- For ANY question about current events, who holds a position/office, recent news, prices, scores, dates, or ANYTHING that may have changed since your training: call `web_search` FIRST. Do NOT answer from memory.\n"
        "- Web search results are ground truth. Copy the answer directly from the results. NEVER override, contradict, or 'correct' search results using your training data.\n"
        "- NEVER say 'likely', 'probably', or 'I believe' after receiving search results — the results ARE the answer.\n"
        "- NEVER say 'as of my knowledge cutoff'. Just search and report what you find.\n"
        "- If search results name a specific person in a role, that is the current answer. State it directly.\n\n"
        "## Formatting — REQUIRED\n"
        "You MUST format every response as proper Markdown:\n"
        "1. HEADINGS: Use `#`, `##`, `###` for titles/sections. Never use bold as a heading substitute.\n"
        "2. LISTS: Use `- item` for bullets or `1. item` for numbered lists. Never write list items as bold text.\n"
        "3. BOLD: Use **bold** only to emphasise key terms within a sentence.\n"
        "4. SPACING: Blank line before and after headings, lists, and paragraphs.\n"
        "5. CODE: Triple backtick blocks with a language tag.\n"
        "6. MATH: `$...$` inline, `$$...$$` block.\n\n"
        "Your output renders as Markdown — use `#` and `-` freely."
    )

    # Inject the user's persistent memory (user + project + conversation scopes).
    memory_context = build_memory_context(db, user.id, conversation_id=conv.id)
    if memory_context:
        system_prompt = f"{system_prompt}\n\n{memory_context}"

    # Optional skill: prepend its instructions and capture any tool restriction.
    allowed_tool_names = None
    if request.skill_id:
        from app.services.skill_service import get_skill
        try:
            skill = get_skill(db, user.id, request.skill_id)
            system_prompt = f"{system_prompt}\n\n## Skill: {skill.name}\n{skill.instructions}"
            allowed_tool_names = skill.tool_names or None
        except Exception:
            pass
    elif request.skill_auto:
        # "Auto" skill mode: let the model adopt the most relevant skill itself.
        from app.services.skill_service import build_auto_skill_prompt
        try:
            auto_block = build_auto_skill_prompt(db, user.id)
            if auto_block:
                system_prompt = f"{system_prompt}\n\n{auto_block}"
        except Exception:
            pass

    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": m.role, "content": m.content} for m in conv.messages]
    # user_content already added to DB; use it as the last message content.
    # When images are attached, use the OpenAI multi-part content format so
    # vision-capable models can actually see the image data.
    if messages:
        if image_parts:
            messages[-1]["content"] = image_parts + [{"type": "text", "text": user_content}]
        else:
            messages[-1]["content"] = user_content

    # Extract all primitives before the DI session closes
    from app.core import crypto
    base_url = provider.base_url
    api_key = crypto.decrypt(provider.api_key)
    model = request.model or provider.model
    conv_id: UUID = conv.id
    user_id: UUID = user.id
    preferred_provider_id = str(request.provider_id) if request.provider_id else None
    use_router = has_enabled_providers(db, user.id)
    # Resolve tool behaviour. Explicit tool_mode wins; otherwise fall back to the
    # legacy use_tools flag (True -> "auto"). Tools are active unless mode is "off".
    tool_mode = (request.tool_mode or ("auto" if request.use_tools else "off")).lower()
    if tool_mode not in ("off", "auto", "always"):
        tool_mode = "auto"
    use_tools = tool_mode != "off"

    # Resolve the tool whitelist. A skill may restrict tools; the user may also
    # explicitly pick a subset in the UI. If both are present, intersect them so
    # neither can broaden the other. None/empty means "all available tools".
    if request.tool_names:
        picked = [t for t in request.tool_names if t]
        if allowed_tool_names:
            allowed_set = set(allowed_tool_names)
            allowed_tool_names = [t for t in picked if t in allowed_set]
        else:
            allowed_tool_names = picked

    # Intelligent routing (Phase 10): when the user picks the "auto" model,
    # resolve the best concrete model + an ordered failover list from the catalog.
    from app.services.routing_service import is_auto, choose_models
    from app.models.provider import Provider as ProviderModel
    route_info = None
    model_order = None
    has_image = any(
        (a.content_type or "").startswith("image/") for a in attachment_refs
    )
    if is_auto(model):
        if use_router:
            routing_mode = (request.routing_mode or "balanced").lower()
            if routing_mode not in ("speed", "quality", "reliability", "balanced"):
                routing_mode = "balanced"
            ranked = choose_models(
                db, user_id, messages,
                has_image=has_image,
                preferred_provider_id=preferred_provider_id,
                routing_mode=routing_mode,
            )
            if ranked:
                model_order = [(m, p) for (m, p, _r) in ranked]
                top_model, top_pid, top_reason = ranked[0]
                model = top_model
                prov = (
                    db.query(ProviderModel)
                    .filter(ProviderModel.id == top_pid, ProviderModel.user_id == user_id)
                    .first()
                )
                route_info = {
                    "type": "route",
                    "model": top_model,
                    "provider": prov.name if prov else None,
                    "reason": top_reason,
                }
        if is_auto(model):
            # Couldn't resolve (no catalog / single-provider config) — fall back.
            model = provider.model or model

    # web_search and web_fetch are always injected as grounding tools regardless
    # of the user's tool mode setting. When tools are "off", only these two are
    # offered so the model can answer questions about current events without the
    # user having to manually enable tools.
    ALWAYS_ON_TOOLS = ["web_search", "web_fetch"]
    if tool_mode == "off":
        # Tools are off — surface only the always-on search tools so the model
        # can answer live questions without the user explicitly enabling tools.
        effective_tool_mode = "auto"
        effective_allowed = ALWAYS_ON_TOOLS
    else:
        effective_tool_mode = tool_mode
        if allowed_tool_names:
            # User explicitly selected tools — honour that selection exactly.
            # Do NOT inject web_search; if they picked Playwright, use Playwright.
            effective_allowed = list(allowed_tool_names)
        else:
            # No restriction — all tools including always-on are available.
            effective_allowed = None

    async def generate():
        full_response = ""
        timer = RequestTimer()
        try:
            yield f"data: {json.dumps({'type': 'conversation_id', 'conversation_id': str(conv_id)})}\n\n"
            if route_info:
                yield f"data: {json.dumps(route_info)}\n\n"

            from app.services.chat_agent_service import stream_chat_with_tools
            async for evt in stream_chat_with_tools(
                user_id=user_id,
                base_url=base_url,
                api_key=api_key,
                model=model,
                messages=messages,
                preferred_provider_id=preferred_provider_id,
                allowed_tool_names=effective_allowed,
                tool_mode=effective_tool_mode,
                model_order=model_order,
            ):
                if evt.get("type") == "chunk":
                    full_response += evt["content"]
                yield f"data: {json.dumps(evt)}\n\n"

            with SessionLocal() as fresh_db:
                add_message(fresh_db, conv_id, "assistant", full_response)
                log_request(fresh_db, user_id=user_id, endpoint="/api/chat/stream",
                            model=model, status_code=200, latency_ms=timer.elapsed_ms, is_stream=True)

            yield f"data: {json.dumps({'type': 'done', 'conversation_id': str(conv_id)})}\n\n"
        except Exception as e:
            with SessionLocal() as err_db:
                log_request(err_db, user_id=user_id, endpoint="/api/chat/stream",
                            model=model, status_code=500, latency_ms=timer.elapsed_ms,
                            is_stream=True, error=str(e))
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
