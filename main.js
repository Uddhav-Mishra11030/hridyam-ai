
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const APP_BRAND = 'HRIYDAM AI';
document.title = `${APP_BRAND} | Intelligent Cardiac Risk Visualization`;

const app = document.querySelector('#app');
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const modelOrder = ['CAD', 'LAD', 'LCX', 'RCA'];
const resultState = {
  fields: [],
  metrics: {},
  selectedModel: 'CAD',
  requestInFlight: false,
};

function getApiErrorMessage(error) {
  if (error && typeof error.message === 'string' && /Failed to fetch|fetch/i.test(error.message)) {
    return `Unable to reach the API. Check that the Flask backend is running and that the Vite proxy is configured.`;
  }

  if (error && typeof error.message === 'string') {
    return error.message;
  }

  return 'The API request failed unexpectedly.';
}

const FEATURE_GROUPS = [
  { title: 'Demographics', fields: ['Age', 'Weight', 'Length', 'Sex', 'BMI'] },
  {
    title: 'Medical History & Risk Factors',
    fields: ['DM', 'HTN', 'Current Smoker', 'EX-Smoker', 'FH', 'Obesity', 'CRF', 'CVA', 'Airway disease', 'Thyroid Disease', 'CHF', 'DLP'],
  },
  {
    title: 'Clinical Examination',
    fields: ['BP', 'PR', 'Edema', 'Weak Peripheral Pulse', 'Lung rales', 'Systolic Murmur', 'Diastolic Murmur', 'Typical Chest Pain', 'Dyspnea', 'Function Class'],
  },
  {
    title: 'ECG Findings',
    fields: ['Atypical', 'Nonanginal', 'Exertional CP', 'LowTH Ang', 'Q Wave', 'St Elevation', 'St Depression', 'Tinversion', 'LVH', 'Poor R Progression', 'BBB'],
  },
  {
    title: 'Laboratory & Echocardiography',
    fields: ['FBS', 'CR', 'TG', 'LDL', 'HDL', 'BUN', 'ESR', 'HB', 'K', 'Na', 'WBC', 'Lymph', 'Neut', 'PLT', 'EF-TTE', 'Region RWMA', 'VHD'],
  },
];

const FIELD_LABELS = {
  Age: 'Age',
  Weight: 'Weight',
  Length: 'Length',
  Sex: 'Sex',
  BMI: 'BMI',
  DM: 'Diabetes Mellitus (DM)',
  HTN: 'Hypertension (HTN)',
  'Current Smoker': 'Current Smoker',
  'EX-Smoker': 'Former Smoker',
  FH: 'Family History (FH)',
  Obesity: 'Obesity',
  CRF: 'Chronic Renal Failure (CRF)',
  CVA: 'Cerebrovascular Accident (CVA)',
  'Airway disease': 'Airway Disease',
  'Thyroid Disease': 'Thyroid Disease',
  CHF: 'Congestive Heart Failure (CHF)',
  DLP: 'Dyslipidemia (DLP)',
  BP: 'Blood Pressure (BP)',
  PR: 'Pulse Rate (PR)',
  Edema: 'Edema',
  'Weak Peripheral Pulse': 'Weak Peripheral Pulse',
  'Lung rales': 'Lung Rales',
  'Systolic Murmur': 'Systolic Murmur',
  'Diastolic Murmur': 'Diastolic Murmur',
  'Typical Chest Pain': 'Typical Chest Pain',
  Dyspnea: 'Dyspnea',
  'Function Class': 'Function Class',
  Atypical: 'Atypical',
  Nonanginal: 'Nonanginal',
  'Exertional CP': 'Exertional CP',
  'LowTH Ang': 'Low TH Ang',
  'Q Wave': 'Q Wave',
  'St Elevation': 'ST Elevation',
  'St Depression': 'ST Depression',
  Tinversion: 'T Inversion',
  LVH: 'Left Ventricular Hypertrophy (LVH)',
  'Poor R Progression': 'Poor R Progression',
  BBB: 'Bundle Branch Block (BBB)',
  FBS: 'Fasting Blood Sugar (FBS)',
  CR: 'Creatinine (CR)',
  TG: 'Triglycerides (TG)',
  LDL: 'LDL',
  HDL: 'HDL',
  BUN: 'Blood Urea Nitrogen (BUN)',
  ESR: 'Erythrocyte Sedimentation Rate (ESR)',
  HB: 'Hemoglobin (HB)',
  K: 'Potassium (K)',
  Na: 'Sodium (Na)',
  WBC: 'White Blood Cell Count (WBC)',
  Lymph: 'Lymphocytes',
  Neut: 'Neutrophils',
  PLT: 'Platelets (PLT)',
  'EF-TTE': 'Ejection Fraction (EF-TTE)',
  'Region RWMA': 'Regional Wall Motion Abnormality (RWMA)',
  VHD: 'Valvular Heart Disease (VHD)',
};

