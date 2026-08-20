// ATLAS Web UX hotfix: real Y zoom + semantic family filter/grouping
(function(){
  'use strict';

  const $q = s => document.querySelector(s);

  function familyOfModel(m){
    if(!m) return 'Non classées';
    const o=m.object||{};
    const known=(typeof atlasKnownEr6Family==='function'?atlasKnownEr6Family(m.address):'')||'';
    const text=[o.semantic_family,o.semantic_name,o.name,o.technical_name,known].filter(Boolean).join(' ').toLowerCase();
    if(/allum|ignition|spark|avance/.test(text)) return 'Allumage';
    if(/inject|fuel|essence|carbur/.test(text)) return 'Injection';
    if(/\btps\b|throttle|papillon/.test(text)) return 'TPS';
    if(/fan|ventilat|cooling fan/.test(text)) return 'Fan control';
    if(/lambda|afr|richesse|oxygen|o2/.test(text)) return 'Lambda';
    if(/temp|ect|iat|coolant/.test(text)) return 'Température';
    if(/limit|limiteur|rev|rpm limit|speed limit/.test(text)) return 'Limiteurs';
    if(/boost|turbo|wastegate/.test(text)) return 'Turbo / Boost';
    if(/torque|couple/.test(text)) return 'Couple';
    return 'Non classées';
  }

  function ensureFamilySelect(){
    if(document.getElementById('atlasFamilyFilter')) return;
    const filter=$q('#mapFilter');
    if(!filter) return;
    const select=document.createElement('select');
    select.id='atlasFamilyFilter';
    select.className='input';
    select.style.marginBottom='8px';
    select.innerHTML=[
      ['Toutes','Toutes les familles'],
      ['Allumage','Allumage'],
      ['Injection','Injection'],
      ['TPS','TPS / Papillon'],
      ['Fan control','Fan control / Ventilateur'],
      ['Lambda','Lambda / AFR'],
      ['Température','Température'],
      ['Limiteurs','Limiteurs'],
      ['Turbo / Boost','Turbo / Boost'],
      ['Couple','Couple'],
      ['Non classées','Non classées']
    ].map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    filter.parentNode.insertBefore(select,filter);
    select.addEventListener('change',()=>renderMapList());
  }

  function displayName(m){
    const o=m.object||{};
    if(typeof atlasMapLabel==='function') return atlasMapLabel(o,m.address);
    return o.semantic_name||o.name||o.semantic_family||o.technical_name||o.object_id||o.object_kind||'Objet';
  }

  // Override list renderer to support semantic family dropdown and visible group headings.
  window.renderMapList=function(){
    ensureFamilySelect();
    const list=$q('#mapList'); if(!list) return;
    const query=($q('#mapFilter')?.value||'').toLowerCase();
    const selectedFamily=$q('#atlasFamilyFilter')?.value||'Toutes';
    list.innerHTML='';
    const visible=[];
    mapModels.forEach((m,i)=>{
      const family=familyOfModel(m),name=displayName(m);
      const searchable=`${family} ${name} ${m.object?.object_id||''} ${hex(m.address)} ${m.object?.object_kind||''}`.toLowerCase();
      if(selectedFamily!=='Toutes'&&family!==selectedFamily) return;
      if(query&&!searchable.includes(query)) return;
      visible.push({m,i,family,name});
    });
    const familyOrder=['Allumage','Injection','TPS','Fan control','Lambda','Température','Limiteurs','Turbo / Boost','Couple','Non classées'];
    const groups=new Map();
    visible.forEach(x=>{if(!groups.has(x.family))groups.set(x.family,[]);groups.get(x.family).push(x)});
    familyOrder.forEach(family=>{
      const rows=groups.get(family); if(!rows?.length) return;
      if(selectedFamily==='Toutes'){
        const h=document.createElement('div');h.className='atlas-family-heading';h.textContent=`${family} · ${rows.length}`;list.appendChild(h);
      }
      rows.forEach(({m,i,family,name})=>{
        const d=document.createElement('div');
        d.className='map-item'+(i===selectedMap?' active':'');
        d.innerHTML=`<strong>${esc(name)}</strong><span>${family} · ${hex(m.address)} · ${m.rows}×${m.cols} · ${esc(m.type)}</span>`;
        d.onclick=()=>{selectedMap=i;if(typeof atlasSelectedRow!=='undefined')atlasSelectedRow=0;renderMapList();loadMapConfig();renderSelectedMap()};
        list.appendChild(d);
      });
    });
    const count=$q('#mapCount'); if(count) count.textContent=`${visible.length}/${mapModels.length}`;
  };

  // Real vertical zoom: moving the slider explicitly leaves auto-scale mode.
  function bindZoom(){
    const zy=$q('#cfgZoomY');
    if(zy){
      zy.oninput=()=>{yAuto=false;draw2D();};
      zy.onchange=()=>{yAuto=false;draw2D();};
    }
    const zx=$q('#cfgZoomX'); if(zx) zx.oninput=()=>draw2D();
    const auto=$q('#autoScale'); if(auto) auto.onclick=()=>{yAuto=true;if(zy)zy.value='1';draw2D();};
  }

  // Keep family filter after each map rebuild without modifying the analyzer result.
  const oldRebuild=window.rebuildMaps;
  window.rebuildMaps=function(){
    oldRebuild();
    ensureFamilySelect();
    bindZoom();
    renderMapList();
  };

  const style=document.createElement('style');
  style.textContent=`
    #atlasFamilyFilter{width:100%;min-height:38px}
    .atlas-family-heading{position:sticky;top:0;z-index:2;padding:8px 10px;margin:6px 0 4px;border-radius:7px;background:#0a1c2e;color:#7fcfff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border:1px solid #173a58}
  `;
  document.head.appendChild(style);
  ensureFamilySelect();
  bindZoom();
  if(typeof renderMapList==='function') renderMapList();
})();
