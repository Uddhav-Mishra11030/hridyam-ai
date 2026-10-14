
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene;
let camera;
let renderer;
let controls;
let heartModel;
let animationFrameId;

const MODEL_URL = `${import.meta.env.BASE_URL}heart.glb`;

function showModelMessage(message, isError = false) {
  const container = document.getElementById('heart-viewer');

  if (!container) {
    console[isError ? 'error' : 'log'](message);
    return;
  }

  let status = container.querySelector('.heart-model-status');

  if (!status) {
    status = document.createElement('div');
    status.className = 'heart-model-status';
    Object.assign(status.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: '2'
    });
    container.appendChild(status);
  }

  status.textContent = message;
  status.style.color = isError ? '#ff7b89' : '#a8b8cc';
  status.style.display = 'flex';
}

function hideModelMessage() {
  const status = document.querySelector(
    '#heart-viewer .heart-model-status'
  );

  if (status) status.style.display = 'none';
}

function initHeartViewer() {
  const container = document.getElementById('heart-viewer');

  if (!container) {
    console.error(
      'Missing #heart-viewer element in index.html'
    );
    return;
  }

  // Prevent duplicate initialization.
  if (renderer) return;

  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#101522');

const camera = new THREE.PerspectiveCamera(
  42,
  view.clientWidth / view.clientHeight,
  0.01,
  1000
);
camera.position.set(0, 0.2, 5.8);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.setSize(
    container.clientWidth,
    container.clientHeight
  );

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  container.appendChild(renderer.domElement);

  Object.assign(renderer.domElement.style, {
    display: 'block',
    width: '100%',
    height: '100%'
  });

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(4, 5, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8abaff, 1.5);
  fillLight.position.set(-5, 1, 3);
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
  const center = box.getCenter(new THREE.Vector3());
  const point = (x, y, z) => new THREE.Vector3(x * size.x, y * size.y, z * size.z).add(center);

  const labelConfigs = [
    { name: 'AORTA', color: '#fcbf49', anchor: point(0.7, 0.82, 0.18), screenOffset: { x: 0, y: -20 } },
    { name: 'RIGHT ATRIUM', color: '#fca5a5', anchor: point(0.22, 0.56, 0.08), screenOffset: { x: 52, y: -22 } },
    { name: 'LEFT ATRIUM', color: '#c4b5fd', anchor: point(-0.38, 0.35, 0.22), screenOffset: { x: -56, y: -18 } },
    { name: 'RCA', color: '#fb7185', anchor: point(0.42, -0.08, -0.05), screenOffset: { x: 62, y: 18 } },
    { name: 'LAD', color: '#f472b6', anchor: point(0.08, 0.18, 0.06), screenOffset: { x: 0, y: -10 } },
    { name: 'LCX', color: '#f59e0b', anchor: point(-0.38, 0.14, 0.18), screenOffset: { x: -60, y: 12 } },
    { name: 'RIGHT VENTRICLE', color: '#a7f3d0', anchor: point(0.12, -0.22, 0.1), screenOffset: { x: 52, y: 42 } },
    { name: 'LEFT VENTRICLE', color: '#93c5fd', anchor: point(-0.28, -0.46, 0.14), screenOffset: { x: -48, y: 50 } },
  ];

  anatomicalLabels.length = 0;
  annotationCanvas.innerHTML = '';

  labelConfigs.forEach((config) => {
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
      anchor: config.anchor.clone(),
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
    MODEL_URL,

    // Model loaded successfully
    (gltf) => {
      heartModel = gltf.scene;

      const box = new THREE.Box3().setFromObject(heartModel);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

    heartModel.position.sub(center);
    heartModel.scale.setScalar(1);

    heartModel.rotation.set(0.28, -0.66, 0.12);
    heartModel.position.y = 0.06;

      scene.add(heartModel);

      // Aim camera at the center
      controls.target.set(0, 0, 0);
      camera.position.set(0, 0, 5);
      camera.near = 0.01;
      camera.far = 1000;
      camera.updateProjectionMatrix();
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

  const placed = [];
  const labelWidth = 150;
  const labelHeight = 30;

  anatomicalLabels.forEach((entry) => {
    const anchorWorld = entry.anchor.clone().applyMatrix4(heartModel.matrixWorld);
    const anchorScreen = projectPointToViewer(anchorWorld);

    const labelX = anchorScreen.x + (entry.screenOffset?.x || 0);
    const labelY = anchorScreen.y + (entry.screenOffset?.y || 0);
    let finalX = labelX;
    let finalY = labelY;

    for (const other of placed) {
      const dx = Math.abs(finalX - other.x);
      const dy = Math.abs(finalY - other.y);
      if (dx < labelWidth * 0.8 && dy < labelHeight * 0.8) {
        finalX = other.x + (finalX < other.x ? -labelWidth * 0.7 : labelWidth * 0.7);
        finalY = other.y + (finalY < other.y ? -labelHeight * 0.7 : labelHeight * 0.7);
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
  });

  resizeObserver.observe(container);

  // Animation loop
  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

// Initialize after HTML is ready
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initHeartViewer,
    { once: true }
  );
} else {
  initHeartViewer();
}

// Optional cleanup if your app needs to destroy the viewer
export function destroyHeartViewer() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  controls?.dispose();
  renderer?.dispose();
  renderer?.domElement.remove();

  renderer = undefined;
  camera = undefined;
  scene = undefined;
  controls = undefined;
  heartModel = undefined;
}
