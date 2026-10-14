
import pandas as pd
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
)

# 1. Load dataset
project_dir = Path(__file__).parent
excel_files = list((project_dir / "data").glob("*.xlsx"))

if not excel_files:
    raise FileNotFoundError("Excel dataset data folder mein nahi mili.")

df = pd.read_excel(excel_files[0])
print("Dataset loaded:", df.shape)

# 2. Define target and remove target leakage
target = "Cath"
excluded_targets = ["Cath", "LAD", "LCX", "RCA"]

df = df.dropna(subset=[target]).copy()
X = df.drop(columns=excluded_targets)
y = df[target].astype(str).str.strip()

# 3. Encode target labels
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

print("CAD target classes:", list(label_encoder.classes_))

# 4. Separate numeric and categorical inputs
numeric_cols = X.select_dtypes(include="number").columns.tolist()
categorical_cols = X.select_dtypes(exclude="number").columns.tolist()

numeric_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="median"))
])

categorical_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore"))
])

preprocessor = ColumnTransformer([
    ("numeric", numeric_pipeline, numeric_cols),
    ("categorical", categorical_pipeline, categorical_cols),
])

# 5. Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y_encoded,
    test_size=0.2,
    random_state=42,
    stratify=y_encoded,
)

# 6. Train model
model = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        class_weight="balanced",
    )),
])

model.fit(X_train, y_train)

# 7. Evaluate on held-out test data
predictions = model.predict(X_test)

print("\n--- Test Results ---")
print("Accuracy:", round(accuracy_score(y_test, predictions), 3))
print("Precision (macro):", round(
    precision_score(y_test, predictions, average="macro", zero_division=0), 3
))
print("Recall (macro):", round(
    recall_score(y_test, predictions, average="macro", zero_division=0), 3
))
print("F1-score (macro):", round(
    f1_score(y_test, predictions, average="macro", zero_division=0), 3
))

print("\nClassification report:")
print(classification_report(
    y_test,
    predictions,
    labels=range(len(label_encoder.classes_)),
    target_names=label_encoder.classes_,
    zero_division=0,
))

import joblib

model_dir = Path(__file__).parent / "models"
model_dir.mkdir(exist_ok=True)

joblib.dump(
    {
        "model": model,
        "label_encoder": label_encoder,
        "feature_columns": X.columns.tolist(),
    },
    model_dir / "cad_model.joblib",
)

print("\nModel saved to:", model_dir / "cad_model.joblib")
