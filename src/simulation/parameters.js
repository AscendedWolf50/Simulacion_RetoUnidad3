import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.35),
    maxSpeed: uniform(5.0),
    boundsSize: uniform(10.0),
    particleSize: uniform(0.035),

    windEnabled: uniform(0.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    radialEnabled: uniform(1.0),
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    radialStrength: uniform(2.2),
    softening: uniform(0.35),

    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(1.4),

    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.12),

    time: uniform(0.0),
    turbulenceEnabled: uniform(0.0),
    turbulenceStrength: uniform(3.5),
    turbulenceFrequency: uniform(0.8),

    gridEnabled: uniform(0.0),
    elasticConstant: uniform(3.5),

    // ONDA EXPANSIVA MÁS FUERTE
    shockwaveEnabled: uniform(0.0),
    shockwaveStrength: uniform(50.0),

    // NUEVO: RETORNO AL ORIGEN
    returnEnabled: uniform(0.0),
    returnForce: uniform(8.0)
  };
}