"""
Memory service — persistent, provider-independent memory across three scopes:

    user          facts/preferences that apply to everything the user does
    project       context shared within a project
    conversation  summaries / long-term context for one conversation

`build_memory_context` assembles the relevant memories into a block that is
injected into the system prompt of chats and agent runs.
"""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.memory import Memory

VALID_SCOPES = {"user", "project", "conversation"}
_CONTEXT_BUDGET = 6000  # chars


def create_memory(
    db: Session,
    user_id: UUID,
    content: str,
    scope: str = "user",
    project_id: UUID | None = None,
    conversation_id: UUID | None = None,
    source: str = "manual",
) -> Memory:
    if scope not in VALID_SCOPES:
        raise HTTPException(status_code=400, detail=f"Invalid scope '{scope}'")
    content = (content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Memory content cannot be empty")
    if scope == "project" and not project_id:
        raise HTTPException(status_code=400, detail="project scope requires project_id")
    if scope == "conversation" and not conversation_id:
        raise HTTPException(status_code=400, detail="conversation scope requires conversation_id")

    mem = Memory(
        user_id=user_id,
        scope=scope,
        project_id=project_id if scope == "project" else None,
        conversation_id=conversation_id if scope == "conversation" else None,
        content=content,
        source=source,
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return mem


def list_memories(
    db: Session,
    user_id: UUID,
    scope: str | None = None,
    project_id: UUID | None = None,
    conversation_id: UUID | None = None,
) -> list[Memory]:
    q = db.query(Memory).filter(Memory.user_id == user_id)
    if scope:
        q = q.filter(Memory.scope == scope)
    if project_id:
        q = q.filter(Memory.project_id == project_id)
    if conversation_id:
        q = q.filter(Memory.conversation_id == conversation_id)
    return q.order_by(desc(Memory.created_at)).all()


def get_memory(db: Session, user_id: UUID, memory_id: UUID) -> Memory:
    mem = db.query(Memory).filter(Memory.id == memory_id, Memory.user_id == user_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    return mem


def update_memory(db: Session, user_id: UUID, memory_id: UUID, content: str) -> Memory:
    mem = get_memory(db, user_id, memory_id)
    content = (content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Memory content cannot be empty")
    mem.content = content
    db.commit()
    db.refresh(mem)
    return mem


def delete_memory(db: Session, user_id: UUID, memory_id: UUID) -> None:
    mem = get_memory(db, user_id, memory_id)
    db.delete(mem)
    db.commit()


_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "of", "to", "in", "on", "for",
    "and", "or", "what", "which", "who", "whom", "whose", "does", "do", "did",
    "user", "users", "prefer", "preference", "about", "my", "me", "i", "you",
}


def search_memories(db: Session, user_id: UUID, query: str, limit: int = 10) -> list[Memory]:
    """Token-based search: a memory matches if it contains the full query OR any
    significant keyword from it. Results are ranked by number of keywords matched."""
    query = (query or "").strip()
    base = db.query(Memory).filter(Memory.user_id == user_id)
    if not query:
        return base.order_by(desc(Memory.created_at)).limit(limit).all()

    candidates = base.order_by(desc(Memory.created_at)).all()
    q_lower = query.lower()
    keywords = [
        w.strip(".,!?;:\"'()").lower()
        for w in query.split()
    ]
    keywords = [w for w in keywords if len(w) > 2 and w not in _STOPWORDS]

    scored: list[tuple[int, Memory]] = []
    for m in candidates:
        content_lower = m.content.lower()
        if q_lower in content_lower:
            scored.append((1000, m))
            continue
        hits = sum(1 for w in keywords if w in content_lower)
        if hits:
            scored.append((hits, m))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [m for _, m in scored[:limit]]


def build_memory_context(
    db: Session,
    user_id: UUID,
    conversation_id: UUID | None = None,
    project_id: UUID | None = None,
) -> str:
    """Return a system-prompt-ready block of the user's relevant memories, or ''."""
    # Resolve the conversation's project so project memories surface automatically.
    if conversation_id and not project_id:
        conv = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .first()
        )
        if conv:
            project_id = conv.project_id

    clauses = [Memory.scope == "user"]
    if project_id:
        clauses.append(Memory.project_id == project_id)
    if conversation_id:
        clauses.append(Memory.conversation_id == conversation_id)

    memories = (
        db.query(Memory)
        .filter(Memory.user_id == user_id, or_(*clauses))
        .order_by(Memory.scope, desc(Memory.created_at))
        .all()
    )
    if not memories:
        return ""

    sections: dict[str, list[str]] = {"user": [], "project": [], "conversation": []}
    for m in memories:
        sections[m.scope].append(m.content)

    labels = {
        "user": "About the user",
        "project": "Project context",
        "conversation": "Earlier in this conversation",
    }
    out: list[str] = ["# Memory", "The following persistent context is known. Use it when relevant.\n"]
    used = 0
    for scope in ("user", "project", "conversation"):
        items = sections[scope]
        if not items:
            continue
        out.append(f"## {labels[scope]}")
        for item in items:
            line = f"- {item}"
            if used + len(line) > _CONTEXT_BUDGET:
                break
            out.append(line)
            used += len(line)
        out.append("")
    return "\n".join(out).strip()
