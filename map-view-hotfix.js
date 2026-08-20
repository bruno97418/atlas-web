// ATLAS Web 2D view: WinOLS-like single trace of the complete map, fitted by default.
(function(){
  'use strict';
  const q=s=>document.querySelector(s);

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
    const values=z.flat(); // one continuous trace: whole map in memory order
    const zx=Math.max(.5,Number(q('#cfgZoomX')?.value||1));
    const zy=Math.max(.5,Number(q('#cfgZoomY')?.value||1));
    const baseW=Math.max(720,(wrap?.clientWidth||1200)-8);
    const baseH=500;
    c.width=Math.round(baseW*zx);
    c.height=Math.round(baseH*zy);
    c.style.width=c.width+'px';
    c.style.height=c.height+'px';

    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle='#0610a8';
    ctx.fillRect(0,0,c.width,c.height);

    let min=Math.min(...values),max=Math.max(...values);
    if(min===max){min-=1;max+=1;}
    const span=max-min;
    const margin=Math.max(span*.06,1);
    const lo=min-margin,hi=max+margin;
    const padL=58,padR=28,padT=26,padB=44;
    const plotW=c.width-padL-padR,plotH=c.height-padT-padB;

    // Dense WinOLS-like grid.
    ctx.font='10px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.lineWidth=1;
    for(let i=0;i<=12;i++){
      const yy=padT+plotH*i/12;
      ctx.strokeStyle='rgba(185,205,255,.28)';
      ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(c.width-padR,yy);ctx.stroke();
      ctx.fillStyle='rgba(220,230,255,.82)';
      ctx.fillText((hi-(hi-lo)*i/12).toFixed(0),5,yy+3);
    }
    for(let i=0;i<=24;i++){
      const xx=padL+plotW*i/24;
      ctx.strokeStyle='rgba(185,205,255,.22)';
      ctx.beginPath();ctx.moveTo(xx,padT);ctx.lineTo(xx,c.height-padB);ctx.stroke();
    }

    // Single white profile for the COMPLETE map. Fit-to-width at Zoom X = 1.
    ctx.strokeStyle='#f2f4ff';
    ctx.lineWidth=1.15;
    ctx.beginPath();
    values.forEach((v,i)=>{
      const xx=padL+plotW*i/Math.max(1,values.length-1);
      const yy=padT+(hi-v)/(hi-lo)*plotH;
      if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
    });
    ctx.stroke();

    // Sparse point markers only when zoomed enough; avoids a solid block at overview scale.
    if(zx>=2.5 || values.length<250){
      ctx.fillStyle='#ffffff';
      const step=zx>=5?1:Math.max(1,Math.ceil(values.length/(plotW/5)));
      for(let i=0;i<values.length;i+=step){
        const xx=padL+plotW*i/Math.max(1,values.length-1);
        const yy=padT+(hi-values[i])/(hi-lo)*plotH;
        ctx.fillRect(Math.round(xx)-1,Math.round(yy)-1,3,3);
      }
    }

    // Memory-address scale across the full map, like WinOLS 2D overview.
    const bytesPerValue=(m.type.includes('32')?4:m.type.includes('16')?2:1);
    const start=Number(m.address)||0;
    const end=start+Math.max(0,values.length*bytesPerValue-1);
    ctx.fillStyle='rgba(235,240,255,.9)';
    ctx.fillText(`${hex(start)} · ${m.rows}×${m.cols} · ${values.length} points · vue 2D complète`,padL,15);
    const addrSteps=12;
    for(let i=0;i<=addrSteps;i++){
      const xx=padL+plotW*i/addrSteps;
      const addr=Math.round(start+(end-start)*i/addrSteps);
      ctx.fillStyle='rgba(220,230,255,.85)';
      ctx.save();
      ctx.translate(xx,c.height-8);
      ctx.rotate(-Math.PI/4);
      ctx.fillText(hex(addr),0,0);
      ctx.restore();
    }
  };

  // Keep table and 3D unchanged; 2D always uses the full flattened map trace.
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

  // Row selection is irrelevant in the complete WinOLS-like 2D overview.
  const hideRowControl=()=>{
    const control=document.getElementById('atlasRowControl');
    if(control)control.style.display='none';
  };
  hideRowControl();setTimeout(hideRowControl,200);setTimeout(hideRowControl,1000);

  const style=document.createElement('style');
  style.textContent='#twoDWrap{overflow:auto;background:#0610a8}#map2d{display:block;max-width:none}';
  document.head.appendChild(style);
  window.addEventListener('resize',()=>{if(mapMode==='2d')draw2D();});
})();
