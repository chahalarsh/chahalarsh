import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ======================================================
// CONFIG
// ======================================================
const CONFIG = {
  containerSelector: '#laptop-canvas',
  sectionSelector: '.laptop-section',
  modelPath: '/model2.glb',
  cameraNameFallback: /camera/i,
  scrollSmoothTime: 0.15,
};

// ======================================================
// DOM
// ======================================================
const container = document.querySelector(CONFIG.containerSelector);
const section = document.querySelector(CONFIG.sectionSelector);

if (!container) {
  throw new Error(
    `[laptop-canvas] Could not find container "${CONFIG.containerSelector}". Aborting.`
  );
}

if (!section) {
  console.warn(
    `[laptop-canvas] Could not find scroll section "${CONFIG.sectionSelector}". ` +
    `Scroll-driven playback will be disabled.`
  );
}

// ======================================================
// SCENE / RENDERER
// ======================================================
const scene = new THREE.Scene();

// FIXED: Added position and lookAt to the fallback camera
// so you aren't stuck inside the model looking at nothing.
let camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
camera.position.set(0, 1, 5); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

container.appendChild(renderer.domElement);

// OPTIONAL DEBUGGING: Uncomment these if you still see a black screen 
// to prove the camera and renderer are working.
// const axesHelper = new THREE.AxesHelper(5);
// scene.add(axesHelper);
// const gridHelper = new THREE.GridHelper(10, 10);
// scene.add(gridHelper);


// ======================================================
// PLAYBACK STATE (FIX: Moved UP before Resize/Scroll)
// ======================================================
let mixer = null;
let actions = [];       // [{ action, clip }]
let animationDuration = 0;
let targetProgress = 0;
let currentProgress = 0;


// ======================================================
// SCROLL PROGRESS CALCULATION (FIX: Moved UP before Resize)
// ======================================================
function updateScrollProgress() {
  if (!section) return;

  const rect = section.getBoundingClientRect();
  const scrollDistance = section.offsetHeight - window.innerHeight;

  if (scrollDistance <= 0) {
    targetProgress = 0;
    return;
  }

  targetProgress = THREE.MathUtils.clamp(-rect.top / scrollDistance, 0, 1);
}

// ======================================================
// RESIZE
// ======================================================
function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (width === 0 || height === 0) return;

  const aspect = width / height;

  if (camera.isPerspectiveCamera) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  } else if (camera.isOrthographicCamera) {
    const halfHeight = (camera.top - camera.bottom) / 2;
    const halfWidth = halfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.updateProjectionMatrix();
  }

  renderer.setSize(width, height, false);
  updateScrollProgress();
}

if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
} else {
  window.addEventListener('resize', resize);
}

// Listen to scroll events natively
window.addEventListener('scroll', updateScrollProgress, { passive: true });

// Initial calls
resize();
updateScrollProgress();

// ======================================================
// LIGHTING
// ======================================================
const keyLight = new THREE.DirectionalLight(0xffffff, 4);
keyLight.position.set(4, 6, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
fillLight.position.set(-4, 2, 3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 2);
rimLight.position.set(0, 4, -5);
scene.add(rimLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// ======================================================
// CAMERA RESOLUTION
// ======================================================
function resolveCamera(gltf, model) {
  if (gltf.cameras && gltf.cameras.length > 0) {
    if (gltf.cameras.length > 1) {
      console.warn(
        `[laptop-canvas] ${gltf.cameras.length} cameras found in the glTF; ` +
        `using the first one ("${gltf.cameras[0].name}").`
      );
    }
    return gltf.cameras[0];
  }

  let found = null;
  model.traverse((obj) => {
    if (!found && obj.isCamera) found = obj;
  });
  if (found) return found;

  found = null;
  model.traverse((obj) => {
    if (!found && CONFIG.cameraNameFallback.test(obj.name)) found = obj;
  });

  return found;
}

// ======================================================
// LOAD GLB
// ======================================================
const loader = new GLTFLoader();

loader.load(
  CONFIG.modelPath,
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    // Camera
    const blenderCamera = resolveCamera(gltf, model);
    if (blenderCamera) {
      camera = blenderCamera;
      console.log(`[laptop-canvas] Using Blender camera "${camera.name}".`);
      resize();
    } else {
      console.warn('[laptop-canvas] No camera found in the glTF. Falling back to default.');
    }

    // Animation
    if (!gltf.animations || gltf.animations.length === 0) {
      console.warn('[laptop-canvas] No animations found. Model will be static.');
      return;
    }

    mixer = new THREE.AnimationMixer(model);
    animationDuration = 0;
    actions = [];

    gltf.animations.forEach((clip) => {
      animationDuration = Math.max(animationDuration, clip.duration);
      const action = mixer.clipAction(clip);
      
      action.play();
      action.paused = true;
      action.time = 0;
      actions.push({ action, clip });
    });

    mixer.update(0);
    console.log(`[laptop-canvas] Timeline duration: ${animationDuration.toFixed(2)}s`);
  },
  undefined,
  (error) => {
    console.error('[laptop-canvas] Failed to load glTF:', error);
  }
);

// ======================================================
// RENDER LOOP
// ======================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const smoothing = 1 - Math.exp(-delta / CONFIG.scrollSmoothTime);
  currentProgress += (targetProgress - currentProgress) * smoothing;

  if (mixer && animationDuration > 0) {
    const time = currentProgress * animationDuration;

    actions.forEach(({ action, clip }) => {
      action.time = THREE.MathUtils.clamp(time, 0, clip.duration);
    });

    mixer.update(0);
  }

  renderer.render(scene, camera);
}

animate();