const FIELD_UNITS = {
  Age: 'years',
  Weight: 'kg',
  Length: 'cm',
  BMI: 'kg/m²',
  BP: 'mmHg',
  PR: 'bpm',
  'Typical Chest Pain': 'score',
  'Function Class': 'class',
  'Q Wave': 'mm',
  'St Elevation': 'mm',
  'St Depression': 'mm',
  Tinversion: 'mm',
  FBS: 'mg/dL',
  CR: 'mg/dL',
  TG: 'mg/dL',
  LDL: 'mg/dL',
  HDL: 'mg/dL',
  BUN: 'mg/dL',
  ESR: 'mm/hr',
  HB: 'g/dL',
  K: 'mmol/L',
  Na: 'mmol/L',
  WBC: '10^3/µL',
  Lymph: '%',
  Neut: '%',
  PLT: '10^3/µL',
  'EF-TTE': '%',
  'Region RWMA': 'segments',
};

const CATEGORY_DISPLAY_MAP = {
  Sex: { Fmale: 'Female', Male: 'Male' },
  Obesity: { N: 'No', Y: 'Yes' },
  CRF: { N: 'No', Y: 'Yes' },
  CVA: { N: 'No', Y: 'Yes' },
  'Airway disease': { N: 'No', Y: 'Yes' },
  'Thyroid Disease': { N: 'No', Y: 'Yes' },
  CHF: { N: 'No', Y: 'Yes' },
  DLP: { N: 'No', Y: 'Yes' },
  'Weak Peripheral Pulse': { N: 'No', Y: 'Yes' },
  'Lung rales': { N: 'No', Y: 'Yes' },
  'Systolic Murmur': { N: 'No', Y: 'Yes' },
  'Diastolic Murmur': { N: 'No', Y: 'Yes' },
  Dyspnea: { N: 'No', Y: 'Yes' },
  Atypical: { N: 'No', Y: 'Yes' },
  Nonanginal: { N: 'No', Y: 'Yes' },
  'Exertional CP': { N: 'No' },
  'LowTH Ang': { N: 'No', Y: 'Yes' },
  LVH: { N: 'No', Y: 'Yes' },
  'Poor R Progression': { N: 'No', Y: 'Yes' },
  BBB: { N: 'No', LBBB: 'Left Bundle Branch Block (LBBB)', RBBB: 'Right Bundle Branch Block (RBBB)' },
  VHD: { N: 'No', mild: 'Mild', Moderate: 'Moderate', Severe: 'Severe' },
};

function getVisibleValue(rawValue, fieldName) {
  const fieldMap = CATEGORY_DISPLAY_MAP[fieldName] || {};
  const normalized = String(rawValue).trim();
  if (fieldMap[normalized] !== undefined) {
    return fieldMap[normalized];
  }

  if (normalized === 'Y') return 'Yes';
  if (normalized === 'N') return 'No';
  if (normalized === 'mild') return 'Mild';
  if (normalized === 'Fmale') return 'Female';
  return normalized;
}

function getVisibleFieldLabel(fieldName) {
  return FIELD_LABELS[fieldName] || fieldName;
}

function buildSubmitButtonLabel() {
  return 'Predict Cardiac Risk';
}

