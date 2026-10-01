import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PARTS, arrangeRocket } from './rocket-parts.js';
import { FLIGHT_CONFIG } from './flight-config.js';

// Main app sections: shared state, builder, flight scene, simulation, and controls.
let rocketParts=[];
let buildScene,buildCamera,buildRenderer,buildControls,rocketGroup;
let flightScene,flightCamera,flightRenderer,flightRocket,moon,flightStars,engineFlame,boosterFlames=[];
let flightRunning=false,flightT=0,flightY=0,flightV=0,flightFuel=0,coreFuel=0,boosterFuel=0,stage=1,lastTime=0;
let flightParts=[],countdown=3,flightState='ready';
const { gravity:G, moonRadius:MOON_RADIUS, viewScale:FLIGHT_SCALE, engineIsp:ENGINE_ISP, boosterIsp:BOOSTER_ISP } = FLIGHT_CONFIG;
const flightPosition=new THREE.Vector3(),flightVelocity=new THREE.Vector3(),flightGravityCenter=new THREE.Vector3(0,-MOON_RADIUS,0);
const flightKeys=new Set();
let cameraMode=0;
const cameraModes=['CHASE','CLOSE','ORBIT'];

// ── Builder UI: render the parts catalog and connect builder buttons ──
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

// ── Builder scene: lights, floor, camera, and resize handling ──
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
// ── Builder: render the current rocket and update vehicle statistics ──
function renderRocket(){
 if(!rocketGroup)return;
 const height=arrangeRocket(rocketGroup,rocketParts);
 rocketGroup.position.y=Math.max(.25,2.1-height/2);
}
function updateStats(){
 let mass=0,fuel=0,thrust=0;rocketParts.forEach(id=>{const p=PARTS[id];mass+=p.mass;fuel+=p.fuel;thrust+=p.thrust});
 $('#massStat').textContent=mass.toFixed(1)+' t';$('#fuelStat').textContent=Math.round(fuel)+' kg';$('#thrustStat').textContent=Math.round(thrust)+' kN';$('#twrStat').textContent=(mass?thrust/(mass*G):0).toFixed(2);
 $('#buildStatus').textContent=rocketParts.length?'ASSEMBLED':'READY';
}

