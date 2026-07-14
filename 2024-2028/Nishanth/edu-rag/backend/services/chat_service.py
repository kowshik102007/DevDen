import os
import json
import time
from dotenv import load_dotenv
from google.genai import Client
from pageindex import PageIndexClient

load_dotenv()

PAGEINDEX_API_KEY = os.getenv("PAGEINDEX_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

pg_index_client = PageIndexClient(api_key=PAGEINDEX_API_KEY)
gemini_client = Client(api_key=GEMINI_API_KEY)

REGISTRY_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "document_registry.json")

def get_registry():
    if not os.path.exists(REGISTRY_PATH):
        return {}
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_registry(registry):
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)

def upload_to_pageindex(file_path: str, filename: str) -> dict:
    """
    Upload a document to PageIndex and register it locally.
    """
    print(f"Uploading file {file_path} to PageIndex...")
    res = pg_index_client.submit_document(file_path=file_path)
    doc_id = res["doc_id"]
    
    registry = get_registry()
    registry[doc_id] = {
        "doc_id": doc_id,
        "filename": filename,
        "status": "processing",
        "uploaded_at": time.time(),
        "tree": None
    }
    save_registry(registry)
    
    return registry[doc_id]

def check_document_status(doc_id: str) -> dict:
    """
    Check the status of document processing. If completed, fetch and cache the tree.
    """
    registry = get_registry()
    if doc_id not in registry:
        return {"error": "Document not found"}
    
    doc_info = registry[doc_id]
    
    # If already completed, just return
    if doc_info["status"] == "completed" and doc_info["tree"] is not None:
        return doc_info

    try:
        status_res = pg_index_client.get_document(doc_id)
        status = status_res.get("status", "processing")
        
        doc_info["status"] = status
        
        if status == "completed":
            print(f"Document {doc_id} completed indexing! Fetching tree structure...")
            tree_result = pg_index_client.get_tree(doc_id, node_summary=True)
            pageindex_tree = tree_result.get("result", [])
            doc_info["tree"] = pageindex_tree
            
        elif status == "failed":
            print(f"Document {doc_id} failed to index.")
            
        registry[doc_id] = doc_info
        save_registry(registry)
        
    except Exception as e:
        print(f"Error checking status for doc {doc_id}: {str(e)}")
        doc_info["status"] = "failed"
        doc_info["error"] = str(e)
        registry[doc_id] = doc_info
        save_registry(registry)
        
    return doc_info

def compress_tree(nodes):
    out = []
    for n in nodes:
        entry = {
            "node_id": n["node_id"],
            "title":   n["title"],
            "page":    n.get("page_index", "?"),
            "summary": n.get("text", "")[:150]  # first 150 chars
        }
        if n.get("nodes"):
            entry["children"] = compress_tree(n["nodes"])
        out.append(entry)
    return out

def llm_tree_search(query: str, tree: list, model: str = "gemini-3.1-flash-lite") -> dict:
    """
    Ask Gemini to search the document tree and find relevant node IDs.
    """
    compressed = compress_tree(tree)
    
    prompt = f"""You are given a query and a document's tree structure (like a Table of Contents).
Your task: identify which node IDs most likely contain the answer to the query.
Think step-by-step about which sections are relevant.

Query: {query}

Document Tree:
{json.dumps(compressed, indent=2)}

Reply ONLY in this exact JSON format:
{{
  "thinking": "<your step-by-step reasoning>",
  "node_list": ["node_id1", "node_id2"]
}}"""

    response = gemini_client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    )
    
    try:
        return json.loads(response.text)
    except Exception as e:
        print(f"Error parsing JSON from LLM: {str(e)}")
        return {
            "thinking": f"Failed to parse LLM search response: {response.text}",
            "node_list": []
        }

def find_nodes(tree, target_ids):
    found = []
    for node in tree:
        if node["node_id"] in target_ids:
            found.append(node)
        if node.get("nodes"):
            found.extend(find_nodes(node["nodes"], target_ids=target_ids))
    return found

def generate_answer(query: str, nodes: list, model: str = "gemini-3.1-flash-lite") -> str:
    """
    Generate final answer based on retrieved nodes.
    """
    if not nodes:
        return "No relevant sections found in the document."
    
    context_parts = []
    for node in nodes:
        context_parts.append(
            f"[Section: '{node['title']}' | Page {node.get('page_index', '?')}]\n"
            f"{node.get('text', 'Content not available.')}"
        )
        
    context = "\n\n---\n\n".join(context_parts)
    
    prompt = f"""You are an expert document analyst. Answer the question using ONLY the provided context. For every claim you make, cite the section title and page number in parentheses. Be concise and precise.

Question: {query}
Context:
{context}
Answer:"""
    
    response = gemini_client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            'temperature': 0.2,
            'top_k': 40,
            'top_p': 0.95,
        },
    )
    
    return response.text

def vectorless_rag_pipeline(query: str, tree: list) -> dict:
    """
    Run Vectorless RAG pipeline:
    1. LLM Tree Search -> finds relevant node_ids
    2. Node Retrieval -> fetches section contents
    3. Answer Generation -> produces cited answer
    """
    # Use standard gemini-3.1-flash-lite which is fast and supports JSON response schema
    model = "gemini-3.1-flash-lite"
    
    # Step 1: Tree Search
    search_result = llm_tree_search(query, tree, model=model)
    node_ids = search_result.get("node_list", [])
    thinking = search_result.get("thinking", "")
    
    # Step 2: Retrieve node contents
    nodes = find_nodes(tree, node_ids)
    
    # Step 3: Generate answer
    answer = generate_answer(query, nodes, model=model)
    
    # Clean up node contents to only return necessary info to frontend
    returned_nodes = []
    for n in nodes:
        returned_nodes.append({
            "node_id": n["node_id"],
            "title": n["title"],
            "page_index": n.get("page_index", "?"),
            "text": n.get("text", "")
        })
        
    return {
        "thinking": thinking,
        "node_list": node_ids,
        "nodes": returned_nodes,
        "answer": answer
    }
