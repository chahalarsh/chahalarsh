import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
// Optional: swap RoomEnvironment for a real HDRI — see notes at the bottom.
// import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ======================================================
// CONFIG
// ======================================================
const CONFIG = {
  containerSelector: '#laptop-canvas',
  sectionSelector: '.laptop-section',
  modelPath: '/Untitled.glb',
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
renderer.toneMappingExposure = 1.15;

// Real shadows — this is most of what sells "realistic" vs. "flat CG".
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);

// ======================================================
// PLAYBACK STATE
// ======================================================
let mixer = null;
let actions = [];
let animationDuration = 0;
let targetProgress = 0;
let currentProgress = 0;

// ======================================================
// SCROLL PROGRESS CALCULATION
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

window.addEventListener('scroll', updateScrollProgress, { passive: true });

resize();
updateScrollProgress();

// ======================================================
// ENVIRONMENT (image-based lighting)
// ======================================================
// This model has 103 materials, several using KHR_materials_clearcoat
// (the chair, likely the monitor bezels/desk hardware). Clearcoat and any
// glossy/metallic surface needs *something* to reflect or it renders as
// dead flat grey no matter how many lights you throw at it — direct lights
// only create tiny specular highlights, not the soft reflected gradients
// you see across a curved monitor or a leather chair in the reference
// photo. RoomEnvironment is a procedural neutral room baked to an env map
// at runtime — no external asset needed, and it's what gives PBR materials
// their "it looks like a photo" quality for free.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();

// For a step up in realism, swap this block for a real photographed HDRI —
// see the RGBELoader note at the bottom of this file.

// ======================================================
// LIGHTING
// ======================================================
// The glTF does NOT contain an embedded light (no KHR_lights_punctual in
// the file) or any emissive-baked materials, despite what earlier comments
// in this file assumed. So the room needs real lights, not a bake to
// "boost." This is a simple 3-point setup similar to how the reference
// photo reads: one warm key light standing in for a window/room light,
// one cool, dim fill from the opposite side so shadow-side surfaces don't
// crush to black, and a subtle rim light to separate the chair/desk edges
// from the wall behind them.

// Soft ambient/hemisphere fill — keep this LOW. Its job is to lift the
// absolute darkest shadows a touch, not to light the room; if this is
// strong it flattens every shadow the key light is creating.
const hemiLight = new THREE.HemisphereLight(0xbfd4ff, 0x3a2e22, 0.35);
scene.add(hemiLight);

// KEY LIGHT — the dominant light, warm (simulates a window / room lamp),
// casts the primary shadow. Positioned upper-front so it rakes across the
// desk the way the reference photo's key light does.
const keyLight = new THREE.DirectionalLight(0xfff2df, 3.2);
keyLight.position.set(3, 4.5, 3);
keyLight.target.position.set(1.5, 0.8, -1.3); // aim roughly at desk center
scene.add(keyLight.target);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0003;
keyLight.shadow.normalBias = 0.02;
// Tight shadow frustum around the model's actual bounds (~5 x 2.5 x 4.7
// units) — a frustum sized for a whole outdoor scene wastes shadow-map
// resolution and gives you soft, blurry, unconvincing shadows.
const shadowCam = keyLight.shadow.camera;
shadowCam.left = -4;
shadowCam.right = 4;
shadowCam.top = 4;
shadowCam.bottom = -4;
shadowCam.near = 0.5;
shadowCam.far = 15;
scene.add(keyLight);

// FILL LIGHT — cool, dim, opposite side, NO shadow (a second shadow-caster
// creates ugly double-shadows). Just stops the far side of the desk/chair
// from going pure black.
const fillLight = new THREE.DirectionalLight(0xcfe0ff, 0.6);
fillLight.position.set(-4, 2.5, -2);
scene.add(fillLight);

// RIM / SEPARATION LIGHT — small, positioned behind/above the subject,
// picks out the edge of the monitor and the top of the chair so they
// don't merge into the wall tone behind them.
const rimLight = new THREE.SpotLight(0xffffff, 4, 8, Math.PI / 5, 0.5, 1.5);
rimLight.position.set(1.5, 3, -4);
rimLight.target.position.set(1.5, 1.2, -1.3);
scene.add(rimLight.target);
scene.add(rimLight);

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

    // Enable shadow casting/receiving on every mesh. Everything both casts
    // and receives here — with a desk scene like this, the desk needs to
    // receive the chair's shadow and vice versa, and the floor/back wall
    // (if present in the model) needs to receive both.
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

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

// ======================================================
// ALTERNATIVE: swap RoomEnvironment for a real HDRI
// ======================================================
// RoomEnvironment gets you 80% of the way there for free. For the closest
// match to a photo-real render like your reference image, replace the
// "ENVIRONMENT" block above with a real equirectangular HDRI:
//
//   import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
//
//   new RGBELoader().load('/env/studio_small_09_1k.hdr', (hdrEquirect) => {
//     const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture;
//     scene.environment = envMap;
//     scene.background = null; // keep your own background/backdrop
//     hdrEquirect.dispose();
//     pmremGenerator.dispose();
//   });
//
// Free, CC0 HDRIs that suit an office/interior scene: polyhaven.com/hdris
// (search "studio" or "indoor" — grab the 1k or 2k version, no need for 4k
// for a desk-sized model). This single swap is usually the highest-value
// change you can make for realism, because it fixes reflections on every
// clearcoat/metal/glossy material at once instead of one light at a time.
