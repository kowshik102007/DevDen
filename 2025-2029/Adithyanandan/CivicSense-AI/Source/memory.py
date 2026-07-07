from db import SessionLocal, Conversation
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-small-en-v1.5")
TOP_K = 6


def embed(text):
    return model.encode(text, normalize_embeddings=True).tolist()


def save_message(session_id, role, message):
    db = SessionLocal()
    try:
        db.add(Conversation(session_id=session_id,role=role,message=message,embedding=embed(message)))

        db.commit()
    finally:
        db.close()


def retrieve_relevant_messages(session_id, query):
    db = SessionLocal()
    try:
        q_vec = embed(query)
        results = (
            db.query(Conversation)
            .filter(Conversation.session_id == session_id)
            .order_by(Conversation.embedding.cosine_distance(q_vec))
            .limit(TOP_K)
            .all()
        )
        # re-sort chronologically so the LLM sees a coherent conversation
        results.sort(key=lambda m: m.timestamp)
        return [{"role": m.role, "content": m.message} for m in results]
    finally:
        db.close()