"""Static model family registry and classifier.

Classifies models by speed, knowledge, and coding ability using a
taxonomy of known model families plus parameter-count extraction from
model IDs. No LLM calls — deterministic and instant.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class FamilyProfile:
    knowledge_base: int
    coding_base: int
    reasoning_capable: bool
    vision_capable: bool
    context_window_default: int
    speed_modifier: int  # -2 to +2


MODEL_FAMILIES: dict[str, FamilyProfile] = {
    # --- Meta Llama ---
    "llama-4":     FamilyProfile(8, 8, False, True,  131_072, 0),
    "llama-3.3":   FamilyProfile(7, 7, False, False, 131_072, 0),
    "llama-3.2":   FamilyProfile(5, 6, False, True,  131_072, 0),
    "llama-3.1":   FamilyProfile(7, 7, False, False, 131_072, 0),
    "llama-3":     FamilyProfile(6, 6, False, False, 131_072, 0),
    "llama-2":     FamilyProfile(4, 4, False, False, 4_096,   0),
    "codellama":   FamilyProfile(5, 8, False, False, 16_384,  0),
    "llama":       FamilyProfile(4, 4, False, False, 4_096,   0),

    # --- Google Gemma ---
    "gemma-4":     FamilyProfile(7, 7, False, True,  131_072, 0),
    "gemma-3n":    FamilyProfile(5, 5, False, True,  32_768,  +1),
    "gemma-3":     FamilyProfile(6, 6, False, True,  131_072, 0),
    "gemma-2":     FamilyProfile(5, 5, False, False, 8_192,   0),
    "gemma":       FamilyProfile(4, 4, False, False, 8_192,   0),
    "codegemma":   FamilyProfile(4, 7, False, False, 8_192,   0),

    # --- Google Gemini ---
    "gemini-3.5":  FamilyProfile(10, 10, True, True,  1_000_000, 0),
    "gemini-3.1":  FamilyProfile(9, 9, True,  True,  1_000_000, 0),
    "gemini-3":    FamilyProfile(9, 9, True,  True,  1_000_000, 0),
    "gemini-2.5":  FamilyProfile(9, 9, True,  True,  1_000_000, 0),
    "gemini-2.0":  FamilyProfile(8, 8, False, True,  1_000_000, 0),
    "gemini-1.5":  FamilyProfile(8, 8, False, True,  1_000_000, 0),
    "gemini":      FamilyProfile(7, 7, False, True,  1_000_000, 0),

    # --- Qwen ---
    "qwen3-coder": FamilyProfile(8, 10, True,  False, 1_000_000, 0),
    "qwen3.6":     FamilyProfile(8, 8, True,  True,  131_072, 0),
    "qwen3.5":     FamilyProfile(8, 8, True,  False, 131_072, 0),
    "qwen3-next":  FamilyProfile(8, 8, True,  False, 262_144, 0),
    "qwen3-vl":    FamilyProfile(7, 7, True,  True,  131_072, 0),
    "qwen3":       FamilyProfile(7, 7, True,  False, 131_072, 0),
    "qwen2.5-coder": FamilyProfile(6, 9, False, False, 131_072, 0),
    "qwen2.5":     FamilyProfile(7, 7, False, False, 131_072, 0),
    "qwen2-vl":    FamilyProfile(6, 6, False, True,  32_768,  0),
    "qwen2":       FamilyProfile(6, 6, False, False, 131_072, 0),
    "qwen-vl":     FamilyProfile(5, 5, False, True,  32_768,  0),
    "qwq":         FamilyProfile(7, 7, True,  False, 131_072, -1),
    "qwen":        FamilyProfile(5, 5, False, False, 32_768,  0),

    # --- Mistral ---
    "mistral-large":  FamilyProfile(8, 8, False, True,  256_000, 0),
    "mistral-medium": FamilyProfile(7, 7, False, True,  256_000, 0),
    "mistral-small":  FamilyProfile(6, 6, False, True,  256_000, 0),
    "mistral-nemo":   FamilyProfile(6, 6, False, False, 131_072, 0),
    "magistral":      FamilyProfile(8, 8, True,  False, 40_960,  -1),
    "pixtral-large":  FamilyProfile(8, 7, False, True,  131_072, 0),
    "pixtral":        FamilyProfile(6, 6, False, True,  131_072, 0),
    "codestral":      FamilyProfile(6, 9, False, False, 256_000, 0),
    "mixtral":        FamilyProfile(6, 6, False, False, 32_768,  -1),
    "mistral":        FamilyProfile(5, 5, False, False, 32_768,  0),

    # --- DeepSeek ---
    "deepseek-v4":       FamilyProfile(9, 9, False, False, 1_000_000, 0),
    "deepseek-r1":       FamilyProfile(9, 9, True,  False, 65_536,  -2),
    "deepseek-v3":       FamilyProfile(8, 8, False, False, 131_072, 0),
    "deepseek-v2.5":     FamilyProfile(7, 8, False, False, 65_536,  0),
    "deepseek-coder":    FamilyProfile(6, 8, False, False, 16_384,  0),
    "deepseek":          FamilyProfile(6, 6, False, False, 65_536,  0),

    # --- Microsoft Phi ---
    "phi-4":       FamilyProfile(6, 7, True,  False, 16_384,  +1),
    "phi-3.5":     FamilyProfile(5, 6, False, True,  131_072, +1),
    "phi-3":       FamilyProfile(5, 6, False, False, 131_072, +1),
    "phi-2":       FamilyProfile(4, 5, False, False, 2_048,   +1),
    "phi":         FamilyProfile(3, 4, False, False, 2_048,   +1),

    # --- Cohere Command / Aya / North ---
    "command-a-plus":  FamilyProfile(9, 8, False, True,  128_000, 0),
    "command-a":       FamilyProfile(8, 7, False, False, 256_000, 0),
    "command-r-plus":  FamilyProfile(8, 7, False, False, 131_072, 0),
    "command-r7b":     FamilyProfile(5, 5, False, False, 131_072, 0),
    "command-r":       FamilyProfile(6, 6, False, False, 131_072, 0),
    "command":         FamilyProfile(5, 5, False, False, 4_096,   0),
    "aya-expanse":     FamilyProfile(6, 5, False, False, 131_072, 0),
    "aya-vision":      FamilyProfile(6, 5, False, True,  16_384,  0),
    "aya":             FamilyProfile(5, 5, False, False, 8_192,   0),
    "north":           FamilyProfile(7, 8, False, False, 256_000, 0),

    # --- Yi ---
    "yi-1.5":      FamilyProfile(6, 6, False, False, 32_768, 0),
    "yi-large":    FamilyProfile(7, 7, False, False, 32_768, 0),
    "yi-coder":    FamilyProfile(5, 8, False, False, 131_072, 0),
    "yi":          FamilyProfile(5, 5, False, False, 4_096,   0),

    # --- Nous Research ---
    "nous-hermes-2": FamilyProfile(6, 6, False, False, 32_768, 0),
    "hermes-3":      FamilyProfile(7, 7, False, False, 131_072, 0),

    # --- Vision-specific ---
    "llava":       FamilyProfile(4, 3, False, True, 4_096,  0),
    "moondream":   FamilyProfile(3, 2, False, True, 2_048,  +1),
    "internvl":    FamilyProfile(6, 5, False, True, 32_768, 0),

    # --- RWKV / Mamba ---
    "rwkv":        FamilyProfile(4, 4, False, False, 8_192,   +2),
    "mamba":       FamilyProfile(4, 4, False, False, 8_192,   +2),

    # --- Databricks ---
    "dbrx":        FamilyProfile(7, 7, False, False, 32_768, -1),

    # --- xAI Grok ---
    "grok-3":      FamilyProfile(9, 8, True,  False, 131_072, 0),
    "grok-2":      FamilyProfile(8, 7, False, False, 131_072, 0),
    "grok":        FamilyProfile(7, 6, False, False, 8_192,   0),

    # --- StarCoder ---
    "starcoder2":  FamilyProfile(3, 8, False, False, 16_384, 0),
    "starcoder":   FamilyProfile(3, 7, False, False, 8_192,  0),

    # --- Anthropic Claude (on OpenRouter) ---
    "claude-opus-4":     FamilyProfile(10, 10, True,  True, 200_000, -1),
    "claude-sonnet-4":   FamilyProfile(9,  9,  True,  True, 200_000, 0),
    "claude-3.5-sonnet": FamilyProfile(9,  9,  False, True, 200_000, 0),
    "claude-3-5-sonnet": FamilyProfile(9,  9,  False, True, 200_000, 0),
    "claude-3-opus":     FamilyProfile(9,  8,  False, True, 200_000, -1),
    "claude-3-sonnet":   FamilyProfile(8,  8,  False, True, 200_000, 0),
    "claude-3-haiku":    FamilyProfile(6,  6,  False, True, 200_000, +1),
    "claude":            FamilyProfile(7,  7,  False, True, 200_000, 0),

    # --- OpenAI (on OpenRouter) ---
    "gpt-4.1":    FamilyProfile(9,  9,  False, True,  1_000_000, 0),
    "gpt-4o":     FamilyProfile(9,  9,  False, True,  128_000, 0),
    "gpt-4-turbo": FamilyProfile(9, 9,  False, True,  128_000, 0),
    "gpt-4":      FamilyProfile(8,  8,  False, False, 8_192,   -1),
    "gpt-3.5":    FamilyProfile(6,  6,  False, False, 16_385,  +1),
    "o4-mini":    FamilyProfile(9,  9,  True,  True,  200_000, 0),
    "o3-mini":    FamilyProfile(8,  8,  True,  False, 200_000, 0),
    "o3":         FamilyProfile(10, 10, True,  True,  200_000, -2),
    "o1-mini":    FamilyProfile(7,  7,  True,  False, 128_000, 0),
    "o1":         FamilyProfile(9,  9,  True,  False, 200_000, -2),

    # --- Perplexity ---
    "sonar":      FamilyProfile(7, 6, False, False, 131_072, 0),

    # --- NVIDIA Nemotron ---
    "nemotron-3": FamilyProfile(9, 9, False, False, 1_000_000, 0),
    "nemotron":   FamilyProfile(7, 7, False, False, 131_072, 0),

    # --- Dolphin ---
    "dolphin":    FamilyProfile(5, 5, False, False, 16_384, 0),

    # --- WizardLM ---
    "wizardlm":   FamilyProfile(6, 7, False, False, 16_384, 0),

    # --- Openchat ---
    "openchat":   FamilyProfile(5, 5, False, False, 8_192, 0),

    # --- Zephyr ---
    "zephyr":     FamilyProfile(5, 5, False, False, 32_768, 0),

    # --- Solar ---
    "solar":      FamilyProfile(5, 5, False, False, 4_096, 0),

    # --- OpenAI GPT-5+ ---
    "gpt-5.5":    FamilyProfile(10, 10, True,  True, 1_000_000, 0),
    "gpt-5.4":    FamilyProfile(10, 10, True,  True, 1_000_000, 0),
    "gpt-5.3":    FamilyProfile(10, 10, True,  True, 1_000_000, 0),
    "gpt-5.2":    FamilyProfile(10, 10, True,  True, 1_000_000, 0),
    "gpt-5.1":    FamilyProfile(10, 10, True,  True, 1_000_000, 0),
    "gpt-5":      FamilyProfile(10, 10, True,  True, 1_000_000, 0),
    "gpt-oss":    FamilyProfile(7, 7, False, False, 128_000, 0),
    "gpt-audio":  FamilyProfile(8, 7, False, False, 128_000, 0),
    "gpt-chat":   FamilyProfile(9, 9, False, True,  128_000, 0),
    "gpt-latest":  FamilyProfile(9, 9, False, True, 128_000, 0),
    "gpt-mini":   FamilyProfile(8, 8, False, True,  128_000, +1),

    # --- GLM (Zhipu) ---
    "glm-5.1":    FamilyProfile(8, 8, True,  False, 131_072, 0),
    "glm-5":      FamilyProfile(8, 8, True,  False, 131_072, 0),
    "glm-4.7":    FamilyProfile(7, 7, False, False, 131_072, 0),
    "glm-4.6":    FamilyProfile(7, 7, False, True,  131_072, 0),
    "glm-4.5v":   FamilyProfile(7, 7, False, True,  131_072, 0),
    "glm-4.5":    FamilyProfile(7, 7, False, False, 131_072, 0),
    "glm":        FamilyProfile(6, 6, False, False, 131_072, 0),

    # --- Amazon Nova ---
    "nova-premier": FamilyProfile(8, 8, True,  True,  1_000_000, 0),
    "nova-pro":     FamilyProfile(7, 7, False, True,  300_000, 0),
    "nova-lite":    FamilyProfile(6, 6, False, True,  300_000, +1),
    "nova-micro":   FamilyProfile(5, 5, False, False, 128_000, +2),
    "nova-2-lite":  FamilyProfile(6, 6, False, True,  300_000, +1),
    "nova":         FamilyProfile(6, 6, False, False, 128_000, 0),

    # --- MiniMax ---
    "minimax-m3":   FamilyProfile(8, 7, False, False, 1_000_000, 0),
    "minimax-m2.7": FamilyProfile(8, 7, False, False, 1_000_000, 0),
    "minimax-m2.5": FamilyProfile(7, 7, False, False, 1_000_000, 0),
    "minimax-m2.1": FamilyProfile(7, 7, False, False, 1_000_000, 0),
    "minimax-m2":   FamilyProfile(7, 6, False, False, 1_000_000, 0),
    "minimax-m1":   FamilyProfile(7, 6, True,  False, 1_000_000, -1),
    "minimax-01":   FamilyProfile(7, 6, True,  False, 1_000_000, -1),
    "minimax":      FamilyProfile(6, 5, False, False, 256_000, 0),

    # --- Moonshot Kimi ---
    "kimi-k2.7":   FamilyProfile(9, 9, True,  False, 131_072, 0),
    "kimi-k2.6":   FamilyProfile(8, 8, True,  False, 131_072, 0),
    "kimi-k2.5":   FamilyProfile(8, 8, True,  False, 131_072, 0),
    "kimi-k2":     FamilyProfile(8, 8, True,  False, 131_072, 0),
    "kimi":        FamilyProfile(7, 7, False, False, 131_072, 0),

    # --- Step (StepFun) ---
    "step-3.7":    FamilyProfile(7, 7, False, False, 131_072, 0),
    "step-3.5":    FamilyProfile(7, 7, False, False, 131_072, 0),
    "step":        FamilyProfile(6, 6, False, False, 32_768, 0),

    # --- Ministral (Mistral sub-family) ---
    "ministral":   FamilyProfile(5, 5, False, False, 131_072, +1),

    # --- Devstral ---
    "devstral":    FamilyProfile(6, 9, False, False, 131_072, 0),

    # --- Reka ---
    "reka-flash":  FamilyProfile(6, 6, False, True,  131_072, +1),
    "reka-edge":   FamilyProfile(5, 5, False, False, 131_072, +1),
    "reka":        FamilyProfile(6, 6, False, True,  131_072, 0),

    # --- IBM Granite ---
    "granite-4.1": FamilyProfile(6, 7, False, False, 131_072, 0),
    "granite-4.0": FamilyProfile(6, 7, False, False, 131_072, 0),
    "granite":     FamilyProfile(5, 6, False, False, 32_768, 0),

    # --- Inflection ---
    "inflection-3": FamilyProfile(7, 6, False, False, 32_768, 0),
    "inflection":   FamilyProfile(6, 5, False, False, 8_192, 0),

    # --- Jamba (AI21) ---
    "jamba":       FamilyProfile(7, 6, False, False, 256_000, 0),

    # --- ByteDance Seed ---
    "seed-2.0":    FamilyProfile(7, 7, False, False, 131_072, 0),
    "seed-1.6":    FamilyProfile(6, 6, False, False, 131_072, 0),
    "seed":        FamilyProfile(6, 6, False, False, 131_072, 0),

    # --- Tencent Hunyuan ---
    "hunyuan":     FamilyProfile(7, 7, False, False, 131_072, 0),

    # --- ByteDance Ling ---
    "ling-2.6":    FamilyProfile(7, 7, False, False, 131_072, 0),
    "ling":        FamilyProfile(6, 6, False, False, 32_768, 0),

    # --- MIMO (Xiaomi) ---
    "mimo-v2.5":   FamilyProfile(7, 7, False, True,  131_072, 0),
    "mimo-v2":     FamilyProfile(6, 6, False, True,  131_072, 0),
    "mimo":        FamilyProfile(5, 5, False, True,  32_768, 0),

    # --- Palmyra (Writer) ---
    "palmyra":     FamilyProfile(7, 6, False, False, 131_072, 0),

    # --- Mercury (Inception) ---
    "mercury":     FamilyProfile(7, 7, False, False, 131_072, +1),

    # --- ERNIE (Baidu) ---
    "ernie-4.5":   FamilyProfile(8, 7, False, True,  131_072, 0),
    "ernie":       FamilyProfile(7, 6, False, False, 32_768, 0),

    # --- Cogito ---
    "cogito":      FamilyProfile(8, 8, True,  False, 131_072, 0),

    # --- Creative/RP models ---
    "mythomax":    FamilyProfile(5, 4, False, False, 4_096, 0),
    "euryale":     FamilyProfile(5, 4, False, False, 131_072, 0),
    "rocinante":   FamilyProfile(5, 4, False, False, 131_072, 0),
    "magnum":      FamilyProfile(6, 5, False, False, 131_072, 0),
    "unslopnemo":  FamilyProfile(5, 4, False, False, 131_072, 0),
    "lunaris":     FamilyProfile(5, 4, False, False, 131_072, 0),
    "hanami":      FamilyProfile(5, 4, False, False, 131_072, 0),

    # --- Aion ---
    "aion":        FamilyProfile(7, 7, False, False, 131_072, 0),

    # --- LFM (Liquid) ---
    "lfm":         FamilyProfile(5, 5, False, False, 32_768, +1),

    # --- Voxtral (Mistral voice) ---
    "voxtral":     FamilyProfile(6, 5, False, False, 32_768, 0),

    # --- Allam ---
    "allam":       FamilyProfile(5, 5, False, False, 32_768, 0),

    # --- Intellect ---
    "intellect":   FamilyProfile(6, 6, False, False, 131_072, 0),

    # --- Morph ---
    "morph":       FamilyProfile(6, 6, False, False, 131_072, 0),

    # --- OLMo (AllenAI) ---
    "olmo":        FamilyProfile(6, 6, True,  False, 131_072, 0),

    # --- Poolside Laguna ---
    "laguna":      FamilyProfile(7, 8, False, False, 262_144, 0),

    # --- Nex-AGI ---
    "nex":         FamilyProfile(7, 7, False, True,  262_144, 0),

    # --- OpenRouter OWL ---
    "owl":         FamilyProfile(7, 7, False, False, 1_000_000, 0),

    # --- Big-Pickle (OpenCode Zen) ---
    "big-pickle":  FamilyProfile(7, 7, False, False, 131_072, 0),
}

_SORTED_KEYS = sorted(MODEL_FAMILIES.keys(), key=len, reverse=True)

_SIZE_PATTERN = re.compile(r"(\d+)x(\d+(?:\.\d+)?)([bm])", re.IGNORECASE)
_SIZE_FALLBACK = re.compile(r"(\d+(?:\.\d+)?)\s*([bBmM])\b")

_SIZE_HINTS = {
    "mini": 3.8,
    "tiny": 1.1,
    "nano": 0.5,
    "small": 3.0,
}

_DEFAULT_PROFILE = FamilyProfile(
    knowledge_base=5, coding_base=5, reasoning_capable=False,
    vision_capable=False, context_window_default=8_192, speed_modifier=0,
)


def extract_param_billions(model_id: str) -> float | None:
    mid = model_id.lower()
    moe = _SIZE_PATTERN.search(mid)
    if moe:
        experts = int(moe.group(1))
        per = float(moe.group(2))
        total = experts * per
        if moe.group(3).lower() == "m":
            total /= 1000
        return total

    match = _SIZE_FALLBACK.search(mid)
    if match:
        size = float(match.group(1))
        if match.group(2).lower() == "m":
            size /= 1000
        return size

    for hint, size in _SIZE_HINTS.items():
        if hint in mid:
            return size
    return None


def extract_family(model_id: str) -> str | None:
    mid = model_id.lower()
    if "/" in mid:
        mid = mid.rsplit("/", 1)[1]
    if mid.startswith("models-"):
        mid = mid[7:]
    for key in _SORTED_KEYS:
        if mid.startswith(key) or f"-{key}" in mid:
            return key
    return None


def classify_model(model_id: str, provider_name: str | None = None) -> dict:
    family_key = extract_family(model_id)
    param_b = extract_param_billions(model_id)
    mid = model_id.lower()
    fp = MODEL_FAMILIES.get(family_key, _DEFAULT_PROFILE) if family_key else _DEFAULT_PROFILE

    # Knowledge: adjust by param count
    knowledge = fp.knowledge_base
    if param_b is not None:
        if param_b < 3:
            knowledge = max(1, knowledge - 3)
        elif param_b < 9:
            knowledge = max(2, knowledge - 1)
        elif param_b >= 100:
            knowledge = min(10, knowledge + 1)

    # Speed: derive from param count + family modifier
    if param_b is not None:
        if param_b < 3:
            speed = 9
        elif param_b < 9:
            speed = 8
        elif param_b < 35:
            speed = 6
        elif param_b < 80:
            speed = 5
        elif param_b < 200:
            speed = 4
        else:
            speed = 2
    else:
        speed = 5

    speed = max(1, min(10, speed + fp.speed_modifier))

    # Provider speed bonuses
    pname = (provider_name or "").lower()
    if "groq" in pname:
        speed = min(10, speed + 2)
    elif "cerebras" in pname:
        speed = min(10, speed + 2)

    # Flash/pro modifiers for Gemini-style models
    if "flash" in mid:
        speed = min(10, speed + 3)
        knowledge = max(1, knowledge - 1)
    elif "pro" in mid and family_key and family_key.startswith("gemini"):
        speed = max(1, speed - 1)
        knowledge = min(10, knowledge + 1)

    # Coding
    coding = fp.coding_base
    if any(x in mid for x in ("coder", "code-", "-code", "codestral", "starcoder")):
        coding = max(coding, 8)

    # Vision
    vision = fp.vision_capable
    if any(x in mid for x in ("vision", "-vl", "vl-", "visual", "llava", "pixtral", "image", "-omni")):
        vision = True

    # Reasoning
    reasoning = fp.reasoning_capable
    if any(x in mid for x in ("thinking", "reasoning", "-r1", "qwq")):
        reasoning = True
    if reasoning and fp.speed_modifier >= 0:
        speed = max(1, speed - 1)

    # Context window from ID markers
    context_window = fp.context_window_default
    for marker, value in [
        ("1m", 1_000_000), ("1000k", 1_000_000),
        ("200k", 200_000), ("128k", 128_000),
        ("65k", 65_536), ("32k", 32_768),
        ("16k", 16_384), ("8k", 8_192),
        ("4k", 4_096), ("2k", 2_048),
    ]:
        if marker in mid:
            context_window = value
            break

    return {
        "knowledge_score": max(1, min(10, knowledge)),
        "coding_score": max(1, min(10, coding)),
        "speed_score": max(1, min(10, speed)),
        "context_window": context_window,
        "vision_support": vision,
        "reasoning_support": reasoning,
        "model_family": family_key,
        "param_billions": param_b,
    }
