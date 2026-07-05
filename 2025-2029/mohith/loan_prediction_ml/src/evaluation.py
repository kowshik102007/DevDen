from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


def evaluate_model(model, X_test, y_test):
    y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)

    print("Accuracy:", acc)
    print("\nClassification Report:\n", classification_report(y_test, y_pred))
    print("\nConfusion Matrix:\n", confusion_matrix(y_test, y_pred))

    return acc


if __name__ == "__main__":
    from data_preprocessing import preprocess_data
    from feature_engineering import feature_engineering_pipeline
    from model_training import split_data, train_models

    df = preprocess_data("data/raw/train.csv")
    df = feature_engineering_pipeline(df)

    X_train, X_test, y_train, y_test = split_data(df)

    models = train_models(X_train, y_train)

    results = {}

    for name, model in models.items():
        print(f"\n================ {name} ================")
        acc = evaluate_model(model, X_test, y_test)
        results[name] = acc

    best_model_name = max(results, key=results.get)
    print("\n Best Model:", best_model_name)
    print("Best Accuracy:", results[best_model_name])
