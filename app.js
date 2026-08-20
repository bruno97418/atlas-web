const $=s=>document.querySelector(s);
let currentFile=null,currentBytes=null,atlasResult=null,view3d=true;
const state={apiBase:(localStorage.getItem('atlasApiBase')||'').replace(/\/$/,'')};

function setCloudState(){
  $('#cloudState').textContent=state.apiBase?'ATLAS Cloud configuré':'Cloud non configuré';
  $('#cloudDot').style.opacity=state.apiBase?'1':'.25';
}
setCloudState();

$('#cloudSettings').onclick=()=>{ $('#apiBaseInput').value=state.apiBase; $('#settingsDialog').showModal(); };
$('#saveApi').onclick=e=>{ e.preventDefault(); state.apiBase=$('#apiBaseInput').value.trim().replace(/\/$/,''); localStorage.setItem('atlasApiBase',state.apiBase); setCloudState(); $('#settingsDialog').close(); };

document.querySelectorAll('.nav[data-view]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.nav[data-view],.view').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); $('#view-'+b.dataset.view).classList.add('active'); if(b.dataset.view==='maps')renderMap();
});
$('#browseBtn').onclick=()=>$('#fileInput').click();
$('#fileInput').onchange=e=>loadFile(e.target.files[0]);
const dz=$('#dropZone');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));
dz.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
$('#analyzeBtn').onclick=analyze;
$('#toggle3d').onclick=()=>{view3d=!view3d;$('#toggle3d').textContent=view3d?'Vue 2D':'Vue 3D';renderMap()};
$('#mapSelect').onchange=renderMap;

async function loadFile(file){
  if(!file)return; currentFile=file; currentBytes=new Uint8Array(await file.arrayBuffer()); atlasResult=null;
  $('#workspace').classList.remove('hidden'); $('#fileName').textContent=file.name;
  $('#fileMeta').textContent=`${file.type||'binaire'} · ${new Date(file.lastModified).toLocaleString()}`;
  $('#metricSize').textContent=formatBytes(file.size); $('#metricHash').textContent='calcul…'; $('#metricEntropy').textContent='—'; $('#metricFill').textContent='—';
  $('#engineStatus').textContent='ATLAS Web · dump chargé'; $('#hexView').textContent=hexPreview(currentBytes); drawMemory(currentBytes);
  $('#detections').innerHTML=''; $('#detectBadge').textContent='en attente'; $('#reportView').textContent='Aucune analyse exécutée.'; $('#mapSelect').innerHTML=''; $('#mapDetails').textContent='Aucun résultat ATLAS V9.';
  const hash=await crypto.subtle.digest('SHA-256',currentBytes);
  $('#metricHash').textContent=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16)+'…';
}

async function analyze(){
  if(!currentFile)return;
  if(!state.apiBase){ $('#engineStatus').textContent='Configure ATLAS Cloud'; $('#settingsDialog').showModal(); return; }
  $('#analyzeBtn').disabled=true; $('#detectBadge').textContent='envoi'; $('#engineStatus').textContent='ATLAS V9 · envoi sécurisé…';
  try{
    const form=new FormData(); form.append('firmware',currentFile,currentFile.name);
    const submit=await fetch(state.apiBase+'/api/jobs',{method:'POST',body:form});
    const job=await submit.json(); if(!submit.ok)throw new Error(job.detail||job.error||`HTTP ${submit.status}`);
    $('#engineStatus').textContent='ATLAS V9 · analyse GitHub Actions…'; $('#detectBadge').textContent='en cours';
    const result=await pollJob(job.job_id,job.job_token);
    if(result.status!=='done')throw new Error(result.error||'Analyse ATLAS échouée');
    atlasResult=result.result; applyAtlasResult(atlasResult);
  }catch(e){
    $('#engineStatus').textContent='ATLAS V9 · erreur'; $('#detectBadge').textContent='erreur';
    $('#detections').innerHTML=`<div class="detection"><strong>Erreur</strong><span>${escapeHtml(String(e.message||e))}</span></div>`;
  }finally{$('#analyzeBtn').disabled=false;}
}

async function pollJob(id,jobToken){
  const started=Date.now();
  while(Date.now()-started<30*60*1000){
    await new Promise(r=>setTimeout(r,3000));
    const r=await fetch(`${state.apiBase}/api/jobs/${id}`,{headers:{'X-Job-Token':jobToken}});
    const j=await r.json(); if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
    if(j.status==='done'||j.status==='error')return j;
  }
  throw new Error('Délai ATLAS dépassé');
}

