import * as THREE from 'three';

// Rocket part catalog — edit names, stats, icons, and colors here.
export const PARTS = {
  capsule: { name: 'Command Capsule', desc: 'Crew module', icon: '◉', mass: 1.8, fuel: 0, thrust: 0, color: 0xdce5ee, type: 'capsule' },
  nose: { name: 'Nose Cone', desc: 'Aerodynamic tip', icon: '△', mass: .35, fuel: 0, thrust: 0, color: 0xb8c4d0, type: 'nose' },
  tank: { name: 'Fuel Tank', desc: 'Liquid fuel', icon: '▥', mass: 1.2, fuel: 900, thrust: 0, color: 0xb6bec7, type: 'tank' },
  engine: { name: 'Lunar Engine', desc: 'High thrust', icon: '🔥', mass: 1.1, fuel: 0, thrust: 120, color: 0x697887, type: 'engine' },
  booster: { name: 'Solid Booster', desc: 'Auxiliary thrust', icon: '◆', mass: 1.5, fuel: 650, thrust: 80, color: 0x8f979e, type: 'booster' },
  fins: { name: 'Stabilizer Fins', desc: 'Flight control', icon: '◢', mass: .25, fuel: 0, thrust: 0, color: 0x465463, type: 'fins' },
  separator: { name: 'Decoupler', desc: 'Stage separator', icon: '⊙', mass: .18, fuel: 0, thrust: 0, color: 0xd08b38, type: 'separator' }
};

/* ---------- Procedural textures (cached, drawn once) ---------- */

let hullCanvas;
const texCache = new Map();

// Grayscale hull plating: noise + panel seams + rivets. Tinted by material color.
function getHullCanvas() {
  if (hullCanvas) return hullCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#eef1f3';
  g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - .5) * 26;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(35,45,55,.6)';
  g.lineWidth = 2;
  for (const y of [1, 257]) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  for (const x of [1, 129, 257, 385]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  g.fillStyle = 'rgba(25,35,45,.55)';
  for (const y of [9, 265]) for (let x = 8; x < 512; x += 16) { g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
  hullCanvas = c;
  return c;
}

function hullTexture(rx, ry) {
  const key = rx + 'x' + ry;
  if (!texCache.has(key)) {
    const t = new THREE.CanvasTexture(getHullCanvas());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

function hullMaterial(color, rx = 4, ry = 2, metalness = .35, roughness = .42) {
  const t = hullTexture(rx, ry);
  return new THREE.MeshStandardMaterial({ color, map: t, bumpMap: t, bumpScale: .7, metalness, roughness });
}

function material(color, metalness = .45, roughness = .38) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

// Printed tank label with hazard stripe.
function labelTexture(text) {
  if (texCache.has('label' + text)) return texCache.get('label' + text);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1b232b';
  g.font = 'bold 84px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 256, 120);
  g.font = 'bold 28px Arial, sans-serif';
  g.fillText('LIQUID FUEL  •  HANDLE WITH CARE', 256, 165);
  g.fillStyle = '#d08b38';
  for (let x = -40; x < 560; x += 48) {
    g.beginPath(); g.moveTo(x, 205); g.lineTo(x + 28, 205); g.lineTo(x + 8, 245); g.lineTo(x - 20, 245); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set('label' + text, t);
  return t;
}

/* ---------- Geometry helpers ---------- */

const lathe = (pts, mat, seg = 48) =>
  new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);

const cyl = (rt, rb, h, y, mat, seg = 32) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.y = y;
  return m;
};

const ring = (r, tube, y, mat, seg = 48) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
};

// Smooth ogive nose profile from radius R down to the tip.
function ogivePoints(R, y0, h, steps = 28) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([Math.max(0, R * Math.pow(1 - t, .85)), y0 + h * t]);
  }
  return pts;
}

// Rocket bell nozzle profile (bottom → top), fast flare near the throat.
function bellPoints(rThroat, rExit, yBottom, yTop, steps = 20) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, d = 1 - t;
    pts.push([rThroat + (rExit - rThroat) * Math.pow(d, .5), yBottom + (yTop - yBottom) * t]);
  }
  return pts;
}

let finGeometry;
function getFinGeometry() {
  if (finGeometry) return finGeometry;
  const s = new THREE.Shape();
  s.moveTo(.4, .66);
  s.lineTo(1.0, .3);
  s.lineTo(1.0, .02);
  s.lineTo(.4, 0);
  s.closePath();
  finGeometry = new THREE.ExtrudeGeometry(s, {
    depth: .05, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 2
  });
  finGeometry.translate(0, 0, -.025);
  return finGeometry;
}

/* ---------- Parts ---------- */

