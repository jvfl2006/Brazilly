'use strict';

const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll('.screen')];
const headerNav = document.querySelector('.header-nav');
const mobileMenuButton = $('mobileMenuButton');
const STORAGE = { settings: 'brazilly.settings.v1', filters: 'brazilly.filters.v1' };
const SUPABASE_URL = 'https://dcercmjfvcpxlyxmwaan.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_F2wCZyDnPVCCxnv-lrmMdQ_Y6EsbNW1';
const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
let currentUser = null;
let currentProfile = null;
let isModerator = false;
let authReady = false;

async function refreshModerationAccess(){
  isModerator=false;
  if(currentUser){
    const {data,error}=await db.rpc('is_brazilly_moderator');
    if(error)console.warn('Não foi possível verificar acesso à moderação:',error.message);
    else isModerator=Boolean(data);
  }
  updateHeaderAccountButtons();
}
function updateHeaderAccountButtons(){
  const loggedIn=Boolean(currentUser);
  $('signupButton').hidden=loggedIn;
  $('heroSignupButton').hidden=loggedIn;
  $('heroLoginButton').hidden=loggedIn;
  $('featureSignupButton').hidden=loggedIn;
  document.querySelector('.auth-switch-prompt')?.toggleAttribute('hidden',loggedIn);
  $('moderationSettingsGroup').hidden=!isModerator;
  $('emailAccountSettingsGroup').hidden=!loggedIn;
  $('loginButton').textContent=loggedIn?(currentProfile?'Minha conta':'Completar perfil'):'Entrar';
}
async function sendEmailVerificationLink(){
  if(!currentUser?.email){alert('Entre na sua conta primeiro.');return;}
  const button=$('sendEmailVerificationButton');
  if(button){button.disabled=true;button.textContent='Enviando...';}
  try{
    const {error}=await db.auth.signInWithOtp({email:currentUser.email,options:{emailRedirectTo:window.location.origin,shouldCreateUser:false}});
    if(error)throw error;
    localStorage.setItem('brazilly.emailLinkPending',JSON.stringify({userId:currentUser.id,expiresAt:Date.now()+60*60*1000}));
    alert('Enviamos um link para seu e-mail. Abra a mensagem e toque no link para confirmar que você tem acesso a esse endereço. Você continuará com sua conta normalmente.');
    closeModal('emailVerificationModal');
  }catch(error){console.error(error);alert('Não foi possível enviar o link: '+(error.message||'erro desconhecido'));}
  finally{if(button){button.disabled=false;button.textContent='Enviar link de confirmação';}}
}
$('sendEmailVerificationButton').addEventListener('click',sendEmailVerificationLink);
$('settingsEmailVerificationButton').addEventListener('click',sendEmailVerificationLink);
$('skipEmailVerificationButton').addEventListener('click',()=>closeModal('emailVerificationModal'));
function showScreen(id) {
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  headerNav?.classList.remove('open');
  mobileMenuButton?.setAttribute('aria-expanded', 'false');
  if (id === 'discoverScreen') renderProfiles();
  if (id === 'messagesScreen') renderConversationList();
  if (id === 'profileScreen') renderProfilePreview();
  if (id === 'moderationScreen') renderModerationReports();
}
document.querySelectorAll('[data-screen]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); showScreen(el.dataset.screen); }));
document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => showScreen(el.dataset.open)));
document.querySelectorAll('[data-scroll]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); showScreen('homeScreen'); setTimeout(() => $(el.dataset.scroll)?.scrollIntoView({behavior:'smooth'}), 80); }));
$('heroDiscoverButton').addEventListener('click', () => showScreen('discoverScreen'));
$('heroLoginButton').addEventListener('click', () => openModal('loginModal'));
$('authExistingAccountButton').addEventListener('click', () => openModal('loginModal'));
$('settingsButton').addEventListener('click', () => showScreen('settingsScreen'));
mobileMenuButton.addEventListener('click', () => { const open = headerNav.classList.toggle('open'); mobileMenuButton.setAttribute('aria-expanded', String(open)); });

// Cadastro: catálogo amplo e pesquisável de interesses.
const interestData = {
  '🎮 Jogos': ['Minecraft','Grand Theft Auto V','Red Dead Redemption 2','Counter-Strike 2','Valorant','Fortnite','Roblox','Terraria','Elden Ring','The Sims','RimWorld','Factorio','Stardew Valley','Rust','ARK: Survival Evolved','DayZ','The Forest','Sons of the Forest','Subnautica','The Last of Us','God of War','The Witcher 3','Cyberpunk 2077','Baldur’s Gate 3','Skyrim','Dark Souls','Resident Evil','Silent Hill','Outlast','Phasmophobia','Dead by Daylight','Call of Duty','Battlefield','Overwatch 2','Rainbow Six Siege','Apex Legends','League of Legends','Dota 2','Rocket League','Among Us','Fall Guys','Brawl Stars','Clash Royale','Forza Horizon','Gran Turismo','Assetto Corsa','Need for Speed','F1','BeamNG.drive','Euro Truck Simulator 2','American Truck Simulator','Cities: Skylines','Civilization','Age of Empires','Genshin Impact','Honkai: Star Rail','Pokémon','Animal Crossing','Hollow Knight','Hades','Cuphead','Celeste','Don’t Starve','Project Zomboid'],
  '📺 Séries': ['Breaking Bad','Better Call Saul','The Boys','Gen V','Invincible','Stranger Things','Dark','Black Mirror','The Walking Dead','Game of Thrones','House of the Dragon','The Last of Us','Supernatural','Dexter','Lost','Prison Break','Peaky Blinders','Sherlock','The Office','Brooklyn Nine-Nine','Rick and Morty','The Simpsons','South Park','Arcane','One Piece','Cobra Kai','The Bear','Severance','The Mandalorian','The Witcher','Vikings','The Sopranos','Sons of Anarchy','Mr. Robot','Fargo','The Punisher','Daredevil','Loki','Euphoria','Friends','How I Met Your Mother','Community','Love, Death & Robots','BoJack Horseman','Futurama','Adventure Time','Regular Show','Hora de Aventura'],
  '🎬 Filmes': ['Interestelar','Clube da Luta','O Poderoso Chefão','Matrix','John Wick','Mad Max: Estrada da Fúria','Oppenheimer','A Origem','Blade Runner 2049','Invocação do Mal','Jogos Mortais','Premonição','Velozes e Furiosos','Shrek','Homem-Aranha','Batman','Senhor dos Anéis','Harry Potter','Star Wars','Jurassic Park','De Volta para o Futuro','Pulp Fiction','Django Livre','Whiplash','Parasita','Coringa','Gladiador','Alien','O Exorcista','Hereditário','Midsommar','Toy Story','Wall-E','Your Name','A Viagem de Chihiro','Os Vingadores','Guardiões da Galáxia','Top Gun: Maverick','1917','O Resgate do Soldado Ryan'],
  '🏁 Esportes': ['Futebol','Futsal','Basquete','Vôlei','Handebol','Tênis','Corrida de rua','Atletismo','Musculação','Crossfit','Calistenia','Ciclismo','Mountain bike','Motocross','Motovelocidade','Automobilismo','Kart','Drift','MMA','Muay Thai','Boxe','Jiu-jitsu','Judô','Taekwondo','Skate','Surf','Natação','Escalada','Paintball','Airsoft','Rugby','Beisebol','Golfe','Hipismo','Parkour','Artes marciais'],
  '🔧 Hobbies e atividades': ['Mecânica','Preparação de motores','Motociclismo','Carros modificados','Soldagem','Marcenaria','Eletrônica','Programação','Robótica','Impressão 3D','Fotografia','Edição de vídeo','Desenho','Pintura','Música','Tocar instrumentos','Culinária','Pesca','Camping','Trilhas','Jardinagem','Colecionismo','Modelismo','Astronomia amadora','Leitura','Escrita','Jogos de tabuleiro','RPG de mesa','Costura','Artesanato','Faça você mesmo (DIY)','Aquarismo','Customização'],
  '🎵 Música': ['Rock','Heavy metal','Metalcore','Pop','Rap','Trap','Hip-hop','Funk brasileiro','Sertanejo','Pagode','Samba','MPB','Eletrônica','Techno','House','Phonk','Reggae','Jazz','Blues','Música clássica','Indie','Punk','Emo','Grunge','K-pop','J-pop','Forró','Piseiro','Gospel','Guitarra','Violão','Bateria','Baixo','Canto','Produção musical','DJ'],
  '🌎 Estilo de vida': ['Vida fitness','Academia','Vida ao ar livre','Aventura','Viagens','Natureza','Minimalismo','Tecnologia','Cultura geek','Cultura automotiva','Vida noturna','Festas','Gastronomia','Voluntariado','Empreendedorismo','Desenvolvimento pessoal','Estudos','Carreira','Animais de estimação','Vida tranquila','Explorar lugares novos','Trabalho remoto','Sustentabilidade','Moda','Beleza','Espiritualidade','Comunidade'],
  '🧠 Assuntos e curiosidades': ['Ciência','Física','Química','Biologia','Engenharia','Mecânica','História','Arqueologia','Astronomia','Filosofia','Psicologia','Política','Economia','Tecnologia','Inteligência artificial','Mistérios','Criminologia','Investigação','História militar','Aviação','Espaço','Sobrevivência','Geopolítica','Paleontologia','Oceanografia','Matemática','Direito','Sociologia'],
  '🐾 Animais e natureza': ['Cachorros','Gatos','Cavalos','Aves','Répteis','Animais exóticos','Aquarismo','Vida selvagem','Conservação ambiental','Fotografia da natureza','Cães de trabalho','Resgate animal','Fazenda','Pesca esportiva'],
  '📚 Cultura e entretenimento': ['Mangás','Animes','Quadrinhos','Super-heróis','Marvel','DC','Literatura','Ficção científica','Fantasia','Terror','Cultura japonesa','Cultura brasileira','Memes','Humor','Stand-up','Podcasts','Streaming','YouTube','Cosplay','Convenções','Board games','História em quadrinhos','Dublagem','Cultura pop']
};
const mbti = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
const intentions = ['Fazer novas amizades','Encontrar um relacionamento sério','Conhecer pessoas sem compromisso','Encontrar pessoas para jogar','Encontrar parceiros para hobbies','Conhecer pessoas da minha região','Conversar e conhecer gente nova','Participar de comunidades','Fazer networking profissional','Encontrar pessoas para atividades presenciais'];
let selectedInterests = new Set();
let photos = [];
let wizardStep = 0;
let editingProfile = false;
let authMode = 'register';

function renderInterestCategories(query = '') {
  const root = $('interestCategories'); root.innerHTML = '';
  const q = query.trim().toLocaleLowerCase('pt-BR');
  Object.entries(interestData).forEach(([category, items]) => {
    const matches = items.filter(x => x.toLocaleLowerCase('pt-BR').includes(q));
    if (q && !matches.length && !category.toLocaleLowerCase('pt-BR').includes(q)) return;
    const details = document.createElement('details'); details.className = 'interest-category'; details.open = Boolean(q);
    const summary = document.createElement('summary'); summary.textContent = `${category} · ${items.filter(x => selectedInterests.has(x)).length} selecionados`;
    const options = document.createElement('div'); options.className = 'interest-options';
    (q && category.toLocaleLowerCase('pt-BR').includes(q) ? items : matches).forEach(item => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'interest-chip' + (selectedInterests.has(item) ? ' selected' : ''); btn.textContent = (selectedInterests.has(item) ? '✓ ' : '') + item;
      btn.addEventListener('click', () => { selectedInterests.has(item) ? selectedInterests.delete(item) : selectedInterests.add(item); renderInterestCategories($('interestSearch').value); renderSelectedInterests(); }); options.append(btn);
    });
    details.append(summary, options); root.append(details);
  });
}
function renderSelectedInterests() { const root = $('selectedInterests'); root.innerHTML = ''; if (!selectedInterests.size) { root.textContent = 'Nenhum interesse selecionado.'; return; } root.append(document.createTextNode(`${selectedInterests.size} interesses selecionados: `)); [...selectedInterests].forEach(item => { const b=document.createElement('button'); b.type='button'; b.className='interest-chip selected'; b.textContent=`× ${item}`; b.title='Remover interesse'; b.addEventListener('click',()=>{selectedInterests.delete(item);renderInterestCategories($('interestSearch').value);renderSelectedInterests();});root.append(b); }); }
$('interestSearch').addEventListener('input', e => renderInterestCategories(e.target.value));
renderInterestCategories(); renderSelectedInterests();

