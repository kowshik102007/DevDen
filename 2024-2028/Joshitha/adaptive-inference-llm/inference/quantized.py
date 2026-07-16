import time
import torch

from inference.loader import get_quant_model, tokenizer, device
from prompts.system_prompt import SYSTEM_PROMPT


def generate_quantized(user_input, max_new_tokens=200):
    """
    Generation using quantized model (memory optimized)
    """

    # Load model lazily
    model = get_quant_model()

    # Safety check
    if model is None:
        return "Quantized model not available.", 0

    # Use professional chat template
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_input},
    ]
    full_prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    inputs = tokenizer(
        full_prompt,
        return_tensors="pt"
    ).to(device)

    start_time = time.time()

    # Use inference_mode for faster CPU performance
    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            use_cache=True,
            do_sample=True,
            top_p=0.9,
            top_k=50,
            temperature=0.8,
            repetition_penalty=1.1
        )

    end_time = time.time()

    # Extract only new tokens
    new_tokens = outputs[0][len(inputs["input_ids"][0]):]
    answer = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    latency = (end_time - start_time) * 1000

    return answer, latency