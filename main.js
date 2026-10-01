import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PARTS, arrangeRocket } from './rocket-parts.js';
import { FLIGHT_CONFIG } from './flight-config.js';

/* ───────────────────────── Shared state ───────────────────────── */

const $ = s => document.querySelector(s);
const {
  gravity: G, moonRadius: MOON_RADIUS, viewScale: FLIGHT_SCALE,
  engineIsp: ENGINE_ISP, boosterIsp: BOOSTER_ISP
} = FLIGHT_CONFIG;

// Must match the radius/scale used by arrangeRocket in rocket-parts.js.
const ROCKET_SCALE = .78;
const BOOSTER_RING = .9 * ROCKET_SCALE;
const PAD_Y = -.85;

let rocketParts = [];
let buildScene, buildCamera, buildRenderer, buildControls, rocketGroup;
let flightScene, flightCamera, flightRenderer, flightRocket, moon, flightStars;
let engineFlame = null, boosterFlames = [], flameLight, smoke;
let flightRunning = false, flightT = 0, flightY = 0, flightV = 0;
let flightFuel = 0, coreFuel = 0, boosterFuel = 0, stage = 1, lastTime = 0;
let flightParts = [], countdown = 3, flightState = 'ready';
let cameraMode = 0, popAmount = 0, idleTimer, lastMessage = '', messageTimer;

const flightPosition = new THREE.Vector3();
const flightVelocity = new THREE.Vector3();
const flightGravityCenter = new THREE.Vector3(0, -MOON_RADIUS, 0);
const flightKeys = new Set();
const debris = [];
const cameraModes = ['CHASE', 'CLOSE', 'ORBIT'];
const isLaunchActive = () => $('#launchScreen').classList.contains('active');

/* ───────────────────────── Renderer helpers ───────────────────────── */

function makeRenderer(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  return renderer;
}

// Image-based lighting so metal parts have something to reflect.
function addEnvironment(renderer, scene, intensity) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = intensity;
  pmrem.dispose();
}

/* ───────────────────────── Builder UI ───────────────────────── */

const partsList = $('#partsList');
for (const [id, p] of Object.entries(PARTS)) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'part';
  el.dataset.part = id;
  el.innerHTML = `<span class="part-icon" aria-hidden="true">${p.icon}</span><span><b>${p.name}</b><small>${p.desc}</small></span><em>+ ADD</em>`;
  el.onclick = () => addPart(id);
  partsList.appendChild(el);
}

function addPart(id) { rocketParts.push(id); popAmount = 1; renderRocket(); updateStats(); }
function undoPart() { if (rocketParts.pop()) { renderRocket(); updateStats(); } }
function clearRocket() { rocketParts = []; renderRocket(); updateStats(); }
$('#undoBtn')?.addEventListener('click', undoPart);
$('#clearBtn')?.addEventListener('click', clearRocket);

function setStatus(text, tone = '') {
  const el = $('#buildStatus');
  el.textContent = text;
  el.className = tone;
}

/* ───────────────────────── Builder scene ───────────────────────── */

