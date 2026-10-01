import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PARTS={
 capsule:{name:'Command Capsule',desc:'Crew module',icon:'◉',mass:1.8,fuel:0,thrust:0,color:0xdce5ee,type:'capsule'},
 nose:{name:'Nose Cone',desc:'Aerodynamic tip',icon:'△',mass:.35,fuel:0,thrust:0,color:0xb8c4d0,type:'nose'},
 tank:{name:'Fuel Tank',desc:'Liquid fuel',icon:'▥',mass:1.2,fuel:900,thrust:0,color:0xb6bec7,type:'tank'},
 engine:{name:'Lunar Engine',desc:'High thrust',icon:'🔥',mass:1.1,fuel:0,thrust:120,color:0x697887,type:'engine'},
 booster:{name:'Solid Booster',desc:'Auxiliary thrust',icon:'◆',mass:1.5,fuel:650,thrust:80,color:0x8f979e,type:'booster'},
 fins:{name:'Stabilizer Fins',desc:'Flight control',icon:'◢',mass:.25,fuel:0,thrust:0,color:0x465463,type:'fins'},
 separator:{name:'Decoupler',desc:'Stage separator',icon:'⊙',mass:.18,fuel:0,thrust:0,color:0xd08b38,type:'separator'}
};
let rocketParts=[];
let buildScene,buildCamera,buildRenderer,buildControls,rocketGroup;
let flightScene,flightCamera,flightRenderer,flightRocket,moon;
let flightRunning=false,flightT=0,flightY=0,flightV=0,flightFuel=0,stage=1,lastTime=0;
const G=1.62;

const $=s=>document.querySelector(s);
const partsList=$('#partsList');
for(const [id,p] of Object.entries(PARTS)){
  const el=document.createElement('button');el.className='part';el.dataset.part=id;
  el.innerHTML=`<span class="part-icon">${p.icon}</span><span><b>${p.name}</b><small>${p.desc}</small></span><em>+ ADD</em>`;
  el.onclick=()=>addPart(id);partsList.appendChild(el);
}

function addPart(id){
  rocketParts.push(id); renderRocket(); updateStats();
}
function clearRocket(){rocketParts=[];renderRocket();updateStats()}
$('#clearBtn').onclick=clearRocket;

function initBuild(){
  const host=$('#builderViewport');buildScene=new THREE.Scene();
  buildScene.background=new THREE.Color(0x080d15);
  buildCamera=new THREE.PerspectiveCamera(42,host.clientWidth/host.clientHeight,.1,1000);buildCamera.position.set(5,4.2,8);
  buildRenderer=new THREE.WebGLRenderer({antialias:true});buildRenderer.setPixelRatio(Math.min(devicePixelRatio,2));buildRenderer.setSize(host.clientWidth,host.clientHeight);buildRenderer.shadowMap.enabled=true;host.appendChild(buildRenderer.domElement);
  buildControls=new OrbitControls(buildCamera,buildRenderer.domElement);buildControls.enableDamping=true;buildControls.target.set(0,2,0);buildControls.minDistance=3;buildControls.maxDistance=14;
  const hemi=new THREE.HemisphereLight(0x9ecbff,0x202938,2.2);buildScene.add(hemi);const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(5,8,5);key.castShadow=true;buildScene.add(key);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(4.8,4.8,.35,64),new THREE.MeshStandardMaterial({color:0x30363d,roughness:1}));floor.position.y=-.3;floor.receiveShadow=true;buildScene.add(floor);
  rocketGroup=new THREE.Group();buildScene.add(rocketGroup);renderRocket();
  window.addEventListener('resize',resize);
}
function mat(c,metal=.45,rough=.38){return new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough})}
function renderRocket(){
 if(!rocketGroup)return;while(rocketGroup.children.length)rocketGroup.remove(rocketGroup.children[0]);
 let y=0;
 [...rocketParts].reverse().forEach((id)=>{const p=PARTS[id];const g=makePart(p);g.position.y=y;rocketGroup.add(g);y+=partHeight(p.type)});
 rocketGroup.position.y=Math.max(.25,2.1-y/2);
}
function partHeight(type){return {capsule:1.05,nose:.8,tank:1.55,engine:.75,booster:1.25,fins:.55,separator:.22}[type]||1}
function makePart(p){
 const g=new THREE.Group(),m=mat(p.color);let mesh;
 if(p.type==='nose'||p.type==='capsule'){mesh=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,p.type==='nose'?.65:.75,32),m);mesh.position.y=(p.type==='nose'?.32:.38);g.add(mesh);if(p.type==='nose'){const cone=new THREE.Mesh(new THREE.ConeGeometry(.48,.58,32),m);cone.position.y=.9;g.add(cone)}}
 else if(p.type==='tank'){mesh=new THREE.Mesh(new THREE.CylinderGeometry(.52,.52,1.45,32),m);mesh.position.y=.72;g.add(mesh);const band=new THREE.Mesh(new THREE.TorusGeometry(.53,.035,8,32),mat(0x303943, .7));band.position.y=.18;g.add(band)}
 else if(p.type==='engine'||p.type==='booster'){mesh=new THREE.Mesh(new THREE.CylinderGeometry(.44,.58,.7,32),m);mesh.position.y=.35;g.add(mesh);const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.24,.39,.32,24),mat(0x30363d,.8));nozzle.position.y=-.15;g.add(nozzle)}
 else if(p.type==='separator'){mesh=new THREE.Mesh(new THREE.CylinderGeometry(.56,.56,.18,32),mat(0xe4a34e,.7));mesh.position.y=.09;g.add(mesh)}
 else if(p.type==='fins'){mesh=new THREE.Mesh(new THREE.BoxGeometry(1.45,.65,.12),m);mesh.position.y=.28;g.add(mesh);}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return g;
}
function updateStats(){
 let mass=0,fuel=0,thrust=0;rocketParts.forEach(id=>{const p=PARTS[id];mass+=p.mass;fuel+=p.fuel;thrust+=p.thrust});
 $('#massStat').textContent=mass.toFixed(1)+' t';$('#fuelStat').textContent=Math.round(fuel)+' kg';$('#thrustStat').textContent=Math.round(thrust)+' kN';$('#twrStat').textContent=(mass?thrust/(mass*G):0).toFixed(2);
 $('#buildStatus').textContent=rocketParts.length?'ASSEMBLED':'READY';
}