$('addCustomInterest').addEventListener('click', () => {
  const input = $('customInterestInput');
  const value = input.value.trim().replace(/\s+/g, ' ');
  if (!value) { input.focus(); return; }
  if (value.length > 50) { alert('O interesse deve ter no máximo 50 caracteres.'); return; }
  const duplicate = [...selectedInterests].some(x => x.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'));
  if (duplicate) { alert('Esse interesse já foi adicionado.'); return; }
  selectedInterests.add(value);
  input.value = '';
  renderInterestCategories($('interestSearch').value);
  renderSelectedInterests();
});
$('customInterestInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); $('addCustomInterest').click(); }
});

async function loadBrazilianMunicipalities() {
  const list = $('brazilCities');
  if (!list || list.dataset.loaded === 'true' || list.dataset.loading === 'true') return;
  list.dataset.loading = 'true';
  try {
    const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
    if (!response.ok) throw new Error('Não foi possível consultar o IBGE.');
    const municipalities = await response.json();
    const fragment = document.createDocumentFragment();
    municipalities.forEach(municipality => {
      const state = municipality.microrregiao?.mesorregiao?.UF
        || municipality['regiao-imediata']?.['regiao-intermediaria']?.UF;
      if (!municipality.nome || !state?.sigla) return;
      const option = document.createElement('option');
      option.value = municipality.nome + ' - ' + state.sigla;
      fragment.append(option);
    });
    list.append(fragment);
    list.dataset.loaded = 'true';
  } catch (error) {
    console.warn('Lista de municípios do IBGE indisponível:', error);
    $('city').placeholder = 'Digite sua cidade (IBGE indisponível no momento)';
  } finally {
    list.dataset.loading = 'false';
  }
}
$('city').addEventListener('focus', loadBrazilianMunicipalities, { once: true });
$('city').addEventListener('input', loadBrazilianMunicipalities, { once: true });

mbti.forEach(v => $('personality').add(new Option(v,v)));
intentions.forEach(v => { const label=document.createElement('label');label.className='choice-item';const input=document.createElement('input');input.type='checkbox';input.value=v;label.append(input,document.createTextNode(v));$('intentOptions').append(label); });

function calculateAge(dateString) { if (!dateString) return 0; const birth=new Date(`${dateString}T12:00:00`); if(Number.isNaN(birth.getTime()))return 0;const now=new Date();let age=now.getFullYear()-birth.getFullYear();const before=now.getMonth()<birth.getMonth()||(now.getMonth()===birth.getMonth()&&now.getDate()<birth.getDate());if(before)age--;return age; }
function zodiac(dateString) { if(!dateString)return '';const d=new Date(`${dateString}T12:00:00`);const day=d.getDate(),m=d.getMonth()+1;const signs=[['Capricórnio',1,20],['Aquário',2,19],['Peixes',3,20],['Áries',4,20],['Touro',5,20],['Gêmeos',6,20],['Câncer',7,22],['Leão',8,22],['Virgem',9,22],['Libra',10,22],['Escorpião',11,21],['Sagitário',12,21],['Capricórnio',12,31]];return (day<=signs[m-1][2]?signs[m-1][0]:signs[m][0]); }
$('birthDate').addEventListener('change',()=>{const age=calculateAge($('birthDate').value);$('zodiac').value=zodiac($('birthDate').value);if(age&&age<18)alert('O Brazilly é destinado exclusivamente a maiores de 18 anos.');});

