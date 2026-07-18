# Research Companion AI

An AI-powered research writing assistant that analyzes your research text, compares it with existing research papers, and provides detailed feedback on novelty, alignment, coherence, and relevance.

## Features

### 🎯 Core Functionality
- **Draft Analysis Mode**: Analyze research paragraphs and get detailed scoring
- **Live Assist Mode**: ChatGPT-like interface for finding research papers and getting writing feedback
- **Browser Extension**: Analyze text on any webpage with real-time feedback
- **Research Paper Integration**: Automatically fetches and compares with papers from Semantic Scholar API

### 📊 Analysis Metrics
- **Overall Research Score** (0-100)
- **Novelty**: How original your work is compared to existing research
- **Alignment**: How well your text aligns with the research problem
- **Coherence**: Internal flow and structure of your writing
- **Relevance**: How relevant your work is to the research field

### 🎨 User Interface
- Modern, dark-themed React frontend
- ChatGPT-style sidebar with chat history
- Real-time issue highlighting with tooltips
- Responsive design with Tailwind CSS

## Project Structure

```
research-companion-ai/
├── app.py                 # Flask backend server
├── requirements.txt       # Python dependencies
├── RE-A/
│   └── front-end/         # React frontend application
│       ├── src/
│       │   └── App.jsx   # Main React component
│       ├── package.json
│       └── vite.config.js
└── research-bot/          # Browser extension
    ├── manifest.json
    ├── extension.js
    └── styles.css
```

## Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. **Install Python dependencies**:
```bash
pip install -r requirements.txt
```

2. **Start the Flask server**:
```bash
python app.py
```

The backend will run on `http://127.0.0.1:5001`

### Frontend Setup

1. **Navigate to frontend directory**:
```bash
cd RE-A/front-end
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start the development server**:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

### Browser Extension Setup

1. **Open Chrome/Edge**:
   - Go to `chrome://extensions/` (or `edge://extensions/`)

2. **Enable Developer Mode**:
   - Toggle "Developer mode" in the top right

3. **Load the extension**:
   - Click "Load unpacked"
   - Navigate to `research-bot/` directory
   - Select the folder

4. **Make sure backend is running**:
   - The extension connects to `http://127.0.0.1:5001`

## Usage

### Web Application

1. **Draft Analysis Mode**:
   - Enter your research problem statement
   - Paste or type your research draft
   - Click "Analyze Draft"
   - View your score, breakdown, and highlighted issues
   - Hover over red underlined text to see issue details

2. **Live Assist Mode**:
   - Click "New Chat" to start a conversation
   - Ask about research topics to find papers
   - Get writing feedback and suggestions
   - All chats are saved in the sidebar

### Browser Extension

1. Navigate to any webpage with a textarea or contentEditable element
2. Type your research text (minimum 20 characters)
3. Wait 1.5 seconds after you stop typing
4. The extension will automatically:
   - Extract the research problem from the page context
   - Analyze your text
   - Show research score and breakdown
   - Highlight sentences with issues in red
   - Display related research papers
5. Hover over red underlined text to see issue details

## API Endpoints

### POST `/score`
Analyze research text and return scoring breakdown.

**Request**:
```json
{
  "problem": "Your research problem statement",
  "paragraph": "Your research text to analyze"
}
```

**Response**:
```json
{
  "score": 75.5,
  "breakdown": {
    "novelty": 85.2,
    "alignment": 70.1,
    "coherence": 90.0,
    "relevance": 56.7
  },
  "sentences": [
    {
      "sentence": "Your sentence text",
      "issues": [
        {
          "reason": "Issue description",
          "suggestion": "How to fix it"
        }
      ]
    }
  ],
  "papers": [...],
  "papers_count": 10
}
```

### GET `/test-papers?problem=<research_topic>`
Fetch research papers for a given topic.

**Response**:
```json
{
  "papers": [
    {
      "title": "Paper Title",
      "authors": ["Author 1", "Author 2"],
      "year": 2023,
      "citations": 42,
      "abstract": "Paper abstract..."
    }
  ],
  "papers_count": 10
}
```

## Technologies Used

### Backend
- **Flask**: Web framework
- **Sentence Transformers**: Text embeddings for similarity analysis
- **Semantic Scholar API**: Research paper database
- **NLTK**: Natural language processing

### Frontend
- **React**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **localStorage**: Chat history persistence

### Extension
- **Chrome Extension Manifest V3**: Browser extension API
- **Content Scripts**: Page interaction

## Configuration

### Backend Port
Default: `5001` (to avoid conflict with Apple AirPlay on port 5000)

To change, edit `app.py`:
```python
app.run(debug=True, host="127.0.0.1", port=5001)
```

### Frontend Proxy
The Vite dev server proxies API requests. Configuration in `RE-A/front-end/vite.config.js`:
```javascript
proxy: {
  '/score': {
    target: 'http://localhost:5001',
  },
  '/test-papers': {
    target: 'http://localhost:5001',
  }
}
```

## Troubleshooting

### Backend not connecting
- Make sure Flask is running on port 5001
- Check if port 5001 is available: `lsof -ti:5001`
- Verify CORS is enabled in `app.py`

### Frontend not showing changes
- Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Clear browser cache
- Restart the Vite dev server

### Extension not working
- Reload the extension in `chrome://extensions/`
- Check browser console for errors (F12)
- Verify backend is running on port 5001
- Check extension permissions in manifest.json

### No papers found
- Verify Semantic Scholar API is accessible
- Check network tab in browser DevTools
- Review backend logs for API errors

## Development

### Running in Development Mode

1. **Terminal 1 - Backend**:
```bash
python app.py
```

2. **Terminal 2 - Frontend**:
```bash
cd RE-A/front-end
npm run dev
```

3. **Access the app**:
   - Web app: `http://localhost:5173`
   - Backend API: `http://127.0.0.1:5001`

### Building for Production

**Frontend**:
```bash
cd RE-A/front-end
npm run build
```

**Backend**:
```bash
# Use a production WSGI server like Gunicorn
pip install gunicorn
gunicorn -w 4 -b 127.0.0.1:5001 app:app
```

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Ashish

## Acknowledgments

- Semantic Scholar API for research paper data
- Sentence Transformers for text embeddings
- React and Vite communities

