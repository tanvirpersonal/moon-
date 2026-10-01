import * as THREE from 'three';

export const PARTS = {
  capsule:{name:'Command Capsule',desc:'Crew module',icon:'◉',mass:1.8,fuel:0,thrust:0,color:0xdce5ee,type:'capsule'},
  nose:{name:'Nose Cone',desc:'Aerodynamic tip',icon:'△',mass:.35,fuel:0,thrust:0,color:0xb8c4d0,type:'nose'},
  tank:{name:'Fuel Tank',desc:'Liquid fuel',icon:'▥',mass:1.2,fuel:900,thrust:0,color:0xb6bec7,type:'tank'},
  engine:{name:'Lunar Engine',desc:'High thrust',icon:'🔥',mass:1.1,fuel:0,thrust:120,color:0x697887,type:'engine'},
  booster:{name:'Solid Booster',desc:'Auxiliary thrust',icon:'◆',mass:1.5,fuel:650,thrust:80,color:0x8f979e,type:'booster'},
  fins:{name:'Stabilizer Fins',desc:'Flight control',icon:'◢',mass:.25,fuel:0,thrust:0,color:0x465463,type:'fins'},
  separator:{name:'Decoupler',desc:'Stage separator',icon:'⊙',mass:.18,fuel:0,thrust:0,color:0xd08b38,type:'separator'}
};

const mat=(color,metalness=.45,roughness=.38)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const cyl=(r1,r2,h,y,m,seg=32)=>{const x=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),m);x.position.y=y;return x};
const ring=(r,t,y,m)=>{const x=new THREE.Mesh(new THREE.TorusGeometry(r,t,10,40),m);x.rotation.x=Math.PI/2;x.position.y=y;return x};
const lathe=(p,m,seg=40)=>new THREE.Mesh(new THREE.LatheGeometry(p.map(([r,y])=>new THREE.Vector2(r,y)),seg),m);
function noseProfile(r=.48,h=.95){const p=[];for(let i=0;i<=24;i++){const t=i/24;p.push([r*Math.pow(1-t,.85),.38+h*t])}return p}
function bellProfile(){const p=[];for(let i=0;i<=18;i++){const t=i/18;p.push([.12+.12*Math.pow(1-t,.5),-.28+.38*t])}return p}
let finGeo;
function fins(){if(finGeo)return finGeo;const s=new THREE.Shape();s.moveTo(.38,.68);s.lineTo(1,.34);s.lineTo(1,.02);s.lineTo(.38,0);s.closePath();finGeo=new THREE.ExtrudeGeometry(s,{depth:.06,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:2});finGeo.translate(0,0,-.03);return finGeo}

