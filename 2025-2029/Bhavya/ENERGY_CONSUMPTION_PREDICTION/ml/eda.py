import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

DATA_PATH = "ml/data/processed_energy_data.csv"
OUTPUT_DIR = "ml/eda_outputs"

os.makedirs(OUTPUT_DIR, exist_ok=True)

df = pd.read_csv(DATA_PATH)

df["date"] = pd.to_datetime(df["date"])

print("Dataset loaded successfully")
print("Shape:", df.shape)
print("\nColumns:")
print(df.columns)

print("\nBasic info:")
print(df.info())

print("\nSummary statistics:")
print(df.describe())

#1.Energy consumption over time
plt.figure(figsize=(14, 6))
plt.plot(df["date"], df["Appliances"])
plt.title("Appliance Energy Consumption Over Time")
plt.xlabel("Date")
plt.ylabel("Energy Consumption Wh")
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/energy_over_time.png")
plt.close()

#2.Hourly energy usage
hourly_usage = df.groupby("hour")["Appliances"].mean()

plt.figure(figsize=(10, 5))
hourly_usage.plot(kind="bar")
plt.title("Average Energy Consumption by Hour")
plt.xlabel("Hour of Day")
plt.ylabel("Average Energy Consumption Wh")
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/hourly_usage.png")
plt.close()

#3.Monthly energy usage
monthly_usage = df.groupby("month")["Appliances"].mean()

plt.figure(figsize=(10, 5))
monthly_usage.plot(kind="bar")
plt.title("Average Energy Consumption by Month")
plt.xlabel("Month")
plt.ylabel("Average Energy Consumption Wh")
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/monthly_usage.png")
plt.close()

# 4. Weekend vs Weekday usage
weekend_usage = df.groupby("is_weekend")["Appliances"].mean()

plt.figure(figsize=(6, 5))
weekend_usage.plot(kind="bar")
plt.title("Weekday vs Weekend Energy Consumption")
plt.xlabel("0 = Weekday, 1 = Weekend")
plt.ylabel("Average Energy Consumption Wh")
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/weekday_vs_weekend.png")
plt.close()

# 5. Temperature vs energy consumption
plt.figure(figsize=(8, 5))
plt.scatter(df["T_out"], df["Appliances"], alpha=0.4)
plt.title("Outdoor Temperature vs Energy Consumption")
plt.xlabel("Outdoor Temperature")
plt.ylabel("Energy Consumption Wh")
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/temperature_vs_energy.png")
plt.close()

# 6. Correlation heatmap showcase
plt.figure(figsize=(16, 10))
numeric_df = df.select_dtypes(include=["number"])
sns.heatmap(numeric_df.corr(), cmap="coolwarm", annot=False)
plt.title("Correlation Heatmap")
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/correlation_heatmap.png")
plt.close()

print("\nEDA completed successfully.")
print(f"Graphs saved inside: {OUTPUT_DIR}")
