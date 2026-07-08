# Stock AI Prediction

A Flask web application for stock price prediction using historical NSE stock data and a scikit-learn model. Users can register, log in, run predictions for supported stock symbols, and view their personal prediction history.

## Features

- User registration and login with Flask-Login
- SQLite database using Flask-SQLAlchemy
- User-specific prediction history
- Stock prediction workflow from CSV datasets
- Model training script for generating the prediction model
- Bootstrap-based HTML templates

## Tech Stack

- Python
- Flask
- Flask-SQLAlchemy
- Flask-Login
- pandas
- numpy
- scikit-learn
- joblib
- SQLite

## Project Map

```text
stock_ai/
|-- app.py
|   Main Flask application, routes, database models, login setup, and DB initialization.
|
|-- predict.py
|   Loads the trained model and generates stock predictions from CSV data.
|
|-- train_model.py
|   Trains the machine learning model from the dataset and saves it under models/.
|
|-- requirements.txt
|   Python dependencies required to run and train the project.
|
|-- README.MD
|   Project documentation and setup guide.
|
|-- .gitignore
|   Ignores local runtime files, virtual environments, databases, logs, and model artifacts.
|
|-- dataset/
|   Historical stock CSV files used for training and prediction.
|   |-- ADANIPORTS.csv
|   |-- RELIANCE.csv
|   |-- TCS.csv
|   |-- NIFTY50_all.csv
|   |-- stock_metadata.csv
|   `-- ...
|
|-- templates/
|   Flask/Jinja HTML templates.
|   |-- base.html
|   |-- login.html
|   |-- register.html
|   |-- dashboard.html
|   `-- stock.html
|
|-- static/
|   Static frontend assets.
|   |-- css/
|   |   `-- style.css
|   `-- js/
|       `-- app.js
|
|-- models/
|   Generated model files. Not committed because trained model artifacts can be very large.
|
|-- instance/
|   Local SQLite database location. Not committed.
|
`-- stock_ai/venv/
    Local virtual environment. Not committed.
```

## Setup

1. Clone the repository.

```bash
git clone https://github.com/rohan1537/Stock_ai_prediction.git
cd Stock_ai_prediction
```

2. Create and activate a virtual environment.

```bash
python -m venv venv
venv\Scripts\activate
```

3. Install dependencies.

```bash
pip install -r requirements.txt
```

4. Train the model.

```bash
python train_model.py
```

This creates the model file under `models/`.

5. Run the application.

```bash
python app.py
```

6. Open the app in your browser.

```text
http://127.0.0.1:5000/
```

## Database

The application uses SQLite through Flask-SQLAlchemy. Tables are created automatically when the app starts.

Main tables:

- `user`: stores registered users
- `prediction`: stores user-specific stock prediction history

## Notes

- The trained model file is ignored because it is too large for a normal GitHub push.
- Run `python train_model.py` after cloning to regenerate the model locally.
- Local database files under `instance/` are ignored and created automatically.

