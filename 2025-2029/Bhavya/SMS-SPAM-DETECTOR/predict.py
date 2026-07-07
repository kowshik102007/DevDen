import pickle

with open('model/model.pkl', 'rb') as f:
    model = pickle.load(f)
with open('model/vectorizer.pkl', 'rb') as f:
    vectorizer = pickle.load(f)

def predict(message):
    vec = vectorizer.transform([message])
    pred = model.predict(vec)[0]
    prob = model.predict_proba(vec)[0]
    label = "🚨 SPAM" if pred == 1 else "✅ HAM (Not Spam)"
    confidence = prob[pred] * 100
    print(f"Result:  {label}  |  Confidence: {confidence:.2f}%")

print("=== SMS Spam Detector ===")
print("Type a message and press Enter. Type 'quit' to exit.\n")

while True:
    msg = input("Enter message: ")
    if msg.lower() == 'quit':
        break
    predict(msg)