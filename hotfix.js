// ATLAS Web pipeline integrity + map rendering hotfix
let atlasExpectedSha256 = '';

loadFile = async function(file){
  if(!file)return;
  currentFile=file;
  currentBytes=new Uint8Array(await file.arrayBuffer());
  atlasResult=null;
  mapModels=[];
  selectedMap=0;
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
  // Validation overlay only: these are previously confirmed ER-6 calibration families.
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
    d.onclick=()=>{selectedMap=i;renderMapList();loadMapConfig();renderSelectedMap()}; $('#mapList').appendChild(d);
  });
};

loadMapConfig = function(){
  const m=mapModels[selectedMap]; if(!m)return;
  $('#cfgAddress').value=hex(m.address); $('#cfgRows').value=m.rows; $('#cfgCols').value=m.cols; $('#cfgType').value=m.type; $('#cfgFactor').value=m.factor; $('#cfgOffset').value=m.offset;
  const family=atlasKnownEr6Family(m.address); $('#selectedInfo').textContent=`${family?family+' · ':''}${m.object.object_kind||''} · confiance ${m.object.confidence||'—'}`;
};
