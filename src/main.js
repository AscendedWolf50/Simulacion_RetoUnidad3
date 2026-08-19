import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createLabPanel } from './ui/labPanel.js';

const PARTICLE_COUNT = 131072; 

async function main() {
  const mount = document.querySelector('#app');

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este proyecto requiere WebGPU para ejecutar compute shaders.');
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050607');

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 11);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.target.set(0, 0, 0);

  const params = createParameters();
  const simulation = createSimulation({ renderer, scene, params, count: PARTICLE_COUNT });

  const attractorHelper = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  scene.add(attractorHelper);
  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);

  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  addEventListener('pointermove', (event) => {
    pointerNdc.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(interactionPlane, hit)) {
      params.attractor.value.copy(hit);
      attractorHelper.position.copy(hit);
    }
  });

  let paused = false;
  let mode = 'LAB';
  let panel;
  
  let savedRadialStrength = params.radialStrength.value;
  let savedRadialEnabled = params.radialEnabled.value;
  let originalRadialEnabled = params.radialEnabled.value;
  let originalRadialStrength = params.radialStrength.value;
  let originalDrag = params.dragCoefficient.value;

  const envTargets = {
    turbulence: 0.0,
    grid: 0.0,
    shockwave: 0.0,
    returnHome: 0.0
  };

  const applyPreset = (id) => {
    params.windEnabled.value = 0;
    params.radialEnabled.value = 0;
    params.vortexEnabled.value = 0;
    params.dragEnabled.value = 0;
    params.turbulenceEnabled.value = 0; 
    params.gridEnabled.value = 0;
    params.shockwaveEnabled.value = 0;
    params.returnEnabled.value = 0;
    params.wind.value.set(0, 0, 0);
    params.initialSpeed.value = 0;

    if (id === 'inertia') {
      params.initialSpeed.value = 0.8;
    } else if (id === 'wind') {
      params.windEnabled.value = 1;
      params.wind.value.set(1.5, 0, 0);
    } else if (id === 'attract') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 3.0;
    } else if (id === 'repel') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = -3.0;
    } else if (id === 'vortex') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 1.0;
      params.vortexEnabled.value = 1;
      params.vortexStrength.value = 3.0;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.08;
    }
    simulation.reset();
    panel?.refresh();
  };

  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';
    panel.setVisible(lab);
    axes.visible = lab;
    attractorHelper.visible = lab;
    hud.innerHTML = lab
      ? '<strong>LAB</strong> · P: performance · R: reset · 1–5: pruebas'
      : '<strong>PERFORMANCE</strong> · C: Imán · B: Retorno · T: Turb · G: Grilla · E: Onda · X: Pulso · Shift: Slowmo';
  };

  panel = createLabPanel({
    params,
    onReset: () => simulation.reset(),
    onPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => paused = !paused
  });

  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.append(hud);
  setMode('LAB');

  // KEYDOWN
  addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyP') setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
    if (event.code === 'KeyR') simulation.reset();
    
    const presetMap = {
      'Digit1': 'inertia', 'Digit2': 'wind', 'Digit3': 'attract',
      'Digit4': 'repel', 'Digit5': 'vortex'
    };
    if (presetMap[event.code]) {
      applyPreset(presetMap[event.code]);
    }
    
    // CÁMARA LENTA en lugar de Freno
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      params.timeScale.value = 0.3; // Mantiene el 30% de la velocidad
      params.dragCoefficient.value = 0.4; // Añade un poco de fricción sin detenerlas por completo
    }

    if (event.code === 'KeyC') {
      originalRadialEnabled = params.radialEnabled.value;
      originalRadialStrength = params.radialStrength.value;
      originalDrag = params.dragCoefficient.value;
      
      params.radialEnabled.value = 1;
      params.radialStrength.value = 150.0; 
      params.dragCoefficient.value = 0.2; 
    }

    // PULSO RÍTMICO
    if (event.code === 'KeyX') {
      params.sizeMultiplier.value = 3.5;
    }

    if (event.code === 'KeyB') envTargets.returnHome = 1.0; 
    if (event.code === 'KeyT') envTargets.turbulence = 1.0;
    if (event.code === 'KeyG') envTargets.grid = 1.0;
    if (event.code === 'KeyE') envTargets.shockwave = 1.0; 

    if (event.code === 'Space') {
      event.preventDefault();
      savedRadialStrength = params.radialStrength.value;
      savedRadialEnabled = params.radialEnabled.value;
      params.radialEnabled.value = 1;
      params.radialStrength.value = -(savedRadialStrength || 2.0);
    }
  });

  // KEYUP
  addEventListener('keyup', (event) => {
    if (event.code === 'KeyB') envTargets.returnHome = 0.0;
    if (event.code === 'KeyT') envTargets.turbulence = 0.0;
    if (event.code === 'KeyG') envTargets.grid = 0.0;
    if (event.code === 'KeyE') envTargets.shockwave = 0.0;

    if (event.code === 'KeyC') {
      params.radialEnabled.value = originalRadialEnabled;
      params.radialStrength.value = originalRadialStrength;
      params.dragCoefficient.value = originalDrag;
    }

    if (event.code === 'Space') {
      params.radialEnabled.value = savedRadialEnabled;
      params.radialStrength.value = savedRadialStrength;
    }

    // Restaurar de la Cámara Lenta
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      params.timeScale.value = 1.0;
      params.dragCoefficient.value = 0.12; 
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();

  // FRAME LOOP
  renderer.setAnimationLoop(() => {
    if (!paused) {
      params.time.value += params.dt.value * params.timeScale.value;

      params.turbulenceEnabled.value += (envTargets.turbulence - params.turbulenceEnabled.value) * 0.05;
      params.gridEnabled.value += (envTargets.grid - params.gridEnabled.value) * 0.1;
      params.shockwaveEnabled.value += (envTargets.shockwave - params.shockwaveEnabled.value) * 0.25;
      params.returnEnabled.value += (envTargets.returnHome - params.returnEnabled.value) * 0.15;
      
      // Decay para que el tamaño regrese a su valor normal (1.0) suavemente
      params.sizeMultiplier.value += (1.0 - params.sizeMultiplier.value) * 0.1;

      simulation.stepSimulation();
    }
    orbit.update();
    renderer.render(scene, camera);
  });
}

main().catch((error) => {
  console.error(error);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:16px;white-space:pre-wrap;color:#fff;z-index:50';
  pre.textContent = String(error?.stack || error);
  document.body.append(pre);
});