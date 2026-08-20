// ATLAS Web 2D view: fit complete map by default; Zoom X/Y are the only visual scaling controls.
(function(){
  'use strict';
  const q=s=>document.querySelector(s);

  function axisValues(m,key,count){
    if(typeof atlasAxisValues==='function') return atlasAxisValues(m,key,count);
    return null;
  }

  function ensureDefaults(){
    const zx=q('#cfgZoomX'), zy=q('#cfgZoomY');
    if(zx && !zx.dataset.atlasInit){zx.value='1';zx.dataset.atlasInit='1';}
    if(zy && !zy.dataset.atlasInit){zy.value='1';zy.dataset.atlasInit='1';}
  }

  window.draw2D=function(z=(typeof getGrid==='function'?getGrid():null)){
    if(!z||!z.length||!z[0]?.length)return;
    ensureDefaults();
    const c=q('#map2d'), wrap=q('#twoDWrap'), ctx=c.getContext('2d');
    const m=mapModels[selectedMap];
    const zx=Math.max(.25,Number(q('#cfgZoomX')?.value||1));
    const zy=Math.max(.25,Number(q('#cfgZoomY')?.value||1));
    const baseW=Math.max(720,(wrap?.clientWidth||1200)-8);
    const baseH=520;
    c.width=Math.round(baseW*zx);
    c.height=Math.round(baseH);
    c.style.width=c.width+'px';
    c.style.height=baseH+'px';

    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle='#06111e';ctx.fillRect(0,0,c.width,c.height);

    const flat=z.flat();
    let min=Math.min(...flat), max=Math.max(...flat);
    if(min===max){min-=1;max+=1;}
    const mid=(min+max)/2;
    const span=(max-min)/zy;
    const lo=mid-span/2, hi=mid+span/2;
    const padL=64,padR=24,padT=34,padB=50;
    const plotW=c.width-padL-padR, plotH=c.height-padT-padB;
    const xvals=axisValues(m,'x_axis',z[0].length)||z[0].map((_,i)=>i);

    ctx.font='11px ui-monospace';
    ctx.strokeStyle='#19324a';ctx.lineWidth=1;ctx.fillStyle='#7fa2bd';
    for(let i=0;i<=8;i++){
      const yy=padT+plotH*i/8;
      ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(c.width-padR,yy);ctx.stroke();
      ctx.fillText((hi-(hi-lo)*i/8).toFixed(2),5,yy+4);
    }
    const labelStep=Math.max(1,Math.ceil(xvals.length/14));
    xvals.forEach((v,i)=>{
      if(i%labelStep&&i!==xvals.length-1)return;
      const xx=padL+plotW*i/Math.max(1,xvals.length-1);
      ctx.fillStyle='#7fa2bd';ctx.fillText(String(v),Math.max(padL,xx-9),c.height-22);
    });

    // Default = complete 2D map: every Y row is visible at once.
    z.forEach((row,ridx)=>{
      const alpha=Math.max(.14,Math.min(.75,2.4/Math.sqrt(z.length)));
      const hue=190+(ridx*137)%140;
      ctx.strokeStyle=`hsla(${hue},90%,65%,${alpha})`;
      ctx.lineWidth=(typeof atlasSelectedRow!=='undefined'&&ridx===atlasSelectedRow)?2:1;
      ctx.beginPath();
      row.forEach((v,i)=>{
        const xx=padL+plotW*i/Math.max(1,row.length-1);
        const yy=padT+(hi-v)/(hi-lo)*plotH;
        if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
      });
      ctx.stroke();
    });

    ctx.fillStyle='#b9d8ef';
    ctx.fillText(`${hex(m.address)} · ${m.rows}×${m.cols} · ${m.type} · vue complète · min ${min.toFixed(3)} max ${max.toFixed(3)}`,padL,18);
  };

  // Selection changes highlight only; they never alter fit/scale.
  const oldRender=window.renderSelectedMap;
  if(oldRender){
    window.renderSelectedMap=function(){
      const z=typeof getGrid==='function'?getGrid():null;
      if(!z){if(typeof clear2D==='function')clear2D('Dump local ou géométrie insuffisante');return;}
      if(typeof renderTable==='function')renderTable(z);
      if(mapMode==='2d')draw2D(z);else if(typeof draw3D==='function')draw3D(z);
    };
  }

  const zx=q('#cfgZoomX'),zy=q('#cfgZoomY'),auto=q('#autoScale');
  if(zx){zx.min='.5';zx.max='8';zx.step='.25';zx.oninput=()=>draw2D();}
  if(zy){zy.min='.5';zy.max='8';zy.step='.25';zy.oninput=()=>draw2D();}
  if(auto){auto.textContent='Réinitialiser zoom';auto.onclick=()=>{if(zx)zx.value='1';if(zy)zy.value='1';draw2D();};}

  // Hide the old Superposer concept: complete map is now always the default 2D view.
  const hideLegacy=()=>{
    const b=document.getElementById('atlasOverlayBtn');if(b)b.style.display='none';
    const c=document.getElementById('atlasRowControl');if(c){const label=c.querySelector('.muted');if(label)label.textContent='Ligne surlignée';}
  };
  hideLegacy();setTimeout(hideLegacy,200);

  const style=document.createElement('style');
  style.textContent='#twoDWrap{overflow:auto}#map2d{display:block;max-width:none}';
  document.head.appendChild(style);
  window.addEventListener('resize',()=>{if(mapMode==='2d')draw2D();});
})();