function makeMoon(){
 const geo=new THREE.SphereGeometry(10,96,64);const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i);const n=Math.sin(v.x*1.9+v.z*.7)*.16+Math.sin(v.x*4.8-v.z*2.2)*.07+Math.sin(v.y*8+v.x)*.035;v.multiplyScalar(1+n);pos.setXYZ(i,v.x,v.y,v.z)}geo.computeVertexNormals();
 const matMoon=new THREE.MeshStandardMaterial({color:0x8b8f91,roughness:1,metalness:0});moon=new THREE.Mesh(geo,matMoon);moon.position.y=-11;moon.receiveShadow=true;flightScene.add(moon);
 const craters=new THREE.Group();for(let i=0;i<45;i++){const a=Math.random()*Math.PI*2,r=3+Math.random()*6;const x=Math.cos(a)*r,z=Math.sin(a)*r;const c=new THREE.Mesh(new THREE.RingGeometry(.08+Math.random()*.22,.15+Math.random()*.3,16),new THREE.MeshBasicMaterial({color:0x5f6264,side:THREE.DoubleSide,transparent:true,opacity:.5}));c.rotation.x=-Math.PI/2;c.position.set(x,-.82,z);craters.add(c)}flightScene.add(craters);
}
function initFlight(){
 const host=$('#flightViewport');flightScene=new THREE.Scene();flightScene.background=new THREE.Color(0x010205);
 flightCamera=new THREE.PerspectiveCamera(48,host.clientWidth/host.clientHeight,.1,500);flightCamera.position.set(6,5,10);
 flightRenderer=new THREE.WebGLRenderer({antialias:true});flightRenderer.setPixelRatio(Math.min(devicePixelRatio,2));flightRenderer.setSize(host.clientWidth,host.clientHeight);flightRenderer.shadowMap.enabled=true;host.appendChild(flightRenderer.domElement);
 flightScene.add(new THREE.AmbientLight(0x526079,1.1));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-8,15,8);sun.castShadow=true;flightScene.add(sun);makeMoon();
}
function buildFlightRocket(){
 flightRocket=new THREE.Group();const scale=.78;let y=0;
 [...rocketParts].reverse().forEach(id=>{const p=PARTS[id],g=makePart(p);g.scale.setScalar(scale);g.position.y=y;flightRocket.add(g);y+=partHeight(p.type)*scale});
 flightRocket.position.set(0,0,0);flightScene.add(flightRocket);
 return y;
}
function startLaunch(){
 if(!rocketParts.length){$('#flightMessage').textContent='BUILD A ROCKET FIRST';return}
 if(!flightRenderer)initFlight();
 document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('#launchScreen').classList.add('active');
 if(flightRocket)flightScene.remove(flightRocket);buildFlightRocket();
 let totalFuel=0;rocketParts.forEach(id=>totalFuel+=PARTS[id].fuel);flightFuel=totalFuel;flightY=0;flightV=0;flightT=0;stage=1;flightRunning=true;lastTime=performance.now();$('#stageNumber').textContent='01';$('#flightMessage').textContent='IGNITION — 3… 2… 1…';setTimeout(()=>$('#flightMessage').textContent='',1500);requestAnimationFrame(flightLoop);
}
function flightLoop(now){
 if(!flightRunning)return;const dt=Math.min((now-lastTime)/1000,.035);lastTime=now;flightT+=dt;
 const throttle=Number($('#throttle').value)/100;let thrust=0;rocketParts.forEach(id=>{const p=PARTS[id];if((p.type==='engine'||p.type==='booster')&&flightFuel>0)thrust+=p.thrust});
 const mass=Math.max(.5,rocketParts.reduce((s,id)=>s+PARTS[id].mass,0)+flightFuel/1000);const burn=thrust*.018*throttle*dt;flightFuel=Math.max(0,flightFuel-burn);
 const accel=(thrust*throttle/mass)-G;flightV+=accel*dt;flightY+=flightV*dt;
 if(flightY<0){flightY=0;flightV=0;if(flightT>1){flightRunning=false;$('#flightMessage').textContent='LANDING / TOUCHDOWN';}}
 if(flightY>500){flightRunning=false;$('#flightMessage').textContent='MISSION COMPLETE — LUNAR ASCENT';}
 if(flightRocket){flightRocket.position.y=flightY*.32+1;flightRocket.rotation.z=Math.sin(flightT*.7)*.025;flightCamera.position.lerp(new THREE.Vector3(6,flightRocket.position.y+4,10),.035);flightCamera.lookAt(0,flightRocket.position.y+1,0)}
 $('#altitude').textContent=Math.round(flightY)+' m';$('#velocity').textContent=Math.round(flightV)+' m/s';$('#flightFuel').textContent=Math.round(flightFuel)+' kg';$('#missionTime').textContent='T+ '+fmtTime(flightT);requestAnimationFrame(flightLoop);flightRenderer.render(flightScene,flightCamera);
}
function fmtTime(t){const m=Math.floor(t/60).toString().padStart(2,'0'),s=Math.floor(t%60).toString().padStart(2,'0');return `${m}:${s}`}
$('#launchBtn').onclick=startLaunch;
$('#abortBtn').onclick=()=>{flightRunning=false;showBuild()};
$('#stageBtn').onclick=()=>{stage++;$('#stageNumber').textContent=String(stage).padStart(2,'0');$('#flightMessage').textContent='STAGE '+stage+' — SEPARATION';setTimeout(()=>$('#flightMessage').textContent='',900)};
$('#throttle').oninput=e=>$('#throttleValue').textContent=e.target.value+'%';

document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>b.dataset.screen==='build'?showBuild():startLaunch());
function showBuild(){flightRunning=false;document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('#buildScreen').classList.add('active')}
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'){rocketParts=[];renderRocket();updateStats()}if(e.code==='Space'&&$('#launchScreen').classList.contains('active'))$('#stageBtn').click()});
function resize(){if(buildRenderer){const h=$('#builderViewport');buildCamera.aspect=h.clientWidth/h.clientHeight;buildCamera.updateProjectionMatrix();buildRenderer.setSize(h.clientWidth,h.clientHeight)}if(flightRenderer){const h=$('#flightViewport');flightCamera.aspect=h.clientWidth/h.clientHeight;flightCamera.updateProjectionMatrix();flightRenderer.setSize(h.clientWidth,h.clientHeight)}}
function buildLoop(){requestAnimationFrame(buildLoop);buildControls?.update();buildRenderer?.render(buildScene,buildCamera)}
initBuild();updateStats();buildLoop();