(() => {
'use strict';
const $=id=>document.getElementById(id), clone=v=>JSON.parse(JSON.stringify(v));
const defaults={theme:'lofi',fontFamily:'nunito',accent:'#d8a879',musicPath:'',musicTrackTitle:'',musicArtist:'',room:{time:'sunset',weather:'rain',items:[{id:'bed',type:'bed',x:-2.8,z:1.7,rotation:0},{id:'desk',type:'desk',x:1.3,z:-1.5,rotation:0},{id:'shelf',type:'shelf',x:3.6,z:-2.1,rotation:0},{id:'plant',type:'plant',x:-4.1,z:-1.7,rotation:0},{id:'lamp',type:'lamp',x:2.7,z:.1,rotation:0},{id:'frame',type:'frame',x:-.2,z:-3.1,rotation:0},{id:'radio',type:'radio',x:-1.1,z:.3,rotation:0}]},quote:'',music:'',musicUrl:'',games:'',setup:'',countdownTitle:'',countdownDate:'',links:[]};
const PROFILE_SCENE_PRESETS=[];
const themes=['lofi','anime','pixel','scrapbook','aurora','midnight','sunset','forest','rose'],times=['dawn','day','sunset','night'],weatherTypes=['clear','rain','snow','petals'];
const labels={bed:'Cama',desk:'Escrivaninha',shelf:'Estante',plant:'Planta',lamp:'Luminária',frame:'Quadro',radio:'Vitrola',rug:'Tapete',beanbag:'Pufe',poster:'Pôster',speaker:'Caixa de som',calendar:'Calendário',board:'Mural'};
const widgets={bed:'about',desk:'setup',shelf:'games',plant:'interests',lamp:'quote',frame:'gallery',poster:'gallery',radio:'music',speaker:'music',beanbag:'about',rug:'about',calendar:'countdown',board:'links'};
const cache=new Map(),cleanup=new WeakMap(),renderVersions=new WeakMap();let activePublicId=null,ownRenderVersion=0;
function norm(raw){const v={...clone(defaults),...(raw||{})};v.theme=themes.includes(v.theme)?v.theme:'lofi';v.fontFamily=['nunito','poppins','space-grotesk','comfortaa','playfair-display','roboto-slab','dm-mono','system'].includes(v.fontFamily)?v.fontFamily:'nunito';v.accent=/^#[0-9a-f]{6}$/i.test(v.accent)?v.accent:defaults.accent;const r=v.room||{};v.room={time:times.includes(r.time)?r.time:'sunset',weather:weatherTypes.includes(r.weather)?r.weather:'rain',background:typeof r.background==='string'&&r.background.length<500?r.background:'',preset:typeof r.preset==='string'&&r.preset.length<100?r.preset:'',backgroundType:['gif','webp','png','jpg','jpeg','avif','mp4','webm'].includes(r.backgroundType)?r.backgroundType:'',items:(Array.isArray(r.items)?r.items:clone(defaults.room.items)).filter(x=>x&&labels[x.type]).slice(0,24).map((x,i)=>({id:String(x.id||'item-'+i),type:x.type,x:Math.max(-4.7,Math.min(4.7,Number(x.x)||0)),z:Math.max(-3.55,Math.min(3,Number(x.z)||0)),rotation:Number(x.rotation)||0}))};if(!v.room.items.length)v.room.items=clone(defaults.room.items);delete v.mascot;delete v.cover;delete v.decor;delete v.widgets;['quote','music','musicUrl','musicTrackTitle','musicArtist','games','setup','countdownTitle','countdownDate'].forEach(k=>v[k]=String(v[k]||''));v.musicPath=typeof v.musicPath==='string'&&v.musicPath.length<300?v.musicPath:'';v.links=Array.isArray(v.links)?v.links.slice(0,8):[];return v;}
async function load(id){if(cache.has(id))return clone(cache.get(id));const {data,error}=await db.from('profile_customizations').select('settings').eq('user_id',id).maybeSingle();if(error)throw error;const v=norm(data?.settings);cache.set(id,v);return clone(v);}
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;}
function safeUrl(v){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}

const PROFILE_FONTS={
 nunito:{name:'Nunito',family:'Nunito',url:'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap'},
 poppins:{name:'Poppins',family:'Poppins',url:'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap'},
 'space-grotesk':{name:'Space Grotesk',family:'Space Grotesk',url:'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap'},
 comfortaa:{name:'Comfortaa',family:'Comfortaa',url:'https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;500;600;700&display=swap'},
 'playfair-display':{name:'Playfair Display',family:'Playfair Display',url:'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap'},
 'roboto-slab':{name:'Roboto Slab',family:'Roboto Slab',url:'https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700;800;900&display=swap'},
 'dm-mono':{name:'DM Mono',family:'DM Mono',url:'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap'},
 system:{name:'Padrão do sistema',family:'inherit',url:''}
};
function applyProfileFont(root,key){
 const font=PROFILE_FONTS[key]||PROFILE_FONTS.nunito;
 if(font.url&&!document.querySelector('[data-profile-font="'+key+'"]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href=font.url;link.dataset.profileFont=key;document.head.append(link);
 }
 if(root){root.dataset.profileFont=key;root.style.setProperty('--profile-font-family',font.family==='inherit'?'inherit':'"'+font.family+'",sans-serif');}
}

async function photos(p){if(p.photos?.length)return p.photos.map(x=>x.data).filter(Boolean).slice(0,8);return (await Promise.all((p.photo_paths||[]).slice(0,8).map(async x=>{const {data,error}=await db.storage.from('profile-photos').createSignedUrl(x,3600);return error?null:data?.signedUrl||null;}))).filter(Boolean);}
const BUILTIN_SCENE_FALLBACK=[
 {id:'f436c8e8-f08a-4b8e-9fb8-8d04d1b6d41b',title:'Paisagem montanhosa',description:'Montanhas ao entardecer',storage_path:'library/70eb7e60-bdf7-4125-9e69-4d688e425b52.mp4',mime_type:'video/mp4',sort_order:10},
 {id:'bd6708a9-836a-4606-b100-c549dcbe4979',title:'Inverno',description:'Paisagem de inverno',storage_path:'library/a5c7bebf-2e29-4bc6-9825-6708debfecf9.mp4',mime_type:'video/mp4',sort_order:20},
 {id:'f502677f-7a62-444c-bec6-6c3262419360',title:'Floresta tranquila',description:'Floresta em alta definição',storage_path:'library/c44c2113-e414-4940-8ea6-8e2c6469be07.mp4',mime_type:'video/mp4',sort_order:30},
 {id:'a7f00c2a-6ed4-4a86-81c7-1d9dce6d16f6',title:'Trem de anime ao pôr do sol',description:'Paisagem anime em movimento',storage_path:'library/06ad4695-5ec9-4a5a-8dab-800dbe40156f.mp4',mime_type:'video/mp4',sort_order:40},
 {id:'1d3b5f27-2c1c-450e-a2d0-48d5c19a352d',title:'Explorador espacial',description:'Cena espacial cinematográfica',storage_path:'library/6cbe7c69-68e7-458d-bdc3-d0c3ebae5c37.mp4',mime_type:'video/mp4',sort_order:50},
 {id:'d14c3240-c1a0-4f00-94c8-b04f8bec199d',title:'BMW M5 à noite',description:'Carro em cenário noturno',storage_path:'library/eded20a8-b606-4fe5-ba39-3969140f5bdc.mp4',mime_type:'video/mp4',sort_order:60},
 {id:'5072ce6a-6ef8-4efe-b238-b5efbec21c05',title:'Folhas de cerejeira',description:'Cenário com folhas de cerejeira',storage_path:'library/7f96f603-7e7b-4c1c-b5fa-acd2f99bfdfc.mp4',mime_type:'video/mp4',sort_order:70},
 {id:'e46bf774-27ec-4bc8-a623-6799a185b33e',title:'Guardião da floresta Minecraft',description:'Floresta em estilo Minecraft',storage_path:'library/dac4d49b-1c94-41b3-8b67-2bbaa2890121.mp4',mime_type:'video/mp4',sort_order:80},
 {id:'82771f87-705e-4b2a-8bac-6a45674960c4',title:'Apartamento Cyberpunk',description:'Apartamento futurista',storage_path:'library/33e9b27f-99e2-485a-b70a-dcd71512e4ac.mp4',mime_type:'video/mp4',sort_order:90}
];
async function loadSceneCatalog(){
 const fallback=BUILTIN_SCENE_FALLBACK.map(row=>({...row,name:row.title,file:db.storage.from('profile-scene-library').getPublicUrl(row.storage_path).data.publicUrl}));
 const loadRemote=async()=>{
  const {data,error}=await db.from('profile_scene_catalog').select('id,title,description,storage_path,mime_type,sort_order,created_at').eq('is_active',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
  if(error)throw error;
  const rows=(data||[]).map(row=>({...row,name:row.title,file:db.storage.from('profile-scene-library').getPublicUrl(row.storage_path).data.publicUrl}));
  const known=new Set(rows.map(row=>row.id));
  return [...fallback.filter(item=>!known.has(item.id)),...rows];
 };
 try{
  if(window.BrazillyCache?.getOrLoad)return await window.BrazillyCache.getOrLoad('public:profile-scene-catalog:v1',loadRemote,{ttlMs:5*60*1000});
  return await loadRemote();
 }catch(error){console.warn('Catálogo de cenários indisponível; usando catálogo local:',error.message||error);return fallback;}
}
function sceneMedia(preset){const video=['video/mp4','video/webm'].includes(preset.mime_type);const media=el(video?'video':'img','profile-world-animated-background');media.src=preset.file;media.alt=video?'':'Cenário '+preset.name;media.draggable=false;if(video){media.autoplay=true;media.loop=true;media.muted=true;media.playsInline=true;media.preload='metadata';media.setAttribute('aria-hidden','true');}return media;}
function colors(theme,time){const p={lofi:['#d9c2aa','#b88f7c','#9a6e60','#f3c59b','#f4d7c0'],anime:['#e8c4d7','#b5a6ce','#a9788d','#f8b7ca','#f9d9df'],pixel:['#a9c8c8','#73989c','#8e6b58','#b6d9d6','#f2d38d'],scrapbook:['#e7d5bf','#c9a9a0','#a77e70','#e9b8b4','#fff0d8'],aurora:['#4a5877','#34465f','#363b59','#8cb4d6','#c6b6f5'],midnight:['#303b59','#202b47','#30304c','#738bd0','#b3c7ff'],sunset:['#e9b5a2','#c98e91','#95626a','#ffc08e','#ffe0bb'],forest:['#b7c5a7','#819c85','#746a50','#b8c99a','#e1d5a8'],rose:['#e4b8d2','#bc8eaf','#865c7c','#f4a9cc','#f8d2e4']}[theme]||['#d9c2aa','#b88f7c','#9a6e60','#f3c59b','#f4d7c0'];const sky={dawn:'#d8c6d9',day:'#b8dce9',sunset:p[3],night:'#26395f'}[time];return {wall:p[0],side:p[1],floor:p[2],accent:p[3],fabric:p[4],sky,glow:time==='night'?'#a4b8ef':'#ffe1bd'};}
function scene(s){const c=colors(s.theme,s.room.time),night=s.room.time==='night';return '<svg class="illustrated-room-art" viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice" aria-label="Quarto ilustrado aconchegante">'+
'<defs><linearGradient id="rw" x2="0" y2="1"><stop stop-color="'+c.wall+'"/><stop offset="1" stop-color="'+c.side+'"/></linearGradient><linearGradient id="rs" x2="0" y2="1"><stop stop-color="'+c.sky+'"/><stop offset="1" stop-color="'+c.glow+'"/></linearGradient><linearGradient id="rf" x2="0" y2="1"><stop stop-color="'+c.floor+'"/><stop offset="1" stop-color="#493e4c"/></linearGradient><radialGradient id="halo"><stop stop-color="'+c.glow+'" stop-opacity=".6"/><stop offset="1" stop-color="'+c.glow+'" stop-opacity="0"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="13"/></filter></defs>'+
'<rect width="1440" height="760" fill="url(#rw)"/><path d="M0 0H1440V40Q900 70 0 42Z" fill="#fff" opacity=".08"/>'+
'<g class="room-window-layer"><rect x="190" y="82" width="500" height="360" rx="10" fill="#51495e"/><rect x="204" y="96" width="472" height="332" fill="url(#rs)"/><circle cx="565" cy="165" r="'+(night?36:52)+'" fill="'+(night?'#f4eddb':'#ffe2a2')+'"/><path d="M204 350Q315 290 405 346T676 326V428H204Z" fill="#5e6a83" opacity=".55"/>'+
'<g fill="#49536c" opacity=".8"><path d="M210 300h48v128h-48zM270 264h65v164h-65zM350 318h58v110h-58zM425 278h74v150h-74zM514 302h55v126h-55zM584 250h82v178h-82z"/></g><path d="M190 78Q160 190 191 454L232 438Q212 246 239 90ZM690 78Q728 206 686 454L649 438Q670 245 644 90Z" fill="'+c.side+'"/><rect x="185" y="76" width="510" height="18" rx="9" fill="#f0d8c6"/><rect x="185" y="430" width="510" height="20" rx="8" fill="#8b665e"/><path d="M435 96V430M204 260H676" stroke="#f3dfd0" stroke-width="13"/><path d="M210 103H670V423H210Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="4"/></g>'+
'<g><rect x="825" y="115" width="210" height="155" rx="5" fill="#6b4d57"/><rect x="837" y="127" width="186" height="131" fill="#f3d7bd"/><rect x="847" y="137" width="166" height="111" fill="'+c.sky+'"/><circle cx="965" cy="165" r="24" fill="'+c.glow+'"/><path d="M847 220Q900 170 950 215T1013 205V248H847Z" fill="'+c.side+'"/><rect x="1090" y="142" width="150" height="112" rx="5" fill="#765b60"/><rect x="1100" y="152" width="130" height="92" fill="#e8c6b8"/><path d="M1110 225Q1150 178 1195 218T1220 208V244H1110Z" fill="'+c.accent+'"/></g>'+
'<path d="M0 520Q300 490 620 520T1440 505V760H0Z" fill="url(#rf)"/><path d="M0 530Q300 500 620 530T1440 515" fill="none" stroke="#f5d9c4" stroke-opacity=".25" stroke-width="9"/>'+
'<g class="room-bed-layer"><ellipse cx="350" cy="665" rx="300" ry="35" fill="#171b2b" opacity=".35" filter="url(#blur)"/><path d="M70 545Q92 490 175 492H540Q615 500 640 565V690H80Z" fill="#705260"/><path d="M90 555Q120 515 188 518H540Q594 525 616 574V650H90Z" fill="'+c.fabric+'"/><path d="M100 570Q270 545 400 568T610 565V635Q400 655 100 635Z" fill="'+c.accent+'" opacity=".5"/><rect x="110" y="492" width="180" height="82" rx="34" fill="#f1d9cf"/><rect x="300" y="492" width="180" height="82" rx="34" fill="#d9b7c7"/><path d="M75 685H640" stroke="#493b4c" stroke-width="16" stroke-linecap="round"/></g>'+
'<g class="room-desk-layer"><ellipse cx="1000" cy="650" rx="235" ry="28" fill="#171b2b" opacity=".3" filter="url(#blur)"/><path d="M805 465H1210L1188 500H825Z" fill="#8d5e4e"/><path d="M825 500H1190L1168 652H850Z" fill="#765044"/><path d="M850 650V710M1168 650V710" stroke="#493b3c" stroke-width="22"/><rect x="920" y="355" width="190" height="112" rx="12" fill="#383849"/><rect x="932" y="367" width="166" height="88" rx="5" fill="#9fc2ce"/><path d="M932 427Q980 390 1022 420T1098 405V455H932Z" fill="#6c8294"/><path d="M1015 467V490M975 492H1055" stroke="#5d5662" stroke-width="12" stroke-linecap="round"/><rect x="895" y="482" width="240" height="12" rx="6" fill="#d8b19b"/><circle cx="1170" cy="470" r="10" fill="#f4d9b5"/></g>'+
'<g><path d="M1288 620H1370L1355 690H1302Z" fill="#a66e67"/><path d="M1328 620Q1260 535 1280 460Q1335 510 1328 620M1330 620Q1375 520 1410 500Q1405 585 1330 620M1325 615Q1310 490 1345 430Q1380 515 1325 615" fill="#668e78" stroke="#456a61" stroke-width="7"/></g>'+
'<g><ellipse cx="760" cy="480" rx="160" ry="145" fill="url(#halo)"/><path d="M750 430V510" stroke="#68505a" stroke-width="12"/><path d="M710 430Q750 350 790 430Z" fill="'+c.accent+'" stroke="#8d6b68" stroke-width="5"/><circle cx="750" cy="440" r="12" fill="#fff0c8"/></g>'+
'<rect width="1440" height="760" fill="'+(night?'#172443':'#f3c6a3')+'" opacity="'+(night?'.18':'.055')+'"/></svg>';}
function art(type){const common='viewBox="0 0 160 130" aria-hidden="true"';const shapes={
bed:'<path d="M15 55Q20 38 42 38H132Q145 40 147 58V105H15Z" fill="#8b6172"/><path d="M21 58H140V100H21Z" fill="#d9a8b9"/><rect x="26" y="30" width="45" height="35" rx="12" fill="#f2dfd2"/><rect x="76" y="30" width="45" height="35" rx="12" fill="#c9a8c7"/>',
desk:'<path d="M18 48H143L136 62H24Z" fill="#9a674f"/><path d="M27 62H136V112H27Z" fill="#775044"/><path d="M38 110V124M124 110V124" stroke="#493b3c" stroke-width="8"/><rect x="57" y="9" width="55" height="38" rx="5" fill="#343746"/><rect x="62" y="14" width="45" height="28" fill="#9bc4d0"/>',
shelf:'<rect x="30" y="8" width="100" height="112" rx="5" fill="#775347"/><path d="M27 38H133M27 72H133M27 105H133" stroke="#d0a17b" stroke-width="8"/><path d="M38 17h12v20H38zm20-4h14v24H58zm22 7h12v17H80zm18-8h15v25H98z" fill="#d5a06d"/>',
plant:'<path d="M54 72H108L100 120H62Z" fill="#b77770"/><path d="M80 77Q35 48 45 15Q79 28 80 77M82 78Q116 31 139 40Q126 75 82 78M79 78Q68 22 91 5Q111 43 79 78" fill="#71977d" stroke="#4e7565" stroke-width="4"/>',
lamp:'<path d="M79 43V110" stroke="#6c5965" stroke-width="8"/><path d="M48 45Q80 -5 112 45Z" fill="#e7b77f" stroke="#9b756a" stroke-width="4"/><ellipse cx="80" cy="114" rx="29" ry="7" fill="#765b64"/>',
frame:'<rect x="23" y="10" width="114" height="105" rx="5" fill="#8b614f"/><rect x="32" y="19" width="96" height="87" fill="#f0d9c7"/><rect x="39" y="26" width="82" height="73" fill="#a6c6d1"/><circle cx="99" cy="44" r="13" fill="#f7d69a"/><path d="M39 84Q65 53 84 78T121 67V99H39Z" fill="#71907e"/>',
radio:'<rect x="20" y="30" width="120" height="75" rx="12" fill="#8c624d"/><rect x="28" y="38" width="104" height="59" rx="8" fill="#473e4b"/><circle cx="75" cy="68" r="23" fill="#2d2c3a" stroke="#d5a477" stroke-width="5"/><circle cx="75" cy="68" r="9" fill="#d9b17b"/>',
rug:'<ellipse cx="80" cy="70" rx="68" ry="43" fill="#b9818c"/><ellipse cx="80" cy="70" rx="53" ry="31" fill="none" stroke="#f0d5c8" stroke-width="5"/>',
beanbag:'<path d="M34 95Q18 65 48 35Q80 9 112 35Q143 68 124 99Q105 122 58 113Z" fill="#a78bb0"/>',
poster:'<rect x="32" y="8" width="96" height="114" rx="4" fill="#8b614f"/><rect x="40" y="16" width="80" height="98" fill="#f2d7c8"/><circle cx="80" cy="50" r="21" fill="#e9a9b7"/><path d="M51 99Q80 63 109 99" fill="#8499b0"/>',
speaker:'<rect x="32" y="8" width="96" height="114" rx="9" fill="#514956"/><circle cx="80" cy="48" r="27" fill="#292b39" stroke="#a6a1b0" stroke-width="5"/><circle cx="80" cy="48" r="10" fill="#8b8296"/>',
calendar:'<rect x="28" y="18" width="104" height="98" rx="7" fill="#f2dfd2"/><rect x="28" y="18" width="104" height="25" rx="7" fill="#bd7e8b"/><path d="M53 8V28M106 8V28" stroke="#80626c" stroke-width="7" stroke-linecap="round"/>',
board:'<rect x="22" y="14" width="116" height="102" rx="6" fill="#9a765f"/><rect x="30" y="22" width="100" height="86" fill="#e5cdb6"/><rect x="40" y="33" width="37" height="29" fill="#9cb2c4"/><rect x="83" y="31" width="36" height="27" fill="#d5a1a8"/><rect x="49" y="72" width="65" height="24" fill="#d9bd83"/>'
};return '<svg '+common+'><ellipse cx="80" cy="119" rx="65" ry="7" fill="#241c2c" opacity=".18"/>'+(shapes[type]||shapes.poster)+'</svg>';}
function editor(){
 const p=el('section','profile-world-editor');p.id='profileWorldEditor';p.hidden=true;
 p.innerHTML='<div class="profile-world-editor-heading"><div>MODO DE DECORAÇÃO</div><p>Escolha um cenário animado, ajuste a atmosfera e organize os objetos do seu cantinho.</p></div><section class="profile-scene-library"><div class="profile-scene-library-heading"><strong>Galeria de cenários</strong><small>Escolha um fundo pronto para o seu espaço. Os cenários disponíveis aparecem aqui automaticamente.</small></div><div class="profile-scene-grid" id="worldSceneGallery"></div><p class="profile-scene-empty" id="worldSceneEmpty">Novos fundos publicados pela administração aparecem aqui automaticamente.</p></section><section class="profile-scene-upload"><div><strong>Cenário personalizado</strong><small>Opcional: envie um fundo exclusivo para este perfil. GIF, WebP, PNG, JPG, AVIF, MP4 ou WebM · até 30 MB.</small></div><label class="profile-scene-file-button" for="worldSceneFile">＋ Escolher cenário</label><input id="worldSceneFile" type="file" accept="image/gif,image/webp,image/png,image/jpeg,image/avif,video/mp4,video/webm" hidden><button type="button" id="worldSceneRemove" class="button button-outline">Remover cenário</button><span id="worldSceneStatus" aria-live="polite"></span></section><section class="profile-music-editor"><div class="profile-music-editor-heading"><strong>Trilha sonora do perfil</strong><small>Envie arquivos de áudio de até 30 MB. Aceitamos formatos reconhecidos como áudio, incluindo MP3, WAV, OGG, Opus, M4A, AAC, FLAC, AIFF, WebM, AMR, 3GP, CAF e MIDI. O envio não depende do suporte de reprodução deste navegador; a reprodução pode variar conforme o formato e o dispositivo de quem visita. Compartilhe somente áudios que você tem direito de usar.</small></div><div class="profile-music-fields"><label>Título da música<input id="worldMusicTrackTitle" maxlength="100" placeholder="Nome da faixa"></label><label>Artista<input id="worldMusicArtist" maxlength="80" placeholder="Nome do artista"></label></div><div class="profile-music-upload-row"><label class="profile-music-rights"><input type="checkbox" id="worldMusicRights"> Confirmo que tenho direito de compartilhar este áudio.</label><label class="profile-music-file-button" for="worldMusicFile">♫ Adicionar música</label><input id="worldMusicFile" type="file" accept="audio/*,.mp3,.wav,.wave,.ogg,.oga,.opus,.m4a,.m4b,.aac,.flac,.aif,.aiff,.webm,.amr,.3gp,.caf,.mid,.midi" hidden><button type="button" id="worldMusicRemove" class="button button-outline">Remover música</button><span id="worldMusicStatus" aria-live="polite"></span></div><audio id="worldMusicPreview" controls preload="none" hidden></audio></section><div class="profile-world-editor-look"><label>Estilo<select id="worldThemeSelect"><option value="lofi">Lo-fi aconchegante</option><option value="anime">Anime</option><option value="pixel">Pixel art</option><option value="scrapbook">Scrapbook</option><option value="aurora">Aurora</option><option value="midnight">Noite neon</option><option value="sunset">Pôr do sol</option><option value="forest">Floresta</option><option value="rose">Rosa</option></select></label><label>Horário<select id="worldTimeSelect"><option value="dawn">Amanhecer</option><option value="day">Dia</option><option value="sunset">Fim de tarde</option><option value="night">Noite</option></select></label><label>Clima<select id="worldWeatherSelect"><option value="clear">Céu limpo</option><option value="rain">Chuva</option><option value="snow">Neve</option><option value="petals">Pétalas ao vento</option></select></label><label>Cor de destaque<input type="color" id="worldAccentSelect"></label><label class="profile-font-control">Tipografia do perfil<select id="worldFontSelect"><option value="nunito">Nunito · arredondada</option><option value="poppins">Poppins · moderna</option><option value="space-grotesk">Space Grotesk · contemporânea</option><option value="comfortaa">Comfortaa · divertida</option><option value="playfair-display">Playfair Display · elegante</option><option value="roboto-slab">Roboto Slab · editorial</option><option value="dm-mono">DM Mono · monoespaçada</option><option value="system">Padrão do sistema</option></select><small>Altera o nome, títulos, abas e textos do seu espaço.</small></label></div><div class="profile-world-content-editor"><strong>Detalhes do seu espaço</strong><div class="profile-world-content-grid">'+[['Frase do momento','worldQuote'],['Título da contagem','worldCountdownTitle'],['Jogos favoritos','worldGames'],['Hobbies / setup','worldSetup']].map(x=>'<label>'+x[0]+'<input id="'+x[1]+'"></label>').join('')+'<label>Data da contagem regressiva<input type="date" id="worldCountdownDate"></label><label class="world-links-label">Links (um por linha: nome | URL)<textarea id="worldLinks" rows="2"></textarea></label></div></div><div class="profile-world-editor-footer"><span class="world-editor-hint" id="worldEditorHint">Arraste os objetos para mudar sua posição.</span><div><button type="button" class="button button-outline" id="worldCancelEdit">Cancelar</button><button type="button" class="button button-primary" id="worldSaveEdit">Salvar ambiente</button></div></div>';
 return p;
}

let activeProfileAudio=null;
const PROFILE_MUSIC_AUTOPLAY_KEY='brazilly-profile-music-autoplay';
function musicPreference(key,fallback){try{const value=localStorage.getItem(key);return value===null?fallback:value;}catch{return fallback;}}
function buildProfileMusicPlayer(s){
 if(!s.musicPath)return null;
 const url=db.storage.from('profile-music').getPublicUrl(s.musicPath).data?.publicUrl;
 if(!url)return null;
 const player=el('div','profile-music-player');
 const toggle=el('button','profile-music-play','▶');toggle.type='button';toggle.setAttribute('aria-label','Reproduzir música');
 const copy=el('span','profile-music-copy');
 const title=el('span','profile-music-title',s.musicTrackTitle||'Música do perfil');
 const artist=el('span','profile-music-artist',s.musicArtist||'');
 copy.append(title);if(s.musicArtist)copy.append(artist);
 const auto=el('button','profile-music-autoplay','AUTO');auto.type='button';auto.setAttribute('aria-label','Ativar reprodução automática nos perfis');
 const mute=el('button','profile-music-mute','♫');mute.type='button';mute.setAttribute('aria-label','Ativar ou desativar o som');
 const volume=el('input','profile-music-volume');volume.type='range';volume.min='0';volume.max='1';volume.step='.05';volume.setAttribute('aria-label','Volume da música');
 const audio=el('audio','profile-music-audio');audio.preload='none';audio.src=url;const savedVolume=Number(musicPreference('brazilly-profile-music-volume','.42'));audio.volume=Number.isFinite(savedVolume)?Math.max(0,Math.min(1,savedVolume)):0.42;audio.muted=musicPreference('brazilly-profile-music-muted','0')==='1';
 volume.value=String(audio.volume);mute.textContent=audio.muted?'×':'♫';
 let autoplay=musicPreference(PROFILE_MUSIC_AUTOPLAY_KEY,'0')==='1';
 const syncAuto=()=>{auto.classList.toggle('is-active',autoplay);auto.setAttribute('aria-pressed',String(autoplay));auto.title=autoplay?'Reprodução automática ativada':'Ativar reprodução automática nos perfis';};
 syncAuto();
 audio.addEventListener('play',()=>{if(activeProfileAudio&&activeProfileAudio!==audio)activeProfileAudio.pause();activeProfileAudio=audio;toggle.textContent='Ⅱ';toggle.setAttribute('aria-label','Pausar música');});
 audio.addEventListener('pause',()=>{if(activeProfileAudio===audio)activeProfileAudio=null;toggle.textContent='▶';toggle.setAttribute('aria-label','Reproduzir música');});
 audio.addEventListener('ended',()=>{toggle.textContent='▶';toggle.setAttribute('aria-label','Reproduzir música');});
 toggle.addEventListener('click',async()=>{if(!audio.paused){audio.pause();return;}try{await audio.play();}catch{toggle.title='O navegador bloqueou a reprodução. Clique novamente para tocar.';}});
 mute.addEventListener('click',()=>{audio.muted=!audio.muted;mute.textContent=audio.muted?'×':'♫';try{localStorage.setItem('brazilly-profile-music-muted',audio.muted?'1':'0');}catch{}});
 volume.addEventListener('input',()=>{audio.volume=Number(volume.value);audio.muted=audio.volume===0;mute.textContent=audio.muted?'×':'♫';try{localStorage.setItem('brazilly-profile-music-volume',String(audio.volume));localStorage.setItem('brazilly-profile-music-muted',audio.muted?'1':'0');}catch{}});
 auto.addEventListener('click',()=>{autoplay=!autoplay;try{localStorage.setItem(PROFILE_MUSIC_AUTOPLAY_KEY,autoplay?'1':'0');}catch{}syncAuto();if(autoplay)audio.play().catch(()=>{toggle.title='O navegador bloqueou a reprodução automática. Use o botão de play.';});else audio.pause();});
 player.append(toggle,copy,auto,mute,volume,audio);
 if(autoplay)requestAnimationFrame(()=>{if(player.isConnected)audio.play().catch(()=>{toggle.title='O navegador bloqueou a reprodução automática. Use o botão de play.';});});
 return player;
}

function markup(profile,s,photosList,editable){
 const shell=el('section','profile-custom-shell');shell.dataset.theme=s.theme;shell.style.setProperty('--profile-accent',s.accent);applyProfileFont(shell,s.fontFamily);
 const stage=el('div','profile-world-stage profile-world-stage-2d');stage.setAttribute('aria-label','Ambiente ilustrado interativo do perfil');
 const bg=el('div','profile-world-art-layer');bg.innerHTML=scene(s);stage.append(bg);
 const depth=el('div','profile-world-parallax-layer');depth.innerHTML='<span class="world-light-beam"></span><span class="world-glow-orb"></span>';stage.append(depth);
 const objects=el('div','profile-world-objects');stage.append(objects);
 const canvas=el('canvas','profile-world-weather');canvas.setAttribute('aria-hidden','true');stage.append(canvas);
 const top=el('div','profile-world-topline');top.append(el('span','world-brand-label','BRAZILLY / MEU ESPAÇO'));const musicPlayer=buildProfileMusicPlayer(s);if(musicPlayer)top.append(musicPlayer);else top.append(el('span','world-explore-label','um cantinho só meu'));stage.append(top);
 const identity=el('div','profile-world-identity'),avatar=el('div','profile-world-avatar');if(photosList[0])avatar.style.backgroundImage='url("'+photosList[0].replace(/["\\]/g,'')+'")';else avatar.textContent=(profile.display_name||profile.name||'B').trim().slice(0,1).toUpperCase();const name=el('div','world-identity-copy',profile.display_name||profile.name||'Meu espaço');if(profile.city)name.append(el('small','world-identity-location',profile.city));identity.append(name);stage.append(identity);avatar.classList.add('profile-world-featured-avatar');avatar.setAttribute('aria-label','Foto principal do perfil');stage.append(avatar);
 const panel=el('aside','profile-world-info-panel');panel.hidden=true;const close=el('button','world-info-close','×');close.type='button';const info=el('div','world-info-content profile-world-info-content');panel.append(close,info);stage.append(panel);close.addEventListener('click',()=>panel.hidden=true);
 let edit=null;if(editable){edit=el('button','world-edit-trigger','✦ Decorar meu espaço');edit.type='button';edit.addEventListener('click',()=>setMode(!($('profileWorldEditor')&&!$('profileWorldEditor').hidden)));stage.append(edit);}else stage.append(el('span','world-visitor-note','Este é um espaço pessoal'));
 const hint=el('span','world-stage-hint','Explore o cenário · Personalize cada detalhe');stage.append(hint);
 const ed=editable?editor():null;shell.append(stage);if(ed)shell.append(ed);return {shell,stage,bg,depth,objects,canvas,panel,info,editor:ed,hint};
}
function setMode(on){const root=document.querySelector('#profileCustomizationPreview .profile-custom-shell');if(!root)return;const p=$('profileWorldEditor'),b=root.querySelector('.world-edit-trigger');if(p)p.hidden=!on;if(b)b.textContent=on?'✦ Concluir decoração':'✦ Decorar meu espaço';root.classList.toggle('is-editing',on);root._profileWorld?.setEditing(on);const h=root.querySelector('.world-stage-hint');if(h)h.textContent=on?'Arraste os objetos para organizar seu quarto.':'Explore o cenário · Personalize cada detalhe';if(on&&p){requestAnimationFrame(()=>{const target=p.querySelector('.profile-scene-library')||p;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});}}
function infoContent(type,p,s,photosList){const f=document.createDocumentFragment(),titles={bed:'Sobre mim',desk:'Meu setup e hobbies',shelf:'Jogos favoritos',plant:'Meus interesses',lamp:'Frase do momento',frame:'Minha galeria',poster:'Minha galeria',radio:'Minha música',speaker:'Minha música',calendar:'Contagem regressiva',board:'Meus links'};f.append(el('span','world-info-kicker','UM OBJETO DO MEU ESPAÇO'),el('h3','',titles[type]||'Meu espaço'));const txt=x=>f.append(el('p','',x)),w=widgets[type]||'about';if(w==='about'){txt(p.bio||'Ainda não escrevi sobre mim.');if(s.quote)f.append(el('blockquote','world-info-quote','“'+s.quote+'”'));}if(w==='setup')txt(s.setup||'Meus hobbies e meu setup ainda não foram preenchidos.');if(w==='games')txt(s.games||'Meus jogos favoritos ainda não foram adicionados.');if(w==='interests'){const d=el('div','world-info-tags');(p.interests||[]).forEach(x=>d.append(el('span','',x)));f.append(d);}if(w==='gallery'){const d=el('div','world-info-gallery');photosList.forEach(url=>{const a=el('a','');a.href=url;a.target='_blank';a.rel='noopener noreferrer';const img=el('img','');img.src=url;img.alt='Foto do perfil';a.append(img);d.append(a);});f.append(d);}if(w==='music'){txt(s.musicTrackTitle?(s.musicTrackTitle+(s.musicArtist?' · '+s.musicArtist:'')):(s.music||'Ainda não escolhi uma música.'));const u=safeUrl(s.musicUrl);if(u){const a=el('a','world-info-link','Abrir música ↗');a.href=u;a.target='_blank';a.rel='noopener noreferrer';f.append(a);}}if(w==='quote')f.append(el('blockquote','world-info-quote',s.quote||'Ainda não há uma frase do momento.'));if(w==='countdown'){if(s.countdownDate){const days=Math.ceil((new Date(s.countdownDate+'T00:00:00')-new Date(new Date().toDateString()))/86400000);f.append(el('strong','world-countdown-number',days<0?'Chegou!':days===0?'É hoje!':String(days)),el('p','',s.countdownTitle||'Contagem regressiva'));}else txt('Adicione uma data no editor.');}if(w==='links'){const d=el('div','world-info-links');s.links.forEach(x=>{const u=safeUrl(x.url);if(u){const a=el('a','world-info-link',x.label+' ↗');a.href=u;a.target='_blank';a.rel='noopener noreferrer';d.append(a);}});f.append(d);}return f;}
function world(m,p,s,photosList){
 let editing=false,selected=null,raf=0,visible=true,stopped=false,drag=null;const nodes=new Map(),ctx=m.canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let w=0,h=0,dpr=1,particles=[];
 const setSelected=id=>{selected=id;nodes.forEach((n,k)=>n.classList.toggle('is-selected',k===id));const item=s.room.items.find(x=>x.id===id);const n=$('worldSelectedObjectName'),r=$('worldRotateObject'),d=$('worldRemoveObject');if(n)n.textContent=item?labels[item.type]:'Nenhum objeto selecionado';if(r)r.disabled=!item;if(d)d.disabled=!item;};
 const pos=(n,x)=>{n.style.left=((x.x+4.7)/9.4*100)+'%';n.style.top=((x.z+3.55)/6.55*100)+'%';n.style.transform='translate(-50%,-50%) rotate('+x.rotation+'rad)';};
 const draw=()=>{m.objects.replaceChildren();nodes.clear();s.room.items.forEach(x=>{const b=el('button','profile-world-object world-object-'+x.type);b.type='button';b.dataset.itemId=x.id;b.setAttribute('aria-label',labels[x.type]);b.innerHTML=art(x.type);pos(b,x);b.addEventListener('pointerdown',e=>{if(!editing)return;e.preventDefault();b.setPointerCapture(e.pointerId);drag={id:x.id,x:e.clientX,y:e.clientY,ox:x.x,oz:x.z};setSelected(x.id);});b.addEventListener('pointermove',e=>{if(!drag||drag.id!==x.id)return;const r=m.stage.getBoundingClientRect();x.x=Math.max(-4.7,Math.min(4.7,drag.ox+(e.clientX-drag.x)/r.width*9.4));x.z=Math.max(-3.55,Math.min(3,drag.oz+(e.clientY-drag.y)/r.height*6.55));pos(b,x);});['pointerup','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>drag=null));b.addEventListener('click',()=>{if(editing){setSelected(x.id);return;}m.info.replaceChildren(infoContent(x.type,p,s,photosList));m.panel.hidden=false;});m.objects.append(b);nodes.set(x.id,b);});};
 const resize=()=>{const r=m.stage.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(devicePixelRatio||1,1.5);m.canvas.width=Math.round(w*dpr);m.canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const count=s.room.weather==='rain'?140:s.room.weather==='snow'?65:s.room.weather==='petals'?30:0;particles=Array.from({length:count},()=>({x:Math.random()*w,y:Math.random()*h,v:.7+Math.random()*2.4,size:.6+Math.random()*1.8,a:Math.random()*6}));};
 const paint=()=>{ctx.clearRect(0,0,w,h);particles.forEach(q=>{q.y+=q.v*(s.room.weather==='rain'?5:1);q.x+=Math.sin(q.a+=.01)*.6+(s.room.weather==='rain'?-.8:.2);if(q.y>h+15){q.y=-15;q.x=Math.random()*w;}if(s.room.weather==='rain'){ctx.strokeStyle='rgba(220,235,255,.48)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-4,q.y+13);ctx.stroke();}else if(s.room.weather==='snow'){ctx.fillStyle='rgba(255,255,255,.82)';ctx.beginPath();ctx.arc(q.x,q.y,q.size*1.5,0,7);ctx.fill();}else{ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a);ctx.fillStyle='rgba(255,190,211,.8)';ctx.beginPath();ctx.ellipse(0,0,3,6,0,0,7);ctx.fill();ctx.restore();}});};
 const loop=()=>{if(stopped||!m.stage.isConnected){dispose();return;}if(!visible||document.hidden){raf=0;return;}if(!reduced)paint();raf=requestAnimationFrame(loop);};
 const start=()=>{if(!raf&&!document.hidden&&visible&&!reduced)raf=requestAnimationFrame(loop);};
 const ro=new ResizeObserver(resize);ro.observe(m.stage);resize();const io='IntersectionObserver'in window?new IntersectionObserver(es=>{visible=es.some(x=>x.isIntersecting);if(visible)start();else if(raf){cancelAnimationFrame(raf);raf=0;}}):null;io?.observe(m.stage);
 const vis=()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else start();};document.addEventListener('visibilitychange',vis);
 const pointer=e=>{if(editing)return;const r=m.stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;m.bg.style.transform='translate('+(-x*9)+'px,'+(-y*7)+'px) scale(1.025)';m.depth.style.transform='translate('+(-x*16)+'px,'+(-y*12)+'px)';};const leave=()=>{m.bg.style.transform='';m.depth.style.transform='';};m.stage.addEventListener('pointermove',pointer);m.stage.addEventListener('pointerleave',leave);
 const apply=()=>{if(!s.room.preset&&!s.room.background)m.bg.innerHTML=scene(s);m.stage.dataset.weather=s.room.weather;m.stage.dataset.time=s.room.time;m.stage.closest('.profile-custom-shell').dataset.theme=s.theme;m.stage.closest('.profile-custom-shell').style.setProperty('--profile-accent',s.accent);resize();};
 const dispose=()=>{if(stopped)return;stopped=true;if(raf)cancelAnimationFrame(raf);io?.disconnect();ro.disconnect();document.removeEventListener('visibilitychange',vis);m.stage.removeEventListener('pointermove',pointer);m.stage.removeEventListener('pointerleave',leave);};
 draw();apply();start();return {dispose,draw,apply,setEditing(v){editing=!!v;m.stage.classList.toggle('is-editing',editing);},setSelected,rotate(){const x=s.room.items.find(a=>a.id===selected);if(x){x.rotation+=Math.PI/4;pos(nodes.get(x.id),x);}},remove(){if(!selected)return;s.room.items=s.room.items.filter(x=>x.id!==selected);setSelected(null);draw();}};
}
async function render(root,profile,raw,editable=false){
 if(!root||!profile)return;const version=(renderVersions.get(root)||0)+1;renderVersions.set(root,version);const s=norm(raw),scenePresets=await loadSceneCatalog(),photosList=await photos(profile),m=markup(profile,s,photosList,editable);if(s.room.preset){const preset=scenePresets.find(x=>x.id===s.room.preset);if(preset){const media=sceneMedia(preset);media.onerror=()=>{media.remove();};m.bg.replaceChildren(media);}}else if(s.room.background){const {data,error}=await db.storage.from('profile-scenes').createSignedUrl(s.room.background,3600);if(!error&&data?.signedUrl){const media=s.room.backgroundType==='mp4'||s.room.backgroundType==='webm'?el('video','profile-world-animated-background'):el('img','profile-world-animated-background');if(media.tagName==='VIDEO'){media.src=data.signedUrl;media.autoplay=true;media.loop=true;media.muted=true;media.playsInline=true;media.preload='metadata';media.setAttribute('aria-hidden','true');}else{media.src=data.signedUrl;media.alt='Papel de parede do perfil';media.draggable=false;}m.bg.replaceChildren(media);}}if(renderVersions.get(root)!==version)return;cleanup.get(root)?.();if(activeProfileAudio){activeProfileAudio.pause();activeProfileAudio=null;}root.replaceChildren(m.shell);const ctl=world(m,profile,s,photosList);m.shell._profileWorld=ctl;cleanup.set(root,()=>ctl.dispose());if(!editable)return;
 const fill=(id,v)=>{const n=$(id);if(n)n.value=v??'';};fill('worldThemeSelect',s.theme);fill('worldTimeSelect',s.room.time);$('worldSceneRemove').disabled=!(s.room.background||s.room.preset);if(s.room.background)$('worldSceneStatus').textContent='Cenário personalizado ativo.';fill('worldWeatherSelect',s.room.weather);fill('worldAccentSelect',s.accent);fill('worldFontSelect',s.fontFamily);fill('worldQuote',s.quote);fill('worldMusic',s.music);fill('worldMusicUrl',s.musicUrl);fill('worldMusicTrackTitle',s.musicTrackTitle);fill('worldMusicArtist',s.musicArtist);fill('worldGames',s.games);fill('worldSetup',s.setup);fill('worldCountdownTitle',s.countdownTitle);fill('worldCountdownDate',s.countdownDate);fill('worldLinks',s.links.map(x=>x.label+' | '+x.url).join('\n'));
 const gallery=$('worldSceneGallery'),empty=$('worldSceneEmpty');let originalMusicPath=s.musicPath||'',pendingMusicPath='';const musicPreview=$('worldMusicPreview'),musicRemove=$('worldMusicRemove');musicRemove.disabled=!s.musicPath;if(s.musicPath){const existingMusicUrl=db.storage.from('profile-music').getPublicUrl(s.musicPath).data?.publicUrl;if(existingMusicUrl){musicPreview.src=existingMusicUrl;musicPreview.hidden=false;$('worldMusicStatus').textContent='Música atual carregada. Você pode ouvir a prévia ou substituí-la.';}}scenePresets.forEach(preset=>{const card=el('button','profile-scene-card');card.type='button';card.dataset.scenePreset=preset.id;const thumb=el(['video/mp4','video/webm'].includes(preset.mime_type)?'video':'img','');thumb.src=preset.file;thumb.alt='';thumb.loading='lazy';if(thumb.tagName==='VIDEO'){thumb.muted=true;thumb.loop=true;thumb.autoplay=true;thumb.playsInline=true;}thumb.onerror=()=>card.remove();card.append(thumb,el('span','',preset.name));card.addEventListener('click',()=>{s.room.preset=preset.id;s.room.background='';s.room.backgroundType='';const media=sceneMedia(preset);media.onerror=()=>{$('worldSceneStatus').textContent='Não foi possível carregar este cenário.';};m.bg.replaceChildren(media);gallery.querySelectorAll('.profile-scene-card').forEach(x=>x.classList.toggle('is-active',x===card));$('worldSceneRemove').disabled=false;$('worldSceneStatus').textContent='Prévia: '+preset.name+'. Salve para publicar.';});gallery.append(card);});if(empty){empty.hidden=scenePresets.length>0;empty.textContent='Ainda não há cenários publicados. Novos fundos aparecerão aqui automaticamente.';}gallery.querySelectorAll('.profile-scene-card').forEach(x=>x.classList.toggle('is-active',x.dataset.scenePreset===s.room.preset));
 m.editor.querySelectorAll('[data-world-add]').forEach(b=>b.addEventListener('click',()=>{if(s.room.items.length>=24){$('worldEditorHint').textContent='Limite de 24 objetos atingido.';return;}const type=b.dataset.worldAdd,x={id:'item-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),type,x:(Math.random()-.5)*5,z:(Math.random()-.5)*3,rotation:0};s.room.items.push(x);ctl.draw();ctl.setSelected(x.id);}));
 const update=()=>{s.theme=$('worldThemeSelect').value;s.fontFamily=$('worldFontSelect').value;applyProfileFont(m.shell,s.fontFamily);s.room.time=$('worldTimeSelect').value;s.room.weather=$('worldWeatherSelect').value;s.accent=$('worldAccentSelect').value;ctl.apply();};$('worldSceneFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const status=$('worldSceneStatus');const allowed=['image/gif','image/webp','image/png','image/jpeg','image/avif','video/mp4','video/webm'];if(!allowed.includes(file.type)||file.size>30*1024*1024){status.textContent='Arquivo inválido. Use GIF, WebP, MP4 ou WebM de até 30 MB.';e.target.value='';return;}status.textContent='Enviando cenário...';try{const ext=({'image/gif':'gif','image/webp':'webp','image/png':'png','image/jpeg':'jpg','image/avif':'avif','video/mp4':'mp4','video/webm':'webm'})[file.type];const path=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;const {error}=await db.storage.from('profile-scenes').upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});if(error)throw error;s.room.background=path;s.room.backgroundType=ext;s.room.preset='';const {data,error:signedError}=await db.storage.from('profile-scenes').createSignedUrl(path,3600);if(signedError)throw signedError;const media=ext==='mp4'||ext==='webm'?el('video','profile-world-animated-background'):el('img','profile-world-animated-background');if(media.tagName==='VIDEO'){media.src=signedError? '':data.signedUrl;media.autoplay=true;media.loop=true;media.muted=true;media.playsInline=true;media.preload='metadata';}else{media.src=data.signedUrl;media.alt='Cenário animado do perfil';}m.bg.replaceChildren(media);$('worldSceneRemove').disabled=false;status.textContent='Cenário carregado. Salve para publicar no perfil.';}catch(err){status.textContent='Falha ao enviar: '+err.message;}finally{e.target.value='';}});$('worldSceneRemove').addEventListener('click',()=>{s.room.background='';s.room.backgroundType='';s.room.preset='';m.bg.innerHTML=scene(s);gallery.querySelectorAll('.profile-scene-card').forEach(x=>x.classList.remove('is-active'));$('worldSceneRemove').disabled=true;$('worldSceneStatus').textContent='Cenário padrão restaurado. Salve para confirmar.';});
 $('worldMusicFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;const status=$('worldMusicStatus');
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  const formats={
   mp3:{mime:'audio/mpeg',label:'MP3'},wav:{mime:'audio/wav',label:'WAV'},wave:{mime:'audio/wav',label:'WAV'},
   ogg:{mime:'audio/ogg',label:'OGG'},oga:{mime:'audio/ogg',label:'OGA'},opus:{mime:'audio/ogg',label:'Opus'},
   m4a:{mime:'audio/mp4',label:'M4A'},m4b:{mime:'audio/mp4',label:'M4A'},aac:{mime:'audio/aac',label:'AAC'},
   flac:{mime:'audio/flac',label:'FLAC'},aif:{mime:'audio/aiff',label:'AIFF'},aiff:{mime:'audio/aiff',label:'AIFF'},
   webm:{mime:'audio/webm',label:'WebM'},amr:{mime:'audio/amr',label:'AMR'},'3gp':{mime:'audio/3gpp',label:'3GP'},
   caf:{mime:'audio/x-caf',label:'CAF'},mid:{mime:'audio/midi',label:'MIDI'},midi:{mime:'audio/midi',label:'MIDI'}
  };
  const knownFormat=formats[ext];
  const mime=knownFormat?.mime||(file.type&&file.type.toLowerCase().startsWith('audio/')?file.type.split(';')[0]:'');
  const label=knownFormat?.label||mime||'áudio';
  if(!mime||file.size>30*1024*1024){status.textContent='Selecione um arquivo de áudio reconhecido, com até 30 MB.';e.target.value='';return;}
  if(!$('worldMusicRights').checked){status.textContent='Confirme que tem direito de compartilhar este arquivo antes do envio.';e.target.value='';return;}
  // Não bloquear o envio com canPlayType(): essa API só indica suporte de reprodução
  // do navegador atual, não se o arquivo pode ser armazenado no Supabase.
  status.textContent='Enviando áudio...';const oldPending=pendingMusicPath;
  try{
   const path=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;
   const {error}=await db.storage.from('profile-music').upload(path,file,{contentType:mime,cacheControl:'31536000',upsert:false});if(error)throw error;
   pendingMusicPath=path;if(oldPending&&oldPending!==originalMusicPath)await db.storage.from('profile-music').remove([oldPending]);
   s.musicPath=path;if(!$('worldMusicTrackTitle').value.trim())$('worldMusicTrackTitle').value=file.name.replace(/\.[^.]+$/,'');
   const publicUrl=db.storage.from('profile-music').getPublicUrl(path).data.publicUrl;musicPreview.src=publicUrl;musicPreview.hidden=false;musicRemove.disabled=false;
   status.textContent=label+' enviado. A prévia depende do suporte deste navegador. Salve o ambiente para publicar a música.';
  }catch(error){status.textContent='Falha ao enviar áudio: '+error.message;}finally{e.target.value='';}
 });
 musicRemove.addEventListener('click',async()=>{
  if(pendingMusicPath&&pendingMusicPath!==originalMusicPath){await db.storage.from('profile-music').remove([pendingMusicPath]);pendingMusicPath='';}
  s.musicPath='';$('worldMusicTrackTitle').value='';$('worldMusicArtist').value='';musicPreview.pause();musicPreview.removeAttribute('src');musicPreview.load();musicPreview.hidden=true;musicRemove.disabled=true;$('worldMusicStatus').textContent='Música removida da prévia. Salve para confirmar.';
 });
$('worldFontSelect').addEventListener('change',update);['worldThemeSelect','worldTimeSelect','worldWeatherSelect'].forEach(id=>$(id).addEventListener('change',update));$('worldAccentSelect').addEventListener('input',update);$('worldCancelEdit').addEventListener('click',async()=>{if(pendingMusicPath&&pendingMusicPath!==originalMusicPath)await db.storage.from('profile-music').remove([pendingMusicPath]);renderOwn();});
 $('worldSaveEdit').addEventListener('click',async()=>{const b=$('worldSaveEdit'),hint=$('worldEditorHint');if(!currentUser)return;b.disabled=true;b.textContent='Salvando...';try{s.fontFamily=$('worldFontSelect').value;s.quote=$('worldQuote').value.trim();if($('worldMusic'))s.music=$('worldMusic').value.trim();if($('worldMusicUrl'))s.musicUrl=$('worldMusicUrl').value.trim();s.musicTrackTitle=$('worldMusicTrackTitle').value.trim();s.musicArtist=$('worldMusicArtist').value.trim();s.games=$('worldGames').value.trim();s.setup=$('worldSetup').value.trim();s.countdownTitle=$('worldCountdownTitle').value.trim();s.countdownDate=$('worldCountdownDate').value;s.links=$('worldLinks').value.split('\n').map(line=>{const a=line.split('|');return{label:(a.shift()||'').trim(),url:a.join('|').trim()};}).filter(x=>x.label&&safeUrl(x.url)).slice(0,8);const saved=norm(s),{error}=await db.from('profile_customizations').upsert({user_id:currentUser.id,settings:saved,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;cache.set(currentUser.id,saved);currentProfile.profileCustomization=saved;if(originalMusicPath&&originalMusicPath!==saved.musicPath)await db.storage.from('profile-music').remove([originalMusicPath]);pendingMusicPath='';await renderOwn();}catch(e){hint.textContent='Não foi possível salvar: '+e.message;}finally{b.disabled=false;b.textContent='Salvar ambiente';}});
}

function installProfilePhotoViewer(root){
 if(!root||root.dataset.photoViewerReady==='true')return;
 root.dataset.photoViewerReady='true';
 const overlay=el('div','profile-photo-viewer');
 overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Visualização de fotos');
 const image=el('img','profile-photo-viewer-image');image.alt='Foto ampliada do perfil';
 const close=el('button','profile-photo-viewer-close','×');close.type='button';close.setAttribute('aria-label','Fechar foto');
 const previous=el('button','profile-photo-viewer-prev','‹');previous.type='button';previous.setAttribute('aria-label','Foto anterior');
 const next=el('button','profile-photo-viewer-next','›');next.type='button';next.setAttribute('aria-label','Próxima foto');
 const count=el('span','profile-photo-viewer-count');
 overlay.append(image,close,previous,next,count);root.append(overlay);
 let urls=[],index=0,lastFocus=null;
 const render=()=>{image.src=urls[index];count.textContent=(index+1)+' / '+urls.length;previous.disabled=urls.length<2;next.disabled=urls.length<2;};
 const hide=()=>{overlay.hidden=true;image.removeAttribute('src');document.body.classList.remove('profile-photo-viewer-open');if(lastFocus?.isConnected)lastFocus.focus();};
 const show=(items,at,trigger)=>{urls=items;index=at;lastFocus=trigger;render();overlay.hidden=false;document.body.classList.add('profile-photo-viewer-open');close.focus();};
 const move=step=>{if(urls.length<2)return;index=(index+step+urls.length)%urls.length;render();};
 root.addEventListener('click',event=>{
  const thumb=event.target.closest('.preview-photos img,.profile-world-mini-gallery img,.public-world-gallery img');
  if(!thumb||!root.contains(thumb))return;
  const gallery=thumb.closest('.preview-photos,.profile-world-mini-gallery,.public-world-gallery');
  const imgs=[...(gallery?.querySelectorAll('img')||[thumb])].filter(item=>item.src);
  const current=Math.max(0,imgs.indexOf(thumb));
  event.preventDefault();show(imgs.map(item=>item.currentSrc||item.src),current,thumb);
 });
 root.addEventListener('keydown',event=>{
  if(event.target.matches('.preview-photos img,.profile-world-mini-gallery img,.public-world-gallery img')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.target.click();}
 });
 close.addEventListener('click',hide);previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
 overlay.addEventListener('click',event=>{if(event.target===overlay)hide();});
 document.addEventListener('keydown',event=>{if(overlay.hidden)return;if(event.key==='Escape')hide();if(event.key==='ArrowLeft')move(-1);if(event.key==='ArrowRight')move(1);});
}
function profileCatMascot(){
 const mascot=el('div','profile-cat-mascot');
 mascot.setAttribute('aria-hidden','true');
 mascot.innerHTML='<svg viewBox="0 0 260 150" role="presentation">'+
 '<defs><linearGradient id="catFur" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0d9"/><stop offset=".55" stop-color="#e9c7a5"/><stop offset="1" stop-color="#bd8c70"/></linearGradient><linearGradient id="catShade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d6a987"/><stop offset="1" stop-color="#a97560"/></linearGradient><radialGradient id="catCheek"><stop stop-color="#f3a9a0" stop-opacity=".8"/><stop offset="1" stop-color="#f3a9a0" stop-opacity="0"/></radialGradient></defs>'+
 '<ellipse cx="143" cy="111" rx="91" ry="13" fill="#090817" opacity=".2"/>'+
 '<g class="profile-cat-tail"><path d="M205 82C236 74 244 48 228 30C216 17 199 24 204 39" fill="none" stroke="#bd8c70" stroke-width="16" stroke-linecap="round"/><path d="M205 82C236 74 244 48 228 30C216 17 199 24 204 39" fill="none" stroke="#f2d8bd" stroke-width="9" stroke-linecap="round"/><path d="M226 31Q233 36 230 44" fill="none" stroke="#c18d70" stroke-width="3" stroke-linecap="round"/></g>'+
 '<g class="profile-cat-body"><path d="M73 79C91 45 133 36 177 49C201 56 215 76 210 96C206 116 178 123 132 119L82 112C57 108 51 94 73 79Z" fill="url(#catFur)" stroke="#a87862" stroke-width="2.5"/><path d="M103 52Q119 70 110 91M145 48Q159 68 148 91M179 58Q189 74 177 94" fill="none" stroke="#b98268" stroke-width="7" stroke-linecap="round" opacity=".58"/><path d="M95 107Q115 121 133 117M157 116Q179 121 193 109" fill="none" stroke="#fff1dc" stroke-width="5" stroke-linecap="round"/></g>'+
 '<path d="M90 91Q87 112 95 129Q102 139 115 133L122 122L117 107Z" fill="#e9c7a5" stroke="#a87862" stroke-width="2"/><path d="M153 102Q151 122 163 135Q175 141 183 129L181 111Z" fill="#e9c7a5" stroke="#a87862" stroke-width="2"/><path d="M94 128Q104 134 116 128M163 131Q174 136 182 127" fill="none" stroke="#fff0dc" stroke-width="4" stroke-linecap="round"/>'+
 '<g class="profile-cat-head"><path d="M31 70L35 34Q37 22 48 33L67 49Q82 44 96 51L113 34Q123 26 126 42L130 76Q126 105 93 112Q57 118 37 97Q27 86 31 70Z" fill="url(#catFur)" stroke="#a87862" stroke-width="2.5"/><path d="M39 47L42 35L57 50Z" fill="#d99591"/><path d="M105 48L119 37L120 58Z" fill="#d99591"/><path d="M46 81Q56 72 66 81M91 81Q101 72 111 81" fill="none" stroke="#684d4b" stroke-width="3.5" stroke-linecap="round"/><path d="M75 91Q81 96 87 91" fill="none" stroke="#684d4b" stroke-width="2.5" stroke-linecap="round"/><path d="M80 86L84 88L80 91L76 88Z" fill="#bd7776"/><path d="M79 92Q77 100 69 99M84 92Q86 100 94 99" fill="none" stroke="#684d4b" stroke-width="2" stroke-linecap="round"/><ellipse cx="49" cy="91" rx="14" ry="10" fill="url(#catCheek)"/><ellipse cx="107" cy="91" rx="14" ry="10" fill="url(#catCheek)"/><path d="M34 89L10 85M35 96L12 99M112 89L135 84M111 97L134 101" stroke="#f8e7d7" stroke-width="2" stroke-linecap="round"/></g>'+
 '</svg>';
 return mascot;
}
function enhanceProfileCard(stage,preview,settings={}){
 if(!stage||!preview||stage.querySelector('.profile-world-profile-card'))return;
 const identity=stage.querySelector('.profile-world-identity');
 const card=el('section','profile-world-profile-card');
 card.append(profileCatMascot());
 const heading=el('div','profile-world-card-heading');
 const featuredAvatar=stage.querySelector('.profile-world-featured-avatar');
 if(featuredAvatar){featuredAvatar.classList.remove('profile-world-featured-avatar');featuredAvatar.classList.add('profile-world-header-avatar');heading.append(featuredAvatar);}
 const intro=el('div','profile-world-card-intro');
 intro.append(el('span','profile-world-card-kicker','SEU ESPAÇO NO BRAZILLY'),el('p','profile-world-card-subtitle','Seu universo, suas histórias e tudo que faz parte de você.'));
 heading.append(intro);
 if(identity)heading.append(identity);
 card.append(heading);
 const tabs=el('nav','profile-world-profile-tabs');
 tabs.setAttribute('aria-label','Seções do perfil');
 const content=el('div','profile-world-profile-content');
 const nodes=[...preview.children];
 const about=el('section','profile-world-tab-panel is-active');about.dataset.profilePanel='about';
 const photosPanel=el('section','profile-world-tab-panel');photosPanel.dataset.profilePanel='photos';
 const interestsPanel=el('section','profile-world-tab-panel');interestsPanel.dataset.profilePanel='interests';
 const universePanel=el('section','profile-world-tab-panel');universePanel.dataset.profilePanel='universe';
 const details=el('div','profile-world-detail-grid');
 let bioNode=null,statusNode=null,photosNode=null,tagsNode=null,interestsTitle=null;
 nodes.forEach(node=>{
  if(node.matches('.profile-activity-status'))statusNode=node;
  else if(node.matches('.preview-photos'))photosNode=node;
  else if(node.matches('.preview-tags'))tagsNode=node;
  else if(node.tagName==='H3')interestsTitle=node;
  else if(node.tagName==='H2'){}
  else if(node.classList.contains('field-note'))details.append(node);
  else if(node.tagName==='P')bioNode=node;
 });
 const aboutGrid=el('div','profile-world-about-grid');
 const aboutMain=el('div','profile-world-about-main');
 const aboutAside=el('aside','profile-world-about-aside');
 if(statusNode)aboutMain.append(statusNode);
 if(bioNode)aboutMain.append(el('h3','profile-world-section-title','Sobre mim'),bioNode);
 if(details.childElementCount)aboutMain.append(el('h3','profile-world-section-title','Mais sobre mim'),details);
 if(!aboutMain.childElementCount)aboutMain.append(el('p','profile-world-empty','Este perfil ainda não tem uma descrição.'));
 const galleryCard=el('section','profile-world-side-card profile-world-gallery-card');
 const galleryHeading=el('div','profile-world-side-heading');galleryHeading.append(el('span','profile-world-side-eyebrow','MOMENTOS'),el('h3','profile-world-section-title','Fotos recentes'));galleryCard.append(galleryHeading);
 if(photosNode){
  const previewGallery=photosNode.cloneNode(true);
  previewGallery.classList.add('profile-world-mini-gallery');
  galleryCard.append(previewGallery);
  photosPanel.append(el('h3','profile-world-section-title','Minha galeria'),photosNode);
 }else{
  galleryCard.append(el('p','profile-world-empty','Ainda não há fotos publicadas.'));
  photosPanel.append(el('p','profile-world-empty','Ainda não há fotos publicadas.'));
 }
 const interestsCard=el('section','profile-world-side-card profile-world-interests-card');
 const interestsHeading=el('div','profile-world-side-heading');interestsHeading.append(el('span','profile-world-side-eyebrow','O QUE EU CURTO'),el('h3','profile-world-section-title','Interesses'));interestsCard.append(interestsHeading);
 if(tagsNode){
  const previewTags=tagsNode.cloneNode(true);
  previewTags.classList.add('profile-world-mini-tags');
  interestsCard.append(previewTags);
  interestsPanel.append(el('h3','profile-world-section-title','Meus interesses'),tagsNode);
 }else{
  interestsCard.append(el('p','profile-world-empty','Adicione seus interesses ao perfil.'));
  interestsPanel.append(el('p','profile-world-empty','Os interesses ainda não foram adicionados.'));
 }
 aboutAside.append(galleryCard,interestsCard);
 aboutGrid.append(aboutMain,aboutAside);about.append(aboutGrid);
 const soundtrack=[settings.musicTrackTitle,settings.musicArtist].filter(Boolean).join(' · ')||settings.music;const universeItems=[['Jogos favoritos',settings.games],['Hobbies e setup',settings.setup],['Trilha sonora',soundtrack],['Frase do momento',settings.quote]];
 const populated=universeItems.filter(([,value])=>String(value||'').trim());
 if(populated.length){
  const universeGrid=el('div','profile-world-universe-grid');
  populated.forEach(([label,value])=>{const item=el('article','profile-world-universe-item');item.append(el('span','profile-world-universe-label',label),el('p','',String(value)));universeGrid.append(item);});
  universePanel.append(universeGrid);
 }else universePanel.append(el('p','profile-world-empty','Este espaço ainda está esperando seus jogos, hobbies, música e frase favorita.'));
 const sections=[['about','Visão geral'],['photos','Fotos'],['interests','Interesses'],['universe','Meu universo']];
 sections.forEach(([key,label],index)=>{
  const button=el('button','profile-world-tab'+(index===0?' is-active':''),label);
  button.type='button';button.dataset.profileTab=key;button.setAttribute('aria-pressed',index===0?'true':'false');
  button.addEventListener('click',()=>{
   tabs.querySelectorAll('[data-profile-tab]').forEach(b=>{const active=b===button;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');});
   content.querySelectorAll('[data-profile-panel]').forEach(panel=>panel.classList.toggle('is-active',panel.dataset.profilePanel===key));
  });
  tabs.append(button);
 });
 content.append(about,photosPanel,interestsPanel,universePanel);
 preview.classList.add('profile-world-profile-content');
 preview.replaceChildren(content);
 card.append(tabs,preview);
 stage.append(card);
 // Keep the wallpaper stage tall enough to contain the complete profile card.
 // The card itself remains in its existing position; only the scene's height grows.
 const syncStageHeight=()=>{
  const baseHeight=Number(stage.dataset.profileBaseHeight)||stage.getBoundingClientRect().height;
  stage.dataset.profileBaseHeight=String(baseHeight);
  const cardBottom=card.offsetTop+card.offsetHeight+72;
  stage.style.height=Math.max(baseHeight,cardBottom)+'px';
 };
 if(stage._profileCardResizeObserver)stage._profileCardResizeObserver.disconnect();
 if(typeof ResizeObserver!=='undefined'){
  const observer=new ResizeObserver(syncStageHeight);
  observer.observe(card);
  stage._profileCardResizeObserver=observer;
 }
 syncStageHeight();
 installProfilePhotoViewer(stage);
}
async function renderOwn(){if(!currentUser||!currentProfile)return;const version=++ownRenderVersion,userId=currentUser.id;try{const s=await load(userId);if(version!==ownRenderVersion||currentUser?.id!==userId||!$('profileScreen')?.classList.contains('active'))return;currentProfile.profileCustomization=s;const root=$('profileCustomizationPreview');const previewSnapshot=$('profilePreview')?.cloneNode(true)||null;await render(root,currentProfile,s,true);if(version!==ownRenderVersion||currentUser?.id!==userId||!$('profileScreen')?.classList.contains('active'))return;const stage=root?.querySelector('.profile-world-stage-2d');const preview=$('profilePreview')||previewSnapshot,editProfile=$('profileEditButton');if(stage&&preview)enhanceProfileCard(stage,preview,s);if(editProfile)editProfile.classList.remove('profile-world-edit-profile');const page=$('profileScreen');if(page)page.classList.add('profile-world-page');}catch(e){if(version!==ownRenderVersion)return;console.warn(e);if($('profileCustomizationPreview'))$('profileCustomizationPreview').textContent='Não foi possível carregar seu ambiente personalizado.';}}
function publicProfilePreview(p,photosList){
 const preview=el('div','');
 const statusLabels={available:'Disponível',busy:'Ocupado',away:'Ausente',offline:'Offline'};
 const status=el('p','profile-activity-status',(statusLabels[p.activity_status||p.activityStatus]||'Disponível')+((p.activity_note||p.activityNote)?' · '+(p.activity_note||p.activityNote):''));
 preview.append(status);
 const city=p.show_city===false||p.showCity===false?'':(p.city||'');
 if(city)preview.append(el('p','field-note',city));
 if(photosList.length){const gallery=el('div','preview-photos');photosList.forEach(url=>{const img=el('img','');img.src=url;img.alt='Foto do perfil';gallery.append(img);});preview.append(gallery);}
 if(p.bio)preview.append(el('p','',p.bio));
 const fields=[['Gênero',p.gender],['Signo',p.zodiac],['Altura',p.height?String(p.height).replace(/\\s*cm$/i,'')+' cm':''],['Escolaridade',p.education],['Profissão',p.profession],['Religião / crença',p.religion],['Relacionamento',p.relationship_status||p.relationshipStatus],['Personalidade',p.personality],['Pets',p.pets],['Filhos',p.children],['Intenções',(p.intentions||[]).join(', ')]];
 fields.filter(([,value])=>value!==undefined&&value!==null&&String(value).trim()).forEach(([label,value])=>preview.append(el('p','field-note',label+': '+value)));
 if(p.interests?.length){preview.append(el('h3','', 'Interesses'));const tags=el('div','preview-tags');p.interests.forEach(value=>tags.append(el('span','',value)));preview.append(tags);}
 return preview;
}
async function renderPublic(p){
 if(!p?.user_id)return;
 activePublicId=p.user_id;
 try{
  const s=await load(p.user_id);
  if(activePublicId!==p.user_id)return;
  const target=$('profileDetailContent');
  if(!target)return;
  target.querySelector('.profile-public-customization')?.remove();
  const wrap=el('section','profile-public-customization profile-world-page');
  target.replaceChildren(wrap);
  await render(wrap,p,s,false);
  if(activePublicId!==p.user_id){cleanup.get(wrap)?.();wrap.remove();return;}
  const stage=wrap.querySelector('.profile-world-stage-2d');
  if(stage){
   const photoList=await photos(p);
   if(activePublicId!==p.user_id)return;
   const preview=publicProfilePreview(p,photoList);
   enhanceProfileCard(stage,preview,s);
  }
 }catch(e){console.warn('Erro ao carregar ambiente público:',e);}
}
async function openEditor(){if(!currentUser||!currentProfile){alert('Entre na sua conta para personalizar seu perfil.');return;}if(!$('profileCustomizationPreview')?.querySelector('.profile-custom-shell'))await renderOwn();setMode(true);$('profileWorldEditor')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
$('openProfileStudio')?.addEventListener('click',openEditor);document.addEventListener('brazilly:screen-changed',e=>{if(e.detail==='profileScreen')renderOwn();});document.addEventListener('brazilly:profile-opened',e=>renderPublic(e.detail));
})();