// Fotos: redução local para evitar exceder a capacidade do armazenamento do navegador.
$('choosePhotos').addEventListener('click',()=>$('photoInput').click());
$('photoInput').addEventListener('change',async e=>{const files=[...e.target.files];if(photos.length+files.length>6){alert('Você pode adicionar no máximo 6 fotos.');e.target.value='';return;}for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)){alert('Formato não aceito. Use JPG, PNG ou WEBP.');continue;}if(file.size>2*1024*1024){alert(`${file.name} ultrapassa 2 MB. Escolha uma imagem menor.`);continue;}try{const data=await resizeImage(file);photos.push({name:file.name,data});}catch{alert(`Não foi possível processar ${file.name}.`);}}e.target.value='';renderPhotos();});
function resizeImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const scale=Math.min(1,1000/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.76));};img.src=reader.result;};reader.readAsDataURL(file);});}
function renderPhotos(){const grid=$('photoGrid');grid.innerHTML='';for(let i=0;i<6;i++){const slot=document.createElement('div');slot.className='photo-slot';if(photos[i]){const img=document.createElement('img');img.src=photos[i].data;img.alt=`Foto ${i+1}`;slot.append(img);if(i===0){const badge=document.createElement('span');badge.className='primary-photo';badge.textContent='Principal';slot.append(badge);}const tools=document.createElement('div');tools.className='photo-tools';const remove=document.createElement('button');remove.textContent='Remover';remove.addEventListener('click',()=>{photos.splice(i,1);renderPhotos();});tools.append(remove);if(i>0){const up=document.createElement('button');up.textContent='↑';up.title='Mover para cima';up.addEventListener('click',()=>{[photos[i-1],photos[i]]=[photos[i],photos[i-1]];renderPhotos();});tools.append(up);}if(i<photos.length-1){const down=document.createElement('button');down.textContent='↓';down.title='Mover para baixo';down.addEventListener('click',()=>{[photos[i+1],photos[i]]=[photos[i],photos[i+1]];renderPhotos();});tools.append(down);}slot.append(tools);}else{slot.textContent=`＋ Foto ${i+1}`;}grid.append(slot);}}
$('photoRulesButton').addEventListener('click',()=>openModal('photoRulesModal'));
function openModal(id){$(id).hidden=false;}function closeModal(id){$(id).hidden=true;}
document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.closeModal)));
document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id);}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(m=>closeModal(m.id));});

