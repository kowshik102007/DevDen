# Taskify 2.0 - FastAPI + Next.js

A modern task management application with AI-powered scheduling built with FastAPI backend and Next.js 15 frontend.

## Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 📋 **Task Management** - Create and manage tasks with AI assistance
- 📊 **AI-Powered Scheduling** - Generate intelligent schedules from documents
- 📚 **Document Analysis** - Upload PDFs and DOCX for personalized learning paths
- 💬 **Smart Chat Assistant** - Get productivity tips and schedule recommendations
- 📱 **Responsive Design** - Beautiful, modern UI that works on all devices

## Tech Stack

### Backend

- **FastAPI** - Modern Python web framework
- **MongoDB** - Document database for user data
- **Pinecone** - Vector database for document embeddings
- **LangChain** - AI integration framework
- **Google Gemini & Groq** - LLM providers

### Frontend

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API requests

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB running locally or remotely
- uv package manager (`pip install uv`)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create a virtual environment with uv:

   ```bash
   uv venv .venv
   ```

3. Activate the virtual environment:
   - Windows: `.venv\Scripts\activate`
   - Linux/Mac: `source .venv/bin/activate`

4. Install dependencies:

   ```bash
   uv pip install -e .
   ```

5. Create a `.env` file in the backend directory (use `.env.example` as template):

   ```env
   SECRET_KEY=your-secret-key-here
   JWT_SECRET_KEY=your-jwt-secret-key-here
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30

   MONGODB_URI=mongodb://localhost:27017/
   DATABASE_NAME=Taskify
   COLLECTION_NAME=Users

   GOOGLE_API_KEY=your-google-api-key
   GROQ_API_KEY=your-groq-api-key
   GROQ_MODEL=llama-3.3-70b-versatile

   PINECONE_API_KEY=your-pinecone-api-key
   INDEX_NAME=your-index-name

   BACKEND_CORS_ORIGINS=http://localhost:3000
   ```

6. Start the FastAPI server:

   ```bash
   uvicorn main:app --reload --port 8000
   ```

   The API will be available at:
   - API: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. The `.env.local` file is already configured with:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   The application will be available at http://localhost:3000

## Usage

1. **Register**: Create a new account at http://localhost:3000/register
2. **Login**: Access your dashboard at http://localhost:3000/login
3. **Upload Documents**: Upload PDF or DOCX files to generate personalized schedules
4. **Chat with AI**: Get productivity tips and schedule recommendations
5. **Generate Schedules**: Create AI-powered learning schedules based on your goals
6. **View Activity**: Track your chat history and interactions

## Project Structure

```
Taskify/
├── backend/                 # FastAPI backend
│   ├── main.py             # FastAPI application
│   ├── models.py           # Pydantic models
│   ├── dependencies.py     # Dependency injection
│   ├── utils.py            # Utility functions
│   ├── routers/            # API routers
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── documents.py    # Document management
│   │   └── scheduler.py    # Scheduling and chat
│   └── pyproject.toml      # Python dependencies
│
├── frontend/               # Next.js frontend
│   ├── app/                # App Router pages
│   │   ├── page.tsx        # Landing page
│   │   ├── login/          # Login page
│   │   ├── register/       # Registration page
│   │   ├── dashboard/      # Dashboard with chat
│   │   ├── scheduler/      # Schedule generation
│   │   ├── documents/      # Document management
│   │   ├── activity/       # Activity history
│   │   └── logs/           # System logs
│   ├── components/         # Reusable components
│   ├── lib/                # API client
│   └── package.json        # Node dependencies
│
└── README.md              # This file
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/change-password` - Change password

### Documents

- `POST /api/documents/upload` - Upload document
- `GET /api/documents/` - List user documents
- `DELETE /api/documents/{batch_id}` - Delete document

### Scheduler

- `POST /api/scheduler/chat` - Chat with AI
- `GET /api/scheduler/chat/history` - Get chat history
- `POST /api/scheduler/chat/clear` - Clear chat history
- `POST /api/scheduler/generate` - Generate schedule
- `POST /api/scheduler/generate-from-chat` - Generate from chat
- `GET /api/scheduler/schedules` - List schedules
- `GET /api/scheduler/schedules/{id}` - Get schedule
- `DELETE /api/scheduler/schedules/{id}` - Delete schedule

## Testing

All interactive elements include `data-test-id` attributes for easy testing:

- **Landing Page**: `landing-page`, `login-link`, `register-link`
- **Login**: `login-form`, `username-input`, `password-input`, `login-submit`
- **Register**: `register-form`, `name-input`, `username-input`, etc.
- **Dashboard**: `dashboard`, `chat-input`, `send-message-button`, etc.
- **Scheduler**: `scheduler-page`, `schedule-input`, `generate-schedule-button`
- **Documents**: `documents-page`, `upload-button`, `document-list`
- **Activity**: `activity-page`, `activity-list`
- **Logs**: `logs-page`, `logs-container`, `clear-logs-button`

## License

MIT License - see LICENSE file for details

## Support

For issues or questions, please open an issue in the repository.

---

**Taskify 2.0** - Making task management intelligent and efficient! 🚀
