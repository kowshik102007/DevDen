"""
Provider presets + free-tier model filtering.

A single source of truth for the OpenAI-compatible providers the app knows how
to talk to. Each preset carries the base URL, how to list models, auth quirks,
and — crucially for this app — how to keep ONLY the provider's free models.

The user's requirement: surface only free models. Two kinds of providers:

  * Per-model free flag (OpenRouter `:free`, OpenCode Zen `-free`, Zhipu
    `*-flash`): we filter the model list down to the matching ids.
  * Account-level free tier (Groq, Cerebras, Gemini, Mistral, …): every model
    the key can reach is already free-by-quota, so we keep them all.

`free_mode`:
  - "suffix"   : keep models whose id ends with any string in `free_patterns`
  - "contains" : keep models whose id contains any string in `free_patterns`
  - "all"      : every listed model is free (quota-gated provider) — keep all
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProviderPreset:
    name: str
    base_url: str
    free_mode: str = "all"                       # "suffix" | "contains" | "all"
    free_patterns: tuple[str, ...] = ()
    models_url: str | None = None                # override when /models isn't base+"/models"
    key_required: bool = True
    key_prefix: str | None = None                # expected api key prefix (UI hint only)
    notes: str = ""
    # When base_url contains a "{ACCOUNT_ID}" placeholder the user must fill it in.
    needs_template: bool = False


# Ordered roughly by how commonly they're used / how clean the free tier is.
PRESETS: tuple[ProviderPreset, ...] = (
    ProviderPreset(
        name="Groq",
        base_url="https://api.groq.com/openai/v1",
        free_mode="all",
        notes="No card. Per-model rate limits. Open-weight models only.",
    ),
    ProviderPreset(
        name="OpenRouter",
        base_url="https://openrouter.ai/api/v1",
        free_mode="suffix",
        free_patterns=(":free",),
        notes="Free models end in ':free'. ~20 RPM / 200 RPD.",
    ),
    ProviderPreset(
        name="Google AI Studio",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        free_mode="all",
        notes="No card. Per-project limits. Use gemini-2.5-* ids.",
    ),
    ProviderPreset(
        name="Cerebras",
        base_url="https://api.cerebras.ai/v1",
        free_mode="all",
        notes="~1M tokens/day free, no card. 8K context cap on free tier.",
    ),
    ProviderPreset(
        name="Mistral",
        base_url="https://api.mistral.ai/v1",
        free_mode="all",
        notes="Experiment plan: phone-verified, no card. May train on data.",
    ),
    ProviderPreset(
        name="NVIDIA NIM",
        base_url="https://integrate.api.nvidia.com/v1",
        free_mode="all",
        key_prefix="nvapi-",
        notes="Dev program credits + zero-credit free models. Key starts 'nvapi-'.",
    ),
    ProviderPreset(
        name="Cohere",
        base_url="https://api.cohere.ai/compatibility/v1",
        free_mode="all",
        notes="Trial key: all models, 1000 calls/mo, non-commercial. Must use /compatibility/v1.",
    ),
    ProviderPreset(
        name="GitHub Models",
        base_url="https://models.github.ai/inference",
        models_url="https://models.github.ai/catalog/models",
        free_mode="all",
        notes="Free with any GitHub account (experimentation). PAT needs models:read scope. Model ids are namespaced e.g. openai/gpt-4o.",
    ),
    ProviderPreset(
        name="HuggingFace Router",
        base_url="https://router.huggingface.co/v1",
        free_mode="all",
        notes="Monthly free credits. Token needs 'Inference Providers' permission.",
    ),
    ProviderPreset(
        name="Zhipu AI",
        base_url="https://api.z.ai/api/paas/v4",
        free_mode="contains",
        free_patterns=("flash",),
        notes="Free GLM *-flash models, no card. Base ends in /v4 (not /v1).",
    ),
    ProviderPreset(
        name="OpenCode Zen",
        base_url="https://opencode.ai/zen/v1",
        free_mode="suffix",
        free_patterns=("-free",),
        notes="Free models end in '-free'. Key required even for free models.",
    ),
    ProviderPreset(
        name="LLM7",
        base_url="https://api.llm7.io/v1",
        free_mode="all",
        key_required=False,
        notes="Fully free. Keyless anon ~30 RPM; free token at token.llm7.io for more.",
    ),
    ProviderPreset(
        name="Pollinations",
        base_url="https://gen.pollinations.ai/v1",
        free_mode="all",
        notes="Free, tier-based 'pollen' balances. Key at enter.pollinations.ai.",
    ),
    ProviderPreset(
        name="Ollama Cloud",
        base_url="https://ollama.com/v1",
        free_mode="all",
        notes="~6 free models. Session/weekly GPU-time limits. Real key required.",
    ),
    ProviderPreset(
        name="Kilo Gateway",
        base_url="https://api.kilo.ai/api/gateway",
        free_mode="suffix",
        free_patterns=("/free", "-free", ":free"),
        notes="kilo-auto/free routes to zero-credit models.",
    ),
    ProviderPreset(
        name="Cloudflare Workers AI",
        base_url="https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1",
        models_url="https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/models/search",
        free_mode="all",
        needs_template=True,
        notes="10K Neurons/day free. Replace {ACCOUNT_ID} in the URL. Model ids look like @cf/author/model.",
    ),
    ProviderPreset(
        name="Ollama (local)",
        base_url="http://host.docker.internal:11434/v1",
        free_mode="all",
        key_required=False,
        notes="Local Ollama — fully free, no key. Reach host from the backend container via host.docker.internal.",
    ),
    ProviderPreset(
        name="SambaNova",
        base_url="https://api.sambanova.ai/v1",
        free_mode="all",
        notes="~10-20 RPM, 200K TPD free. No card required. Fast inference on open-weight models.",
    ),
    ProviderPreset(
        name="OVHcloud AI",
        base_url="https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
        free_mode="all",
        key_required=False,
        notes="2 RPM/model, anonymous — no signup. EU-hosted open-weight models.",
    ),
    ProviderPreset(
        name="DeepInfra",
        base_url="https://api.deepinfra.com/v1/openai",
        free_mode="all",
        notes="Free serverless tier for selected open-weight models. API key required.",
    ),
)


_BY_NAME = {p.name.lower(): p for p in PRESETS}


def _normalise_url(url: str) -> str:
    return (url or "").rstrip("/").lower()


def find_preset(name: str | None = None, base_url: str | None = None) -> ProviderPreset | None:
    """Resolve a preset by provider name first, then by base URL.

    Name match is exact (case-insensitive). URL match ignores the {ACCOUNT_ID}
    template tail so user-filled Cloudflare URLs still resolve."""
    if name and name.lower() in _BY_NAME:
        return _BY_NAME[name.lower()]
    if base_url:
        target = _normalise_url(base_url)
        for p in PRESETS:
            preset_url = _normalise_url(p.base_url)
            if "{account_id}" in preset_url:
                # Compare the stable prefix before the template segment.
                prefix = preset_url.split("{account_id}")[0]
                if prefix and target.startswith(prefix):
                    return p
            elif target == preset_url:
                return p
    return None


def _is_paid_object(m: dict) -> bool:
    """Heuristic: does this model object's own metadata mark it as paid/pro?

    Providers increasingly tag tiers inline (LLM7 `tier: pro`, OpenRouter
    `pricing`, others `free: false`). This catches paid models regardless of the
    name-pattern free_mode, so e.g. LLM7's free quota never offers a pro model."""
    tier = str(m.get("tier") or "").lower()
    if tier in ("pro", "paid", "premium", "enterprise", "plus"):
        return True
    if m.get("free") is False or m.get("is_free") is False:
        return True
    pricing = m.get("pricing")
    if isinstance(pricing, dict):
        def _num(v):
            try:
                return float(v)
            except (TypeError, ValueError):
                return 0.0
        if any(_num(pricing.get(k)) > 0 for k in ("prompt", "completion", "request", "input", "output")):
            return True
    return False


