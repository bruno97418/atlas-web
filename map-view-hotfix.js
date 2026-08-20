// ATLAS Web 2D view: single selected Y row, full profile fitted by default; Zoom X/Y enlarge only.
(function(){
  'use strict';
  const q=s=>document.querySelector(s);

  function axisValues(m,key,count){
    if(typeof atlasAxisValues==='function') return atlasAxisValues(m,key,count);
    return null;
  }

  function ensureDefaults(){
    const zx=q('#cfgZoomX'),zy=q('#cfgZoomY');
    if(zx&&!zx.dataset.atlasInit){zx.value='1';zx.dataset.atlasInit='1';}
    if(zy&&!zy.dataset.atlasInit){zy.value='1';zy.dataset.atlasInit='1';}
  }

  window.draw2D=function(z=(typeof getGrid==='function'?getGrid():null)){
    if(!z||!z.length||!z[0]?.length)return;
    ensureDefaults();
    const c=q('#map2d'),wrap=q('#twoDWrap'),ctx=c.getContext('2d');
    const m=mapModels[selectedMap];
    const rowIndex=Math.max(0,Math.min(z.length-1,Number(window.atlasSelectedRow||0)));
    const row=z[rowIndex];
    const zx=Math.max(.5,Number(q('#cfgZoomX')?.value||1));
    const zy=Math.max(.5,Number(q('#cfgZoomY')?.value||1));
    const baseW=Math.max(720,(wrap?.clientWidth||1200)-8);
    const baseH=500;
    c.width=Math.round(baseW*zx);
    c.height=Math.round(baseH*zy);
    c.style.width=c.width+'px';
    c.style.height=c.height+'px';

    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle='#05090d';ctx.fillRect(0,0,c.width,c.height);

    let min=Math.min(...row),max=Math.max(...row);
    if(min===max){min-=1;max+=1;}
    const rawSpan=max-min;
    const margin=Math.max(rawSpan*.12,1);
    const lo=min-margin,hi=max+margin;
    const padL=68,padR=24,padT=34,padB=54;
    const plotW=c.width-padL-padR,plotH=c.height-padT-padB;
    const xvals=axisValues(m,'x_axis',row.length)||row.map((_,i)=>i);
    const yvals=axisValues(m,'y_axis',z.length);

    // WinOLS-like dark graph area, restrained grid and single profile.
    ctx.font='11px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.lineWidth=1;
    for(let i=0;i<=8;i++){
      const yy=padT+plotH*i/8;
      ctx.strokeStyle=i===8?'#53616b':'#26313a';
      ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(c.width-padR,yy);ctx.stroke();
      ctx.fillStyle='#a5b0b7';
      ctx.fillText((hi-(hi-lo)*i/8).toFixed(2),7,yy+4);
    }
    const labelStep=Math.max(1,Math.ceil(xvals.length/14));
    xvals.forEach((v,i)=>{
      const xx=padL+plotW*i/Math.max(1,row.length-1);
      ctx.strokeStyle='#202b33';
      ctx.beginPath();ctx.moveTo(xx,padT);ctx.lineTo(xx,c.height-padB);ctx.stroke();
      if(i%labelStep===0||i===xvals.length-1){
        ctx.fillStyle='#a5b0b7';ctx.fillText(String(v),Math.max(padL,xx-10),c.height-27);
      }
    });

    // Single selected map line only.
    ctx.strokeStyle='#00d7ff';
    ctx.lineWidth=2;
    ctx.beginPath();
    row.forEach((v,i)=>{
      const xx=padL+plotW*i/Math.max(1,row.length-1);
      const yy=padT+(hi-v)/(hi-lo)*plotH;
      if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
    });
    ctx.stroke();

    // Small value nodes, similar to an editable calibration profile.
    ctx.fillStyle='#d8f7ff';
    row.forEach((v,i)=>{
      const xx=padL+plotW*i/Math.max(1,row.length-1);
      const yy=padT+(hi-v)/(hi-lo)*plotH;
      ctx.fillRect(Math.round(xx)-2,Math.round(yy)-2,4,4);
    });

    const yLabel=yvals?`Y=${yvals[rowIndex]}`:`ligne Y ${rowIndex}`;
    ctx.fillStyle='#d8e0e5';
    ctx.fillText(`${hex(m.address)} · ${m.rows}×${m.cols} · ${m.type} · ${yLabel} · profil complet`,padL,18);
    ctx.fillStyle='#89969f';
    ctx.fillText(`min ${min.toFixed(3)}   max ${max.toFixed(3)}   X ${xvals[0]} → ${xvals[xvals.length-1]}`,padL,c.height-8);
  };

  const oldRender=window.renderSelectedMap;
  window.renderSelectedMap=function(){
    const z=typeof getGrid==='function'?getGrid():null;
    if(!z){if(typeof clear2D==='function')clear2D('Dump local ou géométrie insuffisante');return;}
    if(typeof renderTable==='function')renderTable(z);
    if(mapMode==='2d')draw2D(z);else if(typeof draw3D==='function')draw3D(z);
  };

  const zx=q('#cfgZoomX'),zy=q('#cfgZoomY'),reset=q('#autoScale');
  if(zx){zx.min='.5';zx.max='8';zx.step='.25';zx.oninput=()=>draw2D();}
  if(zy){zy.min='.5';zy.max='8';zy.step='.25';zy.oninput=()=>draw2D();}
  if(reset){reset.textContent='Réinitialiser zoom';reset.onclick=()=>{if(zx)zx.value='1';if(zy)zy.value='1';draw2D();};}

  const configureRowControl=()=>{
    const b=document.getElementById('atlasOverlayBtn');if(b)b.style.display='none';
    const control=document.getElementById('atlasRowControl');
    if(control){const label=control.querySelector('.muted');if(label)label.textContent='Ligne affichée';}
  };
  configureRowControl();setTimeout(configureRowControl,200);

  const style=document.createElement('style');
  style.textContent='#twoDWrap{overflow:auto;background:#05090d}#map2d{display:block;max-width:none}';
  document.head.appendChild(style);
  window.addEventListener('resize',()=>{if(mapMode==='2d')draw2D();});
})();
