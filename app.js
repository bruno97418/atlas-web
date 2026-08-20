const $=s=>document.querySelector(s);
let currentFile=null,currentBytes=null,atlasResult=null,view3d=true,mapModels=[];

document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav,.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#view-'+b.dataset.view).classList.add('active');if(b.dataset.view==='maps')renderMap()});
$('#browseBtn').onclick=()=>$('#fileInput').click();
$('#fileInput').onchange=e=>loadFile(e.target.files[0]);
$('#resultInput').onchange=e=>loadAtlasResult(e.target.files[0]);
const dz=$('#dropZone');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));
dz.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
$('#analyzeBtn').onclick=localAnalyze;
$('#toggle3d').onclick=()=>{view3d=!view3d;$('#toggle3d').textContent=view3d?'Vue 2D':'Vue 3D';renderMap()};
$('#mapSelect').onchange=renderMap;

async function loadFile(file){
  if(!file)return;
  currentFile=file;currentBytes=new Uint8Array(await file.arrayBuffer());
  $('#workspace').classList.remove('hidden');
  $('#fileName').textContent=file.name;
  $('#fileMeta').textContent=`${file.type||'binaire'} · ${new Date(file.lastModified).toLocaleString()}`;
  $('#metricSize').textContent=formatBytes(file.size);$('#metricHash').textContent='calcul…';
  $('#engineStatus').textContent='ATLAS Web · dump local chargé';
  $('#hexView').textContent=hexPreview(currentBytes);drawMemory(currentBytes);
  const hash=await crypto.subtle.digest('SHA-256',currentBytes);
  $('#metricHash').textContent=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16)+'…';
  rebuildMaps();
}

function localAnalyze(){
  if(!currentBytes)return;
  let counts=new Array(256).fill(0);for(const b of currentBytes)counts[b]++;
  let h=0;for(const c of counts)if(c){const p=c/currentBytes.length;h-=p*Math.log2(p)}
  const fill=(counts[0]+counts[255])/currentBytes.length*100;
  $('#metricEntropy').textContent=h.toFixed(3)+' bit';$('#metricFill').textContent=fill.toFixed(1)+' %';
  const rows=[['Pré-analyse locale',`Entropie ${h.toFixed(3)} bit · FF/00 ${fill.toFixed(1)} %`],['Analyse complète','Dépose le même dump dans ATLAS_INBOX : le workflow privé démarre automatiquement.']];
  $('#detections').innerHTML=cards(rows);$('#detectBadge').textContent='local';
}

async function loadAtlasResult(file){
  if(!file)return;
  try{
    atlasResult=JSON.parse(await file.text());
  }catch(e){alert('JSON ATLAS invalide');return;}
  const arch=atlasResult.architecture?.architecture||atlasResult.architecture?.selected?.architecture||'inconnue';
  const fam=atlasResult.family?.family||atlasResult.family?.vendor||'inconnue';
  const profile=atlasResult.profile||'inconnu';
  const count=atlasResult.object_count??(atlasResult.objects||[]).length;
  $('#engineStatus').textContent='ATLAS V9 · résultat privé chargé';
  $('#detectBadge').textContent='ATLAS V9';
  $('#detections').innerHTML=cards([['Architecture',arch],['Famille ECU',fam],['Profil',profile],['Objets détectés',String(count)]]);
  $('#reportView').textContent=JSON.stringify(atlasResult,null,2);
  rebuildMaps();
  document.querySelector('[data-view="maps"]').click();
}

function rebuildMaps(){
  mapModels=[];
  const objects=atlasResult?.objects||[];
  if(currentBytes){
    for(const o of objects){
      const rows=Number(o.rows||o.y_count||o.height||0),cols=Number(o.columns||o.cols||o.x_count||o.width||0);
      if(rows>1&&cols>1&&rows*cols<=65536){
        const width=rawWidth(o.raw_type,o.access_widths);const address=Number(o.address);
        if(Number.isFinite(address)&&address>=0){
          const z=extractGrid(currentBytes,address,rows,cols,width,o.raw_type);
          if(z)mapModels.push({name:`${o.object_id||o.technical_name||'MAP'} · 0x${address.toString(16).toUpperCase()} · ${rows}×${cols}`,z,object:o});
        }
      }
    }
  }
  if(!mapModels.length&&objects.length){
    const candidates=objects.filter(o=>String(o.object_kind||'').includes('MAP')).slice(0,100);
    for(const o of candidates){
      const address=Number(o.address);if(!Number.isFinite(address))continue;
      mapModels.push({name:`${o.object_id||'MAP'} · 0x${address.toString(16).toUpperCase()}`,z:[[0]],object:o,placeholder:true});
    }
  }
  const sel=$('#mapSelect');sel.innerHTML='';
  if(!mapModels.length)sel.add(new Option('Charge un résultat ATLAS + le dump local',0));
  else mapModels.forEach((m,i)=>sel.add(new Option(m.name,i)));
  renderMap();
}

