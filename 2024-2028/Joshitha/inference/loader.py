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

import gc
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from config.settings import MODEL_NAME, DRAFT_MODEL_NAME

device = "cuda" if torch.cuda.is_available() else "cpu"

# Load tokenizer
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token

_base_model = None
_quant_model = None
_draft_model = None


def clear_gpu_memory():
    """Flush memory cache and run garbage collection"""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def get_base_model():
    """Lazy load base model and unload quantized model if active"""
    global _base_model, _quant_model
    if _base_model is None:
        if _quant_model is not None:
            print("Unloading quantized model to save memory...")
            _quant_model = None
            clear_gpu_memory()
        print(f"Loading base model: {MODEL_NAME}...")
        _base_model = AutoModelForCausalLM.from_pretrained(MODEL_NAME).to(device)
        _base_model.eval()
    return _base_model


def get_quant_model():
    """Lazy load quantized model and unload base model if active"""
    global _quant_model, _base_model
    if _quant_model is None:
        if _base_model is not None:
            print("Unloading base model to save memory...")
            _base_model = None
            clear_gpu_memory()
        print(f"Loading quantized model: {MODEL_NAME}...")
        try:
            bnb_config = BitsAndBytesConfig(load_in_8bit=True)
            _quant_model = AutoModelForCausalLM.from_pretrained(
                MODEL_NAME,
                quantization_config=bnb_config,
                device_map="auto"
            )
            _quant_model.eval()
        except Exception as e:
            print("Quantized model loading failed:", e)
            _quant_model = None
    return _quant_model


def get_draft_model():
    """Lazy load draft model if different from base model"""
    global _draft_model
    if DRAFT_MODEL_NAME == MODEL_NAME:
        return None
    if _draft_model is None:
        print(f"Loading draft model: {DRAFT_MODEL_NAME}...")
        _draft_model = AutoModelForCausalLM.from_pretrained(DRAFT_MODEL_NAME).to(device)
        _draft_model.eval()
    return _draft_model