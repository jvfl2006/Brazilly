(() => {
'use strict';
const FILTERS={original:'none',cinema:'contrast(1.12) saturate(.88)',warm:'sepia(.22) saturate(1.18)',mono:'grayscale(1)',vivid:'saturate(1.45) contrast(1.08)',fade:'contrast(.9) saturate(.78) brightness(1.06)'};
let modal,canvas,ctx,image,currentFile=null,resolveEdit=null,paths=[],drawing=false,settings={brightness:100,contrast:100,saturation:100,warmth:0,filter:'original',ratio:'original',rotation:0,text:'',sticker:''};
const $=id=>modal?.querySelector('#'+id);
function ensureModal(){
 if(modal)return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='studio.css';document.head.append(link);
 modal=document.createElement('div');modal.className='brazilly-studio';modal.hidden=true;
 modal.innerHTML=`<div class="bs-backdrop" data-bs-close></div><section class="bs-panel" role="dialog" aria-modal="true" aria-labelledby="bs-title">
 <header class="bs-header"><div><span> BRAZILLY CREATIVE TOOLS </span><h2 id="bs-title">Brazilly Studio</h2><p>Edite sua foto antes de compartilhar.</p></div><button type="button" class="bs-close" data-bs-close aria-label="Fechar">×</button></header>
 <div class="bs-workspace"><div class="bs-preview-wrap"><canvas id="bs-canvas"></canvas><small>Prévia em tempo real · arquivo original preservado</small></div>
 <div class="bs-tools">
 <nav class="bs-tabs"><button type="button" data-tab="adjust" class="active">Ajustes</button><button type="button" data-tab="filters">Filtros</button><button type="button" data-tab="crop">Corte</button><button type="button" data-tab="text">Texto</button><button type="button" data-tab="draw">Desenho</button></nav>
 <section data-pane="adjust" class="bs-pane"><label>Brilho <output id="bs-brightness-value">100%</output><input id="bs-brightness" type="range" min="40" max="160" value="100"></label><label>Contraste <output id="bs-contrast-value">100%</output><input id="bs-contrast" type="range" min="40" max="160" value="100"></label><label>Saturação <output id="bs-saturation-value">100%</output><input id="bs-saturation" type="range" min="0" max="200" value="100"></label><label>Temperatura <output id="bs-warmth-value">0</output><input id="bs-warmth" type="range" min="-50" max="50" value="0"></label></section>
 <section data-pane="filters" class="bs-pane" hidden><div class="bs-filter-grid"><button type="button" data-filter="original" class="selected">Original</button><button type="button" data-filter="cinema">Cinema</button><button type="button" data-filter="warm">Quente</button><button type="button" data-filter="mono">Mono</button><button type="button" data-filter="vivid">Vibrante</button><button type="button" data-filter="fade">Fosco</button></div></section>
 <section data-pane="crop" class="bs-pane" hidden><label>Proporção<select id="bs-ratio"><option value="original">Original</option><option value="1:1">Quadrado · 1:1</option><option value="4:5">Retrato · 4:5</option><option value="16:9">Paisagem · 16:9</option></select></label><div class="bs-button-row"><button type="button" id="bs-rotate-left">↶ Girar 90°</button><button type="button" id="bs-rotate-right">↷ Girar 90°</button></div><p>O corte é centralizado e aplicado somente ao exportar.</p></section>
 <section data-pane="text" class="bs-pane" hidden><label>Texto sobre a foto<input id="bs-text" maxlength="100" placeholder="Escreva algo..."></label><label>Adesivo rápido<select id="bs-sticker"><option value="">Nenhum</option><option>❤️</option><option>🔥</option><option>✨</option><option>😂</option><option>⭐</option><option>🦋</option><option>🏍️</option></select></label><p>Texto e adesivo aparecem na prévia. O texto é posicionado na parte inferior.</p></section>
 <section data-pane="draw" class="bs-pane" hidden><label>Cor do pincel<input id="bs-draw-color" type="color" value="#ffffff"></label><label>Espessura<input id="bs-draw-size" type="range" min="2" max="28" value="7"></label><button type="button" id="bs-clear-draw">Limpar desenhos</button><p>Desenhe diretamente sobre a foto usando mouse ou toque.</p></section>
 </div></div>
 <footer class="bs-footer"><button type="button" class="bs-secondary" id="bs-reset">Redefinir</button><span id="bs-status" aria-live="polite"></span><div><button type="button" class="bs-secondary" data-bs-close>Cancelar</button><button type="button" class="bs-primary" id="bs-apply">Aplicar edição</button></div></footer>
 </section>`;
 document.body.append(modal);canvas=$('bs-canvas');ctx=canvas.getContext('2d');
 modal.querySelectorAll('[data-bs-close]').forEach(b=>b.addEventListener('click',cancel));
 modal.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{modal.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));modal.querySelectorAll('[data-pane]').forEach(x=>x.hidden=x.dataset.pane!==b.dataset.tab);}));
 ['brightness','contrast','saturation','warmth'].forEach(key=>$('#bs-'+key).addEventListener('input',e=>{settings[key]=Number(e.target.value);$('#bs-'+key+'-value').textContent=key==='warmth'?String(settings[key]):settings[key]+'%';render();}));
 modal.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{settings.filter=b.dataset.filter;modal.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render();}));
 $('#bs-ratio').addEventListener('change',e=>{settings.ratio=e.target.value;render();});
 $('#bs-rotate-left').addEventListener('click',()=>{settings.rotation=(settings.rotation+270)%360;render();});
 $('#bs-rotate-right').addEventListener('click',()=>{settings.rotation=(settings.rotation+90)%360;render();});
 $('#bs-text').addEventListener('input',e=>{settings.text=e.target.value;render();});
 $('#bs-sticker').addEventListener('change',e=>{settings.sticker=e.target.value;render();});
 $('#bs-clear-draw').addEventListener('click',()=>{paths=[];render();});
 $('#bs-reset').addEventListener('click',reset);
 $('#bs-apply').addEventListener('click',apply);
 canvas.addEventListener('pointerdown',e=>{drawing=true;canvas.setPointerCapture(e.pointerId);paths.push({color:$('#bs-draw-color').value,size:Number($('#bs-draw-size').value),points:[point(e)]});render();});
 canvas.addEventListener('pointermove',e=>{if(!drawing)return;paths[paths.length-1].points.push(point(e));render();});
 ['pointerup','pointercancel','lostpointercapture'].forEach(name=>canvas.addEventListener(name,()=>drawing=false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)cancel();});
}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};}
function reset(){settings={brightness:100,contrast:100,saturation:100,warmth:0,filter:'original',ratio:'original',rotation:0,text:'',sticker:''};paths=[];['brightness','contrast','saturation','warmth'].forEach(k=>{$('bs-'+k).value=settings[k];$('bs-'+k+'-value').textContent=k==='warmth'?'0':'100%';});$('#bs-ratio').value='original';$('#bs-text').value='';$('#bs-sticker').value='';modal.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='original'));render();}
function cropSize(w,h,ratio){if(ratio==='original')return{w,h};const [a,b]=ratio.split(':').map(Number),target=a/b,current=w/h;return current>target?{w:h*target,h}:{w,h:w/target};}
function render(){
 if(!image)return;const rotated=settings.rotation%180!==0,baseW=rotated?image.naturalHeight:image.naturalWidth,baseH=rotated?image.naturalWidth:image.naturalHeight,scale=Math.min(1000/baseW,850/baseH,1),w=Math.max(1,Math.round(baseW*scale)),h=Math.max(1,Math.round(baseH*scale)),crop=cropSize(w,h,settings.ratio);
 canvas.width=Math.max(1,Math.round(crop.w));canvas.height=Math.max(1,Math.round(crop.h));
 ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(settings.rotation*Math.PI/180);
 const rawW=image.naturalWidth*scale,rawH=image.naturalHeight*scale;
 ctx.filter='brightness('+settings.brightness+'%) contrast('+settings.contrast+'%) saturate('+settings.saturation+'%) '+(FILTERS[settings.filter]||'none');
 ctx.drawImage(image,-rawW/2,-rawH/2,rawW,rawH);ctx.restore();ctx.filter='none';
 if(settings.warmth){ctx.save();ctx.globalAlpha=Math.abs(settings.warmth)/260;ctx.fillStyle=settings.warmth>0?'#ff9d45':'#65a9ff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
 paths.forEach(path=>{if(!path.points.length)return;ctx.save();ctx.strokeStyle=path.color;ctx.lineWidth=path.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(path.points[0].x,path.points[0].y);path.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.restore();});
 if(settings.sticker){ctx.save();ctx.font=Math.round(canvas.width*.12)+'px sans-serif';ctx.textAlign='right';ctx.shadowColor='#000';ctx.shadowBlur=12;ctx.fillText(settings.sticker,canvas.width-18,Math.max(55,canvas.height*.17));ctx.restore();}
 if(settings.text){ctx.save();const size=Math.max(20,Math.round(canvas.width*.055));ctx.font='800 '+size+'px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineWidth=Math.max(3,size*.13);ctx.strokeStyle='#000b';ctx.fillStyle='#fff';ctx.shadowColor='#000a';ctx.shadowBlur=8;ctx.strokeText(settings.text,canvas.width/2,canvas.height-24,canvas.width-40);ctx.fillText(settings.text,canvas.width/2,canvas.height-24,canvas.width-40);ctx.restore();}
}
function cancel(){if(!modal||modal.hidden)return;modal.hidden=true;document.body.style.overflow='';currentFile=null;image=null;paths=[];if(resolveEdit){resolveEdit(null);resolveEdit=null;}}
function edit(file){ensureModal();if(!file?.type?.startsWith('image/'))return Promise.reject(new Error('O Brazilly Studio está disponível para fotos nesta primeira etapa.'));if(file.type==='image/gif')return Promise.reject(new Error('GIF animado ainda não pode ser editado sem perder a animação.'));return new Promise((resolve,reject)=>{currentFile=file;resolveEdit=resolve;reset();const url=URL.createObjectURL(file);image=new Image();image.onload=()=>{URL.revokeObjectURL(url);modal.hidden=false;document.body.style.overflow='hidden';render();};image.onerror=()=>{URL.revokeObjectURL(url);resolveEdit=null;reject(new Error('Não foi possível abrir esta imagem.'));};image.src=url;});}
function apply(){if(!currentFile||!canvas)return;const button=$('bs-apply');button.disabled=true;$('#bs-status').textContent='Preparando imagem...';canvas.toBlob(blob=>{button.disabled=false;if(!blob){$('#bs-status').textContent='Falha ao exportar a imagem.';return;}const base=currentFile.name.replace(/\.[^.]+$/,'')||'brazilly-foto';const result=new File([blob],base+'-editada.jpg',{type:'image/jpeg',lastModified:Date.now()});modal.hidden=true;document.body.style.overflow='';currentFile=null;image=null;const done=resolveEdit;resolveEdit=null;if(done)done(result);},'image/jpeg',.94);}
window.BrazillyStudio={edit};
})();