function initBuild() {
  const host = $('#builderViewport');
  buildScene = new THREE.Scene();
  buildScene.background = new THREE.Color(0x080d15);
  buildScene.fog = new THREE.Fog(0x080d15, 14, 34);

  buildCamera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, .1, 1000);
  buildCamera.position.set(5, 4.2, 8);
  buildRenderer = makeRenderer(host);
  addEnvironment(buildRenderer, buildScene, .55);

  buildControls = new OrbitControls(buildCamera, buildRenderer.domElement);
  buildControls.enableDamping = true;
  buildControls.target.set(0, 2, 0);
  buildControls.minDistance = 3;
  buildControls.maxDistance = 14;
  buildControls.maxPolarAngle = Math.PI * .56;
  buildControls.autoRotate = true;
  buildControls.autoRotateSpeed = .7;
  // Pause the turntable while the user is orbiting; resume after a short idle.
  buildControls.addEventListener('start', () => { buildControls.autoRotate = false; clearTimeout(idleTimer); });
  buildControls.addEventListener('end', () => { idleTimer = setTimeout(() => buildControls.autoRotate = true, 3500); });

  buildScene.add(new THREE.HemisphereLight(0x9ecbff, 0x202938, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(5, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 8, bottom: -3, near: 1, far: 30 });
  key.shadow.bias = -.0004;
  key.shadow.normalBias = .02;
  buildScene.add(key);
  const rim = new THREE.DirectionalLight(0x61b7ff, 1.4);
  rim.position.set(-6, 4, -5);
  buildScene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(4.8, 4.8, .35, 96),
    new THREE.MeshStandardMaterial({ color: 0x28303a, roughness: .85, metalness: .3 })
  );
  floor.position.y = -.3;
  floor.receiveShadow = true;
  buildScene.add(floor);
  for (const [r, c, o] of [[4.45, 0x61b7ff, .55], [2.2, 0x61b7ff, .18]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - .02, r + .02, 128),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -.12;
    buildScene.add(ring);
  }

  rocketGroup = new THREE.Group();
  buildScene.add(rocketGroup);
  renderRocket();
}

function renderRocket() {
  if (!rocketGroup) return;
  const height = arrangeRocket(rocketGroup, rocketParts);
  rocketGroup.position.y = Math.max(.25, 2.1 - height / 2);
}

function updateStats() {
  let mass = 0, fuel = 0, thrust = 0;
  const counts = {};
  rocketParts.forEach(id => {
    const p = PARTS[id];
    mass += p.mass; fuel += p.fuel; thrust += p.thrust;
    counts[id] = (counts[id] || 0) + 1;
  });
  const wet = mass + fuel / 1000;
  const twr = mass ? thrust / (wet * G) : 0;
  const dv = mass && fuel ? ENGINE_ISP * 9.81 * Math.log(wet / mass) : 0;

  $('#massStat').textContent = wet.toFixed(1) + ' t';
  $('#fuelStat').textContent = Math.round(fuel) + ' kg';
  $('#thrustStat').textContent = Math.round(thrust) + ' kN';
  $('#twrStat').textContent = twr.toFixed(2);
  const dvStat = $('#dvStat');
  if (dvStat) dvStat.textContent = Math.round(dv) + ' m/s';
  const partCount = $('#partCount');
  if (partCount) partCount.textContent = rocketParts.length + (rocketParts.length === 1 ? ' part' : ' parts');
  document.querySelectorAll('.part').forEach(el => {
    const n = counts[el.dataset.part] || 0;
    el.querySelector('em').textContent = n ? `× ${n}` : '+ ADD';
    el.classList.toggle('in-use', n > 0);
  });

  const hasEngine = rocketParts.some(id => ['engine', 'booster'].includes(PARTS[id].type));
  if (!rocketParts.length) setStatus('READY');
  else if (!hasEngine) setStatus('NEEDS ENGINE', 'warn');
  else if (!fuel) setStatus('NEEDS FUEL', 'warn');
  else if (twr < 1) setStatus('TWR BELOW 1', 'warn');
  else setStatus('ASSEMBLED', 'ok');
}

/* ───────────────────────── Flight environment ───────────────────────── */

