
from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE_DIR / "artifacts"
LEGACY_MODEL_DIR = BASE_DIR / "models"

TARGET_ORDER = ["CAD", "LAD", "LCX", "RCA"]
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "Accept"],
    methods=["GET", "POST", "OPTIONS"],
)


def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_bundle(model_name):
    candidate_paths = [
        ARTIFACT_DIR / f"{model_name.lower()}_model.joblib",
        LEGACY_MODEL_DIR / f"{model_name.lower()}_model.joblib",
    ]

    for path in candidate_paths:
        if path.exists():
            return joblib.load(path)

    raise FileNotFoundError(f"No trained model found for {model_name}. Run python3 ml_model.py first.")


MODEL_BUNDLES = {target: load_bundle(target) for target in TARGET_ORDER}
SCHEMA = load_json(ARTIFACT_DIR / "schema.json") if (ARTIFACT_DIR / "schema.json").exists() else []
METRICS = load_json(ARTIFACT_DIR / "metrics.json") if (ARTIFACT_DIR / "metrics.json").exists() else {"targets": {}}
FEATURES_BY_NAME = {field["name"]: field for field in SCHEMA}


def validate_payload(payload):
    if not isinstance(payload, dict):
        return None, {"error": "Send patient features as a JSON object."}, 400

    missing = []
    for field in SCHEMA:
        name = field["name"]
        value = payload.get(name)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(name)

    if missing:
        return None, {
            "error": "Required model inputs are missing.",
            "missing_count": len(missing),
            "missing_features": missing,
        }, 400

    normalized = {}
    for field in SCHEMA:
        name = field["name"]
        value = payload.get(name)
        kind = field.get("kind", "number")

        try:
            if kind == "number":
                normalized[name] = float(value)
            else:
                text = str(value).strip()
                options = field.get("options", [])
                if options and text not in [str(option).strip() for option in options]:
                    raise ValueError(f"{name} must be one of: {options}")
                normalized[name] = text
        except (TypeError, ValueError) as exc:
            return None, {"error": f"Invalid value for '{name}': {exc}"}, 400

    return normalized, None, None


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "api_ready": True,
        "models_loaded": {target: True for target in TARGET_ORDER},
        "warning": "Educational prototype only. Not validated for clinical diagnosis.",
    })


@app.get("/api/features")
def get_features():
    return jsonify({
        "features": SCHEMA,
        "count": len(SCHEMA),
        "excluded_target_columns": ["Cath", "LAD", "LCX", "RCA"],
        "warning": "Educational prototype only. Not validated for clinical diagnosis.",
    })


@app.get("/api/schema")
def get_schema():
    return get_features()


@app.get("/api/metrics")
def get_metrics():
    return jsonify({
        "metrics": METRICS,
        "warning": METRICS.get("warning", "Educational prototype only. Not validated for clinical diagnosis."),
    })


@app.post("/api/predict")
def predict():
    cleaned, error_payload, error_code = validate_payload(request.get_json(silent=True))
    if error_payload is not None:
        return jsonify(error_payload), error_code

    row = pd.DataFrame([cleaned], columns=[field["name"] for field in SCHEMA])
    predictions = {}

    for target in TARGET_ORDER:
        bundle = MODEL_BUNDLES[target]
        model = bundle["pipeline"]
        classes = list(getattr(model, "classes_", []))
        class_labels = bundle.get("class_labels", {0: "Normal", 1: "Stenotic"})

        predicted_class_code = int(model.predict(row)[0])
        predicted_label = class_labels.get(predicted_class_code, str(predicted_class_code))

        probabilities = model.predict_proba(row)[0]
        probability_map = {
            class_labels.get(int(class_id), str(class_id)): round(float(prob), 4)
            for class_id, prob in zip(classes, probabilities)
        }

        predictions[target] = {
            "prediction": predicted_label,
            "probabilities": probability_map,
            "probability": round(float(max(probability_map.values())), 4),
        }

    return jsonify({
        "predictions": predictions,
        "disclaimer": "Educational prototype only. Not validated for clinical diagnosis or treatment decisions.",
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