def _matches_free_name(model_id: str, preset: "ProviderPreset | None") -> bool:
    """Does the id satisfy the preset's name-based free rule? (True if no rule.)"""
    if not preset or preset.free_mode == "all" or not preset.free_patterns:
        return True
    pats = preset.free_patterns
    if preset.free_mode == "suffix":
        return any(model_id.lower().endswith(p.lower()) for p in pats)
    if preset.free_mode == "contains":
        return any(p.lower() in model_id.lower() for p in pats)
    return True


def filter_free_model_objects(
    models: list,
    name: str | None = None,
    base_url: str | None = None,
) -> list[str]:
    """Return free model ids from a list of model objects (or bare id strings).

    Two gates: (1) for providers with per-model free rules (suffix/contains),
    drop objects whose own metadata marks them paid (`tier: pro`, `pricing > 0`,
    `free: false`); (2) apply the preset's name-pattern free rule.
    Quota-gated providers (free_mode="all") skip the paid-object check since
    their pricing metadata doesn't reflect actual cost to the user."""
    preset = find_preset(name=name, base_url=base_url)
    skip_paid_check = preset and preset.free_mode == "all"
    kept: list[str] = []
    saw_any_id = False
    for m in models:
        if isinstance(m, str):
            mid = m
            paid = False
        elif isinstance(m, dict):
            mid = m.get("id") or m.get("name")
            paid = False if skip_paid_check else _is_paid_object(m)
        else:
            continue
        if not mid:
            continue
        saw_any_id = True
        if paid:
            continue
        if not _matches_free_name(mid, preset):
            continue
        kept.append(mid)

    if kept:
        return kept
    # Nothing matched the name rule but we did see models → return the
    # tier-filtered set so the user isn't left with zero (don't re-add paid ones).
    if saw_any_id:
        tier_only = [
            (m if isinstance(m, str) else (m.get("id") or m.get("name")))
            for m in models
            if isinstance(m, str) or (isinstance(m, dict) and not _is_paid_object(m))
        ]
        tier_only = [x for x in tier_only if x]
        if tier_only:
            return tier_only
    return [m if isinstance(m, str) else (m.get("id") or m.get("name")) for m in models if (isinstance(m, str) or isinstance(m, dict))]


