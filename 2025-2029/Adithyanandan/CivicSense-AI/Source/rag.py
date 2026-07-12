from llama_index.core import (VectorStoreIndex,SimpleDirectoryReader,StorageContext,load_index_from_storage)
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core.settings import Settings
import os

index = None
PERSIST_DIR = "storage"

def build_index():
    global index
    Settings.llm = None
    Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")

    if os.path.exists(PERSIST_DIR):
        print("[rag] loading existing index...")
        storage_context = StorageContext.from_defaults(persist_dir=PERSIST_DIR)
        index = load_index_from_storage(storage_context)
        print("[rag] index loaded")
    else:
        print("[rag] building index for the first time...")
        documents = SimpleDirectoryReader("schemes", recursive=True).load_data()
        index = VectorStoreIndex.from_documents(documents)
        index.storage_context.persist(persist_dir=PERSIST_DIR)
        print("[rag] index built and saved")

def query_schemes(query):
    retriever = index.as_retriever(similarity_top_k=5)
    nodes = retriever.retrieve(query)
    if not nodes:
        return "No relevant scheme information found."
    chunks = [node.get_content() for node in nodes]
    return "\n\n---\n\n".join(chunks)