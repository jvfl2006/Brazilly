(() => {
'use strict';

const $ps = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const defaultItems = () => [
  {id:'sofa-main',type:'sofa',x:-2.35,z:1.05,rotation:0},
  {id:'desk-main',type:'desk',x:1.45,z:-1.75,rotation:0},
  {id:'shelf-main',type:'shelf',x:4.05,z:-2.25,rotation:0},
  {id:'plant-main',type:'plant',x:-4.2,z:-1.8,rotation:0},
  {id:'lamp-main',type:'lamp',x:2.8,z:-.55,rotation:0},
  {id:'frame-main',type:'frame',x:-.1,z:-3.12,rotation:0},
  {id:'radio-main',type:'radio',x:-1.05,z:.05,rotation:0},
  {id:'rug-main',type:'rug',x:-.15,z:1.25,rotation:0}
];
const defaults = {
  theme:'lofi',accent:'#d8a879',
  room:{time:'sunset',items:defaultItems()},
  quote:'',music:'',musicUrl:'',games:'',setup:'',countdownTitle:'',countdownDate:'',links:[]
};
const themeNames = ['lofi','pixel','anime','scrapbook','aurora','midnight','sunset','forest','rose'];
const timeNames = ['dawn','day','sunset','night'];
const itemTypes = ['sofa','desk','shelf','plant','lamp','frame','radio','rug','beanbag','poster','speaker','calendar','board'];
const itemLabels = {sofa:'Sofá',desk:'Escrivaninha',shelf:'Estante',plant:'Planta',lamp:'Luminária',frame:'Quadro',radio:'Vitrola',rug:'Tapete',beanbag:'Pufe',poster:'Pôster',speaker:'Caixa de som',calendar:'Calendário',board:'Mural de links'};
const cache = new Map();
const cleanupByRoot = new WeakMap();
let editorSettings = null;
let activePublicId = null;
let threePromise = null;

function normalize(raw) {
  const value = {...clone(defaults),...(raw && typeof raw === 'object' ? raw : {})};
  value.theme = themeNames.includes(value.theme) ? value.theme : 'lofi';
  value.accent = /^#[0-9a-f]{6}$/i.test(value.accent) ? value.accent : defaults.accent;
  const room = value.room && typeof value.room === 'object' ? value.room : {};
  const items = Array.isArray(room.items) ? room.items : defaultItems();
  value.room = {
    time:timeNames.includes(room.time) ? room.time : 'sunset',
    items:items.filter(item => item && itemTypes.includes(item.type)).slice(0,24).map((item,index) => ({
      id:String(item.id || ('furniture-'+index)).slice(0,64),
      type:item.type,
      x:Math.max(-4.7,Math.min(4.7,Number(item.x)||0)),
      z:Math.max(-3.55,Math.min(3.0,Number(item.z)||0)),
      rotation:Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0
    }))
  };
  if(!value.room.items.length)value.room.items=defaultItems();
  delete value.mascot;delete value.cover;delete value.decor;delete value.widgets;
  value.quote = String(value.quote||'').slice(0,180);
  value.music = String(value.music||'').slice(0,100);
  value.musicUrl = String(value.musicUrl||'').slice(0,500);
  value.games = String(value.games||'').slice(0,180);
  value.setup = String(value.setup||'').slice(0,220);
  value.links = Array.isArray(value.links) ? value.links.filter(x => x && typeof x.label==='string' && typeof x.url==='string').slice(0,8) : [];
  return value;
}
async function load(id) {
  if(cache.has(id))return clone(cache.get(id));
  const {data,error}=await db.from('profile_customizations').select('settings').eq('user_id',id).maybeSingle();
  if(error)throw error;
  const value=normalize(data?.settings);
  cache.set(id,value);
  return clone(value);
}
function safeUrl(value) {
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}
  catch{return null;}
}
function element(tag,className,text) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}
function loadThree() {
  if(!threePromise)threePromise=import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
  return threePromise;
}
async function photoUrls(profile) {
  if(profile.photos?.length)return profile.photos.map(item=>item.data).filter(Boolean).slice(0,8);
  const paths=(profile.photo_paths||[]).slice(0,8);
  return (await Promise.all(paths.map(async path=>{
    const {data,error}=await db.storage.from('profile-photos').createSignedUrl(path,3600);
    return error?null:data?.signedUrl||null;
  }))).filter(Boolean);
}
function makeRoomPalette(theme,time) {
  const palettes = {
    lofi:{wall:'#bda38b',side:'#a58d7d',floor:'#765648',trim:'#493a35',wood:'#8b6049',fabric:'#56717a',accent:'#d8a879',plant:'#668b68',sky:'#e7aa82'},
    pixel:{wall:'#78979a',side:'#5f7c83',floor:'#a77b5b',trim:'#394b55',wood:'#76513f',fabric:'#537b88',accent:'#f0d17a',plant:'#6f9b70',sky:'#9fcbd4'},
    anime:{wall:'#c0bfd9',side:'#a4a8c9',floor:'#80677f',trim:'#56516f',wood:'#98718a',fabric:'#819cbd',accent:'#f6b6d0',plant:'#75a78b',sky:'#f2b6c5'},
    scrapbook:{wall:'#d5c5ae',side:'#c3b09e',floor:'#a17e67',trim:'#79645a',wood:'#987358',fabric:'#b18a92',accent:'#d99da8',plant:'#7b986e',sky:'#edc6a3'},
    aurora:{wall:'#39455f',side:'#2d3854',floor:'#45415b',trim:'#252c42',wood:'#65506e',fabric:'#526a87',accent:'#b7a2ff',plant:'#6b9b8a',sky:'#7184bd'},
    midnight:{wall:'#292f47',side:'#20263b',floor:'#39334a',trim:'#191e31',wood:'#55445b',fabric:'#414f70',accent:'#9d9bff',plant:'#537e78',sky:'#252e55'},
    sunset:{wall:'#d9a69b',side:'#ba8d91',floor:'#8e6058',trim:'#634750',wood:'#9c6652',fabric:'#8d6575',accent:'#ffd18a',plant:'#7d9270',sky:'#f1a77f'},
    forest:{wall:'#819181',side:'#64796e',floor:'#665b49',trim:'#384c40',wood:'#755b3e',fabric:'#526d5a',accent:'#d0c28a',plant:'#72996d',sky:'#9ab79b'},
    rose:{wall:'#bd91ad',side:'#997894',floor:'#6f4d70',trim:'#48324e',wood:'#895c79',fabric:'#805d88',accent:'#f5a9d5',plant:'#799578',sky:'#e4a2c7'}
  };
  const palette={...(palettes[theme]||palettes.lofi)};
  const lighting={
    dawn:{sky:'#d7b7c7',ambient:'#f2d7dd',key:'#ffd9ba',intensity:1.8},
    day:{sky:'#9fcbdc',ambient:'#e7f3ff',key:'#fff1d8',intensity:2.25},
    sunset:{sky:palette.sky,ambient:'#ffe3ca',key:'#ffc18d',intensity:1.7},
    night:{sky:'#202a50',ambient:'#9cb3e8',key:'#9cb5ff',intensity:1.15}
  };
  return {...palette,...lighting[time]};
}
function makeScene(T,renderer,stage,settings,profile,photos) {
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(38,1,.1,100);
  const world=new T.Group();scene.add(world);
  const roomRoot=new T.Group();world.add(roomRoot);
  const furnitureRoot=new T.Group();world.add(furnitureRoot);
  const materials={};
  const material=(name,color,roughness=.86,metalness=0)=>{
    if(!materials[name])materials[name]=new T.MeshStandardMaterial({color,roughness,metalness});
    return materials[name];
  };
  const box=(parent,name,pos,size,mat,opts={})=>{
    const mesh=new T.Mesh(new T.BoxGeometry(size[0],size[1],size[2]),mat);
    mesh.position.set(pos[0],pos[1],pos[2]);
    mesh.castShadow=opts.shadow!==false;
    mesh.receiveShadow=opts.receive!==false;
    if(opts.rotation)mesh.rotation.set(...opts.rotation);
    parent.add(mesh);
    return mesh;
  };
  const sphere=(parent,pos,size,mat,segments=18)=>{
    const mesh=new T.Mesh(new T.SphereGeometry(1,segments,Math.max(8,Math.round(segments*.7))),mat);
    mesh.position.set(pos[0],pos[1],pos[2]);mesh.scale.set(size[0],size[1],size[2]);
    mesh.castShadow=true;parent.add(mesh);return mesh;
  };
  const cylinder=(parent,pos,radii,height,mat,segments=20)=>{
    const mesh=new T.Mesh(new T.CylinderGeometry(radii[0],radii[1],height,segments),mat);
    mesh.position.set(pos[0],pos[1],pos[2]);mesh.castShadow=true;parent.add(mesh);return mesh;
  };
  const palette=makeRoomPalette(settings.theme,settings.room.time);
  const mats={
    wall:material('wall',palette.wall),side:material('side',palette.side),floor:material('floor',palette.floor),
    trim:material('trim',palette.trim),wood:material('wood',palette.wood),fabric:material('fabric',palette.fabric),
    accent:material('accent',settings.accent),plant:material('plant',palette.plant),
    dark:material('dark','#252b36'),cream:material('cream','#f2dfc4'),
    metal:material('metal','#68717c',.36,.62),screen:material('screen','#77b5c4',.3,.12),
    glass:material('glass',palette.sky,.24,.04),bookA:material('bookA','#c57b69'),
    bookB:material('bookB','#7d91b2'),bookC:material('bookC','#d4b46e')
  };
  const ground=box(roomRoot,'floor',[0,-.16,0],[10.8,.28,7.6],mats.floor,{receive:true});
  for(let i=0;i<15;i++){
    const z=-3.55+i*.51;
    box(roomRoot,'floorboard',[0,.001,z],[10.72,.018,.018],i%2?mats.trim:mats.wood,{shadow:false,receive:false});
  }
  box(roomRoot,'back-wall',[0,2.94,-3.88],[10.8,6.0,.22],mats.wall);
  box(roomRoot,'left-wall',[-5.38,2.94,0],[.22,6,7.8],mats.side);
  box(roomRoot,'back-baseboard',[0,.16,-3.73],[10.65,.25,.08],mats.trim);
  box(roomRoot,'left-baseboard',[-5.23,.16,0],[.08,.25,7.5],mats.trim);
  // Window, skyline and exterior ambience.
  const windowGroup=new T.Group();windowGroup.position.set(-2.35,2.7,-3.73);roomRoot.add(windowGroup);
  const skyMat=new T.MeshBasicMaterial({color:palette.sky});
  box(windowGroup,'window-sky',[0,0,-.045],[2.65,2.1,.07],skyMat,{shadow:false,receive:false});
  const outsideMat=new T.MeshStandardMaterial({color:palette.sky,roughness:1});
  for(let i=0;i<9;i++){
    const h=.35+(i%4)*.29,x=-1.22+i*.3;
    box(windowGroup,'city',[x,-.87+h/2,-.005],[.22,h,.08],outsideMat,{shadow:false,receive:false});
    for(let j=0;j<2;j++)box(windowGroup,'window-light',[x-.05+j*.09,-.87+h*.45,-.052],[.035,.045,.012],mats.cream,{shadow:false,receive:false});
  }
  const sun=sphere(windowGroup,[.82,.64,.02],[.2,.2,.08],new T.MeshBasicMaterial({color:palette.key}),24);
  for(const x of [-1.42,1.42])box(windowGroup,'window-frame',[x,0,.08],[.12,2.32,.18],mats.wood);
  for(const y of [-1.08,1.08])box(windowGroup,'window-frame',[0,y,.08],[2.95,.12,.18],mats.wood);
  box(windowGroup,'window-cross',[0,0,.1],[.055,2.12,.12],mats.wood);
  box(windowGroup,'window-cross',[0,0,.11],[2.65,.055,.12],mats.wood);
  // Soft rug and fixed room accents.
  const ceilingGlow=new T.PointLight(palette.key,1.2,14);ceilingGlow.position.set(0,4.6,0);roomRoot.add(ceilingGlow);
  const lampGlow=new T.PointLight('#ffd5a0',1.1,7);lampGlow.position.set(2.8,2.5,-.55);roomRoot.add(lampGlow);
  const ambient=new T.HemisphereLight(palette.ambient,palette.trim,1.5);scene.add(ambient);
  const keyLight=new T.DirectionalLight(palette.key,palette.intensity);keyLight.position.set(-4,8,5);keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.camera.left=-8;keyLight.shadow.camera.right=8;keyLight.shadow.camera.top=8;keyLight.shadow.camera.bottom=-8;scene.add(keyLight);
  const fill=new T.DirectionalLight('#a6c9ff',.55);fill.position.set(5,4,-3);scene.add(fill);
  const dustGeometry=new T.BufferGeometry(),dustPositions=new Float32Array(75*3);
  for(let i=0;i<75;i++){dustPositions[i*3]=(Math.random()-.5)*9;dustPositions[i*3+1]=.5+Math.random()*3.5;dustPositions[i*3+2]=(Math.random()-.5)*5;}
  dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));
  const dust=new T.Points(dustGeometry,new T.PointsMaterial({color:settings.accent,size:.025,transparent:true,opacity:.34,depthWrite:false}));roomRoot.add(dust);
  const itemGroups=new Map();
  const widgetFor={sofa:'about',desk:'setup',shelf:'games',plant:'interests',lamp:'quote',frame:'gallery',radio:'music',speaker:'music',poster:'gallery',beanbag:'about',rug:'about',calendar:'countdown',board:'links'};
  function addFurniture(item){
    const g=new T.Group();g.position.set(item.x,0,item.z);g.rotation.y=item.rotation||0;g.userData.itemId=item.id;furnitureRoot.add(g);
    const wood=mats.wood,trim=mats.trim,fabric=mats.fabric,cream=mats.cream,metal=mats.metal;
    if(item.type==='sofa'||item.type==='beanbag'){
      if(item.type==='sofa'){
        box(g,'sofa-seat',[0,.48,0],[1.9,.48,1.0],fabric);
        box(g,'sofa-back',[0,1.02,-.39],[1.95,.92,.28],fabric);
        for(const x of [-.91,.91])box(g,'sofa-arm',[x,.73,.08],[.24,.7,.92],mats.wood);
        for(const x of [-.52,.52]){box(g,'pillow',[x,.83,.13],[.54,.34,.18],mats.cream);box(g,'pillow-accent',[x,.84,.23],[.38,.22,.035],mats.accent);}
        for(const x of [-.72,.72])for(const z of [-.34,.34])cylinder(g,[x,.14,z],[.07,.07],.26,trim,12);
      }else{
        sphere(g,[0,.43,0],[.78,.48,.72],fabric,24);
        sphere(g,[0,.76,-.22],[.65,.42,.42],mats.cream,24);
      }
    }else if(item.type==='desk'){
      box(g,'desk-top',[0,1.02,0],[2.0,.14,.92],wood);
      for(const x of [-.82,.82])for(const z of [-.32,.32])box(g,'desk-leg',[x,.52,z],[.1,1,.1],trim);
      box(g,'monitor-base',[0,1.15,-.18],[.58,.06,.36],metal);
      box(g,'monitor-stand',[0,1.42,-.26],[.09,.52,.09],metal);
      box(g,'monitor',[0,1.83,-.28],[1.05,.72,.12],trim);
      box(g,'monitor-screen',[0,1.84,-.205],[.91,.58,.018],mats.screen,{shadow:false});
      box(g,'keyboard',[0,1.12,.2],[.72,.045,.25],mats.dark);
      box(g,'notebook',[.69,1.12,.18],[.3,.06,.24],mats.bookB);
      sphere(g,[-.68,1.18,.16],[.1,.1,.1],mats.cream);
    }else if(item.type==='shelf'){
      box(g,'shelf-back',[0,1.35,-.12],[1.18,2.55,.12],trim);
      for(const y of [.16,.83,1.51,2.2])box(g,'shelf-board',[0,y,0],[1.28,.09,.62],wood);
      for(let level=0;level<3;level++)for(let b=0;b<4;b++){
        const colors=[mats.bookA,mats.bookB,mats.bookC];
        box(g,'book',[-.43+b*.27,.42+level*.68,.08],[.18,.42+(b%2)*.13,.35],colors[(b+level)%3]);
      }
    }else if(item.type==='plant'){
      cylinder(g,[0,.27,0],[.27,.34],.48,mats.bookA,18);
      cylinder(g,[0,.53,0],[.3,.29],.07,trim,18);
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const leaf=sphere(g,[Math.cos(a)*.25,.92+(i%3)*.12,Math.sin(a)*.22],[.12,.43,.13],mats.plant,14);leaf.rotation.z=-Math.cos(a)*.45;leaf.rotation.x=Math.sin(a)*.3;}
      cylinder(g,[0,.94,0],[.045,.05],.85,mats.plant,10);
    }else if(item.type==='lamp'){
      cylinder(g,[0,.12,0],[.25,.3],.2,trim,18);
      cylinder(g,[0,.83,0],[.035,.045],1.35,metal,12);
      const shade=new T.Mesh(new T.ConeGeometry(.36,.5,24,1,true),mats.accent);shade.position.set(0,1.55,0);shade.rotation.x=Math.PI;g.add(shade);
      sphere(g,[0,1.36,0],[.13,.13,.13],mats.cream,12);
    }else if(item.type==='frame'||item.type==='poster'||item.type==='calendar'||item.type==='board'){
      box(g,'frame-wood',[0,2.25,0],[1.18,.9,.12],wood);
      const paperMat=item.type==='poster'?mats.accent:cream;
      box(g,'frame-paper',[0,2.25,.075],[1.0,.72,.025],paperMat,{shadow:false});
      if(item.type==='calendar'){
        box(g,'calendar-header',[0,2.52,.105],[.94,.12,.025],mats.bookA,{shadow:false});
        for(let row=0;row<2;row++)for(let col=0;col<4;col++)box(g,'calendar-day',[-.34+col*.22,2.31-row*.17,.11],[.12,.08,.018],(row+col)%3===0?mats.accent:mats.bookB,{shadow:false});
        for(const x of [-.22,.22])cylinder(g,[x,2.73,.09],[.035,.035],.09,metal,10);
      }else if(item.type==='board'){
        box(g,'board-note',[-.23,2.33,.105],[.32,.28,.028],mats.bookB,{shadow:false});
        box(g,'board-note',[.22,2.18,.11],[.35,.22,.028],mats.bookA,{shadow:false});
        sphere(g,[-.23,2.49,.14],[.045,.045,.035],mats.accent,10);
        sphere(g,[.22,2.31,.14],[.045,.045,.035],mats.accent,10);
      }else if(item.type==='frame'){
        const photoMaterial=new T.MeshBasicMaterial({color:'#ffffff'});
        const photoPlane=new T.Mesh(new T.PlaneGeometry(.76,.54),photoMaterial);photoPlane.position.set(0,2.25,.112);g.add(photoPlane);
        if(photos[0])new T.TextureLoader().load(photos[0],texture=>{texture.colorSpace=T.SRGBColorSpace;photoMaterial.map=texture;photoMaterial.needsUpdate=true;},undefined,()=>{});
      }else{
        sphere(g,[0,2.28,.11],[.26,.26,.025],mats.bookB,12);
      }
    }else if(item.type==='radio'||item.type==='speaker'){
      box(g,'radio-body',[0,.68,0],[1.05,.64,.48],wood);
      box(g,'radio-face',[0,.69,.25],[.91,.45,.045],trim,{shadow:false});
      if(item.type==='radio'){
        cylinder(g,[.05,.72,.31],[.18,.18],.025,mats.dark,28);
        cylinder(g,[.05,.74,.33],[.08,.08],.03,mats.accent,28);
        for(const x of [-.34,.35])cylinder(g,[x,.68,.31],[.055,.055],.025,metal,14);
      }else{
        for(const x of [-.28,.28])cylinder(g,[x,.69,.31],[.16,.16],.025,metal,24);
      }
    }else if(item.type==='rug'){
      const mat=new T.Mesh(new T.CylinderGeometry(1.05,1.05,.045,32),mats.fabric);mat.scale.set(1.2,1,.72);mat.position.y=.01;g.add(mat);
    }
    const widgetId=widgetFor[item.type]||'about';
    g.userData.widgetId=widgetId;
    g.traverse(child=>{if(child.isMesh){child.userData.itemId=item.id;child.userData.widgetId=widgetId;}});
    itemGroups.set(item.id,g);
    return g;
  }
  settings.room.items.forEach(addFurniture);
  const selectionRing=new T.Mesh(new T.TorusGeometry(.72,.035,8,40),new T.MeshBasicMaterial({color:settings.accent,transparent:true,opacity:.95}));
  selectionRing.rotation.x=Math.PI/2;selectionRing.visible=false;world.add(selectionRing);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),groundPlane=new T.Plane(new T.Vector3(0,1,0),0),hitPoint=new T.Vector3();
  const parallax={x:0,y:0},baseCameraPosition=camera.position.clone(),reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={editing:false,selectedId:null,pendingType:null,dragging:false,pointerId:null,raf:0,stopped:false,visible:!('IntersectionObserver' in window)};
  let visibilityObserver=null;
  const onDocumentVisibility=()=>{if(document.hidden){cancelAnimationFrame(state.raf);state.raf=0;}else if(state.visible&&!state.raf)animate();};
  document.addEventListener('visibilitychange',onDocumentVisibility);
  const aspectCamera=()=>{
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight),aspect=w/h;
    camera.aspect=aspect;
    const portrait=aspect<1.05;
    const dist=Math.max(10,5.4/(Math.tan(T.MathUtils.degToRad(19))*Math.min(aspect,1.55)));
    world.scale.set(portrait?.78:1,1,1);
    camera.position.set(portrait?0:dist*.43,portrait?dist*.34:dist*.37,portrait?dist:dist*.91);
    camera.lookAt(0,1.38,-.1);camera.updateProjectionMatrix();baseCameraPosition.copy(camera.position);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,settings.theme==='pixel'?1:1.5));
    renderer.setSize(Math.round(w*(settings.theme==='pixel'?.58:1)),Math.round(h*(settings.theme==='pixel'?.58:1)),false);
    if(reducedMotion&&renderer.domElement.isConnected)renderer.render(scene,camera);
    renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';
  };
  const resizeObserver=new ResizeObserver(aspectCamera);resizeObserver.observe(stage);aspectCamera();
  const applyLook=()=>{
    const p=makeRoomPalette(settings.theme,settings.room.time);
    materials.wall.color.set(p.wall);materials.side.color.set(p.side);materials.floor.color.set(p.floor);
    materials.trim.color.set(p.trim);materials.wood.color.set(p.wood);materials.fabric.color.set(p.fabric);
    materials.plant.color.set(p.plant);materials.accent.color.set(settings.accent);materials.glass.color.set(p.sky);
    skyMat.color.set(p.sky);outsideMat.color.set(p.sky);sun.material.color.set(p.key);scene.background=new T.Color(p.sky);
    ambient.color.set(p.ambient);ambient.groundColor.set(p.trim);keyLight.color.set(p.key);keyLight.intensity=p.intensity;
    fill.color.set(settings.room.time==='night'?'#657fcb':'#a6c9ff');
    ceilingGlow.color.set(p.key);lampGlow.color.set('#ffd5a0');
    dust.material.color.set(settings.accent);
    if(reducedMotion)renderer.render(scene,camera);
    const shell=stage.closest('.profile-custom-shell');shell.dataset.theme=settings.theme;shell.style.setProperty('--profile-accent',settings.accent);
    aspectCamera();
  };
  const dispose=()=>{
    if(state.stopped)return;state.stopped=true;cancelAnimationFrame(state.raf);resizeObserver.disconnect();visibilityObserver?.disconnect();document.removeEventListener('visibilitychange',onDocumentVisibility);
    stage.removeEventListener('pointerdown',onPointerDown);stage.removeEventListener('pointermove',onPointerMove);
    stage.removeEventListener('pointerup',onPointerUp);stage.removeEventListener('pointercancel',onPointerUp);
    renderer.dispose();renderer.forceContextLoss();
  };
  function canvasPoint(event){
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
    pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(pointer,camera);
  }
  function setSelected(id){
    state.selectedId=id;
    const item=settings.room.items.find(x=>x.id===id),group=itemGroups.get(id);
    selectionRing.visible=Boolean(item&&group);
    if(item&&group)selectionRing.position.set(item.x,.045,item.z);
    updateSelectionControls();if(reducedMotion)renderer.render(scene,camera);
  }
  function updateSelectionControls(){
    const label=$ps('worldSelectedObjectName');
    if(label)label.textContent=state.selectedId ? (itemLabels[settings.room.items.find(x=>x.id===state.selectedId)?.type]||'Objeto selecionado') : 'Nenhum objeto selecionado';
    const rotate=$ps('worldRotateObject'),remove=$ps('worldRemoveObject');
    if(rotate)rotate.disabled=!state.selectedId;
    if(remove)remove.disabled=!state.selectedId;
  }
  function moveSelected(x,z){
    const item=settings.room.items.find(o=>o.id===state.selectedId),group=itemGroups.get(state.selectedId);
    if(!item||!group)return;
    item.x=Math.max(-4.65,Math.min(4.65,x));item.z=Math.max(-3.5,Math.min(3.0,z));
    group.position.x=item.x;group.position.z=item.z;selectionRing.position.set(item.x,.045,item.z);if(reducedMotion)renderer.render(scene,camera);
  }
  function onPointerDown(event){
    if(state.stopped||event.target!==renderer.domElement)return;canvasPoint(event);
    const intersects=raycaster.intersectObjects(furnitureRoot.children,true);
    const hit=intersects.find(x=>x.object.userData.itemId);
    if(state.editing){
      if(hit){
        setSelected(hit.object.userData.itemId);
        state.dragging=true;state.pointerId=event.pointerId;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        raycaster.ray.intersectPlane(groundPlane,hitPoint);
        event.preventDefault();
      }else if(state.pendingType){
        if(raycaster.ray.intersectPlane(groundPlane,hitPoint)){
          addItem(state.pendingType,hitPoint.x,hitPoint.z);
          state.pendingType=null;
          const note=$ps('worldEditorHint');if(note)note.textContent='Objeto adicionado. Arraste para posicionar.';
        }
      }else setSelected(null);
      return;
    }
    if(hit){
      const item=settings.room.items.find(x=>x.id===hit.object.userData.itemId);
      if(item)showObjectInfo(item.type);
    }
  }
  function onPointerMove(event){
    if(state.stopped||event.target!==renderer.domElement)return;
    if(!reducedMotion){const rect=stage.getBoundingClientRect();parallax.x=((event.clientX-rect.left)/rect.width-.5)*2;parallax.y=((event.clientY-rect.top)/rect.height-.5)*2;}
    if(state.dragging&&event.pointerId===state.pointerId){
      canvasPoint(event);
      if(raycaster.ray.intersectPlane(groundPlane,hitPoint))moveSelected(hitPoint.x,hitPoint.z);
      return;
    }
    if(!state.editing){
      canvasPoint(event);
      const hit=raycaster.intersectObjects(furnitureRoot.children,true).find(x=>x.object.userData.itemId);
      renderer.domElement.style.cursor=hit?'pointer':'grab';
    }else renderer.domElement.style.cursor=state.pendingType?'crosshair':state.selectedId?'move':'default';
  }
  function onPointerUp(event){
    if(state.dragging&&event.pointerId===state.pointerId){state.dragging=false;state.pointerId=null;}
  }
  stage.addEventListener('pointerdown',onPointerDown);
  stage.addEventListener('pointermove',onPointerMove,{passive:false});
  stage.addEventListener('pointerup',onPointerUp);
  stage.addEventListener('pointercancel',onPointerUp);
  stage.addEventListener('pointerleave',()=>{parallax.x=0;parallax.y=0;});
  function addItem(type,x=0,z=0){
    if(!itemTypes.includes(type)||settings.room.items.length>=24)return;
    const item={id:'room-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),type,x:Math.max(-4.6,Math.min(4.6,x)),z:Math.max(-3.5,Math.min(3.0,z)),rotation:0};
    settings.room.items.push(item);addFurniture(item);setSelected(item.id);
  }
  function rotateSelected(){
    const item=settings.room.items.find(x=>x.id===state.selectedId),group=itemGroups.get(state.selectedId);
    if(!item||!group)return;item.rotation=(item.rotation+Math.PI/4)%(Math.PI*2);group.rotation.y=item.rotation;if(reducedMotion)renderer.render(scene,camera);
  }
  function removeSelected(){
    if(!state.selectedId)return;
    const id=state.selectedId,group=itemGroups.get(id);if(group)furnitureRoot.remove(group);
    itemGroups.delete(id);settings.room.items=settings.room.items.filter(x=>x.id!==id);setSelected(null);if(reducedMotion)renderer.render(scene,camera);
  }
  function showObjectInfo(type){
    const localRoot=stage.closest('.profile-custom-shell');
    const content=localRoot?.querySelector('.profile-world-info-content'),panel=localRoot?.querySelector('.profile-world-info-panel');
    if(!content||!panel)return;
    content.replaceChildren();
    const titles={sofa:'Sobre mim',beanbag:'Sobre mim',desk:'Meu setup e hobbies',shelf:'Jogos favoritos',plant:'Meus interesses',lamp:'Frase do momento',frame:'Minha galeria',poster:'Minha galeria',radio:'Minha música',speaker:'Minha música',rug:'Meu cantinho',calendar:'Minha contagem regressiva',board:'Meus links'};
    const widget=({sofa:'about',beanbag:'about',desk:'setup',shelf:'games',plant:'interests',lamp:'quote',frame:'gallery',poster:'gallery',radio:'music',speaker:'music',rug:'about',calendar:'countdown',board:'links'})[type]||'about';
    content.append(element('span','world-info-kicker','UM OBJETO DO MEU ESPAÇO'),element('h3','',titles[type]||'Meu espaço'));
    if(widget==='about'){
      if(profile.bio)content.append(element('p','',profile.bio));
      else content.append(element('p','world-info-muted','Ainda não escrevi sobre mim.'));
      if(settings.quote)content.append(element('blockquote','world-info-quote','“'+settings.quote+'”'));
    }else if(widget==='setup'){
      content.append(element('p','',settings.setup||'Meus hobbies e meu setup ainda não foram preenchidos.'));
    }else if(widget==='games'){
      content.append(element('p','',settings.games||'Meus jogos favoritos ainda não foram adicionados.'));
    }else if(widget==='interests'){
      const tags=element('div','world-info-tags');
      (profile.interests||[]).forEach(name=>tags.append(element('span','',name)));
      if(!tags.childElementCount)tags.append(element('span','world-info-muted','Ainda não há interesses cadastrados.'));
      content.append(tags);
    }else if(widget==='gallery'){
      const gallery=element('div','world-info-gallery');
      photos.slice(0,8).forEach(url=>{const a=element('a','');a.href=url;a.target='_blank';a.rel='noopener noreferrer';const img=element('img','');img.src=url;img.alt='Foto do perfil';a.append(img);gallery.append(a);});
      if(!gallery.childElementCount)content.append(element('p','world-info-muted','Ainda não há fotos na galeria.'));
      else content.append(gallery);
    }else if(widget==='countdown'){
      if(settings.countdownDate){const target=new Date(settings.countdownDate+'T00:00:00'),today=new Date(new Date().toDateString()),days=Math.ceil((target-today)/86400000);content.append(element('strong','world-countdown-number',days<0?'Chegou!':days===0?'É hoje!':String(days)),element('p','',settings.countdownTitle||'Contagem regressiva'),element('span','world-info-muted',days>0?'dias restantes':''));}
      else content.append(element('p','world-info-muted','Escolha uma data no editor para criar sua contagem regressiva.'));
    }else if(widget==='links'){
      const links=element('div','world-info-links');settings.links.forEach(item=>{const url=safeUrl(item.url);if(url){const a=element('a','world-info-link',item.label+' ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}});
      if(links.childElementCount)content.append(links);else content.append(element('p','world-info-muted','Adicione seus links no editor.'));
    }else if(widget==='music'){
      content.append(element('p','',settings.music||'Ainda não escolhi uma música.'));
      const url=safeUrl(settings.musicUrl);if(url){const a=element('a','world-info-link','Abrir música ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';content.append(a);}
    }else if(widget==='quote'){
      content.append(element('blockquote','world-info-quote',settings.quote?'“'+settings.quote+'”':'Ainda não há uma frase do momento.'));
    }
    panel.hidden=false;
  }
  function buildEditor(){
    const panel=$ps('profileWorldEditor');if(!panel)return;
    const theme=$ps('worldThemeSelect'),time=$ps('worldTimeSelect'),accent=$ps('worldAccentSelect');
    if(theme)theme.value=settings.theme;if(time)time.value=settings.room.time;if(accent)accent.value=settings.accent;
    const addButtons=panel.querySelectorAll('[data-world-add]');
    addButtons.forEach(button=>button.addEventListener('click',()=>{
      state.pendingType=button.dataset.worldAdd;
      const hint=$ps('worldEditorHint');if(hint)hint.textContent='Clique no chão do ambiente para posicionar: '+(itemLabels[state.pendingType]||'objeto');
    }));
    theme?.addEventListener('change',()=>{settings.theme=theme.value;applyLook();});
    time?.addEventListener('change',()=>{settings.room.time=time.value;applyLook();});
    accent?.addEventListener('input',()=>{settings.accent=accent.value;applyLook();});
    $ps('worldRotateObject')?.addEventListener('click',rotateSelected);
    $ps('worldRemoveObject')?.addEventListener('click',removeSelected);
    updateSelectionControls();
  }
  function animate(){
    if(state.stopped||!renderer.domElement.isConnected){dispose();return;}
    if(!state.visible||document.hidden){state.raf=0;return;}
    if(reducedMotion){renderer.render(scene,camera);return;}
    state.raf=requestAnimationFrame(animate);
    const t=performance.now()*.001;
    if(!reducedMotion){camera.position.x+=(baseCameraPosition.x+parallax.x*.24-camera.position.x)*.025;camera.position.y+=(baseCameraPosition.y-parallax.y*.13-camera.position.y)*.025;camera.lookAt(parallax.x*.13,1.38-parallax.y*.06,-.1);}
    dust.rotation.y=Math.sin(t*.08)*.1;
    sun.position.y=.64+Math.sin(t*.12)*.05;
    lampGlow.intensity=1.0+Math.sin(t*1.7)*.08;
    renderer.render(scene,camera);
  }
  buildEditor();applyLook();
  if('IntersectionObserver' in window){
    visibilityObserver=new IntersectionObserver(entries=>{
      state.visible=entries.some(entry=>entry.isIntersecting);
      if(state.visible&&!state.raf&&!document.hidden)animate();
      else if(!state.visible&&state.raf){cancelAnimationFrame(state.raf);state.raf=0;}
    });
    visibilityObserver.observe(stage);
  }else animate();
  return {dispose,setEditing(value){state.editing=value;state.pendingType=null;state.dragging=false;renderer.domElement.style.cursor=value?'move':'grab';if(!value)setSelected(null);},
    setSelected,rotateSelected,removeSelected,getSettings(){return clone(settings);},showObjectInfo,
    rebuild(){return this;}};
}
function editorMarkup(){
  const panel=element('section','profile-world-editor');panel.id='profileWorldEditor';panel.hidden=true;
  const heading=element('div','profile-world-editor-heading');
  heading.append(element('div','', 'MODO DE DECORAÇÃO'),element('p','','Escolha o estilo, adicione móveis e arraste os objetos pelo ambiente.'));
  const look=element('div','profile-world-editor-look');
  const themeLabel=element('label','','Estilo');const theme=document.createElement('select');theme.id='worldThemeSelect';
  [['lofi','Lo-fi aconchegante'],['pixel','Pixel art'],['anime','Anime'],['scrapbook','Scrapbook'],['aurora','Aurora'],['midnight','Noite neon'],['sunset','Pôr do sol'],['forest','Floresta'],['rose','Rosa elétrico']].forEach(([v,l])=>{const o=element('option','',l);o.value=v;theme.append(o);});themeLabel.append(theme);
  const timeLabel=element('label','','Iluminação');const time=document.createElement('select');time.id='worldTimeSelect';
  [['dawn','Amanhecer'],['day','Dia'],['sunset','Fim de tarde'],['night','Noite']].forEach(([v,l])=>{const o=element('option','',l);o.value=v;time.append(o);});timeLabel.append(time);
  const accentLabel=element('label','','Cor de destaque');const accent=document.createElement('input');accent.type='color';accent.id='worldAccentSelect';accentLabel.append(accent);
  look.append(themeLabel,timeLabel,accentLabel);
  const furniture=element('div','profile-world-furniture');
  furniture.append(element('strong','','Adicionar objetos'));
  const itemRow=element('div','profile-world-furniture-options');
  ['plant','lamp','frame','shelf','desk','sofa','beanbag','poster','radio','speaker','rug','calendar','board'].forEach(type=>{const b=element('button','world-furniture-button','＋ '+itemLabels[type]);b.type='button';b.dataset.worldAdd=type;itemRow.append(b);});
  furniture.append(itemRow);
  const selected=element('div','profile-world-selected');const selectedName=element('strong','', 'Nenhum objeto selecionado');selectedName.id='worldSelectedObjectName';
  const rotate=element('button','button button-outline','Girar 45°');rotate.type='button';rotate.id='worldRotateObject';rotate.disabled=true;
  const remove=element('button','button button-outline','Remover');remove.type='button';remove.id='worldRemoveObject';remove.disabled=true;
  selected.append(selectedName,rotate,remove);
  const content=element('div','profile-world-content-editor');
  content.append(element('strong','','Detalhes do seu espaço'));
  const contentGrid=element('div','profile-world-content-grid');
  const fields=[
    ['Frase do momento','input','worldQuote',180],
    ['Música / artista','input','worldMusic',100],
    ['Título da contagem','input','worldCountdownTitle',70],
    ['Link da música','input','worldMusicUrl',500],
    ['Jogos favoritos','input','worldGames',180],
    ['Hobbies / setup','input','worldSetup',220]
  ];
  fields.forEach(([label,tag,id,max])=>{const wrap=element('label','',label),input=document.createElement(tag);input.id=id;input.maxLength=max;input.placeholder=label;wrap.append(input);contentGrid.append(wrap);});
  const countdownWrap=element('label','','Data da contagem regressiva');const countdownDate=document.createElement('input');countdownDate.id='worldCountdownDate';countdownDate.type='date';countdownWrap.append(countdownDate);contentGrid.append(countdownWrap);
  const linksWrap=element('label','world-links-label','Links (um por linha: nome | URL)');const links=document.createElement('textarea');links.id='worldLinks';links.rows=2;links.maxLength=1200;links.placeholder='Meu portfólio | https://...';linksWrap.append(links);contentGrid.append(linksWrap);
  content.append(contentGrid);
  const footer=element('div','profile-world-editor-footer');const hint=element('span','world-editor-hint','Arraste um objeto para mudar sua posição.');hint.id='worldEditorHint';
  const actions=element('div','');const cancel=element('button','button button-outline','Cancelar');cancel.type='button';cancel.id='worldCancelEdit';
  const save=element('button','button button-primary','Salvar ambiente');save.type='button';save.id='worldSaveEdit';
  actions.append(cancel,save);footer.append(hint,actions);
  panel.append(heading,look,furniture,selected,content,footer);
  return panel;
}
function createWorldMarkup(profile,settings,photos,editable){
  const shell=element('section','profile-custom-shell');shell.dataset.theme=settings.theme;shell.style.setProperty('--profile-accent',settings.accent);
  const stage=element('div','profile-world-stage');stage.setAttribute('aria-label','Ambiente virtual 3D do perfil');
  const top=element('div','profile-world-topline');
  top.append(element('span','world-brand-label','BRAZILLY  /  MEU ESPAÇO'),element('span','world-explore-label','Explore os objetos do ambiente'));
  const identity=element('div','profile-world-identity');
  const avatar=element('div','profile-world-avatar');
  if(photos[0])avatar.style.backgroundImage='url("'+photos[0].replace(/["\\\\]/g,'')+'")';
  else avatar.textContent=(profile.display_name||profile.name||'B').trim().slice(0,1).toUpperCase();
  identity.append(avatar,element('div','world-identity-copy',profile.display_name||profile.name||'Meu espaço'));
  if(profile.city)identity.append(element('small','world-identity-location',profile.city));
  stage.append(top,identity);
  let panel=element('aside','profile-world-info-panel');panel.hidden=true;
  const close=element('button','world-info-close','×');close.type='button';close.setAttribute('aria-label','Fechar detalhes');
  const info=element('div','world-info-content profile-world-info-content');panel.append(close,info);stage.append(panel);
  close.addEventListener('click',()=>panel.hidden=true);
  if(editable){
    const edit=element('button','world-edit-trigger','✦ Decorar meu espaço');edit.type='button';edit.addEventListener('click',()=>{const panel=$ps('profileWorldEditor');setEditMode(!panel||panel.hidden);});stage.append(edit);
  }else stage.append(element('span','world-visitor-note','Este é um espaço pessoal'));
  const hint=element('span','world-stage-hint',editable?'Toque nos objetos para explorar · Decore para reorganizar':'Toque nos objetos para conhecer esta pessoa');stage.append(hint);
  const editor=editable?editorMarkup():null;
  shell.append(stage);
  if(editor)shell.append(editor);
  return {shell,stage,panel,info,editor,editButton:shell.querySelector('.world-edit-trigger'),hint};
}
function setEditMode(active){
  const root=document.querySelector('#profileCustomizationPreview .profile-custom-shell');
  if(!root)return;
  const controller=root._profileWorldController;
  const panel=$ps('profileWorldEditor'),button=root.querySelector('.world-edit-trigger');
  if(!controller){if(panel)panel.hidden=!active;if(button)button.textContent=active?'✦ Fechar decoração':'✦ Decorar meu espaço';return;}
  controller.setEditing(active);
  if(panel)panel.hidden=!active;
  if(button)button.textContent=active?'✦ Fechar decoração':'✦ Decorar meu espaço';
  const hint=root.querySelector('.world-stage-hint');
  if(hint)hint.textContent=active?'Arraste os móveis para reposicionar. Use os controles abaixo para adicionar, girar ou remover.':'Toque nos objetos para explorar · Decore para reorganizar';
}
async function render(root,profile,rawSettings,editable=false){
  if(!root||!profile)return;
  cleanupByRoot.get(root)?.();
  root.replaceChildren();
  const settings=normalize(rawSettings),photos=await photoUrls(profile);
  const markup=createWorldMarkup(profile,settings,photos,editable);
  root.append(markup.shell);
  try{
    const T=await loadThree();
    if(!markup.stage.isConnected)return;
    const pixel=settings.theme==='pixel';
    const renderer=new T.WebGLRenderer({canvas:document.createElement('canvas'),alpha:false,antialias:!pixel,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,pixel?1:1.5));
    renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    renderer.shadowMap.enabled=!pixel;renderer.shadowMap.type=T.PCFSoftShadowMap;
    markup.stage.prepend(renderer.domElement);
    renderer.domElement.className='profile-world-canvas';
    const controller=makeScene(T,renderer,markup.stage,settings,profile,photos);
    markup.shell._profileWorldController=controller;
    if(editable&&markup.editor&&!markup.editor.hidden)controller.setEditing(true);
    const dispose=()=>{controller.dispose();};
    cleanupByRoot.set(root,dispose);
    if(editable){
      const fillEditor=()=>{
        const set=(id,value)=>{const node=$ps(id);if(node)node.value=value||'';};
        set('worldQuote',settings.quote);set('worldMusic',settings.music);set('worldMusicUrl',settings.musicUrl);
        set('worldGames',settings.games);set('worldSetup',settings.setup);
        set('worldCountdownTitle',settings.countdownTitle);set('worldCountdownDate',settings.countdownDate);
        set('worldLinks',settings.links.map(x=>x.label+' | '+x.url).join('\n'));
      };
      fillEditor();
      markup.editor.querySelector('#worldCancelEdit').addEventListener('click',async()=>{await renderOwn();});
      markup.editor.querySelector('#worldSaveEdit').addEventListener('click',async()=>{
        const save=$ps('worldSaveEdit'),hint=$ps('worldEditorHint');
        if(!currentUser)return;save.disabled=true;save.textContent='Salvando...';
        try{
          settings.quote=$ps('worldQuote').value.trim();settings.music=$ps('worldMusic').value.trim();
          settings.musicUrl=$ps('worldMusicUrl').value.trim();settings.games=$ps('worldGames').value.trim();
          settings.setup=$ps('worldSetup').value.trim();settings.countdownTitle=$ps('worldCountdownTitle').value.trim();
          settings.countdownDate=$ps('worldCountdownDate').value;
          settings.links=$ps('worldLinks').value.split('\n').map(line=>{const parts=line.split('|');return{label:(parts.shift()||'').trim().slice(0,50),url:parts.join('|').trim().slice(0,500)};}).filter(item=>item.label&&safeUrl(item.url)).slice(0,8);
          const saved=normalize(settings);
          const {error}=await db.from('profile_customizations').upsert({user_id:currentUser.id,settings:saved,updated_at:new Date().toISOString()},{onConflict:'user_id'});
          if(error)throw error;
          cache.set(currentUser.id,saved);currentProfile.profileCustomization=saved;
          await renderOwn();
        }catch(error){if(hint)hint.textContent='Não foi possível salvar: '+error.message;}
        finally{const b=$ps('worldSaveEdit');if(b){b.disabled=false;b.textContent='Salvar ambiente';}}
      });
    }
  }catch(error){
    console.warn('Não foi possível carregar o ambiente 3D:',error);
    const fallback=element('div','profile-world-fallback','Este navegador não conseguiu iniciar o ambiente 3D. Atualize o navegador ou habilite a aceleração de hardware.');
    markup.stage.append(fallback);
  }
}
async function renderOwn(){
  if(!currentUser||!currentProfile)return;
  try{
    const settings=await load(currentUser.id);
    currentProfile.profileCustomization=settings;
    await render($ps('profileCustomizationPreview'),currentProfile,settings,true);
  }catch(error){
    console.warn(error);
    $ps('profileCustomizationPreview').textContent='Não foi possível carregar seu ambiente personalizado.';
  }
}
async function renderPublic(profile){
  if(!profile?.user_id)return;
  activePublicId=profile.user_id;
  try{
    const settings=await load(profile.user_id);
    if(activePublicId!==profile.user_id)return;
    const target=$ps('profileDetailContent');if(!target)return;
    const previous=target.querySelector('.profile-public-customization');
    if(previous){cleanupByRoot.get(previous)?.();previous.remove();}
    const wrap=element('section','profile-public-customization');
    wrap.textContent='Preparando o ambiente pessoal...';target.prepend(wrap);
    await render(wrap,profile,settings,false);
    if(activePublicId!==profile.user_id){cleanupByRoot.get(wrap)?.();wrap.remove();}
  }catch(error){console.warn('Erro ao carregar o ambiente público:',error);}
}
async function openEditor(){
  if(!currentUser||!currentProfile){alert('Entre na sua conta para personalizar seu perfil.');return;}
  if(!$ps('profileCustomizationPreview')?.querySelector('.profile-custom-shell'))await renderOwn();
  setEditMode(true);
  $ps('profileWorldEditor')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
$ps('openProfileStudio')?.addEventListener('click',openEditor);
document.addEventListener('brazilly:screen-changed',event=>{if(event.detail==='profileScreen')renderOwn();});
document.addEventListener('brazilly:profile-opened',event=>renderPublic(event.detail));
})();