def filter_free_models(
    model_ids: list[str],
    name: str | None = None,
    base_url: str | None = None,
) -> list[str]:
    """Return only the FREE models (id-string variant — no tier metadata).

    Unknown providers (no preset) are returned unchanged — we can't know their
    pricing, so we don't hide anything. Known providers with a per-model free
    flag are filtered; quota-gated providers ("all") pass through.

    Prefer `filter_free_model_objects` when you have the full model dicts, since
    that also catches inline paid-tier markers."""
    preset = find_preset(name=name, base_url=base_url)
    if not preset or preset.free_mode == "all" or not preset.free_patterns:
        return model_ids

    pats = preset.free_patterns
    if preset.free_mode == "suffix":
        kept = [m for m in model_ids if any(m.lower().endswith(p.lower()) for p in pats)]
    elif preset.free_mode == "contains":
        kept = [m for m in model_ids if any(p.lower() in m.lower() for p in pats)]
    else:
        kept = model_ids

    # Safety: if filtering wiped everything (provider changed its naming), fall
    # back to the unfiltered list rather than leaving the user with zero models.
    return kept or model_ids


def preset_dicts() -> list[dict]:
    """Serialisable preset list for the frontend quick-add UI."""
    return [
        {
            "name": p.name,
            "base_url": p.base_url,
            "free_mode": p.free_mode,
            "free_patterns": list(p.free_patterns),
            "key_required": p.key_required,
            "key_prefix": p.key_prefix,
            "needs_template": p.needs_template,
            "notes": p.notes,
        }
        for p in PRESETS
    ]