app.innerHTML = `
  <header class="topbar">
    <div>
      <h1>${APP_BRAND}</h1>
      <p>Intelligent Cardiac Risk Visualization</p>
    </div>
    <span class="status">Medical AI Demo</span>
  </header>

  <main class="dashboard">
    <section class="panel patient-panel">
      <h2>Patient Information</h2>
      <p class="subtitle">Enter the required clinical fields before submission.</p>
      <form id="patient-form"></form>
      <div id="patient-result" aria-live="polite"></div>
    </section>

    <section class="panel heart-panel">
      <div class="heart-heading">
        <div>
          <h2>3D Cardiac Visualization</h2>
          <p class="subtitle">Interactive anatomical model</p>
        </div>
        <span class="live-dot">● Live View</span>
      </div>

      <div id="heart-view">
        <div id="loading">Loading 3D heart model...</div>
      </div>

      <div class="viewer-toolbar">
        <div id="anatomy-legend" class="anatomy-legend" aria-label="Anatomical label legend"></div>
        <button id="toggle-labels" type="button" class="toggle-labels">Hide labels</button>
      </div>

      <div id="anatomy-note" class="anatomy-note"></div>
      <div id="vessel-note" class="vessel-note"></div>
      <div id="vessel-legend" class="vessel-legend" aria-label="Vessel status legend"></div>
      <p class="hint">Drag to rotate · Scroll to zoom</p>
    </section>
  </main>

  <section class="panel insights-panel" aria-live="polite">
    <div class="insights-header">
      <h2>Model Evaluation and Explainability</h2>
      <label class="model-select-wrap" for="model-select">
        <span>Model</span>
        <select id="model-select" aria-label="Select model for evaluation metrics and feature importance"></select>
      </label>
    </div>

    <div class="metrics-layout">
      <div class="metrics-column">
        <h3>Held-out test metrics</h3>
        <div id="metrics-grid" class="metrics-grid"></div>
        <p class="insight-note">These values come from the saved test-set evaluation report and do not establish clinical reliability.</p>
      </div>

      <div class="importance-column">
        <h3>Top 10 permutation importance</h3>
        <div id="importance-chart" class="importance-chart"></div>
        <p class="insight-note">Global permutation importance describes model behavior on the evaluation set and is not a patient-specific explanation or proof of causation.</p>
      </div>
    </div>
  </section>

  <footer class="disclaimer-banner">
    Educational prototype only. Predictions are generated by machine learning models and are not validated for clinical diagnosis. This tool does not replace professional medical evaluation.
  </footer>
`;

const formElement = document.querySelector('#patient-form');
const resultElement = document.querySelector('#patient-result');
const vesselLegend = document.querySelector('#vessel-legend');
const vesselNote = document.querySelector('#vessel-note');
const metricsSelect = document.querySelector('#model-select');
const metricsGrid = document.querySelector('#metrics-grid');
const importanceChart = document.querySelector('#importance-chart');

resultElement.innerHTML = '<div class="result-box neutral">Complete the patient form to generate a model prediction.</div>';

function renderVesselFallback() {
  vesselLegend.innerHTML = `
    <div class="legend-row">
      <span class="legend-swatch normal"></span>
      <span>Normal</span>
    </div>
    <div class="legend-row">
      <span class="legend-swatch stenotic"></span>
      <span>Stenotic</span>
    </div>
    <div class="legend-row">
      <span class="legend-swatch unknown"></span>
      <span>Not available</span>
    </div>
  `;

  vesselNote.innerHTML = `
    <p>
      The current heart asset does not contain separate LAD, LCX, and RCA meshes.
      Vessel results are therefore shown as honest result cards rather than color-coded arteries.
    </p>
  `;
}

function renderAnatomyLegend() {
  const legend = document.querySelector('#anatomy-legend');
  if (!legend) return;

  const entries = [
    { name: 'Aorta', color: '#fcbf49' },
    { name: 'SVC', color: '#9ae6b4' },
    { name: 'Pulmonary artery', color: '#7dd3fc' },
    { name: 'Right atrium', color: '#fca5a5' },
    { name: 'Right ventricle', color: '#a7f3d0' },
    { name: 'Left atrium', color: '#c4b5fd' },
    { name: 'Left ventricle', color: '#93c5fd' },
    { name: 'LAD', color: '#f472b6' },
    { name: 'LCX', color: '#f59e0b' },
    { name: 'RCA', color: '#fb7185' },
  ];

  legend.innerHTML = entries
    .map((entry) => `
      <div class="legend-row anatomy-row">
        <span class="legend-swatch" style="background:${entry.color};"></span>
        <span>${entry.name}</span>
      </div>
    `)
    .join('');
}

