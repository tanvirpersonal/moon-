import * as THREE from 'three';
import { PARTS, makePart } from './rocket-parts.js';

const viewport=document.querySelector('#builderViewport');
const list=document.querySelector('#partsList');
let renderer,scene,camera,ghost,ring,dragging=false,dragId='';

function toast(text){let t=document.querySelector('#builderToast');if(!t){t=document.createElement('div');t.id='builderToast';document.body.append(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1500)}
function init(){
 if(!viewport||renderer)return;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(3.2,2.5,5.6);camera.lookAt(0,.7,0);
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:8;pointer-events:none;display:none;filter:drop-shadow(0 0 18px rgba(61,182,255,.7))';viewport.append(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xbfe4ff,0x16202c,1.8));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(4,7,5);scene.add(key);scene.add(new THREE.PointLight(0x61b7ff,2.4,8));
 ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.012,8,48),new THREE.MeshBasicMaterial({color:0x61b7ff,transparent:true,opacity:.9}));ring.rotation.x=Math.PI/2;ring.visible=false;scene.add(ring);resize();requestAnimationFrame(loop);
}
function resize(){if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
function ghostPart(id){if(ghost)scene.remove(ghost);ghost=makePart(PARTS[id]);ghost.scale.setScalar(.72);ghost.traverse(o=>{if(!o.isMesh)return;const m=o.material?.clone?.();if(m){m.transparent=true;m.opacity=.45;m.depthWrite=false;if('emissive' in m){m.emissive=new THREE.Color(0x155f9a);m.emissiveIntensity=.7}o.material=m}});scene.add(ghost);ring.visible=true}
function move(e){if(!dragging||!ghost)return;const r=viewport.getBoundingClientRect(),nx=(e.clientX-r.left)/r.width,ny=(e.clientY-r.top)/r.height;ghost.position.set((nx-.5)*4.6,(.78-ny)*4.4,0);ghost.rotation.y=(nx-.5)*.7;ghost.rotation.z=(ny-.5)*-.18;ring.position.copy(ghost.position);ring.position.y-=.62}
function start(id,e){dragging=true;dragId=id;init();ghostPart(id);renderer.domElement.style.display='block';viewport.classList.add('drag-active');move(e)}
function stop(){dragging=false;dragId='';if(ghost){scene.remove(ghost);ghost=null}if(ring)ring.visible=false;if(renderer)renderer.domElement.style.display='none';viewport.classList.remove('drag-active','drop-ready')}
function loop(){requestAnimationFrame(loop);if(renderer&&dragging){if(ghost)ghost.rotation.y+=.004;renderer.render(scene,camera)}}
function bind(){
 if(!list||!viewport)return;init();
 list.querySelectorAll('.palette-part,.part:not(.craft-part)').forEach(el=>{
  const id=el.dataset.part;if(!id)return;el.draggable=true;
  el.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain','new:'+id);e.dataTransfer.effectAllowed='copy';start(id,e)});
  el.addEventListener('drag',move);el.addEventListener('dragend',stop);
 });
 viewport.addEventListener('dragover',e=>{e.preventDefault();move(e);viewport.classList.add('drop-ready')});
 viewport.addEventListener('drop',e=>{e.preventDefault();const d=e.dataTransfer.getData('text/plain');if(d.startsWith('new:')){const id=d.slice(4);stop();const source=list.querySelector(`.palette-part[data-part="${CSS.escape(id)}"]`);source?.click();toast(`${PARTS[id].name.toUpperCase()} · 3D MODEL ATTACHED`)}else stop()});
 window.addEventListener('resize',resize);
}
function css(){const s=document.createElement('style');s.textContent=`.viewport.drag-active:after{content:'DROP TO ATTACH';position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:9;padding:9px 14px;border:1px solid #61b7ff;background:#07131ee8;color:#9fd9ff;border-radius:6px;font:8px 'Space Mono';letter-spacing:1.5px;pointer-events:none}.viewport.drop-ready{box-shadow:inset 0 0 0 2px #62e6a2aa}.viewport.drop-ready:after{content:'ATTACH HERE';position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:10;padding:10px 16px;border:1px solid #62e6a2;background:#071a15ee;color:#8ff0bc;border-radius:6px;font:9px 'Space Mono';letter-spacing:1.5px;pointer-events:none}`;document.head.append(s)}
css();bind();