function applyAtlasResult(r){
  const arch=r.architecture||{}, fam=r.family||{};
  $('#metricEntropy').textContent=arch.architecture||'inconnue'; $('#metricFill').textContent=String(r.object_count??0);
  $('#engineStatus').textContent='ATLAS V9 · terminé'; $('#detectBadge').textContent='terminé';
  const rows=[
    ['Famille ECU',`${fam.vendor||'unknown'} / ${fam.family||'unknown'}`],
    ['Architecture',`${arch.architecture||'unknown'} · ${arch.endian||'unknown'} · score ${arch.score??0}`],
    ['Profil',r.profile||'generic'], ['Objets détectés',String(r.object_count??0)],
    ['Politique','Firmware-only · lecture seule · abstention sémantique']
  ];
  $('#detections').innerHTML=rows.map(x=>`<div class="detection"><strong>${escapeHtml(x[0])}</strong><span>${escapeHtml(x[1])}</span></div>`).join('');
  $('#reportView').textContent=JSON.stringify(r,null,2);
  populateObjects(r.objects||[]); renderMap();
}

function populateObjects(objects){
  const sel=$('#mapSelect'); sel.innerHTML='';
  objects.slice(0,5000).forEach((o,i)=>{
    const addr=Number.isFinite(o.address)?'0x'+o.address.toString(16).toUpperCase():'?';
    sel.add(new Option(`${o.object_kind||'OBJECT'} · ${addr} · ${o.technical_name||o.object_id||''}`,i));
  });
  if(!objects.length)sel.add(new Option('Aucun objet détecté',0));
}

function renderMap(){
  if(!atlasResult||!(atlasResult.objects||[]).length){ if(typeof Plotly!=='undefined')Plotly.purge('mapPlot'); return; }
  const o=atlasResult.objects[+$('#mapSelect').value||0]; $('#mapDetails').textContent=JSON.stringify(o,null,2);
  const matrix=extractMatrix(o);
  if(typeof Plotly==='undefined')return;
  if(!matrix){Plotly.react('mapPlot',[],{paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#cfe0f3'},annotations:[{text:'Objet détecté — géométrie ou adresse non exploitable en vue 3D',showarrow:false,font:{size:16}}]},{responsive:true,displaylogo:false});return;}
  const data=view3d?[{z:matrix,type:'surface',showscale:true}]:[{z:matrix,type:'heatmap'}];
  Plotly.react('mapPlot',data,{paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#cfe0f3'},margin:{l:40,r:20,t:20,b:40}},{responsive:true,displaylogo:false});
}

function extractMatrix(o){
  if(!currentBytes||!Number.isFinite(o.address))return null;
  let rows=Number(o.rows||o.y_count||0),cols=Number(o.columns||o.cols||o.x_count||0);
  if(!rows||!cols){const n=Number(o.count||0);if(n>1&&n<=256){rows=1;cols=n}else return null;}
  if(rows*cols>65536)return null;
  const type=String(o.raw_type||'u8').toLowerCase(); let width=type.includes('16')?2:type.includes('32')?4:1;
  let addr=o.address; if(addr<0||addr+rows*cols*width>currentBytes.length)return null;
  const dv=new DataView(currentBytes.buffer,currentBytes.byteOffset,currentBytes.byteLength), little=type.includes('le')||type.includes('little');
  const read=off=>width===1?dv.getUint8(off):width===2?dv.getUint16(off,little):dv.getUint32(off,little);
  return Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>read(addr+(y*cols+x)*width)));
}

function drawMemory(bytes){const c=$('#memoryCanvas'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);let bins=250,step=Math.max(1,Math.floor(bytes.length/bins));for(let i=0;i<bins;i++){let s=0,n=0,start=i*step,end=Math.min(bytes.length,start+step);for(let j=start;j<end;j+=Math.max(1,Math.floor(step/64))){s+=bytes[j];n++}let v=n?s/n/255:0,x=i*c.width/bins,w=c.width/bins+1,h=v*c.height;g.fillStyle=`rgba(${Math.round(55+100*v)},${Math.round(145+70*v)},${Math.round(220+30*v)},.9)`;g.fillRect(x,c.height-h,w,h)}}
function hexPreview(bytes){let out=[];for(let i=0;i<Math.min(bytes.length,512);i+=16){let row=[...bytes.slice(i,i+16)].map(b=>b.toString(16).padStart(2,'0')).join(' ');out.push(i.toString(16).padStart(8,'0')+'  '+row)}return out.join('\n')}
function formatBytes(n){if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KiB';return(n/1048576).toFixed(2)+' MiB'}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