async function loadSchema() {
  const response = await fetch(`${API_BASE_URL}/api/schema`, {
    headers: { Accept: 'application/json' },
  }).catch(() => fetch(`${API_BASE_URL}/api/features`, { headers: { Accept: 'application/json' } }));

  if (!response.ok) {
    throw new Error('Could not load model schema from the API.');
  }

  const data = await response.json();
  resultState.fields = data.features || [];
  buildForm(resultState.fields);
}

async function loadHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('The backend health endpoint is not responding.');
  }

  return response.json();
}

function buildField(field) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-group';

  const labelRow = document.createElement('div');
  labelRow.className = 'field-label-row';

  const label = document.createElement('label');
  label.setAttribute('for', field.name);
  label.textContent = getVisibleFieldLabel(field.name);

  if (FIELD_UNITS[field.name]) {
    const unit = document.createElement('span');
    unit.className = 'field-unit';
    unit.textContent = `(${FIELD_UNITS[field.name]})`;
    labelRow.appendChild(label);
    labelRow.appendChild(unit);
  } else {
    labelRow.appendChild(label);
  }

  wrapper.appendChild(labelRow);

  let input;
  if (field.kind === 'category') {
    input = document.createElement('select');
    input.name = field.name;
    input.id = field.name;
    input.required = true;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select an option';
    input.appendChild(placeholder);

    (field.options || []).forEach((option) => {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = getVisibleValue(option, field.name);
      input.appendChild(optionElement);
    });
  } else {
    input = document.createElement('input');
    input.type = 'number';
    input.name = field.name;
    input.id = field.name;
    input.step = 'any';
    input.placeholder = `Enter ${getVisibleFieldLabel(field.name)}`;
    input.required = true;
  }

  wrapper.appendChild(input);
  return wrapper;
}

function resetForm() {
  formElement.reset();
  showResultState('Patient form reset. Complete the required data to generate a new prediction.', 'neutral');
}

function buildForm(fields) {
  formElement.replaceChildren();

  if (!fields.length) {
    formElement.innerHTML = '<p class="notice">No model schema available yet.</p>';
    return;
  }

  const fieldMap = new Map(fields.map((field) => [field.name, field]));

  FEATURE_GROUPS.forEach((group) => {
    const section = document.createElement('details');
    section.className = 'form-section';
    section.open = true;

    const summary = document.createElement('summary');
    summary.textContent = group.title;

    const sectionBody = document.createElement('div');
    sectionBody.className = 'form-section-body';

    group.fields.forEach((fieldName) => {
      const field = fieldMap.get(fieldName);
      if (!field) {
        return;
      }
      sectionBody.appendChild(buildField(field));
    });

    section.appendChild(summary);
    section.appendChild(sectionBody);
    formElement.appendChild(section);
  });

  const actionRow = document.createElement('div');
  actionRow.className = 'form-actions';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'secondary-button';
  resetButton.textContent = 'Reset Form';
  resetButton.addEventListener('click', resetForm);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = buildSubmitButtonLabel();

  actionRow.appendChild(resetButton);
  actionRow.appendChild(submitButton);
  formElement.appendChild(actionRow);

  formElement.removeEventListener('submit', handleSubmit);
  formElement.addEventListener('submit', handleSubmit);
}

function showResultState(message, type = 'info') {
  resultElement.innerHTML = `<div class="result-box ${type}">${message}</div>`;
}

function resetSubmitButton() {
  const submitButton = formElement.querySelector('button[type="submit"]');
  if (!submitButton) {
    return;
  }

  submitButton.disabled = false;
  submitButton.textContent = 'Predict Cardiac Risk';
}

