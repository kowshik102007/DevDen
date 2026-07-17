"""Simple backend launcher without reload for testing."""
if __name__ == "__main__":
    import uvicorn
    from backend.app.main import app
    
    print("Starting PodScout Pro backend (Flask)...")
    print("Server will be available at: http://localhost:8000")
    print("Press Ctrl+C to stop")
    
    # Run with uvicorn (WSGI compatible)
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        interface="wsgi", # Explicitly set for Flask
        log_level="info"
    )
