import time
import torch

from inference.loader import get_base_model, tokenizer, device
from prompts.system_prompt import SYSTEM_PROMPT


def generate_baseline(user_input, max_new_tokens=200):
    """
    Basic text generation without KV cache optimization (use_cache=False)
    """

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

    # Load model lazily
    model = get_base_model()

    # Use inference_mode for faster CPU performance
    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            use_cache=False,
            do_sample=True,
            top_p=0.9,
            top_k=50,
            temperature=0.8,
            repetition_penalty=1.1
        )

    end_time = time.time()

    # Extract only new tokens (standard robust way)
    new_tokens = outputs[0][len(inputs["input_ids"][0]):]
    answer = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    latency = (end_time - start_time) * 1000

    return answer, latency