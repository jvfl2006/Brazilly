(() => {
'use strict';
const $ps=id=>document.getElementById(id);
const defaults={theme:'lofi',accent:'#9277ff',cover:'lofi-room',decor:'subtle',mascot:{emoji:'🐸',name:'Pingo',interactive:true},widgets:['mascot','quote','music','games','setup','countdown','links','interests','gallery','about'],quote:'',music:'',musicUrl:'',games:'',setup:'',countdownTitle:'',countdownDate:'',links:[]};
const allowed=['mascot','quote','music','games','setup','countdown','links','interests','gallery','about'],cache=new Map();
let editorSettings=null,activePublicId=null;
const clone=x=>JSON.parse(JSON.stringify(x));
function normalize(raw){const v={...clone(defaults),...(raw&&typeof raw==='object'?raw:{})};v.mascot={...defaults.mascot,...(v.mascot||{})};v.mascot.interactive=v.mascot.interactive!==false;v.decor=['none','subtle','cozy'].includes(v.decor)?v.decor:'subtle';v.widgets=Array.isArray(v.widgets)?[...new Set(v.widgets.filter(x=>allowed.includes(x)))]:[...defaults.widgets];v.accent=/^#[0-9a-f]{6}$/i.test(v.accent)?v.accent:defaults.accent;v.theme=['lofi','pixel','anime','scrapbook','aurora','midnight','sunset','forest','rose'].includes(v.theme)?v.theme:'lofi';v.cover=['lofi-room','pixel-room','anime-sky','scrapbook','aurora','nebula','ocean','sunset','forest','minimal'].includes(v.cover)?v.cover:'lofi-room';v.links=Array.isArray(v.links)?v.links.filter(x=>x&&typeof x.label==='string'&&typeof x.url==='string').slice(0,8):[];return v;}
async function load(id){if(cache.has(id))return clone(cache.get(id));const {data,error}=await db.from('profile_customizations').select('settings').eq('user_id',id).maybeSingle();if(error)throw error;const v=normalize(data?.settings);cache.set(id,v);return clone(v);}
function safeUrl(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;}
function card(title,icon,body){const n=el('article','profile-widget'),h=el('div','profile-widget-heading');h.append(el('span','profile-widget-icon',icon),el('h4','',title));n.append(h,body);return n;}
function widget(s,id,p,photos){const b=el('div','profile-widget-content');
 if(id==='mascot'){return null;}
 if(id==='quote'&&s.quote){b.append(el('blockquote','profile-quote','“'+s.quote+'”'));return card('Frase do momento','❝',b);}
 if(id==='music'&&s.music){b.append(el('strong','profile-widget-main',s.music));const u=safeUrl(s.musicUrl);if(u){const a=el('a','profile-widget-link','Abrir música ↗');a.href=u;a.target='_blank';a.rel='noopener noreferrer';b.append(a);}return card('Minha música','♫',b);}
 if(id==='games'&&s.games){b.append(el('p','',s.games));return card('Jogos favoritos','🎮',b);}
 if(id==='setup'&&s.setup){b.append(el('p','',s.setup));return card('Meu setup / hobbies','⚙',b);}
 if(id==='countdown'&&s.countdownDate){const d=new Date(s.countdownDate+'T00:00:00');if(!Number.isNaN(d.getTime())){const days=Math.ceil((d-new Date(new Date().toDateString()))/86400000);b.append(el('strong','profile-countdown-number',days<0?'Chegou!':days===0?'É hoje!':String(days)),el('span','profile-countdown-caption',days>0?'dias restantes':s.countdownTitle||''));return card(s.countdownTitle||'Contagem regressiva','⌛',b);}}
 if(id==='links'&&s.links.length){const list=el('div','profile-widget-links');s.links.forEach(x=>{const u=safeUrl(x.url);if(u){const a=el('a','profile-widget-link',x.label+' ↗');a.href=u;a.target='_blank';a.rel='noopener noreferrer';list.append(a);}});if(list.childElementCount){b.append(list);return card('Meus links','↗',b);}}
 if(id==='interests'&&p.interests?.length){const t=el('div','profile-widget-tags');p.interests.slice(0,12).forEach(x=>t.append(el('span','',x)));b.append(t);return card('Meus interesses','✧',b);}
 if(id==='about'&&p.bio){b.append(el('p','',p.bio));return card('Sobre mim','☻',b);}
 if(id==='gallery'&&photos.length){const g=el('div','profile-widget-gallery');photos.slice(0,6).forEach(u=>{const img=el('img');img.src=u;img.alt='Foto do perfil';img.loading='lazy';g.append(img);});b.append(g);return card('Minha galeria','▧',b);}
 return null;
}
async function photoUrls(p){if(p.photos?.length)return p.photos.map(x=>x.data).filter(Boolean);return (await Promise.all((p.photo_paths||[]).slice(0,6).map(async path=>{const {data,error}=await db.storage.from('profile-photos').createSignedUrl(path,3600);return error?null:data?.signedUrl||null;}))).filter(Boolean);}

let threeModulePromise=null;
function loadThree(){if(!threeModulePromise)threeModulePromise=import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');return threeModulePromise;}
function makeMascotModel(T,kind){
 const root=new T.Group(),body=new T.Group();root.add(body);
 const mat=(color,roughness=.82,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const palettes={ '🐸':['#69c982','#8ce6a1','#183b2a'], '🐱':['#d7a16d','#f2d4ad','#49362b'], '🦊':['#e77d38','#fff0d9','#67341f'], '🐼':['#f1f0e9','#24242b','#111111'], '🐉':['#58b8a1','#b6e8a9','#215b50'], '🤖':['#9da8bd','#e1e7f3','#4d5a75'], '🐢':['#75a96c','#b7cf79','#38543b'], '🦝':['#9b8b80','#e4d7c9','#292a32'], '🐧':['#e9f1f7','#4d6686','#172a40'], '🦖':['#78b95c','#c5e58c','#31542a'], '🐙':['#b77be0','#e4b6ff','#5b347e'], '🦦':['#9b6849','#d9b18a','#4c3025']};
 const colors=palettes[kind]||palettes['🐸'],primary=mat(colors[0]),light=mat(colors[1]),dark=mat(colors[2]),black=mat('#171923'),white=mat('#ffffff'),pink=mat('#e98c9d');
 const sphere=(parent,material,pos,scale)=>{const m=new T.Mesh(new T.SphereGeometry(1,24,18),material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const cone=(parent,material,pos,scale,rot=[0,0,0])=>{const m=new T.Mesh(new T.ConeGeometry(1,1.65,20),material);m.position.set(...pos);m.scale.set(...scale);m.rotation.set(...rot);m.castShadow=true;parent.add(m);return m;};
 const bodyMesh=sphere(body,primary,[0,0.83,0],[.53,.66,.39]);
 sphere(body,light,[0,.69,.365],[.34,.42,.09]);
 const head=new T.Group();head.position.set(0,1.58,0);body.add(head);
 sphere(head,primary,[0,0,0],[.62,.52,.49]);
 const eyeY=.1,eyeZ=.43;
 for(const side of [-1,1]){sphere(head,white,[side*.235,eyeY,eyeZ],[.145,.17,.075]);sphere(head,black,[side*.235,eyeY-.015,eyeZ+.066],[.072,.095,.04]);sphere(head,white,[side*.255,eyeY+.025,eyeZ+.1],[.025,.03,.015]);}
 sphere(head,dark,[0,-.12,.485],[.07,.045,.035]);
 const limbs=[];
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*.43,1.05,0);body.add(arm);sphere(arm,primary,[side*.1,-.18,.02],[.17,.34,.17]);sphere(arm,light,[side*.15,-.39,.11],[.15,.12,.14]);limbs.push(arm);
  const leg=new T.Group();leg.position.set(side*.27,.45,0);body.add(leg);sphere(leg,primary,[0,-.12,.04],[.2,.3,.22]);sphere(leg,light,[0,-.29,.16],[.23,.1,.29]);limbs.push(leg);
 }
 // Species-specific silhouette details
 if(kind==='🐱'||kind==='🦊'||kind==='🐼'||kind==='🦝'){for(const side of [-1,1]){cone(head,primary,[side*.38,.43,0],[.2,.34,.2],[0,0,-side*.18]);if(kind==='🐱'||kind==='🦊')cone(head,light,[side*.38,.4,.13],[.095,.2,.09],[0,0,-side*.18]);}}
 if(kind==='🐸'){sphere(head,primary,[-.29,.42,.06],[.2,.22,.2]);sphere(head,primary,[.29,.42,.06],[.2,.22,.2]);}
 if(kind==='🐧'){sphere(body,light,[0,.95,.37],[.36,.5,.08]);cone(head,mat('#f2a64a'),[0,-.13,.56],[.13,.1,.13],[Math.PI/2,0,0]);}
 if(kind==='🐢'){sphere(body,mat('#66864d'),[0,.94,-.2],[.59,.57,.48]);for(let i=0;i<3;i++)sphere(body,mat('#9ab96c'),[-.25+i*.25,1.1,-.55],[.12,.12,.05]);}
 if(kind==='🐉'||kind==='🦖'){for(const side of [-1,1])cone(head,light,[side*.32,.42,-.02],[.13,.31,.13],[0,0,-side*.42]);if(kind==='🐉'){for(const side of [-1,1]){const wing=new T.Mesh(new T.ConeGeometry(.45,.9,3),light);wing.position.set(side*.55,1.25,-.35);wing.rotation.z=side*-1.1;body.add(wing);}}}
 if(kind==='🤖'){sphere(head,mat('#64748b'),[0,.48,0],[.08,.19,.08]);for(const side of [-1,1])sphere(head,mat('#56d9ed'),[side*.26,.08,.47],[.09,.09,.05]);}
 if(kind==='🐙'){for(let i=0;i<8;i++){const a=i*Math.PI/4,tent=sphere(body,primary,[Math.cos(a)*.47,.42+Math.sin(a)*.08,Math.sin(a)*.34],[.13,.43,.13]);tent.rotation.z=-Math.cos(a)*.7;}}
 if(kind==='🦦'){sphere(head,light,[0,-.17,.38],[.27,.18,.15]);for(const side of [-1,1])sphere(head,primary,[side*.45,.35,0],[.16,.16,.13]);}
 // Tail and a soft ground shadow
 const tail=new T.Group();tail.position.set(0,.72,-.35);body.add(tail);sphere(tail,kind==='🦊'||kind==='🐱'||kind==='🦝'?light:primary,[0,0,-.35],[.18,.2,.55]);
 const shadow=new T.Mesh(new T.CircleGeometry(.65,32),new T.MeshBasicMaterial({color:'#111827',transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;root.add(shadow);
 root.userData={head,limbs,tail,body};return root;
}
function mount3DMascot(stage,settings){
 let stopped=false,renderer=null,raf=0,resize=null,observer=null,three=null;
 const canvas=document.createElement('canvas');canvas.className='profile-mascot-3d-canvas';canvas.setAttribute('aria-label','Mascote 3D animado');stage.append(canvas);
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(raf);resize?.disconnect();observer?.disconnect();if(renderer){renderer.dispose();renderer.forceContextLoss();}canvas.remove();};
 loadThree().then(T=>{
  if(stopped||!canvas.isConnected)return;three=T;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,100);camera.position.set(0,2.65,7.7);camera.lookAt(0,1.05,0);
  renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=false;
  scene.add(new T.HemisphereLight('#fff4df','#48516d',2.1));const key=new T.DirectionalLight('#fff0d7',3.1);key.position.set(-3,6,5);scene.add(key);const rim=new T.DirectionalLight('#9ac8ff',1.3);rim.position.set(4,3,-4);scene.add(rim);
  const floor=new T.Mesh(new T.PlaneGeometry(12,8),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=0;scene.add(floor);
  const mascot=makeMascotModel(T,settings.emoji);scene.add(mascot);mascot.scale.setScalar(settings.emoji==='🐙'?.82:1);
  const clock=new T.Clock(),state={x:-9.2,z:0,direction:1,mode:'walk',until:0,pet:0,nextPause:3.8},pointer={x:0,y:0};
  const resizeToStage=()=>{const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  resize=new ResizeObserver(resizeToStage);resize.observe(stage);resizeToStage();
  const hit=()=>{state.mode='happy';state.until=clock.elapsedTime+2.2;state.pet=clock.elapsedTime;};
  canvas.addEventListener('pointerdown',hit);canvas.style.pointerEvents=settings.interactive?'auto':'none';canvas.style.cursor=settings.interactive?'pointer':'default';
  const animate=()=>{if(stopped||!canvas.isConnected){stop();return;}raf=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),t=clock.elapsedTime,u=mascot.userData;
   if(state.mode==='happy'&&t>state.until){state.mode='walk';state.nextPause=t+3+Math.random()*4;}
   if(state.mode==='walk'){state.x+=state.direction*dt*1.55;if(state.x>9.2){state.x=9.2;state.direction=-1;state.mode='idle';state.until=t+1.1;}if(state.x< -9.2){state.x=-9.2;state.direction=1;state.mode='idle';state.until=t+1.1;}if(t>state.nextPause){state.mode='idle';state.until=t+1.1+Math.random()*1.8;}}
   else if(state.mode==='idle'&&t>state.until){state.mode='walk';state.nextPause=t+3+Math.random()*5;}
   mascot.position.set(state.x,.04+Math.abs(Math.sin(t*7))*.025,Math.sin(t*.55)*.32);mascot.rotation.y=state.direction>0?Math.PI*.08:-Math.PI*.08;
   const walking=state.mode==='walk',swing=walking?Math.sin(t*7.5)*.48:Math.sin(t*2)*.05;
   u.limbs.forEach((limb,i)=>{limb.rotation.x=swing*(i%2===0?1:-1);});
   u.head.rotation.y=Math.sin(t*.9)*.12+pointer.x*.16+(state.mode==='idle'?Math.sin(t*1.8)*.18:0);u.head.rotation.x=Math.sin(t*1.3)*.045-pointer.y*.07;
   u.tail.rotation.x=Math.sin(t*4)*.2;u.tail.rotation.y=Math.sin(t*2.4)*.22;
   if(state.mode==='happy'){mascot.position.y=.08+Math.abs(Math.sin((t-state.pet)*12))*.22;u.head.rotation.z=Math.sin(t*9)*.12;}
   renderer.render(scene,camera);
  };
  observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!raf)animate();});observer.observe(stage);
  if(settings.interactive){stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width-.5)*2;pointer.y=((e.clientY-r.top)/r.height-.5)*2;},{passive:true});}
  if(!('IntersectionObserver'in window))animate();
 }).catch(err=>{console.warn('Não foi possível carregar o mascote 3D:',err);canvas.remove();const fallback=document.createElement('div');fallback.className='profile-mascot-3d-fallback';fallback.textContent='Mascote 3D indisponível neste navegador';stage.append(fallback);});
 return stop;
}
async function render(root,p,s){if(!root||!p)return;root.replaceChildren();const shell=el('section','profile-custom-shell theme-'+s.theme+' decor-'+s.decor);shell.style.setProperty('--profile-accent',s.accent);const cover=el('div','profile-custom-cover cover-'+s.cover);if(s.decor!=='none')cover.append(el('span','profile-cover-sparkle sparkle-one','✦'),el('span','profile-cover-sparkle sparkle-two','✧'));const photos=await photoUrls(p),identity=el('div','profile-custom-identity'),avatar=el('div','profile-custom-avatar');if(photos[0])avatar.style.backgroundImage='url("'+photos[0].replace(/["\\\\]/g,'')+'")';else avatar.textContent=(p.display_name||p.name||'B').trim().slice(0,1).toUpperCase();identity.append(avatar,el('div','profile-custom-name',p.display_name||p.name||'Seu espaço'));if(s.widgets.includes('mascot')){const stage=el('div','profile-mascot-3d-stage');stage.setAttribute('role','img');stage.setAttribute('aria-label',(s.mascot.name||'Mascote')+', personagem 3D animado');cover.append(stage);mount3DMascot(stage,s.mascot);const name=el('span','profile-mascot-name',s.mascot.name||'Mascote');cover.append(name);}shell.append(cover,identity);const grid=el('div','profile-widgets-grid');s.widgets.filter(id=>id!=='mascot').forEach(id=>{const w=widget(s,id,p,photos);if(w)grid.append(w);});if(!grid.childElementCount)grid.append(el('p','profile-studio-empty','Seu espaço está minimalista. Você pode adicionar widgets quando quiser.'));shell.append(grid);root.append(shell);}
async function renderOwn(){if(!currentUser||!currentProfile)return;try{const s=await load(currentUser.id);currentProfile.profileCustomization=s;await render($ps('profileCustomizationPreview'),currentProfile,s);}catch(e){console.warn(e);$ps('profileCustomizationPreview').textContent='Não foi possível carregar seu espaço personalizado.';}}
async function renderPublic(p){if(!p?.user_id)return;activePublicId=p.user_id;try{const s=await load(p.user_id);if(activePublicId!==p.user_id)return;const target=$ps('profileDetailContent');if(!target)return;target.querySelector('.profile-public-customization')?.remove();const wrap=el('section','profile-public-customization');await render(wrap,p,s);if(activePublicId===p.user_id)target.append(wrap);}catch(e){console.warn('Erro ao carregar personalização pública:',e);}}
function fill(s){editorSettings=normalize(s);$ps('psTheme').value=editorSettings.theme;$ps('psAccent').value=editorSettings.accent;$ps('psCover').value=editorSettings.cover;$ps('psDecor').value=editorSettings.decor;$ps('psMascotInteractive').checked=editorSettings.mascot.interactive!==false;$ps('psMascot').value=editorSettings.mascot.emoji;$ps('psMascotName').value=editorSettings.mascot.name;$ps('psQuote').value=editorSettings.quote;$ps('psMusic').value=editorSettings.music;$ps('psMusicUrl').value=editorSettings.musicUrl;$ps('psGames').value=editorSettings.games;$ps('psSetup').value=editorSettings.setup;$ps('psCountdownTitle').value=editorSettings.countdownTitle;$ps('psCountdownDate').value=editorSettings.countdownDate;$ps('psLinks').value=editorSettings.links.map(x=>x.label+' | '+x.url).join('\n');document.querySelectorAll('[data-ps-widget]').forEach(x=>x.checked=editorSettings.widgets.includes(x.dataset.psWidget));order();}
function order(){const root=$ps('psWidgetOrder');root.replaceChildren();if(!editorSettings.widgets.length){root.append(el('small','field-note','Nenhum widget ativado.'));return;}editorSettings.widgets.forEach((id,i)=>{const label=document.querySelector('[data-ps-widget="'+id+'"]')?.parentElement?.textContent?.trim()||id,row=el('div','profile-studio-order-row'),controls=el('div');row.append(el('span','',label));[['↑',-1],['↓',1]].forEach(([txt,d])=>{const b=el('button','profile-studio-order-button',txt);b.type='button';b.disabled=i+d<0||i+d>=editorSettings.widgets.length;b.addEventListener('click',()=>{const a=[...editorSettings.widgets];[a[i],a[i+d]]=[a[i+d],a[i]];editorSettings.widgets=a;order();});controls.append(b);});row.append(controls);root.append(row);});}
$ps('openProfileStudio')?.addEventListener('click',async()=>{if(!currentUser||!currentProfile){alert('Entre na sua conta para personalizar seu perfil.');return;}try{fill(await load(currentUser.id));$ps('psStatus').textContent='';$ps('profileStudioModal').hidden=false;}catch(e){alert('Não foi possível abrir o editor: '+e.message);}});
document.querySelectorAll('[data-ps-widget]').forEach(x=>x.addEventListener('change',()=>{if(!editorSettings)return;const id=x.dataset.psWidget;editorSettings.widgets=x.checked?[...editorSettings.widgets.filter(y=>y!==id),id]:editorSettings.widgets.filter(y=>y!==id);order();}));
$ps('profileStudioForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!currentUser||!editorSettings)return;const btn=$ps('saveProfileStudio'),status=$ps('psStatus');btn.disabled=true;status.textContent='Salvando...';try{const links=$ps('psLinks').value.split('\n').map(line=>{const a=line.split('|');return{label:(a.shift()||'').trim().slice(0,50),url:a.join('|').trim().slice(0,500)};}).filter(x=>x.label&&safeUrl(x.url)).slice(0,8);const s=normalize({theme:$ps('psTheme').value,accent:$ps('psAccent').value,cover:$ps('psCover').value,decor:$ps('psDecor').value,mascot:{emoji:$ps('psMascot').value,name:$ps('psMascotName').value.trim().slice(0,24)||'Mascote',interactive:$ps('psMascotInteractive').checked},widgets:editorSettings.widgets,quote:$ps('psQuote').value.trim(),music:$ps('psMusic').value.trim(),musicUrl:$ps('psMusicUrl').value.trim(),games:$ps('psGames').value.trim(),setup:$ps('psSetup').value.trim(),countdownTitle:$ps('psCountdownTitle').value.trim(),countdownDate:$ps('psCountdownDate').value,links});const {error}=await db.from('profile_customizations').upsert({user_id:currentUser.id,settings:s,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;cache.set(currentUser.id,s);currentProfile.profileCustomization=s;await render($ps('profileCustomizationPreview'),currentProfile,s);status.textContent='Seu espaço foi salvo!';setTimeout(()=>$ps('profileStudioModal').hidden=true,500);}catch(e){status.textContent='Não foi possível salvar: '+e.message;}finally{btn.disabled=false;}});
document.addEventListener('brazilly:screen-changed',e=>{if(e.detail==='profileScreen')renderOwn();});
document.addEventListener('brazilly:profile-opened',e=>renderPublic(e.detail));
document.addEventListener('click',e=>{if(e.target.closest('[data-close-modal="profileStudioModal"]'))$ps('profileStudioModal').hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$ps('profileStudioModal')&&!$ps('profileStudioModal').hidden)$ps('profileStudioModal').hidden=true;});
})();