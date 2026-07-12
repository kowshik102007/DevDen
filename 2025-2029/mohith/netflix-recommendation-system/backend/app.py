from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

from recommend import recommend

app = Flask(__name__)
CORS(app)

TMDB_API_KEY = "2e072dfc4c3e6aeacaee40e2b6d9627c"

DEFAULT_POSTER = (
    "https://via.placeholder.com/300x450?text=No+Poster"
)


def get_movie_poster(title):

    url = "https://api.themoviedb.org/3/search/multi"

    params = {
        "api_key": TMDB_API_KEY,
        "query": title,
        "include_adult": "false"
    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=5
        )

        if response.status_code != 200:
            return "https://via.placeholder.com/300x450?text=No+Poster"

        data = response.json()

        results = data.get("results", [])

        for item in results:

            name = item.get("title") or item.get("name") or ""

            if name.lower() == title.lower():

                if item.get("poster_path"):

                    return (
                        "https://image.tmdb.org/t/p/w500"
                        + item["poster_path"]
                    )

        for item in results:

            if item.get("poster_path"):

                return (
                    "https://image.tmdb.org/t/p/w500"
                    + item["poster_path"]
                )

    except Exception as e:

        print(e)

    return "https://via.placeholder.com/300x450?text=No+Poster"


@app.route("/")
def home():

    return jsonify({
        "message": "Netflix Recommendation API Running"
    })


@app.route("/recommend", methods=["GET"])
def get_recommendations():

    title = request.args.get("title")

    if not title:
        return jsonify({
            "error": "Movie title is required"
        }), 400

    results = recommend(title)

    for movie in results:
        movie["poster"] = get_movie_poster(movie["title"])

    return jsonify({
        "movie": title,
        "recommendations": results
    })


if __name__ == "__main__":
    app.run(debug=True)