// ── Flight environment: Moon surface, craters, stars, and launch pad ──
function makeMoon(){
 const geo=new THREE.SphereGeometry(10,96,64);const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i);const n=Math.sin(v.x*1.9+v.z*.7)*.16+Math.sin(v.x*4.8-v.z*2.2)*.07+Math.sin(v.y*8+v.x)*.035;v.multiplyScalar(1+n);pos.setXYZ(i,v.x,v.y,v.z)}geo.computeVertexNormals();
 const matMoon=new THREE.MeshStandardMaterial({color:0x8b8f91,roughness:1,metalness:0});moon=new THREE.Mesh(geo,matMoon);moon.position.y=-11;moon.receiveShadow=true;flightScene.add(moon);
 const craters=new THREE.Group();
 for(let i=0;i<45;i++){
  const a=Math.random()*Math.PI*2,r=3+Math.random()*6,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const y=-11+Math.sqrt(100-r*r),normal=new THREE.Vector3(x,y+11,z).normalize();
  const c=new THREE.Mesh(new THREE.RingGeometry(.08+Math.random()*.22,.15+Math.random()*.3,16),new THREE.MeshBasicMaterial({color:0x5f6264,side:THREE.DoubleSide,transparent:true,opacity:.5}));
  c.position.set(x,y+.015,z);c.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);craters.add(c);
 }
 flightScene.add(craters);
}
function makeStarfield(){
 const positions=new Float32Array(1800*3);
 for(let i=0;i<1800;i++){
  const radius=400+Math.random()*500,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);
  positions[i*3]=radius*Math.sin(phi)*Math.cos(theta);positions[i*3+1]=radius*Math.cos(phi);positions[i*3+2]=radius*Math.sin(phi)*Math.sin(theta);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 flightStars=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xc8ddff,size:.32,sizeAttenuation:true}));flightScene.add(flightStars);
}
function initFlight(){
 const host=$('#flightViewport');flightScene=new THREE.Scene();flightScene.background=new THREE.Color(0x010205);
 flightCamera=new THREE.PerspectiveCamera(48,host.clientWidth/host.clientHeight,.1,2000);flightCamera.position.set(6,5,10);
 flightRenderer=new THREE.WebGLRenderer({antialias:true});flightRenderer.setPixelRatio(Math.min(devicePixelRatio,2));flightRenderer.setSize(host.clientWidth,host.clientHeight);flightRenderer.shadowMap.enabled=true;host.appendChild(flightRenderer.domElement);
 flightScene.add(new THREE.AmbientLight(0x526079,1.1));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-8,15,8);sun.castShadow=true;flightScene.add(sun);
 makeStarfield();makeMoon();
 const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.9,.22,48),new THREE.MeshStandardMaterial({color:0x343c46,metalness:.65,roughness:.55}));pad.position.y=-.96;pad.receiveShadow=true;flightScene.add(pad);
 const padLight=new THREE.PointLight(0x45b8ff,7,8);padLight.position.set(0,-.2,2.3);flightScene.add(padLight);
}
function addFlightFlames(){
 engineFlame=new THREE.Mesh(new THREE.ConeGeometry(.3,1,24),new THREE.MeshBasicMaterial({color:0xff8b32,transparent:true,opacity:.88}));
 engineFlame.position.y=-.82;engineFlame.visible=false;flightRocket.add(engineFlame);
 boosterFlames=[];
 const boosterCount=flightParts.filter(id=>PARTS[id].type==='booster').length;
 for(let i=0;i<boosterCount;i++){
  const angle=i/Math.max(1,boosterCount)*Math.PI*2,flame=new THREE.Mesh(new THREE.ConeGeometry(.16,.75,16),new THREE.MeshBasicMaterial({color:0xffad45,transparent:true,opacity:.85}));
  flame.position.set(Math.cos(angle)*.53,-.7,Math.sin(angle)*.53);flame.visible=false;flightRocket.add(flame);boosterFlames.push(flame);
 }
}
function buildFlightRocket(){
 flightRocket=new THREE.Group();
 arrangeRocket(flightRocket,flightParts,.78);addFlightFlames();
 flightRocket.position.set(0,-.85,0);flightScene.add(flightRocket);
}
// ── Flight setup: validate the craft, initialize fuel, and start countdown ──
function startLaunch(){
 if(!rocketParts.length){$('#buildStatus').textContent='ADD PARTS FIRST';return}
 const hasPoweredEngine=rocketParts.some(id=>['engine','booster'].includes(PARTS[id].type));
 const availableFuel=rocketParts.reduce((sum,id)=>sum+PARTS[id].fuel,0);
 if(!hasPoweredEngine||availableFuel===0){$('#buildStatus').textContent='ADD ENGINE AND FUEL';return}
 document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('#launchScreen').classList.add('active');
 document.querySelectorAll('.nav-btn').forEach(button=>button.classList.toggle('active',button.dataset.screen==='launch'));
 if(!flightRenderer)initFlight();
 if(flightRocket)flightScene.remove(flightRocket);
 flightParts=rocketParts.slice();buildFlightRocket();
 coreFuel=flightParts.filter(id=>PARTS[id].type==='tank').length*PARTS.tank.fuel;
 boosterFuel=flightParts.filter(id=>PARTS[id].type==='booster').length*PARTS.booster.fuel;
 flightFuel=coreFuel+boosterFuel;
   flightPosition.set(0,0,0);flightVelocity.set(0,0,0);flightRocket.quaternion.identity();
 flightY=0;flightV=0;flightT=0;countdown=3;stage=1;flightState='countdown';flightRunning=true;lastTime=performance.now();flightKeys.clear();cameraMode=0;
 flightRocket.position.set(0,-.85,0);flightCamera.position.set(0,3,15);flightCamera.lookAt(0,2,0);
 $('#cameraBtn').textContent='CAM: '+cameraModes[cameraMode];
 $('#stageNumber').textContent='01';$('#throttle').value=100;$('#throttleValue').textContent='100%';
 $('#flightMessage').textContent='IGNITION — 3…';
 $('#altitude').textContent='0 m';$('#velocity').textContent='0 m/s';$('#flightFuel').textContent=Math.round(flightFuel)+' kg';$('#missionTime').textContent='T+ 00:00';
 requestAnimationFrame(flightLoop);
}
// ── Flight simulation: input, thrust, gravity, mission state, and camera follow ──
function flightLoop(now){
 if(!flightRunning)return;
 const dt=Math.min(Math.max((now-lastTime)/1000,0),.05);lastTime=now;
 if(countdown>0){
  countdown=Math.max(0,countdown-dt);
  $('#flightMessage').textContent=`IGNITION — ${Math.ceil(countdown)}…`;
  if(countdown===0){flightState='ascent';$('#flightMessage').textContent='LIFTOFF';}
 }else{
  flightT+=dt;
  const turnRate=.75;
  const steer=(positive,negative)=>Number(flightKeys.has(positive))-Number(flightKeys.has(negative));
  const pitch=steer('KeyW','KeyS'),yaw=steer('KeyD','KeyA'),roll=steer('KeyE','KeyQ');
  if(pitch||yaw||roll){
   const turn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pitch*turnRate*dt);
   turn.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),yaw*turnRate*dt));
   turn.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),roll*turnRate*dt));
   flightRocket.quaternion.multiply(turn).normalize();
  }
  const throttle=Number($('#throttle').value)/100;
  const engineCount=flightParts.filter(id=>PARTS[id].type==='engine').length;
  const boosterCount=flightParts.filter(id=>PARTS[id].type==='booster').length;
  const coreMax=engineCount*PARTS.engine.thrust*throttle;
  const boosterMax=boosterCount*PARTS.booster.thrust*throttle;
  const coreFlow=1000/(ENGINE_ISP*9.81),boosterFlow=1000/(BOOSTER_ISP*9.81);
  const coreThrust=coreMax&&coreFuel>0?Math.min(coreMax,coreFuel/(coreFlow*dt)):0;
  const boosterThrust=boosterMax&&boosterFuel>0?Math.min(boosterMax,boosterFuel/(boosterFlow*dt)):0;
  const thrust=coreThrust+boosterThrust;
  const coreBurn=Math.min(coreFuel,coreThrust*coreFlow*dt);
  const boosterBurn=Math.min(boosterFuel,boosterThrust*boosterFlow*dt);
  coreFuel-=coreBurn;boosterFuel-=boosterBurn;flightFuel=coreFuel+boosterFuel;
  if(engineFlame){engineFlame.visible=coreThrust>0;engineFlame.scale.y=.65+throttle*.7;}
  boosterFlames.forEach(flame=>{flame.visible=boosterThrust>0;flame.scale.y=.65+throttle*.7;});
  const dryMass=flightParts.reduce((sum,id)=>sum+PARTS[id].mass,0);
  const mass=Math.max(.1,dryMass+flightFuel/1000);
  const radiusVector=flightPosition.clone().sub(flightGravityCenter);
  const radius=Math.max(1,radiusVector.length());
  const gravity=radiusVector.normalize().multiplyScalar(-G*MOON_RADIUS*MOON_RADIUS/(radius*radius));
  const thrustDirection=new THREE.Vector3(0,1,0).applyQuaternion(flightRocket.quaternion);
  flightVelocity.addScaledVector(gravity,dt).addScaledVector(thrustDirection,thrust/mass*dt);
  flightPosition.addScaledVector(flightVelocity,dt);
  const radial=flightPosition.clone().sub(flightGravityCenter);
  const currentRadius=radial.length();flightY=Math.max(0,currentRadius-MOON_RADIUS);flightV=flightVelocity.length();
  const radialDirection=radial.normalize();
  const radialSpeed=flightVelocity.dot(radialDirection);
  const tangentialSpeed=Math.sqrt(Math.max(0,flightV*flightV-radialSpeed*radialSpeed));
  if(currentRadius<=MOON_RADIUS){
   flightPosition.copy(radialDirection.multiplyScalar(MOON_RADIUS).add(flightGravityCenter));
   flightY=0;flightRunning=false;
   if(flightV<12){flightVelocity.set(0,0,0);flightV=0;flightState='landed';$('#flightMessage').textContent='SOFT LANDING — MISSION COMPLETE';}
   else{flightState='crashed';$('#flightMessage').textContent='HARD IMPACT — VEHICLE LOST';}
  }else if(flightY>=10000&&tangentialSpeed>=5&&Math.abs(radialSpeed)<20){
   flightRunning=false;flightState='orbit';$('#flightMessage').textContent='STABLE LUNAR ORBIT — MISSION COMPLETE';
  }else if(throttle===0){
   $('#flightMessage').textContent='ENGINE CUTOFF — COASTING';
  }else if(thrust===0){
   $('#flightMessage').textContent=flightFuel===0?'FUEL DEPLETED — COASTING':'NO ACTIVE ENGINE';
  }else if(flightT>.5){
   $('#flightMessage').textContent=radialSpeed>=0?'POWERED FLIGHT — STEER TO ORBIT':'DESCENT — INCREASE THRUST';
  }
 }
 if(!flightRunning){
  if(engineFlame)engineFlame.visible=false;
  boosterFlames.forEach(flame=>flame.visible=false);
 }
 if(flightRocket){
  flightRocket.position.set(flightPosition.x*FLIGHT_SCALE,-.85+flightPosition.y*FLIGHT_SCALE,flightPosition.z*FLIGHT_SCALE);
  const rocketUp=new THREE.Vector3(0,1,0).applyQuaternion(flightRocket.quaternion).normalize();
  let desiredCamera,desiredTarget;
  if(cameraMode===2){
   desiredCamera=flightRocket.position.clone().add(new THREE.Vector3(12,8,16));
   desiredTarget=flightRocket.position.clone().add(rocketUp.clone().multiplyScalar(2));
  }else{
   const distance=cameraMode===0?13:6;
   const height=cameraMode===0?3.5:1.8;
   const behind=new THREE.Vector3(0,0,1).applyQuaternion(flightRocket.quaternion).normalize();
   desiredCamera=flightRocket.position.clone().addScaledVector(behind,distance).addScaledVector(rocketUp,height);
   desiredTarget=flightRocket.position.clone().addScaledVector(rocketUp,2.5);
  }
  const followRate=cameraMode===1?12:8;
  const followBlend=1-Math.exp(-followRate*Math.max(dt,1/60));
  flightCamera.position.lerp(desiredCamera,followBlend);
  flightCamera.lookAt(desiredTarget);
  if(flightStars)flightStars.position.copy(flightCamera.position);
 }
 $('#altitude').textContent=Math.round(flightY)+' m';$('#velocity').textContent=Math.round(flightV)+' m/s';$('#flightFuel').textContent=Math.round(flightFuel)+' kg';$('#missionTime').textContent='T+ '+fmtTime(flightT);
 flightRenderer.render(flightScene,flightCamera);
 if(flightRunning)requestAnimationFrame(flightLoop);
}
function fmtTime(t){const m=Math.floor(t/60).toString().padStart(2,'0'),s=Math.floor(t%60).toString().padStart(2,'0');return `${m}:${s}`}
$('#launchBtn').onclick=startLaunch;
$('#abortBtn').onclick=()=>{flightRunning=false;showBuild()};
// ── Staging: remove spent boosters or a separated core engine ──
function separateStage(){
 if(!flightRunning||countdown>0)return;
 const boosters=flightParts.filter(id=>PARTS[id].type==='booster').length;
 if(boosters){
  flightParts=flightParts.filter(id=>PARTS[id].type!=='booster');
  boosterFuel=0;flightFuel=coreFuel;
  $('#flightMessage').textContent='BOOSTERS SEPARATED';
 }else if(flightParts.some(id=>PARTS[id].type==='separator')&&flightParts.some(id=>PARTS[id].type==='engine')){
  flightParts=flightParts.filter(id=>!['engine','separator'].includes(PARTS[id].type));
  $('#flightMessage').textContent='CORE ENGINE JETTISONED';
 }else{
  $('#flightMessage').textContent='NO STAGE AVAILABLE';return;
 }
 stage++;$('#stageNumber').textContent=String(stage).padStart(2,'0');
 if(flightRocket){arrangeRocket(flightRocket,flightParts,.78);addFlightFlames();flightRocket.position.set(flightPosition.x*FLIGHT_SCALE,-.85+flightPosition.y*FLIGHT_SCALE,flightPosition.z*FLIGHT_SCALE);}
}
$('#stageBtn').onclick=separateStage;
$('#cameraBtn').onclick=()=>{cameraMode=(cameraMode+1)%cameraModes.length;$('#cameraBtn').textContent='CAM: '+cameraModes[cameraMode]};
$('#throttle').oninput=e=>$('#throttleValue').textContent=e.target.value+'%';

