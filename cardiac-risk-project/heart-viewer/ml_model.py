
# CardioVision AI
# CAD, LAD, LCX and RCA prediction models

from __future__ import annotations

import json
import re
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ARTIFACT_DIR = BASE_DIR / "artifacts"
MODEL_DIR = BASE_DIR / "models"

ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)

TARGET_COLUMNS = {
    "CAD": "Cath",
    "LAD": "LAD",
    "LCX": "LCX",
    "RCA": "RCA",
}

TARGET_LABELS = {
    "CAD": {"negative": "Normal", "positive": "CAD"},
    "LAD": {"negative": "Normal", "positive": "Stenotic"},
    "LCX": {"negative": "Normal", "positive": "Stenotic"},
    "RCA": {"negative": "Normal", "positive": "Stenotic"},
}


def normalize_name(name):
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def find_column(columns, wanted_name):
    lookup = {normalize_name(column): column for column in columns}
    return lookup.get(normalize_name(wanted_name))


def normalize_target_values(series, target_name):
    label_map = {
        "0": 0,
        "0.0": 0,
        "normal": 0,
        "no": 0,
        "negative": 0,
        "false": 0,
        "1": 1,
        "1.0": 1,
        "yes": 1,
        "positive": 1,
        "true": 1,
        "cad": 1,
        "stenotic": 1,
        "stenosis": 1,
    }

    normalized = []
    invalid = []

    for value in series:
        if pd.isna(value):
            normalized.append(np.nan)
            continue

        key = str(value).strip().lower()
        if key in label_map:
            normalized.append(label_map[key])
            continue

        invalid.append(str(value))

    if invalid:
        invalid_values = sorted(set(invalid))
        raise ValueError(
            f"Unsupported labels for target '{target_name}': {invalid_values}. "
            "Allowed labels include Normal/No/0 and CAD/Stenotic/Yes/1."
        )

    return pd.Series(normalized, index=series.index, dtype="float64")


def build_preprocessor(X):
    numeric_columns = X.select_dtypes(include=["number", "bool"]).columns.tolist()
    categorical_columns = [column for column in X.columns if column not in numeric_columns]

    transformers = []

    if numeric_columns:
        transformers.append(
            ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric_columns)
        )

    if categorical_columns:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_columns,
            )
        )

    if not transformers:
        raise ValueError("No compatible feature columns found for training.")

    return ColumnTransformer(transformers=transformers)


def build_model(X):
    preprocessor = build_preprocessor(X)
    classifier = ExtraTreesClassifier(
        n_estimators=400,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    return Pipeline([("preprocessor", preprocessor), ("classifier", classifier)])


def load_dataset():
    excel_files = sorted(DATA_DIR.glob("*.xlsx"))
    if not excel_files:
        raise FileNotFoundError(f"No .xlsx dataset found in: {DATA_DIR}")

    dataset_path = excel_files[0]
    print(f"Loading dataset from: {dataset_path.name}")
    data = pd.read_excel(dataset_path)
    data.columns = [str(column).strip() for column in data.columns]
    print(f"Dataset shape: {data.shape}")
    return data


def build_feature_schema(data, feature_columns):
    schema = []
    for column in feature_columns:
        series = data[column]
        if pd.api.types.is_numeric_dtype(series):
            schema.append({
                "name": column,
                "kind": "number",
                "default": None,
            })
        else:
            options = sorted({str(value).strip() for value in series.dropna().unique() if str(value).strip()})
            schema.append({
                "name": column,
                "kind": "category",
                "default": None,
                "options": options,
            })
    return schema


def save_bundle(target_name, model, feature_columns, negative_label, positive_label):
    bundle = {
        "pipeline": model,
        "feature_columns": feature_columns,
        "target_name": target_name,
        "negative_label": negative_label,
        "positive_label": positive_label,
        "class_labels": {0: negative_label, 1: positive_label},
    }

    artifact_path = ARTIFACT_DIR / f"{target_name.lower()}_model.joblib"
    joblib.dump(bundle, artifact_path)
    joblib.dump(bundle, MODEL_DIR / f"{target_name.lower()}_model.joblib")
    print(f"Saved model: {artifact_path.name}")


def evaluate_target(model, X_test, y_test, feature_columns):
    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)

    if len(model.classes_) != 2:
        raise ValueError(f"Expected binary target but found classes: {list(model.classes_)}")

    positive_index = int(np.where(model.classes_ == 1)[0][0])
    positive_probabilities = probabilities[:, positive_index]

    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision": float(precision_score(y_test, predictions, zero_division=0)),
        "recall": float(recall_score(y_test, predictions, zero_division=0)),
        "f1_score": float(f1_score(y_test, predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, positive_probabilities)),
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=[0, 1]).tolist(),
        "training_samples": int(len(X_test) * 0),
    }

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        permutation = permutation_importance(
            model,
            X_test,
            y_test,
            n_repeats=5,
            random_state=42,
            scoring="f1",
            n_jobs=-1,
        )

    ranked = sorted(
        [
            {"feature": feature, "importance": float(score)}
            for feature, score in zip(feature_columns, permutation.importances_mean)
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )
    metrics["feature_importance"] = ranked[:10]
    metrics["classification_report"] = classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["Normal", "Positive"],
        zero_division=0,
    )
    return metrics


