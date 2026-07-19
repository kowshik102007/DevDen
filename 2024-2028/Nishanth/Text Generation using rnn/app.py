from flask import Flask, request, jsonify, render_template_string, send_from_directory
from flask_cors import CORS
import tensorflow as tf 
import pickle
import os 
from tensorflow.keras.preprocessing.sequence import pad_sequences #type: ignore
import numpy as np 


# Configuration
MODEL_PATH = "model.keras"
TOKENIZER_PATH = "tokenizer.pkl"
MAX_SEQUENCE_LEN = 17 

# Load model
print("Loading model...")
try:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    model = tf.keras.models.load_model(MODEL_PATH)
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    raise

# Load tokenizer
print("Loading tokenizer...")
try:
    if not os.path.exists(TOKENIZER_PATH):
        raise FileNotFoundError(f"Tokenizer file not found: {TOKENIZER_PATH}")
    with open(TOKENIZER_PATH, "rb") as f:
        tokenizer = pickle.load(f)
    print("Tokenizer loaded successfully")
    
    # Validate tokenizer
    if not hasattr(tokenizer, 'word_index') or not tokenizer.word_index:
        raise ValueError("Tokenizer has no word_index or it's empty!")
    
    print(f"Tokenizer vocabulary size: {len(tokenizer.word_index)}")
    print(f"Sample words: {list(tokenizer.word_index.keys())[:10]}")
    
except Exception as e:
    print(f"Error loading tokenizer: {e}")
    raise

# Flask App
app = Flask(__name__, static_folder='frontend', static_url_path='/static')
CORS(app)

def get_known_words_from_input(text):
    """Filter input to only include words the tokenizer knows"""
    if not tokenizer.word_index:
        return [], text.lower().split()
    
    words = text.lower().split()
    known_words = []
    unknown_words = []
    
    for word in words:
        if word in tokenizer.word_index:
            known_words.append(word)
        else:
            unknown_words.append(word)
    
    return known_words, unknown_words

def suggest_similar_words(word, limit=5):
    """Suggest words from vocabulary that are similar to the unknown word"""
    if not tokenizer.word_index:
        return []
    
    suggestions = []
    word_lower = word.lower()
    
    # Look for words that contain the input word or vice versa
    for vocab_word in tokenizer.word_index.keys():
        if word_lower in vocab_word or vocab_word in word_lower:
            suggestions.append(vocab_word)
        if len(suggestions) >= limit:
            break
    
    return suggestions

def get_fallback_seed():
    """Get a fallback seed word from the vocabulary"""
    if not tokenizer.word_index:
        return "the"  # Basic fallback
    
    # Try common starter words
    common_starters = ['the', 'india', 'new', 'government', 'minister', 'people', 'state', 'country', 'said', 'will', 'police', 'court']
    
    for starter in common_starters:
        if starter in tokenizer.word_index:
            return starter
    
    # If no common starters, use the first word in vocabulary
    if tokenizer.word_index:
        return list(tokenizer.word_index.keys())[0]
    
    return "the"

def generate_text(seed_text, next_words=30):
    """Generate text based on seed_text using the trained RNN model."""
    print(f"\n🎯 === STARTING TEXT GENERATION ===")
    print(f"Seed text: '{seed_text}'")
    print(f"Next words to generate: {next_words}")
    print(f"Max sequence length: {MAX_SEQUENCE_LEN}")
    
    # Validate tokenizer
    if not tokenizer.word_index:
        print("❌ CRITICAL ERROR: Tokenizer has no vocabulary!")
        return f"Error: Tokenizer vocabulary is empty. Original input: {seed_text}"
    
    # Check which words are known by the tokenizer
    known_words, unknown_words = get_known_words_from_input(seed_text)
    print(f"Known words: {known_words}")
    print(f"Unknown words: {unknown_words}")
    
    if unknown_words:
        print(f"❌ WARNING: Unknown words detected: {unknown_words}")
        for word in unknown_words:
            suggestions = suggest_similar_words(word)
            if suggestions:
                print(f"  Suggestions for '{word}': {suggestions[:3]}")
    
    # If no known words, try to use a default starter
    if not known_words:
        fallback_seed = get_fallback_seed()
        seed_text = fallback_seed
        print(f"🔄 Using fallback starter word: '{seed_text}'")
    else:
        # Use only the known words
        seed_text = " ".join(known_words)
        print(f"🔄 Using known words only: '{seed_text}'")
    
    original_seed = seed_text
    generated_words = []
    
    for i in range(next_words):
        print(f"\n--- Iteration {i+1}/{next_words} ---")
        print(f"Current seed: '{seed_text}'")
        
        # Step 1: Tokenize current seed text
        try:
            token_list = tokenizer.texts_to_sequences([seed_text])[0]
            print(f"Token list: {token_list}")
            print(f"Token list length: {len(token_list)}")
        except Exception as e:
            print(f"❌ ERROR in tokenization: {e}")
            break
        
        if not token_list:
            print("❌ ERROR: Empty token list even after processing!")
            # Try with just the last word
            last_word = seed_text.split()[-1] if seed_text.split() else get_fallback_seed()
            print(f"🔄 Trying with last word only: '{last_word}'")
            try:
                token_list = tokenizer.texts_to_sequences([last_word])[0]
                if not token_list:
                    print("❌ Even single word failed, stopping generation")
                    break
            except:
                print("❌ Single word tokenization failed, stopping generation")
                break
        
        # Step 2: Pad the sequence
        try:
            padded = pad_sequences([token_list], maxlen=MAX_SEQUENCE_LEN-1, padding='pre')
            print(f"Padded sequence: {padded[0]}")
            print(f"Padded shape: {padded.shape}")
        except Exception as e:
            print(f"❌ ERROR in padding: {e}")
            break
        
        # Step 3: Get model prediction
        try:
            predicted = model.predict(padded, verbose=0)
            print(f"Prediction shape: {predicted.shape}")
            
            # Get top 5 predictions for analysis
            top_5_indices = np.argsort(predicted[0])[-5:][::-1]
            print("Top 5 predictions:")
            for idx in top_5_indices:
                word = tokenizer.index_word.get(idx, f"<UNK:{idx}>")
                confidence = predicted[0][idx]
                print(f"  {idx}: '{word}' (confidence: {confidence:.4f})")
            
            predicted_index = np.argmax(predicted, axis=-1)[0]
            print(f"🎯 Selected index: {predicted_index}")
            print(f"🎯 Selection confidence: {predicted[0][predicted_index]:.4f}")
            
        except Exception as e:
            print(f"❌ ERROR in model prediction: {e}")
            break
        
        # Step 4: Find the word for this index
        output_word = tokenizer.index_word.get(predicted_index, "")
        print(f"🔤 Found word: '{output_word}'")
        
        if not output_word or predicted_index == 0:  # 0 is usually padding/unknown
            print("❌ No valid word found, trying alternatives...")
            # Try the next best predictions
            sorted_indices = np.argsort(predicted[0])[::-1]
            for alt_idx in sorted_indices[1:6]:
                alt_word = tokenizer.index_word.get(alt_idx, "")
                if alt_word and alt_idx != 0:
                    output_word = alt_word
                    predicted_index = alt_idx
                    print(f"✅ Using alternative: '{output_word}' (index: {alt_idx})")
                    break
            
            if not output_word:
                print("❌ No valid alternatives found, stopping generation")
                break
        
        # Step 5: Add word to seed
        generated_words.append(output_word)
        seed_text += " " + output_word
        print(f"📝 Updated seed: '{seed_text}'")
        
        # Stop if we hit a natural ending
        if output_word in ['.', '!', '?'] or len(seed_text) > 200:
            print(f"🛑 Natural stopping point reached")
            break
    
    print(f"\n🎉 === GENERATION COMPLETE ===")
    print(f"Original: '{original_seed}'")
    print(f"Generated words: {generated_words}")
    print(f"Final: '{seed_text}'")
    print(f"Total length: {len(seed_text.split())} words")
    
    return seed_text.title()

