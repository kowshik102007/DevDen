import os
import pandas as pd
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_PATH = os.path.join(
    BASE_DIR,
    "dataset",
    "netflix_clean.csv"
)

print("Loading Dataset...")

df = pd.read_csv(DATA_PATH)

df["director"] = df["director"].fillna("")
df["cast"] = df["cast"].fillna("")
df["listed_in"] = df["listed_in"].fillna("")
df["description"] = df["description"].fillna("")

df["combined_features"] = (
    df["listed_in"]
    + " "
    + df["director"]
    + " "
    + df["cast"]
    + " "
    + df["description"]
)

print("\nCombined Features Created Successfully\n")

print("Creating TF-IDF Matrix...")

tfidf = TfidfVectorizer(stop_words="english")

tfidf_matrix = tfidf.fit_transform(
    df["combined_features"]
)

print("TF-IDF Shape:")
print(tfidf_matrix.shape)

print("\nCreating Cosine Similarity Matrix...")

cosine_sim = cosine_similarity(tfidf_matrix)

print("Cosine Similarity Shape:")
print(cosine_sim.shape)

MODEL_DIR = os.path.join(BASE_DIR, "models")

os.makedirs(MODEL_DIR, exist_ok=True)

joblib.dump(
    cosine_sim,
    os.path.join(MODEL_DIR, "cosine_sim.pkl")
)

joblib.dump(
    df,
    os.path.join(MODEL_DIR, "netflix_data.pkl")
)

print("\nCosine Similarity Saved Successfully")
print("Dataset Saved Successfully")
