(() => {
  'use strict';
  const button=document.createElement('button');
  button.type='button';
  button.className='streaming-float-jump';
  button.setAttribute('aria-label','Abrir Brazilly Cinema');
  button.title='Brazilly Cinema';
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="m10 9 5 3-5 3z"></path></svg>';
  button.addEventListener('click',()=>{
    if(typeof window.showScreen==='function')window.showScreen('streamingScreen');
  });
  document.body.append(button);
  document.getElementById('streamingExploreButton')?.addEventListener('click',()=>{
    if(typeof window.showScreen==='function')window.showScreen('streamingScreen');
  });
})();