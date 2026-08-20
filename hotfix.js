// ATLAS Web pipeline integrity + map rendering/editor hotfix
let atlasExpectedSha256 = '';
let atlasSelectedRow = 0;
let atlasOverlayRows = false;

loadFile = async function(file){
  if(!file)return;
  currentFile=file;
  currentBytes=new Uint8Array(await file.arrayBuffer());
  atlasResult=null;
  mapModels=[];
  selectedMap=0;
  atlasSelectedRow=0;
  $('#workspace').classList.remove('hidden');
  $('#fileName').textContent=file.name;
  $('#fileMeta').textContent=`${formatBytes(file.size)} · ${new Date(file.lastModified).toLocaleString()}`;
  $('#metricSize').textContent=formatBytes(file.size);
  $('#metricArch').textContent='—';
  $('#metricObjects').textContent='—';
  $('#engineStatus').textContent='ATLAS Web · dump prêt';
  $('#detectBadge').textContent='en attente';
  $('#detections').innerHTML=cards([['Architecture','En attente de la nouvelle analyse'],['Famille ECU','En attente de la nouvelle analyse'],['État','Aucun résultat précédent réutilisé']]);
  $('#reportView').textContent='Aucune analyse exécutée pour ce dump.';
  $('#hexView').textContent=hexPreview(currentBytes,4096);
  drawMemory(currentBytes);
  const hash=await crypto.subtle.digest('SHA-256',currentBytes);
  atlasExpectedSha256=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  $('#metricHash').textContent=atlasExpectedSha256.slice(0,16)+'…';
  setProgress(0,'Dump prêt. Clique sur « Lancer ATLAS V9 ».','upload');
  rebuildMaps();
};

const atlasApplyResultOriginal = applyResult;
applyResult = function(){
  const source=atlasResult?.source||{};
  const resultHash=String(source.source_sha256||source.image_sha256||'').toLowerCase();
  if(atlasExpectedSha256 && resultHash && resultHash!==atlasExpectedSha256.toLowerCase()){
    const wrong=resultHash.slice(0,16);
    atlasResult=null; rebuildMaps();
    $('#metricArch').textContent='—'; $('#metricObjects').textContent='—'; $('#detectBadge').textContent='ERREUR';
    $('#detections').innerHTML=cards([['Résultat rejeté','Le résultat reçu appartient à un autre firmware.'],['SHA attendu',atlasExpectedSha256.slice(0,16)+'…'],['SHA reçu',wrong+'…']]);
    throw new Error('Résultat ATLAS rejeté: SHA-256 du firmware différent');
  }
  atlasApplyResultOriginal();
};

// Denso descriptor types are numeric in ATLAS JSON (0x25/0x29=u8, 0x2A=u16 big-endian).
normalizeType = function(r){
  const n=typeof r==='number'?r:Number.NaN;
  if(n===0x2A)return 'u16be';
  if(n===0x25||n===0x29)return 'u8';
  const s=String(r??'').toLowerCase();
  if(s.includes('32'))return(s.startsWith('s')?'s':'u')+'32'+(s.includes('le')?'le':'be');
  if(s.includes('16'))return(s.startsWith('s')?'s':'u')+'16'+(s.includes('le')?'le':'be');
  return s.startsWith('s')?'s8':'u8';
};

function atlasKnownEr6Family(address){
  const ignitionStarts=[0x02C154,0x02C7D0,0x02CE4C,0x02D4C8,0x02DB44,0x02DE40,0x02E4BC,0x02EB38,0x02F1B4,0x02F830];
  const fuelStarts=[0x031C44,0x03289C,0x0334F4,0x03414C,0x034DA4,0x0359FC,0x036654,0x0372AC,0x037F04];
  if(ignitionStarts.includes(address))return 'Allumage · famille confirmée ER-6';
  if(fuelStarts.includes(address))return 'Injection · famille confirmée ER-6';
  return '';
}
function atlasMapLabel(o,address){
  return o.semantic_name||o.name||o.semantic_family||atlasKnownEr6Family(address)||o.technical_name||o.object_id||o.object_kind||'Objet';
}