function makePart(partData) {
  const group = new THREE.Group();
  const R = .48;

  if (partData.type === 'nose') {
    const hull = hullMaterial(partData.color, 5, 2);
    group.add(lathe([[0, 0], [R, 0], [R, .4]], hull));
    group.add(lathe(ogivePoints(R, .4, .95), hull));
    group.add(ring(R + .005, .022, .4, material(0x3a4651, .7, .35)));
    group.add(ring(R + .004, .018, .08, material(0xc87839, .5, .4)));
    const rod = cyl(.012, .02, .24, 1.45, material(0x2b3138, .85, .3), 12);
    group.add(rod);
    const tipBall = new THREE.Mesh(new THREE.SphereGeometry(.026, 12, 10), material(0xd9dde2, .9, .2));
    tipBall.position.y = 1.58;
    group.add(tipBall);
  } else if (partData.type === 'capsule') {
    const hull = hullMaterial(partData.color, 4, 1.5, .3, .4);
    const prof = [[0, 0], [.47, 0], [.48, .03], [.48, .3], [.46, .31]];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      prof.push([.45 - .25 * t - .02 * Math.sin(t * Math.PI), .34 + .46 * t]);
    }
    prof.push([.2, .82], [.14, .86], [.14, .9], [0, .9]);
    group.add(lathe(prof, hull));
    group.add(ring(.485, .022, .02, material(0x8e9aa5, .7, .3)));
    group.add(ring(.49, .02, .32, material(0x2f3a45, .6, .4)));
    group.add(ring(.2, .018, .83, material(0x8e9aa5, .75, .3)));

    // Windows on the sloped command-module wall (angled to match the cone).
    const slope = Math.atan(.25 / .46);
    for (const ang of [0, .95, -.95]) {
      const pivot = new THREE.Group();
      pivot.rotation.y = ang;
      const w = new THREE.Group();
      w.position.set(0, .56, .325);
      w.rotation.x = -slope;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.105, .022, 10, 32), material(0x65798d, .75, .28));
      const glass = new THREE.Mesh(new THREE.SphereGeometry(.088, 20, 16), new THREE.MeshStandardMaterial({
        color: 0x59bfff, metalness: .55, roughness: .12, emissive: 0x0a2b46
      }));
      glass.scale.z = .25;
      glass.position.z = .005;
      w.add(rim, glass);
      pivot.add(w);
      group.add(pivot);
    }

    // RCS thruster quads on the service section.
    const rcsMat = material(0x2b3138, .8, .35);
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2 + Math.PI / 4;
      const pod = new THREE.Group();
      pod.rotation.y = a;
      for (const [dx, dy] of [[-.05, .1], [.05, .1], [-.05, .2], [.05, .2]]) {
        const n = new THREE.Mesh(new THREE.ConeGeometry(.022, .06, 10), rcsMat);
        n.rotation.x = Math.PI / 2;
        n.position.set(dx, dy, .495);
        pod.add(n);
      }
      group.add(pod);
    }
  } else if (partData.type === 'tank') {
    const hull = hullMaterial(partData.color, 4, 3);
    const Rt = .52, dome = .12, top = 1.45;
    const prof = [];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push([Rt * Math.sin(a), dome - dome * Math.cos(a)]); }
    for (let i = 1; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push([Rt * Math.cos(a), top - dome + dome * Math.sin(a)]); }
    group.add(lathe(prof, hull));

    const dark = material(0x303943, .7, .4);
    for (const y of [.18, .72, 1.26]) group.add(ring(Rt + .01, .025, y, y === .72 ? material(0x384653, .7) : dark));
    group.add(cyl(Rt + .015, Rt + .015, .08, .06, dark, 48));
    group.add(cyl(Rt + .015, Rt + .015, .08, 1.39, dark, 48));

    // Printed label.
    const lblMat = new THREE.MeshStandardMaterial({
      map: labelTexture('LF-900'), transparent: true, roughness: .5, metalness: .1,
      polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false
    });
    const len = 1.9;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(Rt + .004, Rt + .004, .55, 40, 1, true, -len / 2, len), lblMat);
    label.position.y = .95;
    group.add(label);

    // External fuel line with clamps.
    const pipeMat = material(0x8a949e, .85, .3);
    for (const a of [2.2, -2.2]) {
      const px = Math.sin(a) * (Rt + .045), pz = Math.cos(a) * (Rt + .045);
      const pipe = cyl(.028, .028, 1.15, .72, pipeMat, 14);
      pipe.position.x = px; pipe.position.z = pz;
      group.add(pipe);
      for (const y of [.25, .72, 1.19]) {
        const clamp = cyl(.04, .04, .04, y, material(0x384653, .7), 14);
        clamp.position.x = px; clamp.position.z = pz;
        group.add(clamp);
      }
    }
  } else if (partData.type === 'engine') {
    const metal = material(partData.color, .75, .35);
    const dark = material(0x30363d, .8, .35);

    // Mount ring + thrust structure.
    group.add(cyl(.5, .5, .08, .66, dark, 40));
    group.add(lathe([[.5, .62], [.4, .55], [.3, .3]], material(partData.color, .7, .4)));
    group.add(ring(.32, .03, .5, material(0x9a744c, .7, .34)));

    // Combustion chamber + gold insulation wrap.
    group.add(cyl(.2, .2, .26, .45, metal, 28));
    group.add(cyl(.37, .37, .1, .55, material(0xb48a3a, .8, .3), 36));

    // Turbopumps and feed lines.
    for (const side of [-1, 1]) {
      const pump = cyl(.09, .09, .26, .46, metal, 18);
      pump.position.x = side * .33; pump.position.z = .1;
      group.add(pump);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .16, 10), dark);
      line.rotation.z = Math.PI / 2;
      line.position.set(side * .25, .45, .1);
      group.add(line);
    }

    // Bell nozzle: outer shell, dark burnt inner wall, cooling ribs, rim.
    const bell = bellPoints(.17, .58, -.5, .34);
    group.add(lathe(bell, material(0x4f5b67, .85, .32)));
    const inner = new THREE.Mesh(
      new THREE.LatheGeometry(bellPoints(.155, .565, -.495, .335).map(([r, y]) => new THREE.Vector2(r, y)), 48),
      new THREE.MeshStandardMaterial({ color: 0x1a1d21, metalness: .6, roughness: .6, side: THREE.BackSide })
    );
    group.add(inner);
    for (const t of [.3, .5, .7, .88]) {
      const d = 1 - t;
      group.add(ring(.17 + .41 * Math.pow(d, .5) + .008, .012, -.5 + .84 * t, dark, 48));
    }
    group.add(ring(.58, .035, -.5, material(0x9a744c, .72, .34)));
  } else if (partData.type === 'booster') {
    const hull = hullMaterial(partData.color, 3, 2.5, .3, .45);
    const r = .3;
    group.add(lathe([[0, .08], [r, .08], [r, 1.0]], hull, 36));
    group.add(lathe(ogivePoints(r, 1.0, .42, 20), hull, 36));
    const nozzle = lathe(bellPoints(.12, .24, -.3, .1, 14), material(0x30363d, .85, .35), 28);
    nozzle.material.side = THREE.DoubleSide;
    group.add(nozzle);
    group.add(ring(.24, .02, -.3, material(0x9a744c, .7, .34), 28));
    for (const y of [.35, .7]) group.add(ring(r + .004, .016, y, material(0x333c45, .7, .4), 36));
    group.add(ring(r + .006, .028, .86, material(0xc87839, .55), 36));
    group.add(ring(r + .006, .028, .2, material(0xc87839, .55), 36));

    // Attach struts toward the core (+x is outward when placed by arrangeRocket).
    const strutMat = material(0x2f3a45, .75, .4);
    for (const y of [.25, .85]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .09), strutMat);
      strut.position.set(-.38, y, 0);
      group.add(strut);
    }
  } else if (partData.type === 'separator') {
    const orange = material(0xe4a34e, .7, .4);
    group.add(cyl(.56, .56, .18, .09, orange, 48));
    group.add(ring(.565, .02, .09, material(0x70451f, .7), 48));
    for (const y of [.01, .17]) group.add(ring(.56, .018, y, material(0x20242a, .8, .4), 48));
    // Separation bolts.
    const boltGeo = new THREE.CylinderGeometry(.022, .022, .035, 10);
    const boltMat = material(0x555d66, .9, .3);
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.rotation.z = Math.PI / 2;
      bolt.rotation.y = -a;
      bolt.position.set(Math.cos(a) * .565, .09 + (i % 2 ? .045 : -.045), Math.sin(a) * .565);
      group.add(bolt);
    }
  } else if (partData.type === 'fins') {
    const finMat = material(partData.color, .6, .42);
    for (let i = 0; i < 4; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = -i * Math.PI / 2;
      pivot.add(new THREE.Mesh(getFinGeometry(), finMat));
      group.add(pivot);
    }
  }

  group.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}

