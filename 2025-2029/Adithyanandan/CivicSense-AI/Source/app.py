from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from groq import Groq
import os
import uuid

from db import init_db
from memory import save_message, retrieve_relevant_messages
from rag import build_index, query_schemes
from auth import init_auth, create_user, login_user

app = Flask(__name__)
app.secret_key =os.getenv("secret_key","change-this-in-production")

client=Groq(api_key=os.getenv("groqapi"))

print("[startup] initializing database...")
init_db()
init_auth()

print("[startup] loading RAG index...")
build_index()

print("[startup] ready")



@app.route("/")
def index():
    if "user_id" not in session:
        return redirect(url_for("login_page"))
    return render_template("index.html")

@app.route("/login")
def login_page():
    if "user_id" in session:
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/api/signup", methods=["post"])
def signup():
    data = request.json
    username=data.get("username","").strip()
    email= data.get("email","").strip()
    password =data.get("password","")

    if not username or not email or not password:
        return jsonify({"error":"All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error":"Password must be at least 6 characters"}), 400

    ok, msg = create_user(username, email, password)
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"message": msg})


@app.route("/api/login", methods=["post"])
def login():
    data = request.json
    username = data.get("username","").strip()
    password = data.get("password","")

    if not username or not password:
        return jsonify({"error":"Username and password are required"}), 400

    ok, result = login_user(username, password)
    if not ok:
        return jsonify({"error": result}), 401

    session["user_id"] = result
    session["username"] = username
    return jsonify({"message": "Logged in"})


@app.route("/api/logout", methods=["post"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/groq",methods=["post"])
def chat():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    user_message = data.get("message", "").strip()
    session_id   = data.get("session_id") or str(uuid.uuid4())

    if not user_message:
        return jsonify({"error": "message is required"}), 400

    scheme_context = query_schemes(user_message)
    memory_context = retrieve_relevant_messages(session_id, user_message)

    print(scheme_context[:400])

    for m in memory_context:
        print(f"  {m['role']}: {m['content'][:80]}")

    system_prompt = f"""You are CivicSense AI, an assistant that answers questions about Indian government schemes.
STRICT RULES:
- ONLY use the scheme data provided below to answer.
- If the answer is not in the data, tell the user you don't have that information and ask "Would you like me to search the web for this?"
- Do NOT use any outside knowledge or training data unless the user explicitly asks you to.
- Do NOT make up or guess any details.
-When you ask the user if you need to search the web for information you dont have and the user responds postively ONLY THEN search from outside sources.
--- Scheme data ---
{scheme_context}
-------------------"""

    messages = [{"role": "system", "content": system_prompt}]
    if memory_context:
        messages.extend(memory_context)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create( model="llama-3.3-70b-versatile",messages=messages)


    reply = response.choices[0].message.content

    save_message(session_id, "user", user_message)
    save_message(session_id, "assistant", reply)

    return jsonify({"reply": reply, "session_id": session_id})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)