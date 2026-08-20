// ATLAS Web UX hotfix: real Y zoom + semantic family filter/grouping
(function(){
  'use strict';

  const $q = s => document.querySelector(s);

  function familyOfModel(m){
    if(!m) return 'Non classées';
    const o=m.object||{};
    const known=(typeof atlasKnownEr6Family==='function'?atlasKnownEr6Family(m.address):'')||'';
    const text=[o.knowledge_family,o.semantic_family,o.knowledge_name,o.semantic_name,o.name,o.technical_name,o.technical_role,known].filter(Boolean).join(' ').toLowerCase();
    if(/\baxis\b|breakpoint|axe/.test(text)) return 'Axes';
    if(/allum|ignition|spark|avance/.test(text)) return 'Allumage';
    if(/inject|fuel|essence|carbur/.test(text)) return 'Injection';
    if(/\btps\b|throttle|papillon|\bload\b|charge/.test(text)) return 'TPS / Charge';
    if(/fan|ventilat|cooling fan/.test(text)) return 'Fan control';
    if(/lambda|afr|richesse|oxygen|o2/.test(text)) return 'Lambda';
    if(/temp|ect|iat|coolant/.test(text)) return 'Température';
    if(/limit|limiteur|rev|rpm limit|speed limit/.test(text)) return 'Limiteurs';
    if(/idle|ralenti/.test(text)) return 'Ralenti';
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
      ['TPS / Charge','TPS / Charge / Papillon'],
      ['Fan control','Fan control / Ventilateur'],
      ['Lambda','Lambda / AFR / Richesse'],
      ['Température','Température ECT / IAT'],
      ['Limiteurs','Limiteurs'],
      ['Ralenti','Ralenti'],
      ['Axes','Axes / Breakpoints'],
      ['Turbo / Boost','Turbo / Boost'],
      ['Couple','Couple'],
      ['Non classées','Non classées']
    ].map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    filter.parentNode.insertBefore(select,filter);
    select.addEventListener('change',()=>renderMapList());
  }

  function displayName(m){
    const o=m.object||{};
    if(o.knowledge_name) return o.knowledge_name;
    if(typeof atlasMapLabel==='function') return atlasMapLabel(o,m.address);
    return o.semantic_name||o.name||o.semantic_family||o.technical_name||o.object_id||o.object_kind||'Objet';
  }

  function provenance(o){
    const s=String(o?.knowledge_status||o?.semantic_status||'');
    if(/CONFIRMED_BY_ER6_REFERENCE/.test(s)) return 'Confirmé ER-6';
    if(/DERIVED_FROM_DESCRIPTOR/.test(s)) return 'Axe dérivé validé';
    if(/OVERLAY/.test(s)) return 'Base ER-6';
    return 'Autonome';
  }

  window.renderMapList=function(){
    ensureFamilySelect();
    const list=$q('#mapList'); if(!list) return;
    const query=($q('#mapFilter')?.value||'').toLowerCase();
    const selectedFamily=$q('#atlasFamilyFilter')?.value||'Toutes';
    list.innerHTML='';
    const visible=[];
    mapModels.forEach((m,i)=>{
      const family=familyOfModel(m),name=displayName(m),prov=provenance(m.object);
      const searchable=`${family} ${name} ${prov} ${m.object?.object_id||''} ${hex(m.address)} ${m.object?.object_kind||''}`.toLowerCase();
      if(selectedFamily!=='Toutes'&&family!==selectedFamily) return;
      if(query&&!searchable.includes(query)) return;
      visible.push({m,i,family,name,prov});
    });
    const familyOrder=['Allumage','Injection','TPS / Charge','Fan control','Lambda','Température','Limiteurs','Ralenti','Axes','Turbo / Boost','Couple','Non classées'];
    const groups=new Map();
    visible.forEach(x=>{if(!groups.has(x.family))groups.set(x.family,[]);groups.get(x.family).push(x)});
    familyOrder.forEach(family=>{
      const rows=groups.get(family); if(!rows?.length) return;
      if(selectedFamily==='Toutes'){
        const h=document.createElement('div');h.className='atlas-family-heading';h.textContent=`${family} · ${rows.length}`;list.appendChild(h);
      }
      rows.forEach(({m,i,family,name,prov})=>{
        const d=document.createElement('div');
        d.className='map-item'+(i===selectedMap?' active':'');
        d.innerHTML=`<strong>${esc(name)}</strong><span>${family} · ${prov} · ${hex(m.address)} · ${m.rows}×${m.cols} · ${esc(m.type)}</span>`;
        d.onclick=()=>{selectedMap=i;if(typeof atlasSelectedRow!=='undefined')atlasSelectedRow=0;renderMapList();loadMapConfig();renderSelectedMap()};
        list.appendChild(d);
      });
    });
    const count=$q('#mapCount'); if(count) count.textContent=`${visible.length}/${mapModels.length}`;
  };

  function bindZoom(){
    const zy=$q('#cfgZoomY');
    if(zy){
      zy.oninput=()=>{yAuto=false;draw2D();};
      zy.onchange=()=>{yAuto=false;draw2D();};
    }
    const zx=$q('#cfgZoomX'); if(zx) zx.oninput=()=>draw2D();
    const auto=$q('#autoScale'); if(auto) auto.onclick=()=>{yAuto=true;if(zy)zy.value='1';draw2D();};
  }

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
