# CivicSense-AI

CivicSense AI is a Retrieval-Augmented Generation (RAG) based civic intelligence assistant that helps citizens understand and navigate Indian government schemes using grounded A responses.

### How to setup :

1. Clone the repository using :

`  git clone https://github.com/AdithyanandanArun/CivicSense-AI.git`

2. Create a virtual environment
```
  python -m venv venv
  source venv/bin/activate
```
3. Install the Dependencies :

```
  cd CivicSense-AI
  pip install -r requirements.txt
```
4. Configure environment variables

-Create a .env file inside the Source Folder.
```
  groqapi=
  database_url=
  secretkey=
```
   
## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript

### Backend
- Python
- Flask

### AI / LLM
- Groq API
- RAG

### Database
- PostgreSQL
- pgvector 
