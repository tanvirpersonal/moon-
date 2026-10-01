const STORAGE='moonflight-craft-v5';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const list=$('#partsList');
let craft=[], selected=-1, history=[], future=[], symmetry=false;
const paletteIds=()=>$$('#partsList .part').map(x=>x.dataset.part).filter(Boolean);
const isPalette=el=>el.classList.contains('palette-part')||el.dataset.index==='';
const toast=(text)=>{let t=$('#builderToast');if(!t){t=document.createElement('div');t.id='builderToast';document.body.append(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1500)};
function snapshot(){return [...craft]}
function remember(){const s=snapshot();if(!history.length||JSON.stringify(history.at(-1))!==JSON.stringify(s)){history.push(s);if(history.length>40)history.shift();future=[]}}
function rebuild(){
  if(!list)return;
  const palette=list.querySelectorAll('.palette-part');
  if(craft.length){
    const label=document.createElement('div');label.className='craft-order-label';label.textContent='ASSEMBLY ORDER · DRAG TO REORDER';list.appendChild(label);
    craft.forEach((id,i)=>{const source=[...palette].find(x=>x.dataset.part===id);if(!source)return;const el=source.cloneNode(true);el.classList.remove('palette-part');el.dataset.index=i;el.draggable=true;el.querySelector('em').textContent='SELECT';el.classList.toggle('selected',i===selected);el.onclick=()=>select(i);el.ondragstart=e=>{e.dataTransfer.setData('text/plain','move:'+i);e.dataTransfer.effectAllowed='move'};el.ondragover=e=>{e.preventDefault();el.classList.add('drop-target')};el.ondragleave=()=>el.classList.remove('drop-target');el.ondrop=e=>{e.preventDefault();el.classList.remove('drop-target');const d=e.dataTransfer.getData('text/plain');if(d.startsWith('move:'))move(+d.slice(5),i)};list.appendChild(el)})
  }
}
function select(i){selected=i;rebuild();const p=craft[i];const title=p?($(`[data-part="${CSS.escape(p)}"] b`)?.textContent||p):'NONE';if($('#selectedPart'))$('#selectedPart').textContent=title.toUpperCase();renderStageEditor();}
function add(id,index=craft.length){remember();craft.splice(index,0,id);selected=index;syncMain();rebuild();renderStageEditor();toast(`${id.toUpperCase()} ATTACHED`)}
function remove(i){if(i<0||i>=craft.length)return;remember();craft.splice(i,1);selected=Math.min(i,craft.length-1);syncMain();rebuild();renderStageEditor();toast('PART REMOVED')}
function move(from,to){if(from===to||from<0||to<0||from>=craft.length||to>=craft.length)return;remember();const [x]=craft.splice(from,1);craft.splice(to,0,x);selected=to;syncMain();rebuild();renderStageEditor();toast('ASSEMBLY ORDER UPDATED')}
function syncMain(){
  // main.js owns the actual rocket array; replay the craft through its public buttons.
  $('#clearBtn')?.click();
  for(const id of craft){const b=$(`#partsList .palette-part[data-part="${CSS.escape(id)}"]`);if(b)b.click()}
}
function initPalette(){
  if(!list)return;
  const originals=[...list.querySelectorAll('.part')];
  list.innerHTML='';
  originals.forEach((el)=>{el.classList.add('palette-part');el.draggable=true;el.ondragstart=e=>{e.dataTransfer.setData('text/plain','new:'+el.dataset.part);e.dataTransfer.effectAllowed='copy'};el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();const d=e.dataTransfer.getData('text/plain');if(d.startsWith('new:'))add(d.slice(4));else if(d.startsWith('move:'))move(+d.slice(5),craft.length-1)};el.onclick=()=>add(el.dataset.part);list.appendChild(el)});
  list.ondragover=e=>e.preventDefault();
  list.ondrop=e=>{e.preventDefault();const d=e.dataTransfer.getData('text/plain');if(d.startsWith('new:'))add(d.slice(4));else if(d.startsWith('move:'))move(+d.slice(5),craft.length-1)};
  rebuild();
}
function loadFromStorage(){try{const x=JSON.parse(localStorage.getItem(STORAGE));if(Array.isArray(x?.craft)){craft=x.craft;syncMain();rebuild();renderStageEditor();toast('CRAFT LOADED')}}catch{} }
function save(){localStorage.setItem(STORAGE,JSON.stringify({craft,systems:{symmetry,legs:$('#legsToggle')?.checked||false,rcs:$('#rcsToggle')?.checked||false}}));toast('CRAFT SAVED')}
function undo(){if(history.length<2)return;future.push(history.pop());craft=[...history.at(-1)];selected=Math.min(selected,craft.length-1);syncMain();rebuild();renderStageEditor();toast('UNDO')}
function redo(){if(!future.length)return;craft=[...future.pop()];history.push([...craft]);selected=Math.min(selected,craft.length-1);syncMain();rebuild();renderStageEditor();toast('REDO')}
function renderStageEditor(){
  let panel=$('#stageEditor');if(!panel){panel=document.createElement('div');panel.id='stageEditor';panel.className='stage-editor';$('.info-panel')?.append(panel)}
  const groups=[];craft.forEach((id,i)=>{let g;if(['booster'].includes(id))g=0;else if(['engine','separator'].includes(id))g=1;else g=2;(groups[g]??=[]).push(i)});
  const active=groups.filter(Boolean);panel.innerHTML=`<div class="stage-editor-title">STAGING <span>${active.length} AUTO STAGES</span></div>`;
  if(!craft.length){panel.innerHTML+='<small class="stage-empty">Build a vehicle to create staging groups.</small>'}else active.forEach((g,n)=>{const row=document.createElement('div');row.className='stage-row';row.innerHTML=`<div class="stage-row-head"><b>STAGE ${String(n+1).padStart(2,'0')}</b><span>${n===0?'BOOST / AUX':n===1?'POWER / SEPARATE':'FINAL VEHICLE'}</span></div>`;const chips=document.createElement('div');chips.className='stage-chips';g.forEach(i=>{const c=document.createElement('button');c.className='stage-chip';c.textContent=craft[i].toUpperCase();c.onclick=()=>select(i);chips.append(c)});row.append(chips);panel.append(row)});
  const systems=document.createElement('div');systems.className='utility-systems';systems.innerHTML='<div class="stage-editor-title">LANDING / CONTROL</div><label><input id="legsToggle" type="checkbox"> LANDING LEGS</label><label><input id="rcsToggle" type="checkbox"> RCS CONTROL</label><small>Systems are stored with the craft and reserved for the next flight-physics pass.</small>';panel.append(systems);
}
function injectStyle(){const s=document.createElement('style');s.textContent=`#builderToast{position:fixed;left:50%;bottom:85px;transform:translate(-50%,12px);opacity:0;z-index:1000;pointer-events:none;background:#07131f;color:#cceaff;border:1px solid #3a6587;border-radius:7px;padding:10px 15px;font:9px 'Space Mono';letter-spacing:1px;transition:.2s;box-shadow:0 10px 30px #0008}#builderToast.show{opacity:1;transform:translate(-50%,0)}.part.selected{border-color:#61b7ff!important;box-shadow:0 0 0 1px #61b7ff55,0 8px 24px #0008}.part.drop-target{border-color:#62e6a2!important;transform:translateX(5px)}.craft-order-label{font:8px 'Space Mono';color:#6d8298;letter-spacing:1px;padding:12px 2px 3px;border-top:1px solid #1c2a39;margin-top:5px}.stage-editor{margin-top:13px;border-top:1px solid #1b2938;padding-top:12px}.stage-editor-title{font:700 8px 'Space Mono';letter-spacing:1px;color:#7890a8;display:flex;justify-content:space-between;margin-bottom:7px}.stage-editor-title span,.stage-row-head span{color:#4f6d86;font-size:7px}.stage-row{border:1px solid #203245;background:#09131d;border-radius:6px;padding:7px;margin:5px 0}.stage-row-head{display:flex;justify-content:space-between;font:8px 'Space Mono';color:#9bc9ec}.stage-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.stage-chip{border:1px solid #294156;background:#101d29;color:#8eabc2;border-radius:4px;padding:4px 6px;font:7px 'Space Mono';cursor:pointer}.stage-chip:hover{border-color:#61b7ff;color:#fff}.utility-systems{margin-top:10px;border-top:1px solid #1b2938;padding-top:10px}.utility-systems label{display:block;padding:6px 0;color:#91a7bb;font:8px 'Space Mono'}.utility-systems input{accent-color:#61b7ff;margin-right:6px}.utility-systems small{display:block;color:#5f748a;font:7px/1.4 'Space Mono';margin-top:5px}`;document.head.append(s)}
// Filters remain available for the palette.
$$('.part-tab').forEach(t=>t.addEventListener('click',()=>{setTimeout(()=>{const f=t.dataset.filter;$$('#partsList .palette-part').forEach(b=>{const type=b.dataset.part==='engine'||b.dataset.part==='booster'||b.dataset.part==='tank';b.style.display=f==='all'||f==='propulsion'&&type||f==='structure'&&!type?'grid':'none'})},0)}));
$('#undoBtn')?.addEventListener('click',undo);$('#redoBtn')?.addEventListener('click',redo);$('#saveBtn')?.addEventListener('click',save);$('#loadBtn')?.addEventListener('click',loadFromStorage);$('#clearBtn')?.addEventListener('click',()=>{remember();craft=[];selected=-1;setTimeout(()=>{rebuild();renderStageEditor()},20)});$('#deletePartBtn')?.addEventListener('click',()=>remove(selected));$('#rotatePartBtn')?.addEventListener('click',()=>toast('ROTATION AXIS LOCKED TO ROCKET ATTACHMENT'));
$('#symmetryBtn')?.addEventListener('click',()=>{if(selected>=0){add(craft[selected]);add(craft[selected]);symmetry=true}else{add('booster');add('booster');symmetry=true}toast('SYMMETRY PAIR ADDED')});
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}else if((e.key==='Delete'||e.key==='Backspace')&&!$('#launchScreen')?.classList.contains('active')){e.preventDefault();remove(selected)}else if(e.code==='KeyS'&&(e.ctrlKey||e.metaKey)){e.preventDefault();save()}});
injectStyle();initPalette();setTimeout(()=>{if(!craft.length)craft=paletteIds().length?[]:craft;history.push([]);renderStageEditor()},250);
