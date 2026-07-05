import os
import joblib
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_DIR = os.path.join(BASE_DIR, "models")

df = joblib.load(
    os.path.join(MODEL_DIR, "netflix_data.pkl")
)

cosine_sim = joblib.load(
    os.path.join(MODEL_DIR, "cosine_sim.pkl")
)


def recommend(title, top_n=5):

    title = title.lower()

    indices = pd.Series(
        df.index,
        index=df["title"].str.lower()
    ).drop_duplicates()

    if title not in indices:
        return []

    idx = indices[title]

    similarity_scores = list(enumerate(cosine_sim[idx]))

    similarity_scores = sorted(
        similarity_scores,
        key=lambda x: x[1],
        reverse=True
    )

    similarity_scores = similarity_scores[1:top_n + 1]

    recommendations = []

    for movie in similarity_scores:

        row = df.iloc[movie[0]]

        recommendations.append({
            "title": row["title"],
            "type": row["type"],
            "release_year": int(row["release_year"]),
            "rating": row["rating"],
            "genre": row["listed_in"],
            "description": row["description"]
        })

    return recommendations


if __name__ == "__main__":

    movie = input("Enter Movie Name: ")

    results = recommend(movie)

    print()

    print("Recommendations:")

    for i, film in enumerate(results, 1):
        print(f"{i}. {film}")