// ── App controls: navigation, keyboard input, resize, and render loops ──
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>b.dataset.screen==='build'?showBuild():startLaunch());
function showBuild(){
 flightRunning=false;document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('#buildScreen').classList.add('active');
 document.querySelectorAll('.nav-btn').forEach(button=>button.classList.toggle('active',button.dataset.screen==='build'));
}
window.addEventListener('keydown',e=>{
 if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE'].includes(e.code)&&$('#launchScreen').classList.contains('active')){flightKeys.add(e.code);e.preventDefault()}
 if(e.key.toLowerCase()==='r'&&!$('#launchScreen').classList.contains('active')){rocketParts=[];renderRocket();updateStats()}
 if(e.code==='Space'&&$('#launchScreen').classList.contains('active')){e.preventDefault();$('#stageBtn').click()}
});
window.addEventListener('keyup',e=>flightKeys.delete(e.code));
window.addEventListener('blur',()=>flightKeys.clear());
function resize(){if(buildRenderer){const h=$('#builderViewport');buildCamera.aspect=h.clientWidth/h.clientHeight;buildCamera.updateProjectionMatrix();buildRenderer.setSize(h.clientWidth,h.clientHeight)}if(flightRenderer){const h=$('#flightViewport');flightCamera.aspect=h.clientWidth/h.clientHeight;flightCamera.updateProjectionMatrix();flightRenderer.setSize(h.clientWidth,h.clientHeight)}}
function buildLoop(){requestAnimationFrame(buildLoop);buildControls?.update();buildRenderer?.render(buildScene,buildCamera)}
initBuild();updateStats();buildLoop();