rebuildMaps = function(){
  mapModels=[];
  const objects=atlasResult?.objects||[];
  for(const o of objects){
    if(!/MAP|AXIS/i.test(String(o.object_kind||'')))continue;
    const address=Number(o.address); if(!Number.isFinite(address))continue;
    const rows=Math.max(1,Number(o.rows||o.y_count||1)),cols=Math.max(1,Number(o.columns||o.cols||o.x_count||o.count||16));
    const factor=(o.factor===null||o.factor===undefined||o.factor==='')?1:Number(o.factor);
    const offset=(o.offset===null||o.offset===undefined||o.offset==='')?0:Number(o.offset);
    mapModels.push({object:o,address,rows,cols,type:normalizeType(o.raw_type),factor:Number.isFinite(factor)?factor:1,offset:Number.isFinite(offset)?offset:0});
  }
  selectedMap=Math.min(selectedMap,Math.max(0,mapModels.length-1));
  $('#mapCount').textContent=mapModels.length; renderMapList(); loadMapConfig(); renderSelectedMap();
};

renderMapList = function(){
  const q=$('#mapFilter').value.toLowerCase(); $('#mapList').innerHTML='';
  mapModels.forEach((m,i)=>{
    const o=m.object,name=atlasMapLabel(o,m.address),label=`${name} ${o.object_id||''} ${hex(m.address)} ${o.object_kind||''}`;
    if(q&&!label.toLowerCase().includes(q))return;
    const d=document.createElement('div'); d.className='map-item'+(i===selectedMap?' active':'');
    d.innerHTML=`<strong>${esc(name)}</strong><span>${hex(m.address)} · ${m.rows}×${m.cols} · ${esc(m.type)}</span>`;
    d.onclick=()=>{selectedMap=i;atlasSelectedRow=0;renderMapList();loadMapConfig();renderSelectedMap()}; $('#mapList').appendChild(d);
  });
};

loadMapConfig = function(){
  const m=mapModels[selectedMap]; if(!m)return;
  $('#cfgAddress').value=hex(m.address); $('#cfgRows').value=m.rows; $('#cfgCols').value=m.cols; $('#cfgType').value=m.type; $('#cfgFactor').value=m.factor; $('#cfgOffset').value=m.offset;
  const family=atlasKnownEr6Family(m.address); $('#selectedInfo').textContent=`${family?family+' · ':''}${m.object.object_kind||''} · confiance ${m.object.confidence||'—'}`;
  atlasUpdateRowControl();
};

function atlasEnsure2DControls(){
  if(document.getElementById('atlasRowControl')) return;
  const toolbar=document.querySelector('.map-toolbar'); if(!toolbar)return;
  const wrap=document.createElement('span');
  wrap.id='atlasRowControl'; wrap.style.display='inline-flex'; wrap.style.alignItems='center'; wrap.style.gap='8px'; wrap.style.marginLeft='8px';
  wrap.innerHTML='<span class="muted">Ligne Y</span><input id="atlasRowSlider" type="range" min="0" max="0" value="0" step="1" style="width:150px"><strong id="atlasRowLabel" class="mono">0</strong><button class="secondary" id="atlasOverlayBtn" type="button">Superposer</button>';
  const selected=document.getElementById('selectedInfo'); toolbar.insertBefore(wrap,selected||null);
  document.getElementById('atlasRowSlider').addEventListener('input',e=>{atlasSelectedRow=Number(e.target.value)||0;atlasUpdateRowControl();renderSelectedMap();});
  document.getElementById('atlasOverlayBtn').addEventListener('click',()=>{atlasOverlayRows=!atlasOverlayRows;const b=document.getElementById('atlasOverlayBtn');b.classList.toggle('active',atlasOverlayRows);b.textContent=atlasOverlayRows?'Toutes lignes':'Superposer';renderSelectedMap();});
}

function atlasAxisValues(m,key,count){
  const addr=Number(m?.object?.[key]);
  if(!currentBytes||!Number.isFinite(addr)||addr<0||addr+count>currentBytes.length)return null;
  const vals=Array.from(currentBytes.slice(addr,addr+count));
  const asc=vals.every((v,i)=>!i||v>=vals[i-1]),desc=vals.every((v,i)=>!i||v<=vals[i-1]);
  return (asc||desc)&&new Set(vals).size>1?vals:null;
}

function atlasUpdateRowControl(){
  atlasEnsure2DControls(); const m=mapModels[selectedMap],slider=document.getElementById('atlasRowSlider'),label=document.getElementById('atlasRowLabel');
  if(!m||!slider||!label)return;
  atlasSelectedRow=Math.max(0,Math.min(m.rows-1,atlasSelectedRow)); slider.max=Math.max(0,m.rows-1); slider.value=atlasSelectedRow;
  const y=atlasAxisValues(m,'y_axis',m.rows); label.textContent=y?`${atlasSelectedRow} · Y=${y[atlasSelectedRow]}`:`${atlasSelectedRow}`;
}

const atlasRenderSelectedOriginal=renderSelectedMap;
renderSelectedMap=function(){atlasUpdateRowControl();return atlasRenderSelectedOriginal();};

