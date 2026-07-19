from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
import numpy as np
import nltk
from nltk.tokenize import sent_tokenize
import re
import requests
from typing import List, Dict
import hashlib

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
model = SentenceTransformer("all-MiniLM-L6-v2")
nltk.download("punkt", quiet=True)

PARAGRAPH_HISTORY = []
PAPER_CACHE = {}

def clean(text):
    return re.sub(r"<[^>]+>", "", text or "").strip()

def embed(text):
    return model.encode(text, normalize_embeddings=True)

def cosine(a, b):
    return float(np.dot(a, b))

def get_problem_hash(problem: str) -> str:
    """Generate a hash for the problem statement to use as cache key."""
    return hashlib.md5(problem.lower().strip().encode()).hexdigest()

def extract_key_terms(problem: str, max_terms: int = 5) -> str:
    """Extract key terms from problem statement for better search."""
    stop_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "should", "could", "can", "may", "might", "must", "this", "that", "these", "those", "we", "you", "they", "how", "what", "why", "when", "where", "which", "who"}
    
    words = re.findall(r'\b\w+\b', problem.lower())
    key_terms = [w for w in words if w not in stop_words and len(w) > 3]
    
    if len(key_terms) > max_terms:
        seen = set()
        result = []
        for term in key_terms:
            if term not in seen:
                result.append(term)
                seen.add(term)
                if len(result) >= max_terms:
                    break
        return " ".join(result)
    return " ".join(key_terms[:max_terms]) if key_terms else problem[:100]

