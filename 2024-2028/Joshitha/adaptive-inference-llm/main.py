# CLI version of Adaptive AI Study Assistant

from controller.strategy_selector import choose_strategy, is_factual_query
from inference.baseline import generate_baseline
from inference.kv_cache import generate_kv_cache
from inference.quantized import generate_quantized
from inference.speculative import generate_speculative
from inference.gemini_api import retrieve_factual_context
from config.settings import GEMINI_API_KEY
from utils.text_formatter import format_response


def run_cli():
    print("\n[Adaptive AI Study Assistant - CLI Mode]")
    print("Type 'exit' to quit\n")

    while True:
        user_input = input("You: ")

        if user_input.lower() == "exit":
            print("Goodbye!")
            break

        # Check if factual context is needed (RAG)
        has_api_key = len(GEMINI_API_KEY.strip()) > 0
        factual_augmented = False
        factual_context = ""
        
        if has_api_key and is_factual_query(user_input):
            print("🔍 Retrieving factual context...")
            factual_context, _ = retrieve_factual_context(user_input)
            if not factual_context.startswith("Error"):
                factual_augmented = True
                print("✅ Factual context loaded successfully.")
            else:
                print("⚠️ Factual context retrieval failed. Proceeding in offline mode...")
                factual_context = ""

        # Choose local strategy
        strategy = choose_strategy(user_input)
        strategy_display = f"{strategy} (Factual Augmented)" if factual_augmented else strategy

        # Augment prompt if needed
        augmented_prompt = user_input
        if factual_augmented:
            augmented_prompt = f"""Use the following verified facts to answer the student's question accurately:
Facts:
{factual_context}

Question: {user_input}
Answer:"""

        # Run inference
        if strategy == "baseline":
            answer, latency = generate_baseline(augmented_prompt)

        elif strategy == "kv_cache":
            answer, latency = generate_kv_cache(augmented_prompt)

        elif strategy == "quantized":
            answer, latency = generate_quantized(augmented_prompt)

        else:
            answer, latency = generate_speculative(augmented_prompt)

        # Format response
        answer = format_response(answer)

        # Output
        print("\nAssistant:")
        print(answer)

        print(f"\n- Strategy: {strategy_display}")
        print(f"- Latency: {latency:.2f} ms\n")



if __name__ == "__main__":
    run_cli()