renderTable=function(z){
  if(!z||!z.length)return;
  const m=mapModels[selectedMap],xv=atlasAxisValues(m,'x_axis',z[0].length),yv=atlasAxisValues(m,'y_axis',z.length),thead=$('#mapTable thead'),tbody=$('#mapTable tbody');
  thead.innerHTML='<tr><th>Y\\X</th>'+z[0].map((_,i)=>`<th>${xv?xv[i]:i}</th>`).join('')+'</tr>';
  tbody.innerHTML=z.map((r,y)=>'<tr data-y="'+y+'"'+(y===atlasSelectedRow?' class="atlas-selected-row"':'')+'><th>'+(yv?yv[y]:y)+'</th>'+r.map(v=>`<td>${Number(v).toFixed(3)}</td>`).join('')+'</tr>').join('');
  tbody.querySelectorAll('tr').forEach(tr=>tr.addEventListener('click',()=>{atlasSelectedRow=Number(tr.dataset.y)||0;atlasUpdateRowControl();renderSelectedMap();}));
};

draw2D=function(z=getGrid()){
  if(!z||!z.length)return; atlasUpdateRowControl();
  const c=$('#map2d'),ctx=c.getContext('2d'),zx=+$('#cfgZoomX').value||1,zy=+$('#cfgZoomY').value||1,m=mapModels[selectedMap];
  const xvals=atlasAxisValues(m,'x_axis',z[0].length)||z[0].map((_,i)=>i),yvals=atlasAxisValues(m,'y_axis',z.length),rows=atlasOverlayRows?z:[z[Math.min(atlasSelectedRow,z.length-1)]],flat=z.flat();
  let min=Math.min(...flat),max=Math.max(...flat);if(min===max){min-=1;max+=1}
  const w=Math.max(1000,Math.round((z[0].length*42+120)*zx)),h=520;c.width=w;c.height=h;ctx.clearRect(0,0,w,h);ctx.fillStyle='#06111e';ctx.fillRect(0,0,w,h);
  const padL=65,padR=25,padT=38,padB=55,span=(max-min)/zy,mid=(max+min)/2,lo=yAuto?min:mid-span/2,hi=yAuto?max:mid+span/2;
  ctx.font='11px ui-monospace';ctx.strokeStyle='#19324a';ctx.lineWidth=1;ctx.fillStyle='#7fa2bd';
  for(let i=0;i<=8;i++){const yy=padT+(h-padT-padB)*i/8;ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(w-padR,yy);ctx.stroke();ctx.fillText((hi-(hi-lo)*i/8).toFixed(2),5,yy+4)}
  for(let i=0;i<xvals.length;i++){const xx=padL+(w-padL-padR)*i/Math.max(1,xvals.length-1);if(i%Math.max(1,Math.ceil(xvals.length/12))===0||i===xvals.length-1){ctx.fillStyle='#7fa2bd';ctx.fillText(String(xvals[i]),xx-8,h-25)}}
  rows.forEach((row,ridx)=>{ctx.strokeStyle=atlasOverlayRows?`hsla(${190+(ridx*137)%140},90%,65%,${Math.max(.15,1/Math.sqrt(rows.length))})`:'#28d3ff';ctx.lineWidth=atlasOverlayRows?1:2;ctx.beginPath();row.forEach((v,i)=>{const xx=padL+(w-padL-padR)*i/Math.max(1,row.length-1),yy=padT+(hi-v)/(hi-lo)*(h-padT-padB);if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)});ctx.stroke();});
  const ri=Math.min(atlasSelectedRow,z.length-1),ylabel=yvals?`Y=${yvals[ri]}`:`Y#${ri}`;ctx.fillStyle='#b9d8ef';ctx.fillText(`${hex(m.address)} · ${m.rows}×${m.cols} · ${m.type} · ${atlasOverlayRows?'superposition complète':ylabel} · brut min ${min.toFixed(3)} max ${max.toFixed(3)}`,padL,20);ctx.fillStyle='#7fa2bd';ctx.fillText(`Axe X brut ${xvals[0]} → ${xvals[xvals.length-1]}`,padL,h-7);
};

const atlasStyle=document.createElement('style');
atlasStyle.textContent='#mapTable tbody tr{cursor:pointer}#mapTable tbody tr.atlas-selected-row th,#mapTable tbody tr.atlas-selected-row td{background:rgba(40,211,255,.14);outline:1px solid rgba(40,211,255,.18)}';document.head.appendChild(atlasStyle);
atlasEnsure2DControls();
