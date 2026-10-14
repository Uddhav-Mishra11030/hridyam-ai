
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

  camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.1,
    1000
  );

  camera.position.set(0, 0, 5);

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

  const rimLight = new THREE.PointLight(0xff526d, 2);
  rimLight.position.set(0, 3, -4);
  scene.add(rimLight);

  // Mouse drag, zoom and touch controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 12;
  controls.target.set(0, 0, 0);

  showModelMessage('Loading 3D heart model...');

  const loader = new GLTFLoader();

  console.log('Loading heart model from:', MODEL_URL);

  loader.load(
    MODEL_URL,

    // Model loaded successfully
    (gltf) => {
      heartModel = gltf.scene;

      const box = new THREE.Box3().setFromObject(heartModel);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      if (
        !Number.isFinite(size.x) ||
        !Number.isFinite(size.y) ||
        !Number.isFinite(size.z) ||
        Math.max(size.x, size.y, size.z) === 0
      ) {
        showModelMessage(
          'The heart model is empty or invalid.',
          true
        );
        return;
      }

      // Center the model around its origin
      heartModel.position.sub(center);

      // Fit model to the viewer
      const maxDimension = Math.max(size.x, size.y, size.z);
      const scale = 2.6 / maxDimension;
      heartModel.scale.setScalar(scale);

      // Improve material appearance
      heartModel.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;

          if (object.material) {
            object.material.needsUpdate = true;
          }
        }
      });

      scene.add(heartModel);

      // Aim camera at the center
      controls.target.set(0, 0, 0);
      camera.position.set(0, 0, 5);
      camera.near = 0.01;
      camera.far = 1000;
      camera.updateProjectionMatrix();
      controls.update();

      hideModelMessage();
      console.log('Heart model loaded successfully.');
    },

    // Loading progress
    (event) => {
      if (event.total > 0) {
        const percent = Math.round(
          (event.loaded / event.total) * 100
        );

        showModelMessage(
          `Loading 3D heart model... ${percent}%`
        );
      }
    },

    // Loading failed
    (error) => {
      console.error('Heart model loading failed:', error);
      console.error('Requested model URL:', MODEL_URL);

      showModelMessage(
        'Heart model could not load. Check that public/heart.glb exists and the URL is correct.',
        true
      );
    }
  );

  // Keep renderer fitted to the viewer
  const resizeObserver = new ResizeObserver(() => {
    if (!renderer || !camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

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