async function handleSubmit(event) {
  event.preventDefault();

  if (resultState.requestInFlight) {
    return;
  }

  const payload = {};
  let invalidField = null;

  for (const field of resultState.fields) {
    const rawValue = new FormData(event.currentTarget).get(field.name);
    const isMissing = rawValue === null || (typeof rawValue === 'string' && rawValue.trim() === '');

    if (isMissing) {
      invalidField = field.name;
      break;
    }

    if (field.kind === 'number') {
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) {
        invalidField = field.name;
        break;
      }
      payload[field.name] = numericValue;
    } else {
      payload[field.name] = String(rawValue).trim();
    }
  }

  if (invalidField) {
    showResultState(`Please complete the required field "${invalidField}" before submitting.`, 'error');
    return;
  }

  resultState.requestInFlight = true;
  const submitButton = formElement.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
  }

  showResultState('Submitting patient data to the prediction API...', 'loading');

  try {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error('The prediction API returned an invalid JSON response.');
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Prediction request failed.');
    }

    if (!data || !data.predictions || typeof data.predictions !== 'object') {
      throw new Error('The API response did not contain prediction results.');
    }

    renderPredictions(data);
  } catch (error) {
    showResultState(`Prediction failed: ${error.message}`, 'error');
  } finally {
    resultState.requestInFlight = false;
    resetSubmitButton();
  }
}

function renderPredictions(data) {
  const predictions = data.predictions || {};
  const cards = modelOrder
    .map((name) => {
      const value = predictions[name] || {};
      const prediction = value.prediction ?? 'Unavailable';
      const probability = Number(value.probability);
      const probabilityPercent = Number.isFinite(probability) ? (probability * 100).toFixed(1) : 'N/A';
      const className = /stenotic|cad|positive|yes/i.test(String(prediction)) ? 'stenotic' : 'normal';

      const probabilityList = Object.entries(value.probabilities || {})
        .map(([label, score]) => {
          const numericScore = Number(score);
          const percentage = Number.isFinite(numericScore) ? `${(numericScore * 100).toFixed(1)}%` : 'N/A';
          return `<li><span>${label}</span><strong>${percentage}</strong></li>`;
        })
        .join('');

      return `
        <div class="risk-card ${className}">
          <h3>${name === 'CAD' ? 'Overall CAD' : name}</h3>
          <p class="prediction-label">Prediction</p>
          <p class="prediction-value">${prediction}</p>
          <p class="prediction-probability">Probability: ${probabilityPercent}%</p>
          <ul class="confidence-list">${probabilityList || '<li><span>Probability</span><strong>Unavailable</strong></li>'}</ul>
        </div>
      `;
    })
    .join('');

  resultElement.innerHTML = `
    <div class="result-box success">
      <h3>Prediction Results</h3>
      <p class="small-note">Model estimates from the backend. This is not a medical diagnosis.</p>
      <div class="risk-grid">${cards}</div>
      <p class="disclaimer">Educational prototype only. Not validated for clinical diagnosis or treatment decisions.</p>
    </div>
  `;
}

