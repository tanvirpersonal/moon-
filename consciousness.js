import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const host=document.querySelector('#scene');
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x02070d,.045);
const camera=new THREE.PerspectiveCamera(48,host.clientWidth/host.clientHeight,.1,100);
camera.position.set(0,1.2,15);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(host.clientWidth,host.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=7;controls.maxDistance=24;controls.target.set(0,0,0);

const defs=[
 {name:'PERCEPTION',sub:'WORLD INPUT',x:-5.2,n:12,c:0x4ddfff},
 {name:'FEATURES',sub:'PATTERNS',x:-2.8,n:16,c:0x58a9ff},
 {name:'MEMORY',sub:'PAST EXPERIENCE',x:-.5,n:18,c:0x9b73ff},
 {name:'REASONING',sub:'CONTEXT',x:1.8,n:20,c:0xe96cff},
 {name:'GOAL',sub:'INTENT',x:4.1,n:14,c:0xff78b7},
 {name:'ACTION',sub:'OUTPUT',x:6.1,n:10,c:0xffcf55}
];
const root=new THREE.Group();scene.add(root);const layers=[];const nodes=[];const links=[];const packets=[];
function node(pos,color,r=.085,li=0,ni=0){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,12),new THREE.MeshBasicMaterial({color}));m.position.copy(pos);m.userData={li,ni,color,base:r,activation:0};root.add(m);nodes.push(m);return m}
for(let li=0;li<defs.length;li++){
 const d=defs[li], arr=[];
 for(let i=0;i<d.n;i++){
  const y=(i/(d.n-1)-.5)*5.6;
  const z=Math.sin(i*1.65+li*.8)*1.35+(Math.random()-.5)*.45;
  arr.push(node(new THREE.Vector3(d.x+(Math.random()-.5)*.18,y,z),d.c,li===3?.1:.08,li,i));
 }
 layers.push(arr);
}
function connect(a,b,color){const g=new THREE.BufferGeometry().setFromPoints([a.position,b.position]);const m=new THREE.LineBasicMaterial({color,transparent:true,opacity:.13});const l=new THREE.Line(g,m);root.add(l);links.push({l,a,b});}
for(let li=0;li<layers.length-1;li++)for(const a of layers[li]){const candidates=[...layers[li+1]].sort(()=>Math.random()-.5).slice(0,4);for(const b of candidates)connect(a,b,defs[li+1].c)}

// subtle layer planes, inspired by educational 3D neural-network visualizers
for(const d of defs){const g=new THREE.PlaneGeometry(.015,6.6);const m=new THREE.MeshBasicMaterial({color:d.c,transparent:true,opacity:.025,side:THREE.DoubleSide});const p=new THREE.Mesh(g,m);p.position.x=d.x;p.rotation.y=Math.PI/2;root.add(p)}
const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,2),new THREE.MeshBasicMaterial({color:0x6beaff,wireframe:true,transparent:true,opacity:.12}));root.add(core);
for(let i=0;i<3;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(1.7+i*.38,.009,8,96),new THREE.MeshBasicMaterial({color:0x4ddfff,transparent:true,opacity:.25}));r.rotation.x=Math.PI/2;r.userData.speed=.0025+i*.001;root.add(r)}
const starsG=new THREE.BufferGeometry(),sp=[];for(let i=0;i<500;i++)sp.push((Math.random()-.5)*32,(Math.random()-.5)*18,(Math.random()-.5)*20-3);starsG.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));scene.add(new THREE.Points(starsG,new THREE.PointsMaterial({color:0x5bbcff,size:.016,transparent:true,opacity:.55})));

const light=new THREE.PointLight(0x39d9ff,8,14);light.position.set(0,0,4);scene.add(light);
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let selected=null;
renderer.domElement.addEventListener('pointerdown',e=>{const r=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(nodes)[0];if(hit){selected=hit.object;showSelection(selected)}});
function showSelection(n){document.querySelector('#activeLayer').textContent=defs[n.userData.li].name;document.querySelector('#activation').textContent=`${Math.round(45+n.userData.activation*55)}%`;document.querySelector('#signal').textContent=`Neuron ${n.userData.ni+1} in ${defs[n.userData.li].name} activated; downstream connections are being evaluated.`}

