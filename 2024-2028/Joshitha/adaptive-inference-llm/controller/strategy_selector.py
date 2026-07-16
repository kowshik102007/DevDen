def is_factual_query(user_input):
    """
    Detect if the user query requires current, real-time, or factual information
    """
    user_input_lower = user_input.lower()
    factual_triggers = [
        "current", "latest", "present", "now", "today", "recent",
        "who is the", "who is", "who was", "president", "prime minister", 
        "news", "ceo", "population of", "capital of", "weather in", 
        "stock price", "winner of", "won the", "minister of"
    ]
    return any(trigger in user_input_lower for trigger in factual_triggers)


def choose_strategy(user_input, memory_limit=800):
    """
    Select best local inference strategy based on input characteristics
    """
    prompt_length = len(user_input)

    # 🔥 Rule 1: Long queries → KV Cache
    if prompt_length > 150:
        return "kv_cache"

    # 🔥 Rule 2: Medium queries → Speculative (fast)
    elif 50 < prompt_length <= 150:
        return "speculative"

    # 🔥 Rule 3: Very low memory → Quantized
    elif memory_limit < 400:
        return "quantized"

    # 🔥 Rule 4: Short/simple queries → Baseline
    else:
        return "baseline"