function setWizardStep(step){wizardStep=Math.max(0,Math.min(4,step));document.querySelectorAll('.wizard-step').forEach((el,i)=>el.classList.toggle('active',i===wizardStep));$('wizardProgress').style.width=`${(wizardStep+1)*20}%`;$('wizardStepLabel').textContent=`ETAPA ${wizardStep+1} DE 5`;$('wizardBack').hidden=wizardStep===0;$('wizardNext').textContent=wizardStep===4?(editingProfile?'Salvar alterações':'Criar meu perfil'):'Continuar';const titles=[['Vamos criar seu perfil','Primeiro, os dados da sua conta.'],['Sobre você','Conte um pouco sobre quem você é.'],['Seus interesses','Encontre pessoas que gostam das mesmas coisas.'],['Fotos e estilo de vida','Mostre um pouco mais de você.'],['Suas intenções','Finalize seu perfil e suas preferências.']];$('wizardTitle').textContent=titles[wizardStep][0];$('wizardSubtitle').textContent=titles[wizardStep][1];}
function validateStep(){if(wizardStep===0){for(const id of (currentUser?['profileName','profileEmail','birthDate']:['profileName','profileEmail','profilePassword','birthDate'])){if(!$(id).reportValidity())return false;}if(calculateAge($('birthDate').value)<18){alert('Você precisa ter pelo menos 18 anos para criar um perfil.');return false;}if(!currentUser&&$('profilePassword').value.length<8){alert('A senha precisa ter pelo menos 8 caracteres.');return false;}}if(wizardStep===1){const h=$('height').value;if(h&&(Number(h)<100||Number(h)>250)){alert('Informe uma altura entre 100 e 250 cm.');return false;}}return true;}
$('wizardNext').addEventListener('click',async()=>{if(!validateStep())return;if(wizardStep<4){setWizardStep(wizardStep+1);return;}await saveProfile();});$('wizardBack').addEventListener('click',()=>setWizardStep(wizardStep-1));
function getFormProfile(){
  const selectedIntents=[...$('intentOptions').querySelectorAll('input:checked')].map(x=>x.value);
  return {name:$('profileName').value.trim(),email:$('profileEmail').value.trim(),birthDate:$('birthDate').value,age:calculateAge($('birthDate').value),gender:$('gender').value,sexuality:$('sexuality').value,height:$('height').value?Number($('height').value):null,education:$('education').value,profession:$('profession').value.trim(),religion:$('religion').value,relationshipStatus:$('relationshipStatus').value,zodiac:zodiac($('birthDate').value),personality:$('personality').value,pets:$('pets').value,children:$('children').value,bio:$('bio').value.trim(),interests:[...selectedInterests],photos,drink:$('drinkFrequency').value,smoke:$('smokeFrequency').value,exercise:$('exerciseFrequency').value,intentions:selectedIntents,city:$('city').value.trim(),showAge:$('showAge').checked,showCity:$('showCity').checked,privateProfile:$('privateProfile').checked,updatedAt:new Date().toISOString()};
}
function categoryForInterest(name){for(const [category,items] of Object.entries(interestData)){if(items.includes(name))return category;}return 'Outros';}
function dataUrlToBlob(dataUrl){const [meta,encoded]=dataUrl.split(',');const mime=(meta.match(/data:(.*?);/)||[])[1]||'image/jpeg';const binary=atob(encoded);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:mime});}
async function uploadProfilePhotos(userId, photoItems){
  const {data:oldRows}=await db.from('profile_photos').select('storage_path').eq('user_id',userId);
  const keepPaths=new Set(photoItems.map(x=>x.storagePath).filter(Boolean));
  const obsolete=(oldRows||[]).map(x=>x.storage_path).filter(path=>!keepPaths.has(path));
  if(obsolete.length){const {error:removeError}=await db.storage.from('profile-photos').remove(obsolete);if(removeError)throw removeError;}
  if(oldRows?.length){const {error:deleteError}=await db.from('profile_photos').delete().eq('user_id',userId);if(deleteError)throw deleteError;}
  for(let i=0;i<photoItems.length;i++){
    const item=photoItems[i];if(!item?.data)continue;
    let path=item.storagePath;
    if(!path){path=`${userId}/${crypto.randomUUID()}.jpg`;const blob=dataUrlToBlob(item.data);const {error:uploadError}=await db.storage.from('profile-photos').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});if(uploadError)throw uploadError;}
    const {error:rowError}=await db.from('profile_photos').insert({user_id:userId,storage_path:path,sort_order:i,is_primary:i===0});
    if(rowError)throw rowError;
  }
}
async function syncProfileToSupabase(p){
  if(!db||!currentUser)throw new Error('Entre na sua conta antes de sincronizar o perfil.');
  const row={user_id:currentUser.id,display_name:p.name,birth_date:p.birthDate,gender:p.gender||null,sexuality:p.sexuality||null,height_cm:p.height||null,education:p.education||null,profession:p.profession||null,religion:p.religion||null,relationship_status:p.relationshipStatus||null,personality_mbti:p.personality||null,pets:p.pets||null,children:p.children||null,bio:p.bio||null,drink_frequency:p.drink||null,tobacco_frequency:p.smoke||null,exercise_frequency:p.exercise||null,intentions:p.intentions||[],city:p.city||null,show_age:p.showAge,show_city:p.showCity,private_profile:p.privateProfile};
  const {error:profileError}=await db.from('profiles').upsert(row,{onConflict:'user_id'});if(profileError)throw profileError;
  const {error:interestDeleteError}=await db.from('user_interests').delete().eq('user_id',currentUser.id);if(interestDeleteError)throw interestDeleteError;
  if(p.interests?.length){const interestRows=p.interests.map(name=>({user_id:currentUser.id,category:categoryForInterest(name),interest_name:name}));const {error:interestError}=await db.from('user_interests').insert(interestRows);if(interestError)throw interestError;}
  await uploadProfilePhotos(currentUser.id,p.photos||[]);
  const settings=readSettings();
  const {error:settingsError}=await db.from('profiles').update({last_seen_visible:settings.lastSeen,online_visible:settings.online,read_receipts:settings.readReceipt,media_download:settings.mediaDownload}).eq('user_id',currentUser.id);
  if(settingsError)throw settingsError;
  currentProfile={...p,email:currentUser.email};
  return currentProfile;
}
async function saveProfile(){
  const p=getFormProfile();
  let createdAccount=false;
  try{
    $('wizardNext').disabled=true;$('wizardNext').textContent='Salvando...';
    if(!db)throw new Error('O serviço de autenticação não carregou. Atualize a página.');
    if(!currentUser){
      const {data,error}=await db.auth.signUp({email:p.email,password:$('profilePassword').value,options:{data:{display_name:p.name},emailRedirectTo:window.location.origin}});
      if(error)throw error;
      if(!data.session){
        const draft={...p,photos:[]};sessionStorage.setItem('brazilly.pendingProfile',JSON.stringify(draft));
        $('profilePassword').value='';alert('A conta foi criada, mas o Supabase ainda está exigindo confirmação obrigatória. Para permitir acesso imediato, desative “Confirm email” em Authentication → Providers → Email no painel do Supabase. Depois disso, novos cadastros entrarão diretamente no Brazilly.');
        editingProfile=false;showScreen('homeScreen');return;
      }
      currentUser=data.user;createdAccount=true;
    }
    await syncProfileToSupabase(p);
    $('profilePassword').value='';editingProfile=false;updateHeaderAccountButtons();showScreen('profileScreen');
    if(createdAccount){openModal('emailVerificationModal');}
    else{alert('Perfil salvo e sincronizado com sua conta Brazilly.');}
  }catch(error){console.error(error);alert(`Não foi possível salvar seu perfil: ${error.message||'erro desconhecido'}. Confira sua conexão e tente novamente.`);}
  finally{$('wizardNext').disabled=false;setWizardStep(wizardStep);}
}
function clearWizard(){editingProfile=false;$('profileWizard').reset();selectedInterests.clear();photos=[];renderPhotos();renderInterestCategories();renderSelectedInterests();$('zodiac').value='';$('wizardBack').hidden=true;setWizardStep(0);}
function startSignup(){if(currentUser&&currentProfile){editProfile();return;}clearWizard();$('profileEmail').value=currentUser?.email||'';$('profileEmail').readOnly=Boolean(currentUser);authMode='register';showScreen('authScreen');}
$('signupButton').addEventListener('click',startSignup);$('heroSignupButton').addEventListener('click',startSignup);$('featureSignupButton').addEventListener('click',startSignup);
$('loginButton').addEventListener('click',()=>currentUser?showScreen('profileScreen'):openModal('loginModal'));
function loadProfile(){return currentProfile;}
async function fetchProfileFromServer(){
  if(!currentUser)return null;
  const {data:row,error}=await db.from('profiles').select('*').eq('user_id',currentUser.id).maybeSingle();if(error)throw error;if(!row)return null;
  const [{data:interestRows,error:interestError},{data:photoRows,error:photoError}]=await Promise.all([
    db.from('user_interests').select('interest_name').eq('user_id',currentUser.id).order('interest_name'),
    db.from('profile_photos').select('storage_path,sort_order').eq('user_id',currentUser.id).order('sort_order')
  ]);
  if(interestError)throw interestError;if(photoError)throw photoError;
  const loadedPhotos=[];
  for(const photo of photoRows||[]){const {data:signedData,error:signedError}=await db.storage.from('profile-photos').createSignedUrl(photo.storage_path,3600);if(signedError||!signedData?.signedUrl)continue;try{const response=await fetch(signedData.signedUrl);const blob=await response.blob();const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});loadedPhotos.push({name:'Foto do perfil',data:dataUrl,storagePath:photo.storage_path});}catch{loadedPhotos.push({name:'Foto do perfil',data:signedData.signedUrl,storagePath:photo.storage_path});}}
  const saved=readSettings();localStorage.setItem(STORAGE.settings,JSON.stringify({...saved,lastSeen:row.last_seen_visible,online:row.online_visible,readReceipt:row.read_receipts,mediaDownload:row.media_download}));initSettings();
  currentProfile={name:row.display_name,email:currentUser.email,birthDate:row.birth_date,age:calculateAge(row.birth_date),gender:row.gender||'',sexuality:row.sexuality||'',height:row.height_cm||'',education:row.education||'',profession:row.profession||'',religion:row.religion||'',relationshipStatus:row.relationship_status||'',zodiac:zodiac(row.birth_date),personality:row.personality_mbti||'',pets:row.pets||'',children:row.children||'',bio:row.bio||'',interests:(interestRows||[]).map(x=>x.interest_name),photos:loadedPhotos,drink:row.drink_frequency||'',smoke:row.tobacco_frequency||'',exercise:row.exercise_frequency||'',intentions:row.intentions||[],city:row.city||'',showAge:row.show_age,showCity:row.show_city,privateProfile:row.private_profile===true};
  return currentProfile;
}
async function initAuth(){
  if(!db){alert('A biblioteca do Supabase não carregou. Atualize a página e tente novamente.');return;}
  const {data:{session}}=await db.auth.getSession();currentUser=session?.user||null;
  if(currentUser){try{await fetchProfileFromServer();const pending=sessionStorage.getItem('brazilly.pendingProfile');if(pending){const draft=JSON.parse(pending);await syncProfileToSupabase(draft);sessionStorage.removeItem('brazilly.pendingProfile');} }catch(error){console.error('Falha ao carregar perfil:',error);}}
  await refreshModerationAccess();
  updateHeaderAccountButtons();
  authReady=true;
  db.auth.onAuthStateChange((event,sessionNow)=>{
    currentUser=sessionNow?.user||null;
    if(!currentUser){currentProfile=null;isModerator=false;updateHeaderAccountButtons();renderProfiles();return;}
    const pendingEmailLink=JSON.parse(localStorage.getItem('brazilly.emailLinkPending')||'null');
    if(event==='SIGNED_IN'&&pendingEmailLink?.userId===currentUser.id&&pendingEmailLink.expiresAt>Date.now()){
      localStorage.removeItem('brazilly.emailLinkPending');
      setTimeout(()=>alert('Acesso ao seu e-mail confirmado. Guarde esse endereço: ele pode ajudar a recuperar sua conta.'),0);
    }else if(pendingEmailLink&&pendingEmailLink.expiresAt<=Date.now()){localStorage.removeItem('brazilly.emailLinkPending');}
    if(event==='PASSWORD_RECOVERY'){
      setTimeout(async()=>{const next=prompt('Digite sua nova senha (mínimo de 8 caracteres):');if(next&&next.length>=8){const {error}=await db.auth.updateUser({password:next});alert(error?error.message:'Senha atualizada com sucesso.');}else if(next!==null){alert('A senha precisa ter pelo menos 8 caracteres.');}},0);
    }
    setTimeout(async()=>{try{await fetchProfileFromServer();await refreshModerationAccess();updateHeaderAccountButtons();renderProfiles();}catch(error){console.error(error);}},0);
  });
  if(currentUser&&currentProfile){$('loginButton').textContent='Minha conta';}renderProfiles();
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!db){alert('O serviço de autenticação não carregou. Atualize a página.');return;}const button=$('loginSubmit');button.disabled=true;button.textContent='Entrando...';try{const {data,error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)throw error;currentUser=data.user;await fetchProfileFromServer();const pending=sessionStorage.getItem('brazilly.pendingProfile');if(pending){await syncProfileToSupabase(JSON.parse(pending));sessionStorage.removeItem('brazilly.pendingProfile');}closeModal('loginModal');$('loginPassword').value='';updateHeaderAccountButtons();if(currentProfile){renderProfilePreview();showScreen('profileScreen');}else{alert('Conta autenticada. Complete seu perfil.');clearWizard();$('profileEmail').value=currentUser.email||'';$('profileEmail').readOnly=true;showScreen('authScreen');}}catch(error){alert(`Não foi possível entrar: ${error.message}`);}finally{button.disabled=false;button.textContent='Entrar';}});
$('forgotPasswordButton').addEventListener('click',async()=>{if(!db){alert('O serviço de autenticação não carregou.');return;}const email=$('loginEmail').value.trim();if(!email){alert('Informe seu e-mail primeiro.');return;}const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(error)alert(error.message);else alert('Se o endereço estiver cadastrado, você receberá um e-mail para redefinir a senha.');});
async function renderProfilePreview(){const p=currentProfile,root=$('profilePreview');root.innerHTML='';if(!p){root.textContent='Entre na sua conta para carregar seu perfil.';return;}const h=document.createElement('h2');h.textContent=`${p.name}${p.showAge?`, ${p.age}`:''}`;root.append(h);if(p.showCity&&p.city){const c=document.createElement('p');c.className='field-note';c.textContent=p.city;root.append(c);}if(p.photos?.length){const photosEl=document.createElement('div');photosEl.className='preview-photos';p.photos.forEach(ph=>{const img=document.createElement('img');img.src=ph.data;img.alt='Foto do perfil';photosEl.append(img);});root.append(photosEl);}if(p.bio){const bio=document.createElement('p');bio.textContent=p.bio;root.append(bio);}const fields=[['Gênero',p.gender],['Signo',p.zodiac],['Altura',p.height?`${p.height} cm`:'' ],['Escolaridade',p.education],['Profissão',p.profession],['Religião / crença',p.religion],['Relacionamento',p.relationshipStatus],['Personalidade',p.personality],['Pets',p.pets],['Filhos',p.children],['Intenções',p.intentions?.join(', ')]];fields.filter(x=>x[1]).forEach(([k,v])=>{const row=document.createElement('p');row.className='field-note';row.textContent=`${k}: ${v}`;root.append(row);});if(p.interests?.length){const title=document.createElement('h3');title.textContent='Interesses';root.append(title);const tags=document.createElement('div');tags.className='preview-tags';p.interests.forEach(x=>{const tag=document.createElement('span');tag.textContent=x;tags.append(tag);});root.append(tags);}}
async function editProfile(){let p=currentProfile;if(!p&&currentUser)p=await fetchProfileFromServer();if(!p){alert('Entre na sua conta para editar o perfil.');return;}editingProfile=true;$('profileName').value=p.name||'';$('profileEmail').value=p.email||'';$('profileEmail').readOnly=true;$('profilePassword').value='';$('birthDate').value=p.birthDate||'';['gender','sexuality','height','education','personality','pets','children','bio','drinkFrequency','smokeFrequency','exerciseFrequency','city'].forEach((id,i)=>{const keys=['gender','sexuality','height','education','personality','pets','children','bio','drink','smoke','exercise','city'];$(id).value=p[keys[i]]||'';});$('profession').value=p.profession||'';$('religion').value=p.religion||'';$('relationshipStatus').value=p.relationshipStatus||'';$('zodiac').value=p.zodiac||'';$('showAge').checked=p.showAge!==false;$('showCity').checked=p.showCity===true;$('privateProfile').checked=p.privateProfile===true;selectedInterests=new Set(p.interests||[]);photos=p.photos||[];renderPhotos();renderInterestCategories();renderSelectedInterests();$('intentOptions').querySelectorAll('input').forEach(x=>x.checked=(p.intentions||[]).includes(x.value));setWizardStep(0);showScreen('authScreen');}
$('editProfileButton').addEventListener('click',editProfile);$('profileEditButton').addEventListener('click',editProfile);
$('exportDataButton').addEventListener('click',()=>{const p=currentProfile;if(!p){alert('Entre na sua conta primeiro.');return;}const blob=new Blob([JSON.stringify({...p,photos:[]},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='meu-perfil-brazilly.json';a.click();URL.revokeObjectURL(url);});
$('openModerationButton').addEventListener('click',()=>showScreen('moderationScreen'));
$('refreshModerationButton').addEventListener('click',renderModerationReports);
async function renderModerationReports(){
  const root=$('moderationReportList');root.innerHTML='';
  if(!currentUser||!isModerator){root.textContent='Acesso restrito à moderação.';return;}
  const {data,error}=await db.rpc('list_moderation_reports');
  if(error){root.textContent='Não foi possível carregar denúncias: '+error.message;return;}
  if(!data?.length){root.textContent='Nenhuma denúncia registrada.';return;}
  for(const report of data){
    const card=document.createElement('article');card.className='moderation-report-card';
    const heading=document.createElement('div');heading.className='moderation-report-heading';
    const title=document.createElement('strong');title.textContent=report.reason;
    const date=document.createElement('time');date.textContent=new Date(report.created_at).toLocaleString('pt-BR');
    heading.append(title,date);
    const users=document.createElement('p');users.textContent='Denunciante: '+report.reporter_name+' · Perfil: '+report.reported_name;
    const details=document.createElement('p');details.textContent=report.details||'Sem detalhes adicionais.';
    const controls=document.createElement('div');controls.className='moderation-report-controls';
    const status=document.createElement('select');
    [['pending','Pendente'],['reviewing','Em análise'],['resolved','Resolvida'],['dismissed','Descartada']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;status.append(option);});
    status.value=report.status;
    const save=document.createElement('button');save.type='button';save.className='button button-small button-primary';save.textContent='Atualizar status';
    save.addEventListener('click',async()=>{save.disabled=true;const {error}=await db.rpc('update_moderation_report',{p_report_id:report.report_id,p_status:status.value});if(error)alert(error.message);else await renderModerationReports();save.disabled=false;});
    controls.append(status,save);card.append(heading,users,details,controls);root.append(card);
  }
}
$('logoutButton').addEventListener('click',async()=>{if(!confirm('Deseja sair da sua conta Brazilly neste dispositivo?'))return;const {error}=await db.auth.signOut();if(error){alert(error.message);return;}currentUser=null;currentProfile=null;isModerator=false;updateHeaderAccountButtons();showScreen('homeScreen');alert('Você saiu da sua conta.');});
// Preferências locais. Recursos que exigem servidor são descritos sem simular execução.
const defaultSettings={theme:'dark',wallpaper:'default',lastSeen:true,online:true,readReceipt:true,mediaDownload:'never'};
function readSettings(){try{return {...defaultSettings,...JSON.parse(localStorage.getItem(STORAGE.settings)||'{}')};}catch{return {...defaultSettings};}}
function applySettings(s){document.body.classList.toggle('light-theme',s.theme==='light'||(s.theme==='system'&&matchMedia('(prefers-color-scheme: light)').matches));document.body.classList.remove('wallpaper-purple','wallpaper-midnight','wallpaper-forest');if(s.wallpaper!=='default')document.body.classList.add(`wallpaper-${s.wallpaper}`);}
function initSettings(){const s=readSettings();$('themeSetting').value=s.theme;$('wallpaperSetting').value=s.wallpaper;$('lastSeenSetting').checked=s.lastSeen;$('onlineSetting').checked=s.online;$('readReceiptSetting').checked=s.readReceipt;$('mediaDownloadSetting').value=s.mediaDownload;applySettings(s);}
function saveSettings(){const s={theme:$('themeSetting').value,wallpaper:$('wallpaperSetting').value,lastSeen:$('lastSeenSetting').checked,online:$('onlineSetting').checked,readReceipt:$('readReceiptSetting').checked,mediaDownload:$('mediaDownloadSetting').value};localStorage.setItem(STORAGE.settings,JSON.stringify(s));applySettings(s);if(currentUser)db.from('profiles').update({last_seen_visible:s.lastSeen,online_visible:s.online,read_receipts:s.readReceipt,media_download:s.mediaDownload}).eq('user_id',currentUser.id).then(({error})=>{if(error)console.error('Não foi possível sincronizar as preferências:',error);});}
['themeSetting','wallpaperSetting','lastSeenSetting','onlineSetting','readReceiptSetting','mediaDownloadSetting'].forEach(id=>$(id).addEventListener('change',saveSettings));initSettings();
if(window.matchMedia){matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if(readSettings().theme==='system')applySettings(readSettings());});}