function makeMoon() {
  const geo = new THREE.SphereGeometry(10, 96, 64);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 1.9 + v.z * .7) * .16 + Math.sin(v.x * 4.8 - v.z * 2.2) * .07 + Math.sin(v.y * 8 + v.x) * .035;
    v.multiplyScalar(1 + n);
    pos.setXYZ(i, v.x, v.y, v.z);
    const shade = .8 + n * 1.1 + Math.sin(v.x * 17 + v.z * 13) * .03;
    colors.set([shade, shade, shade * 1.02], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  moon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9a9ea0, vertexColors: true, roughness: 1, metalness: 0 }));
  moon.position.y = -11;
  moon.receiveShadow = true;
  flightScene.add(moon);

  const craters = new THREE.Group();
  const forward = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 45; i++) {
    const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 6;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = -11 + Math.sqrt(100 - r * r);
    const normal = new THREE.Vector3(x, y + 11, z).normalize();
    const inner = .08 + Math.random() * .22;
    const c = new THREE.Mesh(
      new THREE.RingGeometry(inner, inner + .07 + Math.random() * .1, 20),
      new THREE.MeshBasicMaterial({ color: 0x5f6264, side: THREE.DoubleSide, transparent: true, opacity: .5 })
    );
    c.position.set(x, y + .015, z);
    c.quaternion.setFromUnitVectors(forward, normal);
    craters.add(c);
  }
  flightScene.add(craters);
}

function makeStarfield() {
  const count = 1800, positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 400 + Math.random() * 500, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  flightStars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xc8ddff, size: .32, sizeAttenuation: true }));
  flightScene.add(flightStars);
}

// Launch pad with a service tower.
function makePad() {
  const metal = new THREE.MeshStandardMaterial({ color: 0x343c46, metalness: .65, roughness: .55 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, .22, 48), metal);
  pad.position.y = -.96;
  pad.receiveShadow = true;
  flightScene.add(pad);

  const tower = new THREE.Group();
  const beam = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metal);
    m.position.set(x, y, z);
    m.castShadow = true;
    tower.add(m);
  };
  for (const [x, z] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) beam(.07, 3.6, .07, x, 1.8, z);
  for (let y = .4; y < 3.6; y += .6) { beam(.46, .045, .045, 0, y, .2); beam(.46, .045, .045, 0, y, -.2); }
  beam(.9, .08, .08, .55, 2.5, 0); // umbilical arm
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff4a3a }));
  beacon.position.set(0, 3.65, 0);
  tower.add(beacon);
  tower.position.set(-2.4, PAD_Y, 0);
  flightScene.add(tower);

  const padLight = new THREE.PointLight(0x45b8ff, 7, 8);
  padLight.position.set(0, -.2, 2.3);
  flightScene.add(padLight);
}

// Exhaust dust: a small additive particle pool.
const SMOKE_COUNT = 180;
const smokeVel = Array.from({ length: SMOKE_COUNT }, () => new THREE.Vector3());
const smokeLife = new Float32Array(SMOKE_COUNT);
let smokeHead = 0;

function initSmoke() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3));
  smoke = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: .4, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  smoke.frustumCulled = false;
  flightScene.add(smoke);
}

const _origin = new THREE.Vector3(), _down = new THREE.Vector3();
function emitSmoke(count) {
  flightRocket.localToWorld(_origin.set(0, 0, 0));
  _down.set(0, -1, 0).applyQuaternion(flightRocket.quaternion);
  const p = smoke.geometry.attributes.position;
  for (let i = 0; i < count; i++) {
    const k = smokeHead++ % SMOKE_COUNT;
    p.setXYZ(k, _origin.x + (Math.random() - .5) * .5, _origin.y, _origin.z + (Math.random() - .5) * .5);
    smokeVel[k].set((Math.random() - .5) * 3, 0, (Math.random() - .5) * 3).addScaledVector(_down, 2 + Math.random() * 2);
    smokeLife[k] = 1;
  }
}

function updateSmoke(dt) {
  const p = smoke.geometry.attributes.position, c = smoke.geometry.attributes.color;
  for (let k = 0; k < SMOKE_COUNT; k++) {
    if (smokeLife[k] <= 0) { c.setXYZ(k, 0, 0, 0); continue; }
    smokeLife[k] -= dt * .8;
    smokeVel[k].multiplyScalar(1 - dt * 1.2);
    p.setXYZ(k, p.getX(k) + smokeVel[k].x * dt, p.getY(k) + smokeVel[k].y * dt, p.getZ(k) + smokeVel[k].z * dt);
    const l = Math.max(0, smokeLife[k]) * .35;
    c.setXYZ(k, l, l * .95, l * .9);
  }
  p.needsUpdate = c.needsUpdate = true;
}

