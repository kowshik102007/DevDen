# 🎬 Netflix Recommendation System

An AI-powered movie and TV show recommendation system built with **Python (Flask)** and **Vanilla Frontend technologies (HTML, CSS, JS)**. It utilizes Natural Language Processing (NLP) techniques, specifically **TF-IDF Vectorization** and **Cosine Similarity**, to recommend movies and TV shows based on their genres, directors, cast, and plot descriptions. Additionally, it integrates with **The Movie Database (TMDB) API** to fetch real-time posters for recommended content.

---

## 🚀 Key Features

*   **Content-Based Filtering**: Recommends movies/TV shows similar to the searched title using cosine similarity scores calculated on key features.
*   **Dynamic Poster Fetching**: Integrates with the TMDB API to pull movie posters in real-time, matching titles dynamically.
*   **Sleek Netflix-Inspired UI**: A modern, dark-mode user interface designed with fluid animations and responsive layout card grids.
*   **Detailed Search Results**: Displays Title, Type (Movie/TV Show), Release Year, Netflix Rating, Genre, and a brief description for each recommendation.
*   **Comprehensive Data Processing**: Preprocesses raw datasets and serializes similarity matrices using `joblib` for rapid inference.

---

## 🛠️ Tech Stack

### Frontend
*   **HTML5 & CSS3**: Structured semantic elements and styling using CSS custom variables for a rich dark-themed user interface.
*   **JavaScript (ES6+)**: Handles asynchronous API requests (`fetch`), dynamic DOM manipulation, and input event handling.

### Backend
*   **Flask**: A lightweight WSGI web application framework in Python.
*   **Flask-CORS**: Handles Cross-Origin Resource Sharing (CORS), allowing the frontend to securely interact with the backend API.
*   **Scikit-Learn**: Implements text feature extraction via `TfidfVectorizer` and calculates mathematical similarity using `cosine_similarity`.
*   **Pandas & NumPy**: Handles data cleaning, missing value interpolation, feature engineering, and dataframe operations.
*   **Joblib**: Serializes and deserializes the generated data structures and similarity matrices for quick loading in the API.
*   **Requests**: Performs external HTTP GET calls to the TMDB API to fetch matching poster URLs.

---

## 📁 Repository Structure

```text
netflix-recommendation-system/
├── backend/
│   ├── app.py           # Flask server, hosts api endpoints & fetches TMDB posters
│   ├── model.py         # Loads raw CSV, engineers features, trains TF-IDF, & saves pickles
│   └── recommend.py     # Contains recommendation logic using serialized similarity matrix
├── dataset/
│   ├── netflix_titles.csv   # Raw dataset of Netflix movies and TV shows
│   ├── netflix_clean.csv    # Cleaned dataset ready for preprocessing
│   └── netflix_features.csv # Dataset with engineered features
├── frontend/
│   ├── index.html       # Client interface layout
│   ├── style.css        # Premium Netflix-inspired stylesheets
│   └── script.js        # API requests handler and UI renderer
├── models/              # [Ignored from Git] Directory where serialized binaries are saved
│   ├── cosine_sim.pkl   # Serialized 620MB similarity matrix
│   ├── netflix_data.pkl # Serialized Pandas Dataframe for fast lookup
│   └── tfidf.pkl        # Serialized TF-IDF Vectorizer
├── notebooks/
│   └── EDA.ipynb        # Jupyter Notebook for Exploratory Data Analysis & experiments
├── .gitignore           # Ignores large binaries (.pkl) and virtual environments (venv)
├── requirements.txt     # Python library dependencies
└── README.md            # Project documentation (this file)
```

> [!IMPORTANT]
> The similarity matrix `cosine_sim.pkl` is roughly **620 MB** and is excluded from git tracking via `.gitignore`. You **must** generate it locally by running the model training pipeline before starting the API server.

---

## ⚙️ Setup and Installation

Follow these steps to set up and run the application locally on your machine.

### Prerequisites
Make sure you have Python 3.8+ installed.

### 1. Clone the Repository
```bash
git clone https://github.com/Mohith1-stack/Netflix-Recommendation-System.git
cd netflix-recommendation-system
```

### 2. Create and Activate a Virtual Environment
```bash
# Windows (PowerShell/CMD)
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
pip install Flask flask-cors requests
```

### 4. Train the Model (Generate Pickles)
Since the serialized similarity matrix is not uploaded to GitHub, you need to run the model script to compute and save the similarity vectors:
```bash
python backend/model.py
```
This will read the dataset, perform TF-IDF vectorization, calculate cosine similarity, and generate files in the `models/` directory.

### 5. Run the Backend API
Start the Flask development server:
```bash
python backend/app.py
```
By default, the server runs on `http://127.0.0.1:5000/`.

### 6. Run the Frontend App
You can open `frontend/index.html` directly in your web browser. 

Alternatively, you can run a lightweight local web server from the project directory to avoid potential browser file protocol limitations:
```bash
python -m http.server 8000 --directory frontend
```
Then, visit `http://localhost:8000` in your browser.

---

## 🧠 How It Works

1.  **Feature Extraction**: The fields `listed_in` (genres), `director`, `cast`, and `description` are concatenated to build a singular string of `combined_features` for each movie and TV show.
2.  **TF-IDF Vectorization**: Words in the combined features are transformed into numbers using TF-IDF (Term Frequency-Inverse Document Frequency), creating a feature matrix representing term importance.
3.  **Cosine Similarity**: Calculates pairwise similarity scores between all movies:
    $$\text{Cosine Similarity}(A, B) = \frac{A \cdot B}{\|A\| \|B\|}$$
4.  **Recommendation Query**: When a user inputs a title:
    *   The system searches for its index in the dataset.
    *   It extracts similarity scores for that index from the precomputed `cosine_sim` matrix.
    *   It sorts the scores in descending order and picks the top 5 most similar titles.
    *   The backend retrieves poster paths from the TMDB search API and serves the full payload.

---

## 📡 API Documentation

### Get Recommendations
Retrieve a list of recommended movies or TV shows based on a query title.

*   **URL**: `/recommend`
*   **Method**: `GET`
*   **Query Parameters**:
    *   `title` (string, required): The exact or close title of the movie/show.
*   **Response Format**: `JSON`

#### Example Request
```http
GET http://127.0.0.1:5000/recommend?title=Dracula
```

#### Example Response
```json
{
  "movie": "Dracula",
  "recommendations": [
    {
      "title": "Vampires",
      "type": "Movie",
      "release_year": 1998,
      "rating": "R",
      "genre": "Horror Movies",
      "description": "The Vatican summons a team of vampire hunters, led by Jack Crow, to hunt down and destroy a master vampire before he finds a legendary relic.",
      "poster": "https://image.tmdb.org/t/p/w500/uF68zYq96B0rO8Yp2Uu4x66rA7m.jpg"
    },
    ...
  ]
}
```

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Mohith1-stack/Netflix-Recommendation-System/issues) to submit any feedback or suggestions.
