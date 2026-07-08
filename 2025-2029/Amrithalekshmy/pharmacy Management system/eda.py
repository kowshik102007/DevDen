import sqlite3
import pandas as pd

def get_data():
    conn = sqlite3.connect("pharmacy.db")
    df = pd.read_sql_query("SELECT * FROM medicines", conn)
    conn.close()
    return df

def topsellingmedicine():
    df = get_data()
    return df.sort_values(by="stock", ascending=False)

def lowstock():
    df = get_data()
    return df[df["stock"] < 40]

def restockneeded():
    df = get_data()
    return df[(df["stock"] > 0) & (df["stock"] < 20)]

def highestpricedmedicine():
    df = get_data()
    return df.sort_values(by="price", ascending=False)

def priceofstockleft():
    df = get_data()
    df["value"] = df["price"] * df["stock"]
    return df["value"].sum()