function initFlight() {
  const host = $('#flightViewport');
  flightScene = new THREE.Scene();
  flightScene.background = new THREE.Color(0x010205);
  flightCamera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, .1, 2000);
  flightCamera.position.set(6, 5, 10);
  flightRenderer = makeRenderer(host);
  addEnvironment(flightRenderer, flightScene, .3);

  flightScene.add(new THREE.AmbientLight(0x526079, .8));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(-8, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .02;
  flightScene.add(sun);

  flameLight = new THREE.PointLight(0xff9a4a, 0, 9, 1.6);
  flightScene.add(flameLight);

  makeStarfield();
  makeMoon();
  makePad();
  initSmoke();
}

/* ───────────────────────── Flames ───────────────────────── */

// Layered additive cone: base sits at the origin, tip points down.
function makeFlame(radius, length) {
  const group = new THREE.Group();
  const layer = (r, l, color, opacity) => {
    const geo = new THREE.ConeGeometry(r, l, 20, 1, true);
    geo.rotateX(Math.PI);
    geo.translate(0, -l / 2, 0);
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
  };
  group.add(layer(radius, length, 0xff7a1f, .55), layer(radius * .55, length * .7, 0xffd27a, .85), layer(radius * .28, length * .45, 0xffffff, .95));
  group.visible = false;
  return group;
}

function addFlightFlames() {
  engineFlame = null;
  boosterFlames = [];
  if (flightParts.some(id => PARTS[id].type === 'engine')) {
    engineFlame = makeFlame(.42, 1.7);
    engineFlame.position.y = .02;
    flightRocket.add(engineFlame);
  }
  const count = flightParts.filter(id => PARTS[id].type === 'booster').length;
  for (let i = 0; i < count; i++) {
    const angle = i / Math.max(1, count) * Math.PI * 2 + Math.PI / 4;
    const flame = makeFlame(.18, 1.1);
    flame.position.set(Math.cos(angle) * BOOSTER_RING, .02, Math.sin(angle) * BOOSTER_RING);
    flightRocket.add(flame);
    boosterFlames.push(flame);
  }
}

function buildFlightRocket() {
  flightRocket = new THREE.Group();
  arrangeRocket(flightRocket, flightParts, ROCKET_SCALE);
  addFlightFlames();
  flightRocket.position.set(0, PAD_Y, 0);
  flightScene.add(flightRocket);
}

function flicker(flame, throttle) {
  const s = (.65 + throttle * .7) * (.92 + Math.random() * .16);
  flame.scale.set(.92 + Math.random() * .16, s, .92 + Math.random() * .16);
  flame.visible = true;
}

/* ───────────────────────── Messages ───────────────────────── */

function setMessage(text, tone = '', sticky = false) {
  if (text === lastMessage) return;
  lastMessage = text;
  const el = $('#flightMessage');
  el.textContent = text;
  el.className = `flight-message show ${tone}`;
  clearTimeout(messageTimer);
  if (!sticky) messageTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function setThrottle(value) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  $('#throttle').value = v;
  $('#throttleValue').textContent = v + '%';
}

/* ───────────────────────── Launch ───────────────────────── */

