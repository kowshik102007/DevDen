import streamlit as st
import time
from controller.strategy_selector import choose_strategy, is_factual_query
from utils.text_formatter import format_response
from config.settings import MAX_NEW_TOKENS, GEMINI_API_KEY, GEMINI_MODEL_NAME

# Import inference methods
from inference.baseline import generate_baseline
from inference.kv_cache import generate_kv_cache
from inference.quantized import generate_quantized
from inference.speculative import generate_speculative
from inference.gemini_api import retrieve_factual_context

# -------------------------------
# UI Styling (Rich Aesthetics)
# -------------------------------
st.set_page_config(
    page_title="Adaptive AI Assistant",
    layout="wide",
    initial_sidebar_state="auto"
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap');
    
    * {
        font-family: 'Outfit', sans-serif;
    }
    
    .main {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #f1f5f9;
        padding-top: 2rem;
    }
    
    .stChatMessage {
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        margin-bottom: 1rem;
        backdrop-filter: blur(8px);
        transition: transform 0.2s ease;
    }
    
    .stChatMessage:hover {
        transform: translateY(-2px);
    }
    
    .metric-card {
        background: rgba(15, 23, 42, 0.5);
        border-radius: 10px;
        padding: 10px;
        border-left: 4px solid #38bdf8;
        margin-top: 5px;
    }
    
    h1 {
        background: linear-gradient(90deg, #38bdf8, #818cf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 600;
        font-size: 2.5rem !important;
        text-align: center;
        margin-bottom: 0.5rem !important;
    }
    
    .subtitle {
        text-align: center;
        color: #94a3b8;
        font-size: 1.1rem;
        margin-bottom: 2rem;
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------
# Sidebar / Header
# -------------------------------
with st.sidebar:
    st.header("⚙️ Configuration")
    st.markdown("**Local Inference Strategies:**")
    st.markdown("- **Baseline**: Local model (No cache)")
    st.markdown("- **KV Cache**: Local model (Optimized)")
    st.markdown("- **Quantized**: Local model (Low VRAM)")
    st.markdown("- **Speculative**: Local model (Fast)")

st.markdown("<h1>Adaptive AI Study Assistant</h1>", unsafe_allow_html=True)
st.markdown("<p class='subtitle'>Smart inference strategy selection for lightning-fast learning</p>", unsafe_allow_html=True)

# -------------------------------
# App Logic
# -------------------------------
if "messages" not in st.session_state:
    st.session_state.messages = []

# Show previous messages
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])
        if "meta" in msg:
            st.markdown(f"""
            <div class='metric-card'>
                <small>⚙️ Strategy: <b>{msg['meta']['strategy']}</b> | ⏱️ Latency: <b>{msg['meta']['latency']:.0f}ms</b></small>
            </div>
            """, unsafe_allow_html=True)

# Chat Input
prompt = st.chat_input("Ask a study question (e.g., 'What is gravity?')")

if prompt:
    # Add User Message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.write(prompt)

    # Inference Section
    with st.chat_message("assistant"):
        with st.status("🧠 Selecting strategy and thinking...", expanded=True) as status:
            
            # 1. Perform Factual Context Retrieval (RAG)
            has_api_key = len(GEMINI_API_KEY.strip()) > 0
            is_factual = is_factual_query(prompt)
            factual_augmented = False
            factual_context = ""
            
            if has_api_key and is_factual:
                st.write("🔍 Retrieving factual context...")
                factual_context, _ = retrieve_factual_context(prompt, api_key=GEMINI_API_KEY, model_name=GEMINI_MODEL_NAME)
                if not factual_context.startswith("Error"):
                    factual_augmented = True
                    st.write("✅ Factual context loaded successfully.")
                else:
                    st.write("⚠️ Factual context retrieval failed. Proceeding in offline mode...")
                    factual_context = ""

            # 2. Select Local Strategy
            strategy = choose_strategy(prompt)
            strategy_display = f"{strategy} (Factual Augmented)" if factual_augmented else strategy
            st.write(f"✅ Selected `{strategy}` local strategy.")
            
            # 3. Augment Prompt if needed
            augmented_prompt = prompt
            if factual_augmented:
                augmented_prompt = f"""Use the following verified facts to answer the student's question accurately:
Facts:
{factual_context}

Question: {prompt}
Answer:"""

            # 4. Run Inference
            start_time = time.time()
            if strategy == "baseline":
                answer, _ = generate_baseline(augmented_prompt, max_new_tokens=MAX_NEW_TOKENS)
            elif strategy == "kv_cache":
                answer, _ = generate_kv_cache(augmented_prompt, max_new_tokens=MAX_NEW_TOKENS)
            elif strategy == "quantized":
                answer, _ = generate_quantized(augmented_prompt, max_new_tokens=MAX_NEW_TOKENS)
            else:
                answer, _ = generate_speculative(augmented_prompt, max_new_tokens=MAX_NEW_TOKENS)
            
            latency = (time.time() - start_time) * 1000
            status.update(label="✨ Response Ready!", state="complete", expanded=False)

        # Clean and Show Response
        clean_answer = format_response(answer)
        st.write(clean_answer)
        
        # Metadata
        meta = {"strategy": strategy_display, "latency": latency}
        st.markdown(f"""
        <div class='metric-card'>
            <small>⚙️ Strategy: <b>{strategy_display}</b> | ⏱️ Latency: <b>{latency:.0f}ms</b></small>
        </div>
        """, unsafe_allow_html=True)

        # Save to History
        st.session_state.messages.append({
            "role": "assistant",
            "content": clean_answer,
            "meta": meta
        })