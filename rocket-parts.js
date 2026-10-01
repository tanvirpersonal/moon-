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

// Rocket part geometry — add or adjust visual details by part type here.
function material(color, metalness = .45, roughness = .38) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function makePart(partData) {
  const group = new THREE.Group();
  const bodyMaterial = material(partData.color);
  let mesh;

  if (partData.type === 'nose' || partData.type === 'capsule') {
    const isNose = partData.type === 'nose';
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, isNose ? .65 : .75, 32), bodyMaterial);
    mesh.position.y = isNose ? .32 : .38;
    group.add(mesh);

    if (isNose) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.48, .58, 32), bodyMaterial);
      tip.position.y = .9;
      group.add(tip);
    } else {
      // Small forward-facing window and rim make the crew capsule easier to read.
      const windowRim = new THREE.Mesh(new THREE.TorusGeometry(.145, .025, 10, 32), material(0x65798d, .75, .28));
      windowRim.position.set(0, .48, .48);
      group.add(windowRim);
      const windowGlass = new THREE.Mesh(new THREE.SphereGeometry(.112, 20, 16), new THREE.MeshStandardMaterial({
        color: 0x59bfff, metalness: .55, roughness: .16, emissive: 0x0a2b46
      }));
      windowGlass.scale.z = .28;
      windowGlass.position.set(0, .48, .49);
      group.add(windowGlass);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(.49, .025, 8, 32), material(0x8e9aa5, .7));
      collar.rotation.x = Math.PI / 2;
      collar.position.y = .08;
      group.add(collar);
    }
  } else if (partData.type === 'tank') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, 1.45, 32), bodyMaterial);
    mesh.position.y = .72;
    group.add(mesh);
    for (const y of [.18, .72, 1.26]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(.53, .025, 8, 32), material(y === .72 ? 0x384653 : 0x303943, .7));
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      group.add(band);
    }
  } else if (partData.type === 'engine') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(.44, .58, .7, 32), bodyMaterial);
    mesh.position.y = .35;
    group.add(mesh);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.24, .39, .32, 24), material(0x30363d, .8));
    nozzle.position.y = -.15;
    group.add(nozzle);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.38, .035, 8, 24), material(0x9a744c, .72, .34));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -.3;
    group.add(rim);
  } else if (partData.type === 'booster') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(.3, .34, 1.1, 24), bodyMaterial);
    mesh.position.y = .55;
    group.add(mesh);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.3, .28, 24), bodyMaterial);
    cap.position.y = 1.24;
    group.add(cap);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.16, .25, .25, 20), material(0x30363d, .8));
    nozzle.position.y = -.12;
    group.add(nozzle);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(.31, .025, 8, 24), material(0xc87839, .55));
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = .8;
    group.add(stripe);
  } else if (partData.type === 'separator') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(.56, .56, .18, 32), material(0xe4a34e, .7));
    mesh.position.y = .09;
    group.add(mesh);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(.56, .025, 8, 32), material(0x70451f, .7));
    seam.rotation.x = Math.PI / 2;
    seam.position.y = .09;
    group.add(seam);
  } else if (partData.type === 'fins') {
    const finMaterial = material(partData.color, .6, .42);
    for (let i = 0; i < 4; i++) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(.48, .46, .1), finMaterial);
      const angle = i * Math.PI / 2;
      mesh.position.set(Math.cos(angle) * .48, .24, Math.sin(angle) * .48);
      mesh.rotation.y = -angle;
      group.add(mesh);
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

  const boosters = parts.filter(id => PARTS[id].type === 'booster');
  boosters.forEach((id, index) => {
    const part = makePart(PARTS[id]);
    part.scale.setScalar(scale);
    part.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(part);
    const angle = (index / Math.max(1, boosters.length)) * Math.PI * 2;
    const radius = .68 * scale;
    part.position.set(Math.cos(angle) * radius, -bounds.min.y, Math.sin(angle) * radius);
    group.add(part);
  });

  parts.filter(id => PARTS[id].type === 'fins').forEach(() => {
    const part = makePart(PARTS.fins);
    part.scale.setScalar(scale);
    part.position.y = .08 * scale;
    group.add(part);
  });

  return stackHeight;
}
