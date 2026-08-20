// ATLAS Web — 2D = une seule ligne Y, comportement type WinOLS
(function(){
  'use strict';
  window.atlasOverlayRows = false;

  const previousDraw2D = window.draw2D;
  window.draw2D = function(z){
    window.atlasOverlayRows = false;
    return previousDraw2D(z);
  };

  function cleanControls(){
    const b=document.getElementById('atlasOverlayBtn');
    if(b) b.style.display='none';
    const label=document.querySelector('#atlasRowControl .muted');
    if(label) label.textContent='Ligne affichée';
  }

  const previousUpdate=window.atlasUpdateRowControl;
  if(typeof previousUpdate==='function'){
    window.atlasUpdateRowControl=function(){
      previousUpdate();
      window.atlasOverlayRows=false;
      cleanControls();
    };
  }

  document.addEventListener('DOMContentLoaded',cleanControls);
  cleanControls();
})();
