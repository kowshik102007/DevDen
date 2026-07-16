import ssl
import os
import httpx
from huggingface_hub import set_client_factory, set_async_client_factory

ssl._create_default_https_context = ssl._create_unverified_context
os.environ["HF_HUB_DISABLE_SSL_VERIFY"] = "1"
os.environ["HF_HUB_DISABLE_SSL_VERIFICATION"] = "1"
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""

# Bypass SSL in huggingface_hub httpx clients
def insecure_client_factory():
    return httpx.Client(verify=False)

def insecure_async_client_factory():
    return httpx.AsyncClient(verify=False)

set_client_factory(insecure_client_factory)
set_async_client_factory(insecure_async_client_factory)

import torch
from config.settings import MODEL_NAME
from inference.baseline import generate_baseline
from inference.kv_cache import generate_kv_cache
from inference.quantized import generate_quantized
from inference.speculative import generate_speculative
from inference.gemini_api import retrieve_factual_context

print("Device:", "cuda" if torch.cuda.is_available() else "cpu")
print(f"Testing with model: {MODEL_NAME}...")

# Use a longer query to show benefits of KV cache vs baseline
prompt = "Can you explain how gravity works in general relativity and how it differs from Newtonian physics?"
print(f"\nPrompt: '{prompt}'")

strategies = {
    "baseline": generate_baseline,
    "kv_cache": generate_kv_cache,
    "quantized": generate_quantized,
    "speculative": generate_speculative
}

for name, gen_func in strategies.items():
    print(f"\nRunning {name} strategy...")
    try:
        answer, latency = gen_func(prompt)
        print(f"[{name}] Latency: {latency:.2f}ms")
        print(f"[{name}] Answer length: {len(answer)} chars")
        print(f"[{name}] Snippet: '{answer[:100]}...'")
    except Exception as e:
        print(f"[{name}] Error: {e}")

# Add a test block for Gemini factual context retrieval
print("\nTesting Gemini Factual Context Retrieval (RAG)...")
test_factual_prompt = "Who is the current Prime Minister of India?"
try:
    facts, facts_latency = retrieve_factual_context(test_factual_prompt)
    print(f"[Gemini RAG] Latency: {facts_latency:.2f}ms")
    print(f"[Gemini RAG] Retrieved Facts:\n{facts}")
except Exception as e:
    print(f"[Gemini RAG] Error: {e}")