// Descoberta real: a RPC entrega apenas os campos públicos permitidos.
function getFilters(){try{return JSON.parse(localStorage.getItem(STORAGE.filters)||'{}');}catch{return {};}}
async function renderProfiles(){
  const root=$('profileList');root.innerHTML='';
  if(!currentUser){$('discoverStatus').textContent='Entre para descobrir pessoas';root.textContent='Entre ou crie uma conta para encontrar pessoas da comunidade.';return;}
  $('discoverStatus').textContent='Perfis da comunidade';root.textContent='Carregando perfis...';
  const f=getFilters();
  const args={p_min_age:f.min??18,p_max_age:f.max??99,p_gender:f.gender&&f.gender!=='all'?f.gender:null,p_intention:f.intent&&f.intent!=='all'?f.intent:null,p_interest:f.interest||null,p_city:f.city||null,p_education:f.education&&f.education!=='all'?f.education:null,p_exercise:f.lifestyle&&f.lifestyle!=='all'?f.lifestyle:null,p_photos_only:Boolean(f.photos),p_strict:Boolean(f.strict),p_limit:60};
  try{
    const {data,error}=await db.rpc('discover_profiles_v2',args);if(error)throw error;root.innerHTML='';
    $('activeFilterSummary').textContent=Object.values(f).some(v=>v!==''&&v!==false&&v!=='all')?`Filtros aplicados · ${f.strict?'correspondência rigorosa':'priorização por afinidade'}`:'Nenhum filtro aplicado.';
    if(!data?.length){root.textContent='Ainda não encontramos perfis com esses critérios. Tente ampliar os filtros.';return;}
    data.forEach(p=>{const card=document.createElement('article');card.className='profile-card';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Abrir perfil de ${p.display_name}`);card.addEventListener('click',()=>openProfileDetails(p));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfileDetails(p);}});const avatar=document.createElement('div');avatar.className='avatar';avatar.textContent=(p.display_name||'?')[0].toUpperCase();const info=document.createElement('div');info.className='profile-info';const title=document.createElement('h3');title.textContent=`${p.display_name}${p.age?`, ${p.age}`:''}`;const bio=document.createElement('p');bio.textContent=p.bio||'Ainda não adicionou uma descrição.';const tags=document.createElement('p');tags.textContent=(p.interests||[]).join(' · ');const note=document.createElement('span');note.textContent=p.city||'Localização não informada';info.append(title,bio,tags,note);if(p.photo_paths?.length){const img=document.createElement('img');img.alt=`Foto de ${p.display_name}`;db.storage.from('profile-photos').createSignedUrl(p.photo_paths[0],3600).then(({data,error})=>{if(!error&&data?.signedUrl)img.src=data.signedUrl;else img.remove();});img.style.cssText='width:64px;height:64px;object-fit:cover;border-radius:12px;margin-right:12px';card.append(img);}card.append(avatar,info);root.append(card);});
  }catch(error){console.error(error);root.textContent=`Não foi possível carregar os perfis: ${error.message}. Verifique se o SQL de configuração foi executado no Supabase.`;}
}
$('openFilters').addEventListener('click',()=>{const f=getFilters();$('filterAgeMin').value=f.min||18;$('filterAgeMax').value=f.max||99;$('filterGender').value=f.gender||'all';$('filterIntent').value=f.intent||'all';$('filterInterest').value=f.interest||'';$('filterEducation').value=f.education||'all';$('filterLifestyle').value=f.lifestyle||'all';$('filterCity').value=f.city||'';$('filterPhotos').checked=Boolean(f.photos);$('strictFilters').checked=Boolean(f.strict);openModal('filterModal');});
$('applyFilters').addEventListener('click',()=>{const min=Number($('filterAgeMin').value),max=Number($('filterAgeMax').value);if(min<18||max<min||max>100){alert('Confira a faixa etária. A idade mínima permitida é 18 anos.');return;}const f={min,max,gender:$('filterGender').value,intent:$('filterIntent').value,interest:$('filterInterest').value.trim(),education:$('filterEducation').value,lifestyle:$('filterLifestyle').value,city:$('filterCity').value.trim(),photos:$('filterPhotos').checked,strict:$('strictFilters').checked};localStorage.setItem(STORAGE.filters,JSON.stringify(f));closeModal('filterModal');renderProfiles();});
$('clearFilters').addEventListener('click',()=>{localStorage.removeItem(STORAGE.filters);$('filterAgeMin').value=18;$('filterAgeMax').value=99;$('filterGender').value='all';$('filterIntent').value='all';$('filterInterest').value='';$('filterEducation').value='all';$('filterLifestyle').value='all';$('filterCity').value='';$('filterPhotos').checked=false;$('strictFilters').checked=false;renderProfiles();closeModal('filterModal');});

// Mensagens diretas entre contas autenticadas, persistidas no Supabase.
let selectedPublicProfile = null;
let activeConversationId = null;
let activeConversationChannel = null;
let activeConversationOtherUserId = null;
const messageCache = new Set();

async function updateFriendRequestButton(otherUserId){
  const button=$('friendRequestButton');
  if(!button)return;
  button.disabled=true;button.textContent='Verificando...';
  if(!currentUser){button.disabled=false;button.textContent='Adicionar amigo';return;}
  try{
    const {data,error}=await db.rpc('get_friendship_status',{p_other_user:otherUserId});
    if(error)throw error;
    button.dataset.status=data||'none';
    const labels={none:'Adicionar amigo',sent:'Cancelar pedido',received:'Aceitar pedido',friends:'✓ Amigos',blocked:'Indisponível'};
    button.textContent=labels[data]||labels.none;
    button.disabled=data==='friends'||data==='blocked';
  }catch(error){button.textContent='Amizade indisponível';button.disabled=true;console.warn(error);}
}
function openProfileDetails(p) {
  selectedPublicProfile = p;
  const root = $('profileDetailContent');
  root.innerHTML = '';
  const photos = document.createElement('div');
  photos.className = 'detail-photos';
  (p.photo_paths || []).forEach(path => {
    const img = document.createElement('img');
    img.alt = 'Foto do perfil';
    db.storage.from('profile-photos').createSignedUrl(path,3600).then(({data,error})=>{if(!error&&data?.signedUrl)img.src=data.signedUrl;else img.remove();});
    photos.append(img);
  });
  if (photos.childElementCount) root.append(photos);
  const title = document.createElement('h2');
  title.id = 'profileDetailName';
  title.textContent = p.age ? `${p.display_name}, ${p.age}` : p.display_name;
  root.append(title);
  const meta = [p.city, p.gender, p.education, p.profession, p.religion, p.relationship_status].filter(Boolean).join(' · ');
  if (meta) { const line = document.createElement('p'); line.className='field-note'; line.textContent=meta; root.append(line); }
  if (p.bio) { const bio=document.createElement('p'); bio.className='profile-detail-bio'; bio.textContent=p.bio; root.append(bio); }
  if (p.intentions?.length) { const h=document.createElement('h3');h.textContent='O que procura';root.append(h);const v=document.createElement('p');v.className='field-note';v.textContent=p.intentions.join(' · ');root.append(v); }
  if (p.interests?.length) { const h=document.createElement('h3');h.textContent='Interesses';root.append(h);const tags=document.createElement('div');tags.className='preview-tags';p.interests.forEach(name=>{const tag=document.createElement('span');tag.textContent=name;tags.append(tag);});root.append(tags); }
  openModal('profileDetailModal');
  updateFriendRequestButton(p.user_id);
  $('favoriteProfileButton').textContent='☆ Favoritar';
  if(currentUser){
    db.from('user_favorites').select('target_user_id').eq('user_id',currentUser.id).eq('target_user_id',p.user_id).maybeSingle()
      .then(({data,error})=>{if(!error && selectedPublicProfile?.user_id===p.user_id && data)$('favoriteProfileButton').textContent='★ Favoritado';})
      .catch(error=>console.warn('Não foi possível consultar favorito:',error));
  }
}
$('friendRequestButton').addEventListener('click',async()=>{
  if(!currentUser||!selectedPublicProfile){openModal('loginModal');return;}
  const button=$('friendRequestButton'),status=button.dataset.status,requestId=button.dataset.requestId;
  button.disabled=true;
  try{
    if(status==='none')await db.rpc('send_friend_request',{p_other_user:selectedPublicProfile.user_id});
    else if(status==='sent'){
      const {data:rows,error}=await db.from('friend_requests').select('id').eq('user_one',selectedPublicProfile.user_id<currentUser.id?selectedPublicProfile.user_id:currentUser.id).eq('user_two',selectedPublicProfile.user_id<currentUser.id?currentUser.id:selectedPublicProfile.user_id).eq('status','pending').eq('requested_by',currentUser.id).limit(1);
      if(error)throw error;
      if(!rows?.length)throw new Error('Pedido não encontrado.');
      await db.rpc('cancel_friend_request',{p_request_id:rows[0].id});
    }else if(status==='received'){
      const {data:rows,error}=await db.from('friend_requests').select('id').eq('user_one',selectedPublicProfile.user_id<currentUser.id?selectedPublicProfile.user_id:currentUser.id).eq('user_two',selectedPublicProfile.user_id<currentUser.id?currentUser.id:selectedPublicProfile.user_id).eq('status','pending').neq('requested_by',currentUser.id).limit(1);
      if(error)throw error;
      if(!rows?.length)throw new Error('Pedido não encontrado.');
      await db.rpc('respond_friend_request',{p_request_id:rows[0].id,p_accept:true});
    }
    await updateFriendRequestButton(selectedPublicProfile.user_id);
    await renderFriendRequests();
  }catch(error){alert('Não foi possível atualizar o pedido: '+error.message);}
  finally{button.disabled=false;}
});
$('favoriteProfileButton').addEventListener('click', async () => {
  if (!currentUser || !selectedPublicProfile) { openModal('loginModal'); return; }
  const button=$('favoriteProfileButton'), target=selectedPublicProfile.user_id;
  button.disabled=true;
  try {
    const {data:existing,error:findError}=await db.from('user_favorites').select('target_user_id').eq('user_id',currentUser.id).eq('target_user_id',target).maybeSingle();
    if(findError)throw findError;
    if(existing){const {error}=await db.from('user_favorites').delete().eq('user_id',currentUser.id).eq('target_user_id',target);if(error)throw error;button.textContent='☆ Favoritar';}
    else {const {error}=await db.from('user_favorites').insert({user_id:currentUser.id,target_user_id:target});if(error)throw error;button.textContent='★ Favoritado';}
  } catch(error){alert('Não foi possível atualizar favorito: '+error.message);}
  finally{button.disabled=false;}
});
$('blockProfileButton').addEventListener('click', async () => {
  if (!currentUser || !selectedPublicProfile) { openModal('loginModal'); return; }
  if(!confirm('Bloquear este usuário? Ele deixará de aparecer para você e vocês não poderão iniciar novas conversas.'))return;
  const {error}=await db.from('user_blocks').insert({blocker_id:currentUser.id,blocked_id:selectedPublicProfile.user_id});
  if(error && error.code!=='23505'){alert('Não foi possível bloquear: '+error.message);return;}
  closeModal('profileDetailModal');await renderProfiles();
});
$('reportProfileButton').addEventListener('click', async () => {
  if (!currentUser || !selectedPublicProfile) { openModal('loginModal'); return; }
  const reason=prompt('Qual o motivo da denúncia? (ex.: spam, assédio, perfil falso)');
  if(!reason || reason.trim().length<3)return;
  const details=prompt('Detalhes adicionais (opcional):')||'';
  const {error}=await db.from('user_reports').insert({reporter_id:currentUser.id,reported_user_id:selectedPublicProfile.user_id,reason:reason.trim().slice(0,80),details:details.trim().slice(0,2000)});
  if(error){alert('Não foi possível enviar a denúncia: '+error.message);return;}
  alert('Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.');
});
$('startConversationButton').addEventListener('click', async () => {
  if (!selectedPublicProfile) return;
  await startDirectConversation(selectedPublicProfile.user_id, selectedPublicProfile.display_name);
});
$('messagesButton').addEventListener('click', () => {
  if (!currentUser) { openModal('loginModal'); return; }
  showScreen('messagesScreen');
});
$('refreshConversations').addEventListener('click', renderConversationList);

function addMessageToView(message) {
  if (!message || messageCache.has(message.id)) return;
  messageCache.add(message.id);
  const root = $('conversationMessages');
  const bubble = document.createElement('div');
  bubble.className = 'direct-message ' + (message.sender_id === currentUser?.id ? 'sent' : 'received');
  bubble.dataset.messageId = message.id;
  if(message.message_type==='image'||message.message_type==='gif'||message.message_type==='sticker'||message.message_type==='audio'){
    const mediaBox=document.createElement('div');mediaBox.className='message-media';
    db.storage.from('chat-media').createSignedUrl(message.media_path,3600).then(({data,error})=>{
      if(error||!data?.signedUrl){mediaBox.textContent='Mídia indisponível.';return;}
      if(message.message_type==='audio'){
        const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=data.signedUrl;mediaBox.append(audio);
      }else{
        const img=document.createElement('img');img.src=data.signedUrl;img.alt=message.message_type==='gif'?'GIF recebido':'Imagem recebida';img.loading='lazy';
        const shouldBlur=Boolean(message.media_blurred)&&message.sender_id!==currentUser?.id;
        if(shouldBlur){
          img.classList.add('message-image-blurred');
          const reveal=document.createElement('button');reveal.type='button';reveal.className='button button-small button-outline';reveal.textContent='Revelar imagem';
          reveal.addEventListener('click',()=>{img.classList.remove('message-image-blurred');reveal.remove();});
          mediaBox.append(img,reveal);
        }else mediaBox.append(img);
      }
    }).catch(()=>{mediaBox.textContent='Não foi possível carregar a mídia.';});
    bubble.append(mediaBox);
  }
  if(message.message_type==='text'||!message.message_type){
    const body = document.createElement('p');
    body.textContent = message.body;
    bubble.append(body);
  }
  const time = document.createElement('time');
  time.dateTime = message.created_at;
  time.textContent = new Date(message.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
  bubble.append(time);
  root.append(bubble);
  root.scrollTop = root.scrollHeight;
}
async function loadConversationMessages(conversationId) {
  const {data,error} = await db.from('messages').select('id,conversation_id,sender_id,body,created_at,read_at,message_type,media_path,media_mime,media_size,media_blurred')
    .eq('conversation_id', conversationId).order('created_at', {ascending:true}).limit(300);
  if (error) throw error;
  $('conversationMessages').innerHTML = '';
  messageCache.clear();
  (data || []).forEach(addMessageToView);
  const unread = (data || []).filter(m => m.sender_id !== currentUser.id && !m.read_at).map(m => m.id);
  if (unread.length) {
    const {error:readError} = await db.from('messages').update({read_at:new Date().toISOString()}).in('id', unread);
    if (readError) console.warn('Não foi possível atualizar a confirmação de leitura:', readError.message);
  }
}
function subscribeToConversation(conversationId) {
  if (activeConversationChannel) db.removeChannel(activeConversationChannel);
  activeConversationChannel = db.channel('messages-' + conversationId)
    .on('postgres_changes', {event:'INSERT',schema:'public',table:'messages',filter:'conversation_id=eq.' + conversationId}, payload => {
      addMessageToView(payload.new);
      if (payload.new.sender_id !== currentUser?.id) {
        db.from('messages').update({read_at:new Date().toISOString()}).eq('id',payload.new.id).then(({error})=>{if(error)console.warn(error.message);});
      }
    }).subscribe();
}
async function openConversation(conversationId, otherName, otherUserId) {
  activeConversationId = conversationId;
  activeConversationOtherUserId = otherUserId || null;
  $('conversationName').dataset.originalName=otherName||'Conversa';
  $('conversationName').textContent = otherName || 'Conversa';
  $('conversationNickname').value='';
  $('conversationWallpaper').value='default';
  const {data:settings,error:settingsError}=await db.from('conversation_user_settings').select('nickname,wallpaper').eq('user_id',currentUser.id).eq('conversation_id',conversationId).maybeSingle();
  if(settingsError)console.warn('Não foi possível carregar personalização da conversa:',settingsError.message);
  if(settings){$('conversationNickname').value=settings.nickname||'';$('conversationWallpaper').value=settings.wallpaper||'default';}
  $('conversationName').textContent=settings?.nickname||otherName||'Conversa';
  applyConversationWallpaper(settings?.wallpaper||'default');
  $('conversationStatus').textContent = 'Conversa privada · mensagens em tempo real';
  $('conversationPlaceholder').hidden = true;
  $('activeConversation').hidden = false;
  await loadConversationMessages(conversationId);
  subscribeToConversation(conversationId);
  $('directMessageInput').focus();
}
async function startDirectConversation(otherUserId, otherName) {
  if (!currentUser) { closeModal('profileDetailModal'); openModal('loginModal'); return; }
  if (otherUserId === currentUser.id) { alert('Você não pode iniciar uma conversa consigo mesmo.'); return; }
  const button = $('startConversationButton');
  button.disabled = true;
  button.textContent = 'Abrindo conversa...';
  try {
    const {data,error} = await db.rpc('get_or_create_conversation', {p_other_user:otherUserId});
    if (error) throw error;
    closeModal('profileDetailModal');
    await showScreen('messagesScreen');
    await openConversation(data, otherName, otherUserId);
    await renderConversationList();
  } catch (error) {
    console.error(error);
    alert('Não foi possível iniciar a conversa: ' + (error.message || 'erro desconhecido'));
  } finally {
    button.disabled = false;
    button.textContent = '✉ Enviar mensagem';
  }
}
async function renderFriendRequests(){
  const root=$('friendRequestsList');if(!root||!currentUser)return;
  root.innerHTML='';
  const {data:rows,error}=await db.rpc('list_my_friend_requests');
  if(error){root.textContent='Não foi possível carregar pedidos: '+error.message;return;}
  if(!rows?.length){root.textContent='Nenhum pedido pendente.';return;}
  for(const row of rows){
    const item=document.createElement('div');item.className='friend-request-item';
    const name=document.createElement('strong');name.textContent=row.display_name||'Usuário';
    const actions=document.createElement('div');actions.className='friend-request-actions';
    const accept=document.createElement('button');accept.type='button';accept.className='button button-small button-primary';accept.textContent='Aceitar';
    const decline=document.createElement('button');decline.type='button';decline.className='button button-small button-outline';decline.textContent='Recusar';
    accept.addEventListener('click',async()=>{const {error}=await db.rpc('respond_friend_request',{p_request_id:row.request_id,p_accept:true});if(error)alert(error.message);else{await renderFriendRequests();if(selectedPublicProfile?.user_id===row.requester_id)updateFriendRequestButton(row.requester_id);}});
    decline.addEventListener('click',async()=>{const {error}=await db.rpc('respond_friend_request',{p_request_id:row.request_id,p_accept:false});if(error)alert(error.message);else{await renderFriendRequests();if(selectedPublicProfile?.user_id===row.requester_id)updateFriendRequestButton(row.requester_id);}});
    actions.append(accept,decline);item.append(name,actions);root.append(item);
  }
}
async function renderConversationList() {
  const root = $('conversationList');
  if (!root) return;
  root.innerHTML = '';
  if (!currentUser) { root.textContent = 'Entre na sua conta para ver suas conversas.'; return; }
  await renderFriendRequests();
  const {data:rows,error} = await db.rpc('list_my_conversations');
  if (error) { root.textContent = 'Não foi possível carregar conversas: ' + error.message; return; }
  if (!rows?.length) { root.textContent = 'Você ainda não iniciou nenhuma conversa. Abra um perfil para mandar a primeira mensagem.'; return; }
  const {data:customRows}=await db.from('conversation_user_settings').select('conversation_id,nickname').eq('user_id',currentUser.id).in('conversation_id',rows.map(row=>row.conversation_id));
  const nicknameByConversation=new Map((customRows||[]).map(item=>[item.conversation_id,item.nickname]));
  for (const row of rows) {
    const {data:lastRows} = await db.from('messages').select('body,created_at')
      .eq('conversation_id',row.conversation_id).order('created_at',{ascending:false}).limit(1);
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'conversation-list-item' + (row.conversation_id === activeConversationId ? ' active' : '');
    const name = document.createElement('strong'); name.textContent = nicknameByConversation.get(row.conversation_id) || row.display_name || 'Usuário';
    const preview = document.createElement('span'); preview.textContent = lastRows?.[0]?.body || 'Conversa iniciada';
    const date = document.createElement('small'); date.textContent = lastRows?.[0]?.created_at ? new Date(lastRows[0].created_at).toLocaleDateString('pt-BR') : '';
    item.append(name,preview,date);
    item.addEventListener('click',()=>openConversation(row.conversation_id,row.display_name,row.other_user_id));
    root.append(item);
  }
}

function applyConversationWallpaper(value='default'){
  const root=$('conversationMessages');
  ['purple','midnight','forest'].forEach(name=>root.classList.remove('conversation-wallpaper-'+name));
  if(['purple','midnight','forest'].includes(value))root.classList.add('conversation-wallpaper-'+value);
}
$('saveConversationSettings').addEventListener('click',async()=>{
  if(!currentUser||!activeConversationId)return;
  const nickname=$('conversationNickname').value.trim().slice(0,40);
  const wallpaper=$('conversationWallpaper').value;
  const {error}=await db.from('conversation_user_settings').upsert({
    user_id:currentUser.id,conversation_id:activeConversationId,
    nickname:nickname||null,wallpaper
  },{onConflict:'user_id,conversation_id'});
  if(error){alert('Não foi possível salvar a personalização: '+error.message);return;}
  $('conversationName').textContent=nickname||$('conversationName').dataset.originalName||'Conversa';
  $('conversationName').dataset.nickname=nickname;
  applyConversationWallpaper(wallpaper);
  $('conversationCustomizeSaved')?.remove();
  const note=document.createElement('small');note.id='conversationCustomizeSaved';note.textContent='Personalização salva.';note.className='field-note';
  $('saveConversationSettings').after(note);
  await renderConversationList();
});
$('openChatProfileButton').addEventListener('click',async()=>{
  if(!activeConversationId)return;
  const button=$('openChatProfileButton');button.disabled=true;button.textContent='Carregando...';
  try{
    const {data,error}=await db.rpc('get_profile_for_conversation',{p_conversation_id:activeConversationId});
    if(error)throw error;
    if(!data?.length)throw new Error('Perfil indisponível para esta conversa.');
    openProfileDetails(data[0]);
  }catch(error){alert('Não foi possível abrir o perfil: '+error.message);}
  finally{button.disabled=false;button.textContent='Ver perfil';}
});


async function compressChatImage(file,quality){
  if(file.type==='image/gif')return file;
  if(!window.createImageBitmap)throw new Error('Seu navegador não oferece compressão de imagens.');
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
  if(!blob)throw new Error('Não foi possível processar a imagem.');
  return blob;
}
async function sendChatMedia(blob,type,mime,targetConversationId=activeConversationId){
  if(!currentUser||!targetConversationId)throw new Error('Abra uma conversa antes de enviar mídia.');
  if(blob.size>15*1024*1024)throw new Error('O arquivo excede o limite de 15 MB.');
  const extension=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a','audio/mpeg':'mp3','audio/wav':'wav' })[mime]||'bin';
  const path=targetConversationId+'/'+currentUser.id+'/'+crypto.randomUUID()+'.'+extension;
  const {error:uploadError}=await db.storage.from('chat-media').upload(path,blob,{contentType:mime,upsert:false,cacheControl:'3600'});
  if(uploadError)throw uploadError;
  const labels={image:'Imagem',audio:'Áudio',gif:'GIF',sticker:'Figurinha'};
  const {error:messageError}=await db.from('messages').insert({
    conversation_id:targetConversationId,sender_id:currentUser.id,
    body:labels[type]||'Mídia',message_type:type,media_path:path,
    media_mime:mime,media_size:blob.size,media_blurred:['image','gif','sticker'].includes(type)
  });
  if(messageError){await db.storage.from('chat-media').remove([path]);throw messageError;}
}
async function handleChatImage(file,type){
  if(!file)return;
  const quality=Number($('chatImageQuality').value);
  const blob=(type==='sticker')?file:await compressChatImage(file,quality);
  const mime=blob.type||file.type;
  await sendChatMedia(blob,type,mime);
}
$('chooseChatImage').addEventListener('click',()=>$('chatImageInput').click());
$('chooseChatGif').addEventListener('click',()=>$('chatGifInput').click());
$('chatImageInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{await handleChatImage(file,'image');}catch(error){alert('Falha ao enviar imagem: '+error.message);}
});
$('chatGifInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  const type=file.type==='image/gif'?'gif':'sticker';
  try{await handleChatImage(file,type);}catch(error){alert('Falha ao enviar GIF/figurinha: '+error.message);}
});
const emojis=['😀','😂','🥹','😍','😎','🤔','😭','😡','🤝','👍','👎','❤️','🔥','🎉','💀','🤡','🚀','🐸','🐱','🏍️','⚙️','🍕','☕','✨'];
emojis.forEach(emoji=>{
  const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label','Inserir '+emoji);
  button.addEventListener('click',()=>{$('directMessageInput').value += emoji;$('directMessageInput').focus();});
  $('emojiTray').append(button);
});
$('emojiToggle').addEventListener('click',()=>{$('emojiTray').hidden=!$('emojiTray').hidden;});
let audioRecorder=null,audioChunks=[],recordingConversationId=null;
$('recordAudioButton').addEventListener('click',async()=>{
  const button=$('recordAudioButton'),status=$('audioRecordStatus');
  if(audioRecorder?.state==='recording'){audioRecorder.stop();button.textContent='● Gravar áudio';status.textContent='Processando áudio...';return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('Gravação de áudio não é compatível com este navegador.');return;}
  try{
    recordingConversationId=activeConversationId;
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const preferred=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
    audioRecorder=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined);audioChunks=[];
    audioRecorder.ondataavailable=event=>{if(event.data.size)audioChunks.push(event.data);};
    audioRecorder.onstop=async()=>{
      stream.getTracks().forEach(track=>track.stop());
      const blob=new Blob(audioChunks,{type:audioRecorder.mimeType||'audio/webm'});
      try{await sendChatMedia(blob,'audio',blob.type.split(';')[0],recordingConversationId);recordingConversationId=null;status.textContent='Áudio enviado.';}
      catch(error){status.textContent='';alert('Falha ao enviar áudio: '+error.message);}
      audioRecorder=null;
    };
    audioRecorder.start();button.textContent='■ Parar gravação';status.textContent='Gravando...';
  }catch(error){alert('Não foi possível acessar o microfone: '+error.message);}
});

$('directMessageForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = $('directMessageInput').value.trim();
  if (!body || !activeConversationId || !currentUser) return;
  const button = $('directMessageForm').querySelector('button');
  button.disabled = true;
  try {
    const {error} = await db.from('messages').insert({conversation_id:activeConversationId,sender_id:currentUser.id,body});
    if (error) throw error;
    $('directMessageInput').value = '';
  } catch (error) {
    alert('Não foi possível enviar a mensagem: ' + error.message);
  } finally { button.disabled = false; $('directMessageInput').focus(); }
});
window.addEventListener('beforeunload',()=>{if(activeConversationChannel)db.removeChannel(activeConversationChannel);});

// O chat antigo de demonstração foi substituído pelo mensageiro persistente acima.
setWizardStep(0);renderPhotos();renderProfiles();initAuth();