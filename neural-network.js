import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const host = document.querySelector('#neural-scene');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020712, 0.045);

const camera = new THREE.PerspectiveCamera(52, host.clientWidth / host.clientHeight, 0.1, 100);
camera.position.set(0, 0.4, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const root = new THREE.Group();
scene.add(root);

const layers = [
  { name: 'PERCEPTION', x: -5.0, count: 14, color: 0x4ddfff },
  { name: 'MEMORY', x: -2.5, count: 18, color: 0x8975ff },
  { name: 'REASONING', x: 0, count: 22, color: 0xf36cff },
  { name: 'GOALS', x: 2.5, count: 18, color: 0xff86c9 },
  { name: 'ACTION', x: 5.0, count: 14, color: 0xffd45c }
];

const nodes = [];
const edges = [];
const packets = [];

function makeNode(position, color, size = 0.075) {
  const geometry = new THREE.SphereGeometry(size, 12, 12);
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  root.add(mesh);
  nodes.push({ mesh, color, phase: Math.random() * Math.PI * 2 });
  return mesh;
}

const layerNodes = [];
for (let li = 0; li < layers.length; li++) {
  const layer = layers[li];
  const current = [];
  for (let i = 0; i < layer.count; i++) {
    const y = (i / (layer.count - 1) - 0.5) * 5.4;
    const z = Math.sin(i * 1.7 + li) * 1.3 + (Math.random() - 0.5) * 1.0;
    const x = layer.x + (Math.random() - 0.5) * 0.22;
    current.push(makeNode(new THREE.Vector3(x, y, z), layer.color, li === 2 ? 0.09 : 0.075));
  }
  layerNodes.push(current);
}

function connect(a, b, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([a.position, b.position]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.13 });
  const line = new THREE.Line(geometry, material);
  root.add(line);
  edges.push({ line, a, b });
}

for (let li = 0; li < layerNodes.length - 1; li++) {
  const a = layerNodes[li];
  const b = layerNodes[li + 1];
  for (const from of a) {
    const connections = [...b].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const to of connections) connect(from, to, layers[li + 1].color);
  }
}

const glow = new THREE.PointLight(0x35cfff, 10, 10);
glow.position.set(0, 0, 3);
scene.add(glow);

const coreGeometry = new THREE.IcosahedronGeometry(0.9, 2);
const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x5de7ff, wireframe: true, transparent: true, opacity: 0.22 });
const core = new THREE.Mesh(coreGeometry, coreMaterial);
root.add(core);

const ringGeometry = new THREE.TorusGeometry(2.0, 0.012, 8, 120);
const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x3fdcff, transparent: true, opacity: 0.32 });
const ring = new THREE.Mesh(ringGeometry, ringMaterial);
ring.rotation.x = Math.PI / 2.1;
root.add(ring);

function spawnPacket() {
  const li = Math.floor(Math.random() * (layerNodes.length - 1));
  const from = layerNodes[li][Math.floor(Math.random() * layerNodes[li].length)];
  const to = layerNodes[li + 1][Math.floor(Math.random() * layerNodes[li + 1].length)];
  const packet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color: layers[li + 1].color }));
  root.add(packet);
  packets.push({ packet, from, to, t: 0 });
}

setInterval(spawnPacket, 90);

const stars = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 450; i++) {
  starPositions.push((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 20 - 4);
}
stars.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0x76cfff, size: 0.018, transparent: true, opacity: 0.65 });
scene.add(new THREE.Points(stars, starMaterial));

const neuronCount = document.querySelector('#neuron-count');
const activity = document.querySelector('#activity');
const state = document.querySelector('#state');
neuronCount.textContent = nodes.length.toLocaleString();

const states = ['OBSERVING', 'INTERPRETING', 'THINKING', 'GENERATING GOAL', 'ACTING', 'LEARNING'];
let stateIndex = 0;
setInterval(() => {
  stateIndex = (stateIndex + 1) % states.length;
  state.textContent = states[stateIndex];
}, 1300);

function buildLayerCards() {
  const host = document.querySelector('#layer-map');
  layers.forEach((layer, index) => {
    const card = document.createElement('article');
    card.className = 'layer';
    card.innerHTML = `<h4>${layer.name}</h4><p>${['Sensory signals','Past experience','Pattern analysis','Intent formation','Execution'][index]}</p><div class="nodes"></div>`;
    const nodesHost = card.querySelector('.nodes');
    const count = Math.min(10, Math.ceil(layer.count / 2));
    for (let i = 0; i < count; i++) {
      const n = document.createElement('i');
      n.className = 'node';
      n.style.left = `${10 + Math.random() * 78}%`;
      n.style.top = `${8 + Math.random() * 82}%`;
      n.style.animationDelay = `${Math.random() * 1.5}s`;
      nodesHost.appendChild(n);
    }
    host.appendChild(card);
  });

  const loopHost = document.querySelector('#loop');
  ['Observe','Interpret','Goal','Act','Failure','Learn','New Goal'].forEach((label, i) => {
    const step = document.createElement('div');
    step.className = 'step';
    step.innerHTML = `<div class="orb">${i + 1}</div><span>${label}</span>`;
    loopHost.appendChild(step);
  });
}
buildLayerCards();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  root.rotation.y = Math.sin(t * 0.18) * 0.16;
  root.rotation.x = Math.sin(t * 0.13) * 0.045;
  core.rotation.x += 0.004;
  core.rotation.y -= 0.006;
  ring.rotation.z += 0.002;
  glow.intensity = 7 + Math.sin(t * 3.2) * 3;

  nodes.forEach((n, i) => {
    const pulse = 1 + Math.sin(t * 4 + n.phase) * 0.35;
    n.mesh.scale.setScalar(pulse);
    if (i % 7 === Math.floor(t * 2) % 7) n.mesh.material.color.setHex(0xffffff);
    else n.mesh.material.color.setHex(n.color);
  });

  packets.forEach((p, index) => {
    p.t += 0.025;
    p.packet.position.lerpVectors(p.from.position, p.to.position, p.t);
    if (p.t >= 1) {
      root.remove(p.packet);
      packets.splice(index, 1);
    }
  });

  activity.textContent = `${Math.round(55 + Math.sin(t * 1.7) * 24)}%`;
  renderer.render(scene, camera);
}
animate();

function resize() {
  const w = host.clientWidth;
  const h = host.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