function startLaunch() {
  if (!rocketParts.length) { setStatus('ADD PARTS FIRST', 'warn'); return; }
  const hasPoweredEngine = rocketParts.some(id => ['engine', 'booster'].includes(PARTS[id].type));
  const availableFuel = rocketParts.reduce((sum, id) => sum + PARTS[id].fuel, 0);
  if (!hasPoweredEngine || availableFuel === 0) { setStatus('ADD ENGINE AND FUEL', 'warn'); return; }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#launchScreen').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === 'launch'));

  if (!flightRenderer) initFlight();
  resize();
  if (flightRocket) flightScene.remove(flightRocket);
  debris.splice(0).forEach(d => flightScene.remove(d.obj));
  smokeLife.fill(0);

  flightParts = rocketParts.slice();
  buildFlightRocket();
  coreFuel = flightParts.filter(id => PARTS[id].type === 'tank').length * PARTS.tank.fuel;
  boosterFuel = flightParts.filter(id => PARTS[id].type === 'booster').length * PARTS.booster.fuel;
  flightFuel = coreFuel + boosterFuel;

  flightPosition.set(0, 0, 0);
  flightVelocity.set(0, 0, 0);
  flightRocket.quaternion.identity();
  flightY = 0; flightV = 0; flightT = 0; countdown = 3; stage = 1;
  flightState = 'countdown'; flightRunning = true; lastTime = performance.now();
  flightKeys.clear(); cameraMode = 0; lastMessage = '';

  flightRocket.position.set(0, PAD_Y, 0);
  flightCamera.position.set(0, 3, 15);
  flightCamera.lookAt(0, 2, 0);
  $('#cameraBtn').textContent = 'CAM: ' + cameraModes[cameraMode];
  $('#stageNumber').textContent = '01';
  setThrottle(100);
  setMessage('IGNITION — 3…');
  $('#altitude').textContent = '0 m';
  $('#velocity').textContent = '0 m/s';
  $('#flightFuel').textContent = Math.round(flightFuel) + ' kg';
  $('#missionTime').textContent = 'T+ 00:00';
  requestAnimationFrame(flightLoop);
}

/* ───────────────────────── Flight simulation ───────────────────────── */

