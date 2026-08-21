import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  color,
  hash,
  instanceIndex,
  instancedArray,
  max,
  mix,
  mod,
  step,
  uint,
  uv,
  vec3,
  vec4,
  sin, 
  cos 
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));
    const r5 = hash(i.add(uint(71)));
    const r6 = hash(i.add(uint(89)));

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);
    const i = instanceIndex;

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    force.addAssign(params.wind.mul(params.windEnabled));

    const toAttractor = params.attractor.sub(p);
    const distance = max(toAttractor.length(), params.softening);
    const radialDirection = toAttractor.div(distance);
    const radialForce = radialDirection
      .mul(params.radialStrength)
      .div(distance.pow(2))
      .mul(params.radialEnabled);
    force.addAssign(radialForce);

    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(radialDirection);
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));

    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    const t = params.time.mul(2.0); 
    const freq = params.turbulenceFrequency;
    const turbForce = vec3(
      sin(p.y.mul(freq).add(t)).mul(cos(p.z.mul(freq).add(t))),
      sin(p.z.mul(freq).add(t)).mul(cos(p.x.mul(freq).add(t))),
      sin(p.x.mul(freq).add(t)).mul(cos(p.y.mul(freq).add(t)))
    ).mul(params.turbulenceStrength).mul(params.turbulenceEnabled);
    force.addAssign(turbForce);

    const gridSize = vec3(0.5); 
    const gridTarget = p.div(gridSize).round().mul(gridSize);
    const displacement = p.sub(gridTarget);
    const springForce = displacement.mul(-1.0).mul(params.elasticConstant).mul(params.gridEnabled);
    force.addAssign(springForce);

    const centerDist = max(p.length(), 0.1);
    const shockDir = p.div(centerDist);
    const shockForce = shockDir.mul(params.shockwaveStrength).div(centerDist).mul(params.shockwaveEnabled);
    force.addAssign(shockForce);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const originalPos = vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45));
    
    const returnDir = originalPos.sub(p);
    const returnForce = returnDir.mul(params.returnForce).mul(params.returnEnabled);
    force.addAssign(returnForce);

    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  material.scaleNode = params.particleSize.mul(params.sizeMultiplier);

  material.colorNode = Fn(() => {
    const speed = velocityBuffer.toAttribute().length();
    const p = positionBuffer.toAttribute(); 
    const t = speed.div(params.maxSpeed).clamp(0.0, 1.0);
    
    const r = sin(p.x.mul(1.5).add(params.time)).mul(0.5).add(0.5);
    const g = cos(p.y.mul(1.5).add(params.time)).mul(0.5).add(0.5);
    const b = sin(p.x.sub(p.y).add(params.time)).mul(0.5).add(0.5);
    
    // CAMBIO APLICADO AQUÍ: Multiplicamos por params.colorTint
    const slowColor = vec3(r, g, b).mul(0.6).mul(params.colorTint);
    const fastColor = vec3(1.0, r, 1.0).mul(params.colorTint);

    return vec4(mix(slowColor, fastColor, t), 1.0);
  })();

  material.opacityNode = step(uv().xy.sub(0.5).length(), 0.5);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function reset() {
    renderer.compute(initParticles);
  }

  function stepSimulation() {
    renderer.compute(updateParticles);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(mesh);
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    reset,
    stepSimulation,
    dispose
  };
}