def fetch_research_papers(problem: str, limit: int = 10) -> List[Dict]:
    """
    Fetch research papers from Semantic Scholar API based on problem statement.
    Returns a list of papers with title, abstract, and authors.
    """
    problem_hash = get_problem_hash(problem)
    
    if problem_hash in PAPER_CACHE:
        print(f"📚 Using cached papers for problem: {problem[:50]}...")
        return PAPER_CACHE[problem_hash]
    
    print(f"🔍 Fetching research papers for: {problem[:50]}...")
    
    try:
        search_query = extract_key_terms(problem)
        print(f"🔑 Using search query: {search_query}")
        
        url = "https://api.semanticscholar.org/graph/v1/paper/search"
        params = {
            "query": search_query,
            "limit": limit,
            "fields": "title,abstract,authors,year,citationCount"
        }
        
        headers = {
            "User-Agent": "Research-Companion-AI/1.0"
        }
        response = requests.get(url, params=params, headers=headers, timeout=15)
        print(f"📡 API Response Status: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        print(f"📄 API Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        papers = []
        if "data" in data and data["data"]:
            print(f"📊 Found {len(data['data'])} papers in API response")
            for idx, paper in enumerate(data["data"]):
                print(f"   Processing paper {idx + 1}: {paper.get('title', 'No title')[:50]}...")
                paper_text = ""
                if paper.get("title"):
                    paper_text += paper["title"] + ". "
                if paper.get("abstract"):
                    paper_text += paper.get("abstract", "")
                
                if paper_text.strip():
                    authors_list = []
                    if paper.get("authors"):
                        for a in paper.get("authors", []):
                            if isinstance(a, dict) and a.get("name"):
                                authors_list.append(a.get("name"))
                            elif isinstance(a, str):
                                authors_list.append(a)
                    
                    papers.append({
                        "title": paper.get("title", "") or "",
                        "abstract": paper.get("abstract", "") or "",
                        "text": paper_text.strip(),
                        "authors": authors_list,
                        "year": paper.get("year"),
                        "citations": paper.get("citationCount", 0)
                    })
        
        PAPER_CACHE[problem_hash] = papers
        print(f"✅ Fetched {len(papers)} papers")
        if len(papers) == 0:
            print(f"⚠️ Warning: No papers found. API response: {data}")
        return papers
        
    except requests.exceptions.HTTPError as e:
        print(f"⚠️ HTTP Error fetching papers: {e}")
        print(f"   Response: {e.response.text if hasattr(e, 'response') else 'No response'}")
        return []
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Request Error fetching papers: {e}")
        return []
    except Exception as e:
        print(f"⚠️ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return []

STRONG_CLAIMS = [
    "demonstrates", "proves", "causes", "leads to",
    "results in", "significantly", "increases", "reduces"
]

def is_strong_claim(s):
    s = s.lower()
    return any(v in s for v in STRONG_CLAIMS)

def has_evidence(s):
    return bool(re.search(r"\d+|\(|\)|\[\w+\]", s))

def score_paragraph(paragraph, problem, research_papers=None):
    """
    Score paragraph based on comparison with research papers and other factors.
    
    Args:
        paragraph: The user's paragraph to score
        problem: The research problem statement
        research_papers: List of research papers fetched for the problem
    
    Returns:
        Dictionary with score and breakdown
    """
    para_emb = embed(paragraph)
    prob_emb = embed(problem)
    
    if research_papers is None:
        research_papers = fetch_research_papers(problem)
    
    novelty = 1.0
    novelty_details = {"max_similarity": 0, "similar_papers": []}
    
    if research_papers:
        paper_similarities = []
        for paper in research_papers:
            paper_emb = embed(paper["text"][:1000])
            sim = cosine(para_emb, paper_emb)
            paper_similarities.append((sim, paper["title"]))
        
        if paper_similarities:
            max_sim = max(paper_similarities, key=lambda x: x[0])[0]
            novelty = 1 - max_sim
            novelty_details["max_similarity"] = round(max_sim, 3)
            top_similar = sorted(paper_similarities, key=lambda x: x[0], reverse=True)[:3]
            novelty_details["similar_papers"] = [
                {"title": title, "similarity": round(sim, 3)} 
                for sim, title in top_similar
            ]
    elif PARAGRAPH_HISTORY:
        sims = [cosine(para_emb, embed(p)) for p in PARAGRAPH_HISTORY]
        novelty = 1 - max(sims) if sims else 1.0

    alignment = cosine(para_emb, prob_emb)

    sentences = sent_tokenize(paragraph)
    sent_embs = [embed(s) for s in sentences]
    coherence = 1.0
    if len(sent_embs) > 1:
        sims = [cosine(sent_embs[i], sent_embs[i+1]) for i in range(len(sent_embs)-1)]
        coherence = sum(sims) / len(sims)
    
    relevance = 0.5
    if research_papers:
        paper_embs = [embed(p["text"][:1000]) for p in research_papers]
        relevance_sims = [cosine(para_emb, p_emb) for p_emb in paper_embs]
        relevance = sum(relevance_sims) / len(relevance_sims) if relevance_sims else 0.5

    score = (
        0.25 * novelty +
        0.25 * alignment +
        0.25 * coherence +
        0.25 * relevance
    )

    return {
        "score": round(max(0, min(1, score)) * 100, 1),
        "breakdown": {
            "novelty": round(novelty * 100, 1),
            "alignment": round(alignment * 100, 1),
            "coherence": round(coherence * 100, 1),
            "relevance": round(relevance * 100, 1)
        },
        "novelty_details": novelty_details,
        "papers_count": len(research_papers)
    }

def analyze_sentences(paragraph, problem):
    sentences = sent_tokenize(paragraph)
    prob_emb = embed(problem)
    results = []

    for s in sentences:
        emb = embed(s)
        alignment = cosine(emb, prob_emb)
        issues = []

        if alignment < 0.25:
            issues.append({
                "reason": "Sentence weakly relates to the research problem.",
                "suggestion": "Explicitly connect this sentence to the stated problem."
            })

        if is_strong_claim(s) and not has_evidence(s):
            issues.append({
                "reason": "Strong claim without supporting evidence.",
                "suggestion": "Add a statistic, citation, or reference."
            })

        results.append({
            "sentence": s,
            "issues": issues
        })

    return results

@app.route("/test-papers", methods=["GET", "OPTIONS"])
def test_papers():
    """Endpoint for live assist mode to fetch research papers."""
    if request.method == "OPTIONS":
        return jsonify({}), 200
    
    problem = request.args.get("problem", "").strip()
    
    if not problem:
        return jsonify({"error": "Problem parameter is required"}), 400
    
    papers = fetch_research_papers(problem, limit=10)
    
    papers_for_response = []
    for paper in papers:
        papers_for_response.append({
            "title": paper.get("title", ""),
            "abstract": paper.get("abstract", ""),
            "authors": paper.get("authors", []),
            "year": paper.get("year"),
            "citations": paper.get("citations", 0)
        })
    
    return jsonify({
        "papers": papers_for_response,
        "papers_count": len(papers_for_response)
    })

@app.route("/score", methods=["POST", "OPTIONS"])
def score():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    
    data = request.json or {}
    paragraph = clean(data.get("paragraph"))
    problem = clean(data.get("problem", "research problem"))

    print(f"\n{'='*60}")
    print(f"📝 Request received - Problem: {problem[:100]}")
    print(f"📝 Paragraph length: {len(paragraph)}")
    research_papers = fetch_research_papers(problem)
    print(f"📚 Papers fetched: {len(research_papers)}")
    print(f"{'='*60}\n")
    
    papers_for_response = []
    for paper in research_papers:
        papers_for_response.append({
            "title": paper.get("title", ""),
            "abstract": paper.get("abstract", ""),
            "authors": paper.get("authors", []),
            "year": paper.get("year"),
            "citations": paper.get("citations", 0)
        })
    
    if len(paragraph) < 20:
        return jsonify({
            "score": 0, 
            "sentences": [],
            "breakdown": {},
            "papers_count": len(research_papers),
            "papers": papers_for_response if papers_for_response else []
        })
    
    score_result = score_paragraph(paragraph, problem, research_papers)
    sentence_feedback = analyze_sentences(paragraph, problem)

    PARAGRAPH_HISTORY.append(paragraph)

    return jsonify({
        "score": score_result["score"],
        "breakdown": score_result["breakdown"],
        "novelty_details": score_result["novelty_details"],
        "papers_count": score_result["papers_count"],
        "papers": papers_for_response if papers_for_response else [],
        "sentences": sentence_feedback
    })

@app.route("/editor")
def editor():
    return """
<!DOCTYPE html>
<html>
<head>
<title>Research Companion AI</title>
<style>
body {
  font-family: Arial;
  max-width: 900px;
  margin: 40px auto;
}
.editor {
  border: 1px solid #ccc;
  padding: 15px;
  min-height: 200px;
  font-size: 16px;
}
.issue {
  text-decoration: underline;
  text-decoration-color: #ef4444;
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
  cursor: help;
  background: rgba(239, 68, 68, 0.1);
  padding: 2px 0;
  position: relative;
  transition: all 0.2s ease;
}
.issue:hover {
  background: rgba(239, 68, 68, 0.2);
  text-decoration-color: #dc2626;
}
.tooltip {
  position: fixed;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #e2e8f0;
  padding: 14px 16px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 360px;
  display: none;
  z-index: 99999;
  white-space: normal;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  pointer-events: none;
}
.tooltip .issue-item {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.tooltip .issue-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.tooltip .issue-reason {
  color: #fca5a5;
  font-weight: 500;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tooltip .issue-suggestion {
  color: #94a3b8;
  font-size: 11px;
  padding-left: 20px;
}
.score {
  margin-top: 10px;
  font-weight: bold;
  font-size: 18px;
  color: #0a7;
}
.breakdown {
  margin-top: 15px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 14px;
}
.breakdown-item {
  margin: 8px 0;
  display: flex;
  justify-content: space-between;
}
.breakdown-label {
  font-weight: 500;
}
.breakdown-value {
  color: #666;
}
.papers-info {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  font-style: italic;
}
.papers-list {
  margin-top: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 6px;
  border: 1px solid #ddd;
}
.papers-list h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  color: #333;
}
.paper-item {
  margin-bottom: 20px;
  padding: 12px;
  background: white;
  border-radius: 4px;
  border-left: 3px solid #0a7;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.paper-title {
  font-weight: bold;
  font-size: 14px;
  color: #333;
  margin-bottom: 6px;
  line-height: 1.4;
}
.paper-authors {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}
.paper-meta {
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
}
.paper-abstract {
  font-size: 12px;
  color: #555;
  line-height: 1.5;
  margin-top: 8px;
  max-height: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.paper-abstract.expanded {
  max-height: none;
}
.expand-btn {
  font-size: 11px;
  color: #0a7;
  cursor: pointer;
  margin-top: 4px;
  text-decoration: underline;
}
.loading {
  color: #999;
  font-style: italic;
}
</style>
</head>
<body>

<h2>Research Companion AI</h2>

<p><b>Research Problem</b></p>
<input id="problem" style="width:100%;padding:8px"
 value="Impact of bee population decline on food security"/>
<button onclick="analyze()" style="margin-top:10px;padding:8px 15px;background:#0a7;color:white;border:none;border-radius:4px;cursor:pointer;">Analyze & Fetch Papers</button>

<p><b>Write your paragraph</b></p>
<div id="editor" class="editor" contenteditable="true">
The global decline in bee populations poses a significant threat to food security.
</div>

<div id="score" class="score"></div>
<div id="breakdown" class="breakdown" style="display:none;"></div>
<div id="papers-info" class="papers-info"></div>
<div id="papers-list" class="papers-list" style="display:none;"></div>
<div id="tooltip" class="tooltip"></div>

<script>
let timer = null;
const editor = document.getElementById("editor");
const tooltip = document.getElementById("tooltip");

editor.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(analyze, 1000);
});

async function analyze() {
  const problemInput = document.getElementById("problem").value;
  const scoreDiv = document.getElementById("score");
  const breakdownDiv = document.getElementById("breakdown");
  const papersInfoDiv = document.getElementById("papers-info");
  const papersListDiv = document.getElementById("papers-list");
  
  scoreDiv.innerText = "Analyzing...";
  scoreDiv.className = "score loading";
  breakdownDiv.style.display = "none";
  papersInfoDiv.innerText = "";
  papersListDiv.style.display = "none";
  papersListDiv.innerHTML = "";
  
  const res = await fetch("/score", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      paragraph: editor.innerText,
      problem: problemInput
    })
  });

  const data = await res.json();
  scoreDiv.innerText = "Research Score: " + data.score + "/100";
  scoreDiv.className = "score";
  
  if (data.breakdown) {
    const b = data.breakdown;
    breakdownDiv.innerHTML = `
      <div class="breakdown-item">
        <span class="breakdown-label">Novelty:</span>
        <span class="breakdown-value">${b.novelty || 0}/100</span>
      </div>
      <div class="breakdown-item">
        <span class="breakdown-label">Alignment:</span>
        <span class="breakdown-value">${b.alignment || 0}/100</span>
      </div>
      <div class="breakdown-item">
        <span class="breakdown-label">Coherence:</span>
        <span class="breakdown-value">${b.coherence || 0}/100</span>
      </div>
      <div class="breakdown-item">
        <span class="breakdown-label">Relevance:</span>
        <span class="breakdown-value">${b.relevance || 0}/100</span>
      </div>
    `;
    breakdownDiv.style.display = "block";
  }
  
  console.log("Full response data:", data);
  console.log("Papers data:", data.papers, "Type:", typeof data.papers, "Is Array:", Array.isArray(data.papers));
  console.log("Papers count:", data.papers_count);
  
  const papers = data.papers;
  const papersCount = data.papers_count || (papers ? papers.length : 0);
  
  if (papers && papers.length > 0) {
    papersInfoDiv.innerText = `Compared with ${papersCount} research papers`;
    if (data.novelty_details && data.novelty_details.similar_papers && data.novelty_details.similar_papers.length > 0) {
      const similarPapers = data.novelty_details.similar_papers.slice(0, 2);
      papersInfoDiv.innerText += ` | Most similar: ${similarPapers.map(p => (p.title || "").substring(0, 40)).join(", ")}`;
    }
    
    let papersHTML = '<h3>📚 Fetched Research Papers (' + papers.length + ')</h3>';
    
    function escapeHtml(text) {
      if (!text) return "";
      const div = document.createElement("div");
      div.textContent = String(text);
      return div.innerHTML;
    }
    
    papers.forEach((paper, index) => {
      const title = escapeHtml(paper.title || "Untitled");
      let authors = "Unknown authors";
      if (paper.authors) {
        if (Array.isArray(paper.authors) && paper.authors.length > 0) {
          authors = escapeHtml(paper.authors.slice(0, 5).join(", ") + (paper.authors.length > 5 ? " et al." : ""));
        } else if (typeof paper.authors === "string") {
          authors = escapeHtml(paper.authors);
        }
      }
      const year = paper.year || "N/A";
      const citations = paper.citations || 0;
      const abstract = escapeHtml(paper.abstract || "No abstract available.");
      const abstractId = `abstract-${index}`;
      const needsExpand = abstract.length > 200;
      
      papersHTML += `
        <div class="paper-item">
          <div class="paper-title">${title}</div>
          <div class="paper-authors">${authors}</div>
          <div class="paper-meta">${year} • ${citations} citations</div>
          <div class="paper-abstract" id="${abstractId}">${abstract}</div>
          ${needsExpand ? `<span class="expand-btn" onclick="toggleAbstract('${abstractId}')">Show more</span>` : ""}
        </div>
      `;
    });
    
    papersListDiv.innerHTML = papersHTML;
    papersListDiv.style.display = "block";
    console.log("Papers displayed successfully");
  } else {
    papersInfoDiv.innerText = "No research papers found for this problem. Check console for details.";
    papersListDiv.style.display = "none";
    console.log("No papers to display. Papers:", papers, "Type:", typeof papers);
  }

  highlight(data.sentences);
}

function toggleAbstract(abstractId) {
  const abstractEl = document.getElementById(abstractId);
  const btn = abstractEl.nextElementSibling;
  if (abstractEl.classList.contains("expanded")) {
    abstractEl.classList.remove("expanded");
    btn.textContent = "Show more";
  } else {
    abstractEl.classList.add("expanded");
    btn.textContent = "Show less";
  }
}

function highlight(sentences) {
  let text = editor.innerText;
  let html = text;

  sentences.forEach(s => {
    if (!s.issues || !s.issues.length) return;

    const escaped = s.sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    const tooltipHTML = s.issues.map(i => {
      const reason = (i.reason || "Issue detected").replace(/"/g, '&quot;');
      const suggestion = (i.suggestion || "Review this sentence").replace(/"/g, '&quot;');
      return `
        <div class="issue-item">
          <div class="issue-reason">❌ ${reason}</div>
          <div class="issue-suggestion">💡 ${suggestion}</div>
        </div>
      `;
    }).join("");

    html = html.replace(
      new RegExp(escaped, "g"),
      `<span class="issue" data-tooltip="${tooltipHTML.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}">${s.sentence}</span>`
    );
  });

  editor.innerHTML = html;
  attachTooltips();
}

function attachTooltips() {
  document.querySelectorAll(".issue").forEach(el => {
    el.addEventListener("mouseenter", e => {
      const tooltipContent = el.dataset.tooltip || el.dataset.tip || "Issue detected";
      tooltip.innerHTML = tooltipContent;
      tooltip.style.display = "block";
      updateTooltipPosition(e);
    });
    el.addEventListener("mousemove", e => {
      updateTooltipPosition(e);
    });
    el.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  });
}

function updateTooltipPosition(e) {
  if (tooltip.style.display === "none") return;
  
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let left = e.pageX + 15;
  let top = e.pageY + 15;
  
  if (left + tooltipRect.width > viewportWidth - 10) {
    left = e.pageX - tooltipRect.width - 15;
  }
  
  if (top + tooltipRect.height > viewportHeight - 10) {
    top = e.pageY - tooltipRect.height - 15;
  }
  
  left = Math.max(10, Math.min(left, viewportWidth - tooltipRect.width - 10));
  top = Math.max(10, Math.min(top, viewportHeight - tooltipRect.height - 10));
  
  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}
</script>

</body>
</html>
"""

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5001)