function rawWidth(raw,access){
  const s=String(raw||'').toLowerCase();
  if(s.includes('32'))return 4;if(s.includes('16'))return 2;if(s.includes('8'))return 1;
  if(Array.isArray(access)&&access.length)return Math.max(1,Math.min(4,Number(access[0])||1));
  return 1;
}
function extractGrid(bytes,address,rows,cols,width,raw){
  const size=rows*cols*width;if(address<0||address+size>bytes.length)return null;
  const little=String(raw||'').toLowerCase().includes('le');const signed=String(raw||'').toLowerCase().startsWith('s');
  const z=[];let p=address;
  for(let y=0;y<rows;y++){const row=[];for(let x=0;x<cols;x++){
    let v=0;if(width===1)v=bytes[p];else if(width===2)v=little?(bytes[p]|bytes[p+1]<<8):(bytes[p]<<8|bytes[p+1]);else v=little?(bytes[p]|bytes[p+1]<<8|bytes[p+2]<<16|bytes[p+3]<<24)>>>0:((bytes[p]<<24|bytes[p+1]<<16|bytes[p+2]<<8|bytes[p+3])>>>0);
    if(signed){const bits=width*8,limit=2**(bits-1);if(v>=limit)v-=2**bits}row.push(v);p+=width;
  }z.push(row)}return z;
}
function renderMap(){
  if(typeof Plotly==='undefined')return;
  const m=mapModels[+$('#mapSelect').value||0];
  if(!m){Plotly.purge('mapPlot');return;}
  if(m.placeholder){Plotly.react('mapPlot',[{x:[0],y:[0],mode:'markers',text:[JSON.stringify(m.object)],hoverinfo:'text'}],{paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#cfe0f3'},annotations:[{text:'Géométrie non résolue pour cet objet',showarrow:false,x:.5,y:.5,xref:'paper',yref:'paper'}]},{responsive:true,displaylogo:false});return;}
  const data=view3d?[{z:m.z,type:'surface',showscale:true}]:[{z:m.z,type:'heatmap'}];
  Plotly.react('mapPlot',data,{paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#cfe0f3'},margin:{l:45,r:20,t:25,b:45},title:{text:m.name,font:{size:13}}},{responsive:true,displaylogo:false});
}
function drawMemory(bytes){const c=$('#memoryCanvas'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);const bins=250,step=Math.max(1,Math.floor(bytes.length/bins));for(let i=0;i<bins;i++){let s=0,n=0,start=i*step,end=Math.min(bytes.length,start+step);for(let j=start;j<end;j+=Math.max(1,Math.floor(step/64))){s+=bytes[j];n++}const v=n?s/n/255:0,x=i*c.width/bins,w=c.width/bins+1,h=v*c.height;g.fillStyle=`rgba(${Math.round(55+100*v)},${Math.round(145+70*v)},${Math.round(220+30*v)},.9)`;g.fillRect(x,c.height-h,w,h)}}
function hexPreview(bytes){let out=[];for(let i=0;i<Math.min(bytes.length,512);i+=16){const row=[...bytes.slice(i,i+16)].map(b=>b.toString(16).padStart(2,'0')).join(' ');out.push(i.toString(16).padStart(8,'0')+'  '+row)}return out.join('\n')}
function formatBytes(n){if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KiB';return(n/1048576).toFixed(2)+' MiB'}
function cards(rows){return rows.map(x=>`<div class="detection"><strong>${escapeHtml(x[0])}</strong><span>${escapeHtml(x[1])}</span></div>`).join('')}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
rebuildMaps();
