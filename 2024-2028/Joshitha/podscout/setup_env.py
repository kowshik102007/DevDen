"""
PodScout Pro - Environment Setup Script

Run this to create your .env file with your credentials.
"""

import os

print("=" * 60)
print("PodScout Pro - Environment Setup")
print("=" * 60)

# Supabase credentials (provided)
SUPABASE_URL = "https://vxoxitherkbtlsbbbxlj.supabase.co"
SUPABASE_KEY = "YOUR_SUPABASE_KEY"
SUPABASE_PASSWORD = "YOUR_SUPABASE_PASSWORD"

# Google OAuth (provided)
GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET = "YOUR_GOOGLE_CLIENT_SECRET"

# Ask for LLM API keys
print("\n✅ Supabase configured")
print("✅ Google OAuth configured")
print("\n🔑 Now we need LLM API keys:\n")

print("1. Groq API Key")
print("   Get from: https://console.groq.com (free, 14.4k requests/day)")
groq_key = input("   Paste Groq API key (or press Enter to skip): ").strip()

print("\n2. Gemini API Key")
print("   Get from: https://aistudio.google.com/app/apikey (free, 60 req/min)")
gemini_key = input("   Paste Gemini API key (or press Enter to skip): ").strip()

# Create .env content
env_content = f"""# PodScout Pro - Live Configuration
# ⚠️ KEEP THIS FILE SECRET - DO NOT COMMIT TO GIT

# Application
APP_NAME=PodScout Pro
APP_VERSION=0.1.0
DEBUG=True

# ===== SUPABASE (Database) - CONFIGURED ✅ =====
SUPABASE_URL={SUPABASE_URL}
SUPABASE_KEY={SUPABASE_KEY}
SUPABASE_SERVICE_KEY={SUPABASE_KEY}
SUPABASE_DB_PASSWORD={SUPABASE_PASSWORD}

# ===== GOOGLE OAUTH - CONFIGURED ✅ =====
GOOGLE_CLIENT_ID={GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET={GOOGLE_CLIENT_SECRET}

# ===== LLM APIs =====
GROQ_API_KEY={groq_key if groq_key else 'your-groq-api-key-here'}
GEMINI_API_KEY={gemini_key if gemini_key else 'your-gemini-api-key-here'}

# ===== OPTIONAL SERVICES =====
PINECONE_API_KEY=
PINECONE_ENV=us-east-1
PINECONE_INDEX_NAME=podscout-embeddings

REDIS_URL=redis://localhost:6379/0

GEE_SERVICE_ACCOUNT=
GEE_PRIVATE_KEY_PATH=

CPCB_API_KEY=
OPENAQ_API_KEY=

DEFAULT_GRID_SIZE_METERS=500
"""

# Write .env file
env_path = ".env"
with open(env_path, 'w') as f:
    f.write(env_content)

print("\n" + "=" * 60)
print("✅ Configuration Complete!")
print("=" * 60)
print(f"\n📝 Created: {os.path.abspath(env_path)}")

# Check what's configured
if groq_key and gemini_key:
    print("\n🎉 All required credentials configured!")
    print("\nNext steps:")
    print("1. Setup database: python setup_database.py")
    print("2. Start backend: uv run python -m backend.app.main")
elif groq_key or gemini_key:
    print("\n⚠️  Partial configuration:")
    if not groq_key:
        print("   - Still need Groq API key")
    if not gemini_key:
        print("   - Still need Gemini API key")
    print("\n   Edit .env file to add missing keys")
else:
    print("\n⚠️  LLM API keys not configured")
    print("   Get your keys and edit .env file:")
    print("   - Groq: https://console.groq.com")
    print("   - Gemini: https://aistudio.google.com/app/apikey")

print("\n" + "=" * 60)