async function loadMetrics() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/metrics`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Could not load saved evaluation metrics.');
    }

    const data = await response.json();
    resultState.metrics = data.metrics || {};
    populateMetricSelector();
    renderMetricsPanel();
  } catch (error) {
    metricsGrid.innerHTML = `<div class="notice-box error">${getApiErrorMessage(error)}</div>`;
    importanceChart.innerHTML = '<div class="notice-box">No saved feature importance was available.</div>';
  }
}

function populateMetricSelector() {
  if (!metricsSelect) {
    return;
  }

  const availableModels = Object.keys(resultState.metrics.targets || {});
  metricsSelect.innerHTML = '';

  if (!availableModels.length) {
    const option = document.createElement('option');
    option.value = 'CAD';
    option.textContent = 'No metrics available';
    metricsSelect.appendChild(option);
    return;
  }

  availableModels.forEach((modelName) => {
    const option = document.createElement('option');
    option.value = modelName;
    option.textContent = modelName === 'CAD' ? 'Overall CAD' : modelName;
    metricsSelect.appendChild(option);
  });

  if (availableModels.includes(resultState.selectedModel)) {
    metricsSelect.value = resultState.selectedModel;
  } else {
    resultState.selectedModel = availableModels[0];
    metricsSelect.value = resultState.selectedModel;
  }

  metricsSelect.onchange = () => {
    resultState.selectedModel = metricsSelect.value;
    renderMetricsPanel();
  };
}

function formatMetric(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  return Number(value).toFixed(3);
}

function renderMetricsPanel() {
  const selectedModel = resultState.selectedModel || 'CAD';
  const targetMetrics = resultState.metrics?.targets?.[selectedModel];

  if (!targetMetrics) {
    metricsGrid.innerHTML = '<div class="notice-box">No saved test metrics are available for this model.</div>';
    importanceChart.innerHTML = '<div class="notice-box">No saved permutation importance is available for this model.</div>';
    return;
  }

  const metricCards = [
    ['Accuracy', targetMetrics.accuracy],
    ['Precision', targetMetrics.precision],
    ['Recall', targetMetrics.recall],
    ['F1-score', targetMetrics.f1_score],
    ['ROC-AUC', targetMetrics.roc_auc],
  ]
    .map(([label, value]) => `
      <div class="metric-card">
        <span class="metric-label">${label}</span>
        <strong>${formatMetric(value)}</strong>
      </div>
    `)
    .join('');

  const matrix = Array.isArray(targetMetrics.confusion_matrix) ? targetMetrics.confusion_matrix : [];
  const matrixMarkup = matrix.length
    ? `
      <div class="metric-card matrix-card">
        <span class="metric-label">Confusion matrix</span>
        <div class="matrix-grid">
          ${matrix
            .map((row) => row.map((cell) => `<div class="matrix-cell">${cell}</div>`).join(''))
            .join('')}
        </div>
      </div>
    `
    : '<div class="metric-card"><span class="metric-label">Confusion matrix</span><strong>Not available</strong></div>';

  metricsGrid.innerHTML = `
    <div class="metric-grid">${metricCards}${matrixMarkup}</div>
  `;

  const importanceEntries = Array.isArray(targetMetrics.feature_importance) ? targetMetrics.feature_importance.slice(0, 10) : [];
  if (!importanceEntries.length) {
    importanceChart.innerHTML = '<div class="notice-box">No saved permutation importance is available for this model.</div>';
    return;
  }

  const maxImportance = Math.max(...importanceEntries.map((entry) => Number(entry.importance) || 0), 1);
  importanceChart.innerHTML = importanceEntries
    .map(({ feature, importance }, index) => {
      const value = Number(importance) || 0;
      const width = ((value / maxImportance) * 100).toFixed(1);
      return `
        <div class="importance-item">
          <div class="importance-label-row">
            <span>${index + 1}. ${feature}</span>
            <strong>${Number(value).toFixed(4)}</strong>
          </div>
          <div class="importance-bar">
            <span style="width: ${Math.max(width, 6)}%"></span>
          </div>
        </div>
      `;
    })
    .join('');
}

const view = document.querySelector('#heart-view');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#101522');

const camera = new THREE.PerspectiveCamera(
  42,
  view.clientWidth / view.clientHeight,
  0.01,
  1000
);
camera.position.set(0, 0.2, 5.8);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(view.clientWidth, view.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
view.appendChild(renderer.domElement);

const annotationLayer = document.createElement('div');
annotationLayer.className = 'annotation-layer';
annotationLayer.style.position = 'absolute';
annotationLayer.style.inset = '0';
annotationLayer.style.pointerEvents = 'none';
annotationLayer.style.zIndex = '2';
view.appendChild(annotationLayer);

const annotationCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
annotationCanvas.setAttribute('class', 'annotation-canvas');
annotationCanvas.setAttribute('viewBox', '0 0 1000 1000');
annotationCanvas.setAttribute('preserveAspectRatio', 'xMidYMid meet');
annotationCanvas.style.position = 'absolute';
annotationCanvas.style.inset = '0';
annotationCanvas.style.width = '100%';
annotationCanvas.style.height = '100%';
annotationLayer.appendChild(annotationCanvas);

scene.add(new THREE.HemisphereLight(0xffffff, 0x454566, 2.5));

const mainLight = new THREE.DirectionalLight(0xffffff, 3);
mainLight.position.set(4, 5, 6);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x8aaaff, 1.5);
fillLight.position.set(-4, 1, -3);
scene.add(fillLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3.2;
controls.maxDistance = 16;

const loading = document.querySelector('#loading');
const loader = new GLTFLoader();
const anatomicalLabels = [];
let anatomyVisible = true;
let heartModel = null;

function createAnatomicalLabels(heartModel) {
  const note = document.querySelector('#anatomy-note');
  if (note) {
    note.innerHTML = `
      <p>
        Approximate educational labels only. The current GLB model does not expose separate, verified LAD/LCX/RCA mesh segments, so these vessel annotations are approximate visual anchors rather than anatomically segmented vessel surfaces.
      </p>
    `;
  }

  const box = new THREE.Box3().setFromObject(heartModel);
  const size = box.getSize(new THREE.Vector3());
  const point = (x, y, z) => new THREE.Vector3(x * size.x, y * size.y, z * size.z);

  const labelConfigs = [
    { name: 'Aorta', color: '#fcbf49', anchor: point(0.68, 0.78, 0.14), screenOffset: { x: -20, y: -150 } },
    { name: 'Right Atrium', color: '#fca5a5', anchor: point(0.14, 0.58, 0.12), screenOffset: { x: 160, y: -120 } },
    { name: 'Left Atrium', color: '#c4b5fd', anchor: point(-0.30, 0.32, 0.22), screenOffset: { x: -220, y: -70 } },
    { name: 'LCX', color: '#f59e0b', anchor: point(-0.36, 0.08, 0.18), screenOffset: { x: -280, y: 30 } },
    { name: 'LAD', color: '#f472b6', anchor: point(0.02, 0.12, 0.12), screenOffset: { x: -10, y: -35 } },
    { name: 'RCA', color: '#fb7185', anchor: point(0.34, -0.06, -0.04), screenOffset: { x: 270, y: 130 } },
    { name: 'Right Ventricle', color: '#a7f3d0', anchor: point(0.08, -0.22, 0.10), screenOffset: { x: 120, y: 170 } },
    { name: 'Left Ventricle', color: '#93c5fd', anchor: point(-0.26, -0.44, 0.12), screenOffset: { x: -150, y: 215 } },
  ];

  anatomicalLabels.length = 0;
  annotationCanvas.innerHTML = '';

  labelConfigs.forEach((config) => {
    const anchorPoint = config.anchor.clone();

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', config.color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', '0.8');
    annotationCanvas.appendChild(line);

    const endpoint = document.createElement('div');
    endpoint.className = 'annotation-point';
    endpoint.style.setProperty('--point-color', config.color);
    annotationLayer.appendChild(endpoint);

    const labelDiv = document.createElement('div');
    labelDiv.className = 'anatomy-label';
    labelDiv.innerHTML = `
      <span class="anatomy-label-badge" style="--label-color:${config.color};">
        <span class="label-dot"></span>
        <span>${config.name}</span>
      </span>
    `;
    annotationLayer.appendChild(labelDiv);

    anatomicalLabels.push({
      anchor: anchorPoint,
      screenOffset: config.screenOffset,
      line,
      endpoint,
      labelDiv,
      color: config.color,
      visible: anatomyVisible,
    });
  });

  const toggleButton = document.querySelector('#toggle-labels');
  if (toggleButton) {
    toggleButton.textContent = anatomyVisible ? 'Hide labels' : 'Show labels';
    toggleButton.onclick = () => {
      anatomyVisible = !anatomyVisible;
      anatomicalLabels.forEach((entry) => {
        entry.labelDiv.style.display = anatomyVisible ? 'block' : 'none';
        entry.endpoint.style.display = anatomyVisible ? 'block' : 'none';
        entry.line.setAttribute('display', anatomyVisible ? 'block' : 'none');
      });
      toggleButton.textContent = anatomyVisible ? 'Hide labels' : 'Show labels';
    };
  }
}

loader.load(
  '/heart.glb',
  (gltf) => {
    heartModel = gltf.scene;
    const box = new THREE.Box3().setFromObject(heartModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    heartModel.position.sub(center);
    const maxDimension = Math.max(size.x, size.y, size.z);

    if (maxDimension > 0) {
      heartModel.scale.setScalar(4.2 / maxDimension);
    }

    heartModel.rotation.set(0.18, -0.65, 0.08);
    heartModel.position.y = 0.12;

    scene.add(heartModel);
    controls.target.set(0, 0.1, 0);
    camera.position.set(0, 0.15, 5.8);
    controls.update();

    createAnatomicalLabels(heartModel);
    renderAnatomyLegend();

    loading?.remove();
    console.log('3D anatomical heart loaded successfully.');
  },
  undefined,
  (error) => {
    console.error('Heart model loading failed:', error);
    if (loading) {
      loading.textContent = 'Heart model could not load. Check public/heart.glb.';
      loading.classList.add('error');
    }
  }
);

function projectPointToViewer(point) {
  const width = view.clientWidth || 1000;
  const height = view.clientHeight || 700;
  const vector = point.clone().project(camera);
  return {
    x: ((vector.x + 1) / 2) * width,
    y: (1 - ((vector.y + 1) / 2)) * height,
  };
}

function clampLabelPosition(x, y, width, height) {
  const labelPadding = 40;
  const maxX = width - labelPadding;
  const minX = labelPadding;
  const maxY = height - labelPadding;
  const minY = labelPadding;

  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
}

function updateAnnotationPositions() {
  if (!heartModel || !anatomicalLabels.length) return;

  const width = view.clientWidth || 1000;
  const height = view.clientHeight || 700;
  annotationCanvas.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const center = projectPointToViewer(heartModel.position.clone());
  const placed = [];

  anatomicalLabels.forEach((entry) => {
    const anchorWorld = entry.anchor.clone().applyMatrix4(heartModel.matrixWorld);
    const anchorScreen = projectPointToViewer(anchorWorld);

    const labelX = center.x + (entry.screenOffset?.x || 0);
    const labelY = center.y + (entry.screenOffset?.y || 0);
    const safePos = clampLabelPosition(labelX, labelY, width, height);

    const labelWidth = 120;
    const labelHeight = 28;
    let finalX = safePos.x;
    let finalY = safePos.y;

    for (const other of placed) {
      const dx = Math.abs(finalX - other.x);
      const dy = Math.abs(finalY - other.y);
      if (dx < labelWidth && dy < labelHeight) {
        finalX = other.x + (finalX < other.x ? -labelWidth * 0.7 : labelWidth * 0.7);
        finalY = other.y + (finalY < other.y ? -labelHeight * 0.6 : labelHeight * 0.6);
      }
    }

    const resolved = clampLabelPosition(finalX, finalY, width, height);
    placed.push({ x: resolved.x, y: resolved.y });

    entry.line.setAttribute('x1', String(anchorScreen.x));
    entry.line.setAttribute('y1', String(anchorScreen.y));
    entry.line.setAttribute('x2', String(resolved.x));
    entry.line.setAttribute('y2', String(resolved.y));
    entry.line.style.display = anatomyVisible ? 'block' : 'none';

    entry.labelDiv.style.left = `${resolved.x}px`;
    entry.labelDiv.style.top = `${resolved.y}px`;
    entry.labelDiv.style.display = anatomyVisible ? 'block' : 'none';

    entry.endpoint.style.left = `${anchorScreen.x}px`;
    entry.endpoint.style.top = `${anchorScreen.y}px`;
    entry.endpoint.style.display = anatomyVisible ? 'block' : 'none';
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  updateAnnotationPositions();
}

animate();

window.addEventListener('resize', () => {
  const width = view.clientWidth;
  const height = view.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  annotationCanvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
});

renderVesselFallback();
renderAnatomyLegend();

loadHealth()
  .then(() => {
    return loadSchema();
  })
  .catch((error) => {
    showResultState(`API schema failed to load: ${getApiErrorMessage(error)}`, 'error');
  });

loadMetrics().catch((error) => {
  metricsGrid.innerHTML = `<div class="notice-box error">${getApiErrorMessage(error)}</div>`;
  importanceChart.innerHTML = '<div class="notice-box">Feature importance could not be loaded.</div>';
});