function flightLoop(now) {
  if (!flightRunning) return;
  const dt = Math.min(Math.max((now - lastTime) / 1000, 0), .05);
  lastTime = now;
  const throttle = Number($('#throttle').value) / 100;
  let burning = false;

  if (countdown > 0) {
    countdown = Math.max(0, countdown - dt);
    if (countdown === 0) { flightState = 'ascent'; setMessage('LIFTOFF', 'success'); }
    else setMessage(`IGNITION — ${Math.ceil(countdown)}…`);
    // Pre-ignition glow in the final second.
    if (countdown < 1.2 && countdown > 0) {
      if (engineFlame) { engineFlame.visible = true; engineFlame.scale.set(.6, .25 + Math.random() * .1, .6); }
    }
  } else {
    flightT += dt;
    steer(dt);

    const engineCount = flightParts.filter(id => PARTS[id].type === 'engine').length;
    const boosterCount = flightParts.filter(id => PARTS[id].type === 'booster').length;
    const coreMax = engineCount * PARTS.engine.thrust * throttle;
    const boosterMax = boosterCount * PARTS.booster.thrust * throttle;
    const coreFlow = 1000 / (ENGINE_ISP * 9.81), boosterFlow = 1000 / (BOOSTER_ISP * 9.81);
    const coreThrust = coreMax && coreFuel > 0 ? Math.min(coreMax, coreFuel / (coreFlow * dt)) : 0;
    const boosterThrust = boosterMax && boosterFuel > 0 ? Math.min(boosterMax, boosterFuel / (boosterFlow * dt)) : 0;
    const thrust = coreThrust + boosterThrust;
    burning = thrust > 0;

    coreFuel -= Math.min(coreFuel, coreThrust * coreFlow * dt);
    boosterFuel -= Math.min(boosterFuel, boosterThrust * boosterFlow * dt);
    flightFuel = coreFuel + boosterFuel;

    if (engineFlame) { if (coreThrust > 0) flicker(engineFlame, throttle); else engineFlame.visible = false; }
    boosterFlames.forEach(f => { if (boosterThrust > 0) flicker(f, throttle); else f.visible = false; });

    const dryMass = flightParts.reduce((sum, id) => sum + PARTS[id].mass, 0);
    const mass = Math.max(.1, dryMass + flightFuel / 1000);
    const radiusVector = flightPosition.clone().sub(flightGravityCenter);
    const radius = Math.max(1, radiusVector.length());
    const gravity = radiusVector.normalize().multiplyScalar(-G * MOON_RADIUS * MOON_RADIUS / (radius * radius));
    const thrustDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(flightRocket.quaternion);
    flightVelocity.addScaledVector(gravity, dt).addScaledVector(thrustDirection, thrust / mass * dt);
    flightPosition.addScaledVector(flightVelocity, dt);

    const radial = flightPosition.clone().sub(flightGravityCenter);
    const currentRadius = radial.length();
    flightY = Math.max(0, currentRadius - MOON_RADIUS);
    flightV = flightVelocity.length();
    const radialDirection = radial.normalize();
    const radialSpeed = flightVelocity.dot(radialDirection);
    const tangentialSpeed = Math.sqrt(Math.max(0, flightV * flightV - radialSpeed * radialSpeed));

    if (currentRadius <= MOON_RADIUS) {
      flightPosition.copy(radialDirection.multiplyScalar(MOON_RADIUS).add(flightGravityCenter));
      flightY = 0; flightRunning = false;
      if (flightV < 12) {
        flightVelocity.set(0, 0, 0); flightV = 0; flightState = 'landed';
        setMessage('SOFT LANDING — MISSION COMPLETE\nPRESS R TO RELAUNCH', 'success', true);
      } else {
        flightState = 'crashed';
        setMessage('HARD IMPACT — VEHICLE LOST\nPRESS R TO RELAUNCH', 'danger', true);
      }
    } else if (flightY >= 10000 && tangentialSpeed >= 5 && Math.abs(radialSpeed) < 20) {
      flightRunning = false; flightState = 'orbit';
      setMessage('STABLE LUNAR ORBIT — MISSION COMPLETE\nPRESS R TO RELAUNCH', 'success', true);
    } else if (throttle === 0) {
      setMessage('ENGINE CUTOFF — COASTING');
    } else if (thrust === 0) {
      setMessage(flightFuel === 0 ? 'FUEL DEPLETED — COASTING' : 'NO ACTIVE ENGINE', flightFuel === 0 ? 'danger' : '');
    } else if (flightT > .5) {
      setMessage(radialSpeed >= 0 ? 'POWERED FLIGHT — STEER TO ORBIT' : 'DESCENT — INCREASE THRUST');
    }
  }

  if (!flightRunning) {
    if (engineFlame) engineFlame.visible = false;
    boosterFlames.forEach(f => f.visible = false);
  }

  updateRocketVisuals(dt, burning, throttle);
  updateCamera(dt, burning, throttle);
  updateDebris(dt);
  updateSmoke(dt);

  $('#altitude').textContent = Math.round(flightY) + ' m';
  $('#velocity').textContent = Math.round(flightV) + ' m/s';
  $('#flightFuel').textContent = Math.round(flightFuel) + ' kg';
  $('#missionTime').textContent = 'T+ ' + fmtTime(flightT);
  flightRenderer.render(flightScene, flightCamera);
  if (flightRunning) requestAnimationFrame(flightLoop);
}

const _axisX = new THREE.Vector3(1, 0, 0), _axisY = new THREE.Vector3(0, 1, 0), _axisZ = new THREE.Vector3(0, 0, 1);
function steer(dt) {
  const turnRate = .75;
  const axis = (pos, neg) => Number(flightKeys.has(pos)) - Number(flightKeys.has(neg));
  const pitch = axis('KeyW', 'KeyS'), yaw = axis('KeyD', 'KeyA'), roll = axis('KeyE', 'KeyQ');
  if (!(pitch || yaw || roll)) return;
  const turn = new THREE.Quaternion().setFromAxisAngle(_axisX, pitch * turnRate * dt);
  turn.multiply(new THREE.Quaternion().setFromAxisAngle(_axisZ, yaw * turnRate * dt));
  turn.multiply(new THREE.Quaternion().setFromAxisAngle(_axisY, roll * turnRate * dt));
  flightRocket.quaternion.multiply(turn).normalize();
}