@app.route("/")
def index():
    """Serve the main HTML file"""
    return send_from_directory('frontend', 'index.html')

@app.route("/api/generate", methods=["POST"])
def generate():
    """API endpoint to generate text stories."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        # Support both 'seed' and 'seed_text' parameters for flexibility
        seed = data.get("seed_text", data.get("seed", "")).strip().lower()
        next_words = data.get("next_words", 10)
        
        if not seed:
            return jsonify({"error": "Seed text is required"}), 400
        
        print(f"\n🚀 API CALL: Generating story from seed: '{seed}' with {next_words} words")
        story = generate_text(seed, next_words=next_words)
        print(f"🎯 API RESPONSE: '{story}'")
        
        return jsonify({"story": story})
        
    except Exception as e:
        print(f"❌ ERROR in generate endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal server error during text generation"}), 500

@app.route("/api/vocabulary", methods=["GET"])
def vocabulary():
    """Get sample vocabulary words"""
    try:
        # Get first 50 words from vocabulary
        sample_words = list(tokenizer.word_index.keys())[:50]
        return jsonify({
            "total_words": len(tokenizer.word_index),
            "sample_words": sample_words,
            "common_starters": [word for word in ['the', 'india', 'new', 'government', 'minister', 'people', 'state', 'country'] if word in tokenizer.word_index]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "tokenizer_loaded": tokenizer is not None,
        "vocab_size": len(tokenizer.word_index) + 1,
        "max_sequence_length": MAX_SEQUENCE_LEN
    })

@app.route("/api/debug", methods=["POST"])
def debug():
    """Debug endpoint to test tokenization"""
    try:
        data = request.get_json()
        text = data.get("text", "").lower()
        
        # Test tokenization
        tokens = tokenizer.texts_to_sequences([text])[0]
        
        # Check individual words
        words = text.split()
        word_analysis = []
        for word in words:
            in_vocab = word in tokenizer.word_index
            token = tokenizer.word_index.get(word, None)
            suggestions = suggest_similar_words(word) if not in_vocab else []
            word_analysis.append({
                "word": word,
                "in_vocabulary": in_vocab,
                "token": token,
                "suggestions": suggestions[:3]
            })
        
        return jsonify({
            "input_text": text,
            "tokens": tokens,
            "word_analysis": word_analysis,
            "vocab_size": len(tokenizer.word_index),
            "max_token_index": max(tokenizer.word_index.values()) if tokenizer.word_index else 0
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    vocab_size = len(tokenizer.word_index) + 1
    print(f"Model vocabulary size: {vocab_size}")
    print(f"Max sequence length: {MAX_SEQUENCE_LEN}")
    print(f"Model input shape: {model.input_shape}")
    print(f"Model output shape: {model.output_shape}")
    
    # Show some sample vocabulary
    print("\n=== SAMPLE VOCABULARY ===")
    sample_words = list(tokenizer.word_index.keys())[:20]
    print(f"First 20 words in vocabulary: {sample_words}")
    
    print("StoryWeaver API Server Starting...")
    print("Frontend: http://localhost:5000/")
    print("API: http://localhost:5000/api/generate")
    print("Health: http://localhost:5000/api/health")
    print("Debug: http://localhost:5000/api/debug")
    print("Vocabulary: http://localhost:5000/api/vocabulary")
    
    app.run(host="0.0.0.0", port=5000, debug=True)