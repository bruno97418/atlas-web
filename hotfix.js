// ATLAS Web pipeline integrity hotfix
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
  $('#detections').innerHTML=cards([
    ['Architecture','En attente de la nouvelle analyse'],
    ['Famille ECU','En attente de la nouvelle analyse'],
    ['État','Aucun résultat précédent réutilisé']
  ]);
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
    atlasResult=null;
    rebuildMaps();
    $('#metricArch').textContent='—';
    $('#metricObjects').textContent='—';
    $('#detectBadge').textContent='ERREUR';
    $('#detections').innerHTML=cards([
      ['Résultat rejeté','Le résultat reçu appartient à un autre firmware.'],
      ['SHA attendu',atlasExpectedSha256.slice(0,16)+'…'],
      ['SHA reçu',wrong+'…']
    ]);
    throw new Error('Résultat ATLAS rejeté: SHA-256 du firmware différent');
  }
  atlasApplyResultOriginal();
};