function updateRocketVisuals(dt, burning, throttle) {
  if (!flightRocket) return;
  flightRocket.position.set(flightPosition.x * FLIGHT_SCALE, PAD_Y + flightPosition.y * FLIGHT_SCALE, flightPosition.z * FLIGHT_SCALE);
  if (flameLight) {
    flameLight.position.copy(flightRocket.position).addScaledVector(_axisY.clone().applyQuaternion(flightRocket.quaternion), -.4);
    flameLight.intensity = burning ? 5 * throttle * (.85 + Math.random() * .3) : 0;
  }
  if (burning && flightY < 1200) emitSmoke(Math.ceil(throttle * 3));
}

function updateCamera(dt, burning, throttle) {
  if (!flightRocket) return;
  const rocketUp = new THREE.Vector3(0, 1, 0).applyQuaternion(flightRocket.quaternion).normalize();
  let desiredCamera, desiredTarget;
  if (cameraMode === 2) {
    desiredCamera = flightRocket.position.clone().add(new THREE.Vector3(12, 8, 16));
    desiredTarget = flightRocket.position.clone().addScaledVector(rocketUp, 2);
  } else {
    const distance = cameraMode === 0 ? 13 : 6, height = cameraMode === 0 ? 3.5 : 1.8;
    const behind = new THREE.Vector3(0, 0, 1).applyQuaternion(flightRocket.quaternion).normalize();
    desiredCamera = flightRocket.position.clone().addScaledVector(behind, distance).addScaledVector(rocketUp, height);
    desiredTarget = flightRocket.position.clone().addScaledVector(rocketUp, 2.5);
  }
  const followRate = cameraMode === 1 ? 12 : 8;
  flightCamera.position.lerp(desiredCamera, 1 - Math.exp(-followRate * Math.max(dt, 1 / 60)));
  if (burning && flightT < 8) {
    const shake = .02 * throttle * (1 - flightT / 8);
    flightCamera.position.add(new THREE.Vector3((Math.random() - .5) * shake, (Math.random() - .5) * shake, (Math.random() - .5) * shake));
  }
  flightCamera.lookAt(desiredTarget);
  if (flightStars) flightStars.position.copy(flightCamera.position);
}

function fmtTime(t) {
  const m = Math.floor(t / 60).toString().padStart(2, '0'), s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ───────────────────────── Staging ───────────────────────── */

// Spawn a drifting copy of the jettisoned parts so staging is visible.
function jettison(ids) {
  const obj = new THREE.Group();
  arrangeRocket(obj, ids, ROCKET_SCALE);
  obj.position.copy(flightRocket.position);
  obj.quaternion.copy(flightRocket.quaternion);
  flightScene.add(obj);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(flightRocket.quaternion);
  debris.push({
    obj, life: 6,
    vel: flightVelocity.clone().multiplyScalar(FLIGHT_SCALE).addScaledVector(side, 1.6).add(new THREE.Vector3(0, -.6, 0)),
    spin: new THREE.Vector3((Math.random() - .5) * .8, (Math.random() - .5) * .4, (Math.random() - .5) * .8)
  });
}

function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.life -= dt;
    d.vel.y -= .9 * dt;
    d.obj.position.addScaledVector(d.vel, dt);
    d.obj.rotation.x += d.spin.x * dt;
    d.obj.rotation.y += d.spin.y * dt;
    d.obj.rotation.z += d.spin.z * dt;
    if (d.life <= 0) { flightScene.remove(d.obj); debris.splice(i, 1); }
  }
}