def train_all_models():
    data = load_dataset()
    resolved_targets = {}

    for model_name, expected_column in TARGET_COLUMNS.items():
        actual_column = find_column(data.columns, expected_column)
        if actual_column is None:
            raise ValueError(
                f"Target column {expected_column!r} not found. Available columns: {data.columns.tolist()}"
            )
        resolved_targets[model_name] = actual_column

    outcome_keys = {normalize_name(col) for col in resolved_targets.values()}
    feature_columns = [
        column for column in data.columns if normalize_name(column) not in outcome_keys
    ]

    if not feature_columns:
        raise ValueError("No predictor features found after excluding outcome columns.")

    schema = build_feature_schema(data, feature_columns)
    with (ARTIFACT_DIR / "schema.json").open("w", encoding="utf-8") as schema_file:
        json.dump(schema, schema_file, indent=2)

    print(f"Feature count: {len(feature_columns)}")
    print("Excluded target columns:", resolved_targets)

    report = {
        "dataset_rows": int(len(data)),
        "feature_columns": feature_columns,
        "target_columns": resolved_targets,
        "targets": {},
        "warning": "Educational research prototype only. Not validated for clinical diagnosis.",
    }

    for target_name, target_column in resolved_targets.items():
        print("\n" + "=" * 48)
        print(f"Training model: {target_name}")
        print(f"Target column: {target_column}")
        print("=" * 48)

        y_raw = data[target_column]
        y_numeric = normalize_target_values(y_raw, target_name)
        valid_rows = y_numeric.notna()

        X = data.loc[valid_rows, feature_columns].copy()
        y = y_numeric.loc[valid_rows].astype(int)

        print("Target distribution:", y.value_counts().sort_index().to_dict())

        if y.nunique() != 2:
            raise ValueError(f"{target_name} does not contain both classes after normalization.")
        if y.value_counts().min() < 2:
            raise ValueError(
                f"{target_name} has fewer than two examples in one class; stratified splitting is not possible."
            )

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.25,
            random_state=42,
            stratify=y,
        )

        model = build_model(X_train)
        model.fit(X_train, y_train)

        metrics = {
            "accuracy": float(accuracy_score(y_test, model.predict(X_test))),
            "precision": float(precision_score(y_test, model.predict(X_test), zero_division=0)),
            "recall": float(recall_score(y_test, model.predict(X_test), zero_division=0)),
            "f1_score": float(f1_score(y_test, model.predict(X_test), zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])),
            "confusion_matrix": confusion_matrix(y_test, model.predict(X_test), labels=[0, 1]).tolist(),
            "training_samples": int(len(X_train)),
            "testing_samples": int(len(X_test)),
        }

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            permutation = permutation_importance(
                model,
                X_test,
                y_test,
                n_repeats=5,
                random_state=42,
                scoring="f1",
                n_jobs=-1,
            )

        metrics["feature_importance"] = [
            {"feature": feature, "importance": float(score)}
            for feature, score in zip(feature_columns, permutation.importances_mean)
        ]
        metrics["feature_importance"] = sorted(
            metrics["feature_importance"],
            key=lambda item: item["importance"],
            reverse=True,
        )[:10]

        print(f"Accuracy:  {metrics['accuracy']:.3f}")
        print(f"Precision: {metrics['precision']:.3f}")
        print(f"Recall:    {metrics['recall']:.3f}")
        print(f"F1-score:  {metrics['f1_score']:.3f}")
        print(f"ROC-AUC:   {metrics['roc_auc']:.3f}")
        print("\nClassification report:")
        print(
            classification_report(
                y_test,
                model.predict(X_test),
                labels=[0, 1],
                target_names=[TARGET_LABELS[target_name]["negative"], TARGET_LABELS[target_name]["positive"]],
                zero_division=0,
            )
        )

        negative_label = TARGET_LABELS[target_name]["negative"]
        positive_label = TARGET_LABELS[target_name]["positive"]
        save_bundle(target_name, model, feature_columns, negative_label, positive_label)
        report["targets"][target_name] = metrics

    with (ARTIFACT_DIR / "metrics.json").open("w", encoding="utf-8") as metrics_file:
        json.dump(report, metrics_file, indent=2)

    print("\nSaved schema.json and metrics.json in:", ARTIFACT_DIR)


if __name__ == "__main__":
    train_all_models()