// Shared vertical assembly used by both the builder and flight scene.
export function arrangeRocket(group, parts, scale = 1) {
  while (group.children.length) group.remove(group.children[0]);

  const order = { engine: 0, separator: 1, tank: 2, capsule: 3, nose: 4 };
  const core = parts.map((id, index) => ({ id, index }))
    .filter(item => !['booster', 'fins'].includes(PARTS[item.id].type))
    .sort((a, b) => (order[PARTS[a.id].type] ?? 2) - (order[PARTS[b.id].type] ?? 2) || a.index - b.index);

  let stackHeight = 0;
  core.forEach(({ id }) => {
    const part = makePart(PARTS[id]);
    part.scale.setScalar(scale);
    part.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(part);
    const height = bounds.max.y - bounds.min.y;
    part.position.y = stackHeight - bounds.min.y;
    group.add(part);
    stackHeight += height;
  });

  // Boosters sit just outside the core, offset 45° from the fins, struts facing the core.
  const boosters = parts.filter(id => PARTS[id].type === 'booster');
  boosters.forEach((id, index) => {
    const part = makePart(PARTS[id]);
    part.scale.setScalar(scale);
    part.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(part);
    const angle = (index / Math.max(1, boosters.length)) * Math.PI * 2 + Math.PI / 4;
    const radius = .9 * scale;
    part.rotation.y = -angle;
    part.position.set(Math.cos(angle) * radius, -bounds.min.y, Math.sin(angle) * radius);
    group.add(part);
  });

  parts.filter(id => PARTS[id].type === 'fins').forEach(() => {
    const part = makePart(PARTS.fins);
    part.scale.setScalar(scale);
    part.position.y = .2 * scale;
    group.add(part);
  });

  return stackHeight;
}