/** Real procedural 3D model used by both the rocket and the drag-preview ghost. */
export function makePart(p){
  const g=new THREE.Group();
  if(p.type==='capsule'){
    g.add(lathe([[0,0],[.46,0],[.49,.08],[.49,.32],[.43,.38],[.28,.75],[.2,.86],[0,.9]],mat(p.color,.35,.4)));
    g.add(ring(.49,.022,.03,mat(0x81909d,.7,.3)));g.add(ring(.49,.018,.32,mat(0x27333e,.7,.35)));
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const w=new THREE.Mesh(new THREE.CircleGeometry(.075,20),mat(0x54bfff,.5,.12));w.position.set(Math.sin(a)*.43,.56,Math.cos(a)*.43);w.rotation.y=a;g.add(w)}
  } else if(p.type==='nose'){
    const m=mat(p.color,.4,.4);g.add(lathe([[0,0],[.48,0],[.48,.38]],m));g.add(lathe(noseProfile(),m));g.add(ring(.485,.022,.38,mat(0x35424e,.7,.3)));g.add(cyl(.012,.02,.24,1.48,mat(0x252c33,.8,.3),12));
  } else if(p.type==='tank'){
    const m=mat(p.color,.4,.48),r=.52;g.add(lathe([[0,0],[.45,.03],[r,.12],[r,1.32],[.45,1.42],[0,1.45]],m));
    for(const y of [.18,.72,1.28])g.add(ring(r+.01,.024,y,mat(0x35424e,.7,.4)));
    const band=mat(0x202a34,.6,.45);g.add(cyl(r+.015,r+.015,.07,.05,band));g.add(cyl(r+.015,r+.015,.07,1.4,band));
    const label=mat(0x26333f,.25,.55);label.color.setHex(0x53616d);const plate=new THREE.Mesh(new THREE.BoxGeometry(.72,.24,.012),label);plate.position.set(0,.9,.515);g.add(plate);
  } else if(p.type==='engine'){
    g.add(cyl(.5,.5,.08,.66,mat(0x303943,.8,.35)));g.add(lathe([[.5,.62],[.4,.55],[.3,.3]],mat(p.color,.7,.4)));g.add(ring(.32,.03,.5,mat(0xb4883d,.8,.3)));g.add(cyl(.2,.2,.25,.44,mat(0x8e9aa5,.75,.32)));g.add(lathe(bellProfile(),mat(0x30363d,.85,.35)));g.add(ring(.24,.02,-.28,mat(0xb4883d,.7,.34)));
    for(const s of [-1,1]){const pump=cyl(.075,.075,.22,.46,mat(0x77828c,.8,.3),16);pump.position.x=s*.32;g.add(pump)}
  } else if(p.type==='booster'){
    const r=.3,m=mat(p.color,.4,.45);g.add(lathe([[0,.08],[r,.08],[r,1]],m,36));g.add(lathe(noseProfile(r,.42).map(([x,y])=>[x,y+.62]),m,36));g.add(lathe(bellProfile(),mat(0x30363d,.85,.35),28));g.add(ring(.24,.02,-.28,mat(0xb4883d,.7,.34)));for(const y of [.35,.7])g.add(ring(r+.006,.016,y,mat(0x333c45,.7,.4),36));
  } else if(p.type==='separator'){
    g.add(cyl(.56,.56,.18,.09,mat(0xe0a24b,.7,.4),48));g.add(ring(.565,.02,.09,mat(0x70451f,.7,.4)));g.add(ring(.56,.018,.02,mat(0x20242a,.8,.4)));g.add(ring(.56,.018,.16,mat(0x20242a,.8,.4)));
  } else if(p.type==='fins'){
    for(let i=0;i<4;i++){const q=new THREE.Group();q.rotation.y=-i*Math.PI/2;q.add(new THREE.Mesh(fins(),mat(p.color,.6,.42)));g.add(q)}
  }
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return g;
}

export function arrangeRocket(group,parts,scale=1){
  while(group.children.length)group.remove(group.children[0]);
  const order={engine:0,separator:1,tank:2,capsule:3,nose:4};
  const core=parts.map((id,index)=>({id,index})).filter(x=>!['booster','fins'].includes(PARTS[x.id].type)).sort((a,b)=>(order[PARTS[a.id].type]??2)-(order[PARTS[b.id].type]??2)||a.index-b.index);
  let height=0;
  for(const {id} of core){const q=makePart(PARTS[id]);q.scale.setScalar(scale);q.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(q);const h=b.max.y-b.min.y;q.position.y=height-b.min.y;group.add(q);height+=h}
  const boosters=parts.filter(id=>PARTS[id].type==='booster');
  boosters.forEach((id,i)=>{const q=makePart(PARTS[id]);q.scale.setScalar(scale);q.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(q);const a=i/Math.max(1,boosters.length)*Math.PI*2+Math.PI/4;q.rotation.y=-a;q.position.set(Math.cos(a)*.9*scale,-b.min.y,Math.sin(a)*.9*scale);group.add(q)});
  parts.filter(id=>PARTS[id].type==='fins').forEach(()=>{const q=makePart(PARTS.fins);q.scale.setScalar(scale);q.position.y=.2*scale;group.add(q)});
  return height;
}