const processes=[
 ['OBSERVING','Scanning Moon environment for relevant signals…',0],
 ['ENCODING','Converting sensory input into feature activations…',1],
 ['RECALLING','Matching current state against stored experience…',2],
 ['REASONING','Combining context and active representations…',3],
 ['GOAL FORMING','Selecting the next objective from current state…',4],
 ['ACTING','Propagating a decision toward the action layer…',5],
 ['FEEDBACK','Comparing outcome with expected result…',3],
 ['LEARNING','Updating internal representations from feedback…',2]
];
let pi=0,paused=false,cycle=0;const processEl=document.querySelector('#process'),signalEl=document.querySelector('#signal'),meter=document.querySelector('#meter');
function activateLayer(li){nodes.forEach(n=>{n.userData.activation=0});for(let k=0;k<layers[li].length;k++)if(Math.random()<.68)layers[li][k].userData.activation=.5+Math.random()*.5;}
function setProcess(){const p=processes[pi];processEl.textContent=p[0];signalEl.textContent=p[1];document.querySelector('#activeLayer').textContent=defs[p[2]].name;activateLayer(p[2]);meter.style.width=`${45+Math.round(Math.random()*50)}%`;document.querySelector('#world').textContent=`${40+Math.round(Math.random()*45)}%`;document.querySelector('#memory').textContent=`${30+Math.round(Math.random()*55)}%`;document.querySelector('#self').textContent=`${25+Math.round(Math.random()*55)}%`;document.querySelector('#goal').textContent=`${20+Math.round(Math.random()*65)}%`;pi=(pi+1)%processes.length}
setProcess();setInterval(()=>{if(!paused)setProcess()},1100);

defs.forEach((d,i)=>{const card=document.createElement('div');card.className='layerCol';card.innerHTML=`<div class="layerName">${d.name}</div><div class="layerSub">${d.sub}</div><div class="miniNet"></div>`;const mh=card.querySelector('.miniNet');for(let k=0;k<Math.min(11,d.n);k++){const s=document.createElement('i');s.className='miniNode';s.style.left=`${18+Math.random()*64}%`;s.style.top=`${5+Math.random()*88}%`;mh.appendChild(s)}document.querySelector('#layerMap').appendChild(card)});
const stream=document.querySelector('#stream');function addEvent(text){const e=document.createElement('div');e.className='event';e.innerHTML=`<b>${new Date().toLocaleTimeString()}</b> · ${text}`;stream.prepend(e);while(stream.children.length>6)stream.lastChild.remove()}['Input received','Feature map updated','Memory representation recalled','Context integrated','Goal candidate generated','Action signal emitted'].forEach(addEvent);setInterval(()=>{if(!paused)addEvent(processes[pi][0].toLowerCase()+' stage active')},1500);

document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'RESUME':'PAUSE'};document.querySelector('#reset').onclick=()=>{pi=0;cycle=0;setProcess();stream.innerHTML='';addEvent('Neural activity reset')};

const clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);const t=clock.getElapsedTime();controls.update();root.rotation.y=Math.sin(t*.12)*.035;core.rotation.x=t*.16;core.rotation.y=-t*.22;root.children.forEach(o=>{if(o.userData.speed)o.rotation.z+=o.userData.speed});nodes.forEach((n,i)=>{const a=n.userData.activation||0;const pulse=1+Math.sin(t*5+n.userData.ni)*(.14+.28*a);n.scale.setScalar(pulse);n.material.color.setHex(a>.72?0xffffff:n.userData.color);});for(let i=0;i<3;i++)if(!paused&&Math.random()<.16){const li=cycle% (layers.length-1);const a=layers[li][Math.floor(Math.random()*layers[li].length)],b=layers[li+1][Math.floor(Math.random()*layers[li+1].length)];const q=new THREE.Mesh(new THREE.SphereGeometry(.11,8,8),new THREE.MeshBasicMaterial({color:defs[li+1].c}));root.add(q);packets.push({q,a,b,t:0});cycle++}packets.forEach((p,i)=>{p.t+=.018;p.q.position.lerpVectors(p.a.position,p.b.position,p.t);if(p.t>=1){root.remove(p.q);p.q.material.dispose();p.q.geometry.dispose();packets.splice(i,1)}});document.querySelector('#neurons').textContent=nodes.length.toLocaleString();light.intensity=7+Math.sin(t*3)*2;renderer.render(scene,camera)}animate();
function resize(){const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}addEventListener('resize',resize);