function separateStage() {
  if (!flightRunning || countdown > 0) return;
  const boosters = flightParts.filter(id => PARTS[id].type === 'booster');
  if (boosters.length) {
    jettison(boosters);
    flightParts = flightParts.filter(id => PARTS[id].type !== 'booster');
    boosterFuel = 0; flightFuel = coreFuel;
    setMessage('BOOSTERS SEPARATED');
  } else if (flightParts.some(id => PARTS[id].type === 'separator') && flightParts.some(id => PARTS[id].type === 'engine')) {
    jettison(flightParts.filter(id => ['engine', 'separator'].includes(PARTS[id].type)));
    flightParts = flightParts.filter(id => !['engine', 'separator'].includes(PARTS[id].type));
    setMessage('CORE ENGINE JETTISONED');
  } else {
    setMessage('NO STAGE AVAILABLE', 'danger');
    return;
  }
  stage++;
  $('#stageNumber').textContent = String(stage).padStart(2, '0');
  arrangeRocket(flightRocket, flightParts, ROCKET_SCALE);
  addFlightFlames();
}

/* ───────────────────────── Navigation & input ───────────────────────── */

function showBuild() {
  flightRunning = false;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#buildScreen').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === 'build'));
  resize();
}

$('#launchBtn').onclick = startLaunch;
$('#abortBtn').onclick = showBuild;
$('#stageBtn').onclick = separateStage;
$('#cameraBtn').onclick = () => { cameraMode = (cameraMode + 1) % cameraModes.length; $('#cameraBtn').textContent = 'CAM: ' + cameraModes[cameraMode]; };
$('#throttle').oninput = e => setThrottle(e.target.value);
document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => {
  if (b.dataset.screen === 'build') showBuild();
  else if (!isLaunchActive()) startLaunch();
});

const FLIGHT_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'];
window.addEventListener('keydown', e => {
  const inFlight = isLaunchActive();
  if (inFlight) {
    if (FLIGHT_KEYS.includes(e.code)) { flightKeys.add(e.code); e.preventDefault(); }
    else if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) $('#stageBtn').click(); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setThrottle(Number($('#throttle').value) + 10);
    else if (e.code === 'ControlLeft' || e.code === 'ControlRight') setThrottle(Number($('#throttle').value) - 10);
    else if (e.code === 'KeyZ') setThrottle(100);
    else if (e.code === 'KeyX') setThrottle(0);
    else if (e.code === 'KeyC' && !e.repeat) $('#cameraBtn').click();
    else if (e.code === 'KeyR' && !flightRunning) startLaunch();
  } else {
    if (e.code === 'KeyR') clearRocket();
    else if (e.code === 'Backspace' || (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); undoPart(); }
    else if (e.code === 'Enter' && document.activeElement === document.body) startLaunch();
  }
});
window.addEventListener('keyup', e => {
  flightKeys.delete(e.code);
  if (e.code === 'Space' && isLaunchActive()) e.preventDefault(); // stop a focused button firing twice
});
window.addEventListener('blur', () => flightKeys.clear());

/* ───────────────────────── Resize & render loop ───────────────────────── */

function fit(renderer, camera, host) {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
function resize() {
  if (buildRenderer) fit(buildRenderer, buildCamera, $('#builderViewport'));
  if (flightRenderer) fit(flightRenderer, flightCamera, $('#flightViewport'));
}
new ResizeObserver(resize).observe($('#builderViewport'));
new ResizeObserver(resize).observe($('#flightViewport'));

function buildLoop() {
  requestAnimationFrame(buildLoop);
  if (!$('#buildScreen').classList.contains('active')) return; // don't render the hidden builder
  popAmount *= .86;
  if (rocketGroup) rocketGroup.scale.setScalar(1 + popAmount * .025);
  buildControls?.update();
  buildRenderer?.render(buildScene, buildCamera);
}

initBuild();
updateStats();
buildLoop();
