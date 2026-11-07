(() => {
'use strict';
const $p = id => document.getElementById(id);
const FILTERS = {none:'',warm:'sepia(.18) saturate(1.12) contrast(1.03)',mono:'grayscale(1)',vivid:'saturate(1.45) contrast(1.08)',cool:'saturate(.88) hue-rotate(12deg) contrast(1.04)'};
const MAX_FILES=10, IMAGE_LIMIT=15*1024*1024, VIDEO_LIMIT=50*1024*1024;
let selectedFiles=[], previewUrls=[], feedLoading=false;
function postNotice(message,error=false){const status=$p('postComposerStatus');if(status){status.textContent=message;status.classList.toggle('is-error',error);}else alert(message);}
function clearPreviews(){previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];}
function applyFilter(element,name){element.style.filter=FILTERS[name]||'';}
function renderPreview(){
 const root=$p('postMediaPreview');if(!root)return;clearPreviews();root.replaceChildren();
 selectedFiles.forEach((file,index)=>{
  const item=document.createElement('div');item.className='post-preview-item';
  const url=URL.createObjectURL(file);previewUrls.push(url);
  let media;
  if(file.type.startsWith('video/')){media=document.createElement('video');media.src=url;media.muted=true;media.playsInline=true;}
  else{media=document.createElement('img');media.src=url;media.alt='Prévia da mídia '+(index+1);}
  applyFilter(media,$p('postFilter').value);item.append(media);
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remover arquivo');remove.addEventListener('click',()=>{selectedFiles.splice(index,1);renderPreview();});
  item.append(remove);root.append(item);
 });
}
function validMedia(file){
 if(file.type.startsWith('image/')){
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){postNotice('Formato de imagem não aceito. Use JPG, PNG, WEBP ou GIF.',true);return false;}
  if(file.size>IMAGE_LIMIT){postNotice('Cada foto pode ter no máximo 15 MB.',true);return false;}
  return true;
 }
 if(file.type.startsWith('video/')){
  if(!['video/mp4','video/webm','video/quicktime'].includes(file.type)){postNotice('Formato de vídeo não aceito. Use MP4, WebM ou MOV.',true);return false;}
  if(file.size>VIDEO_LIMIT){postNotice('Cada vídeo pode ter no máximo 50 MB.',true);return false;}
  return true;
 }
 postNotice('Escolha uma foto ou vídeo compatível.',true);return false;
}
function openComposer(){if(!currentUser){openModal('loginModal');return;}const form=$p('postComposer');form.hidden=false;$p('postCaption').focus();}
function closeComposer(){const form=$p('postComposer');form.hidden=true;form.reset();selectedFiles=[];renderPreview();postNotice('');}
function formatPostDate(value){return new Date(value).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'});}
function makeButton(label,className,handler){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.addEventListener('click',handler);return b;}
async function loadPosts(){
 const root=$p('homePostsFeed');if(!root||!currentUser||feedLoading)return;feedLoading=true;root.replaceChildren();const loading=document.createElement('p');loading.className='field-note';loading.textContent='Carregando publicações...';root.append(loading);
 try{
  const {data:posts,error}=await db.rpc('get_home_posts',{p_limit:40});if(error)throw error;
  if(!posts?.length){const empty=document.createElement('div');empty.className='post-feed-empty';empty.innerHTML='<strong>Seu feed ainda está vazio.</strong><span>Publique a primeira foto ou vídeo e dê início à movimentação por aqui.</span>';empty.append(makeButton('＋ Fazer a primeira publicação','button button-primary',openComposer));root.replaceChildren(empty);return;}
  const ids=posts.map(p=>p.id),users=[...new Set(posts.map(p=>p.user_id))];
  const [mediaResult,likesResult,commentsResult]=await Promise.all([
   db.from('post_media').select('id,post_id,storage_path,media_type,mime_type,position').in('post_id',ids).order('position'),
   db.from('post_likes').select('post_id,user_id').in('post_id',ids),
   db.from('post_comments').select('post_id').in('post_id',ids)
  ]);
  for(const r of [mediaResult,likesResult,commentsResult])if(r.error)throw r.error;
  const mediaRows=await Promise.all((mediaResult.data||[]).map(async item=>{const {data,error}=await db.storage.from('post-media').createSignedUrl(item.storage_path,3600);if(error)throw error;return {...item,signedUrl:data.signedUrl};}));
  const mediaByPost=new Map(),likesByPost=new Map(),commentsByPost=new Map();
  for(const m of mediaRows){if(!mediaByPost.has(m.post_id))mediaByPost.set(m.post_id,[]);mediaByPost.get(m.post_id).push(m);}
  for(const l of likesResult.data||[]){likesByPost.set(l.post_id,(likesByPost.get(l.post_id)||[]).concat(l));}
  for(const c of commentsResult.data||[])commentsByPost.set(c.post_id,(commentsByPost.get(c.post_id)||0)+1);
  const fragment=document.createDocumentFragment();
  for(const post of posts)fragment.append(renderPost(post,post.display_name||'Pessoa do Brazilly',mediaByPost.get(post.id)||[],likesByPost.get(post.id)||[],commentsByPost.get(post.id)||0));
  root.replaceChildren(fragment);
 }catch(error){console.error('Falha ao carregar feed:',error);root.replaceChildren();const message=document.createElement('p');message.className='field-note';message.textContent='Não foi possível carregar o feed: '+error.message;root.append(message);}
 finally{feedLoading=false;}
}
function renderPost(post,name,media,likes,commentCount){
 const card=document.createElement('article');card.className='home-post-card';
 const header=document.createElement('header');header.className='home-post-author';
 const avatar=document.createElement('span');avatar.className='home-post-avatar';avatar.textContent=(name.trim()[0]||'B').toUpperCase();
 const details=document.createElement('div');const strong=document.createElement('strong');strong.textContent=name;const date=document.createElement('small');date.textContent=formatPostDate(post.created_at);details.append(strong,date);header.append(avatar,details);card.append(header);
 if(media.length){
  const gallery=document.createElement('div');gallery.className='home-post-gallery';
  media.forEach((item,index)=>{
   const wrap=document.createElement('div');wrap.className='home-post-media';wrap.hidden=index!==0;applyFilter(wrap,post.filter_name);
   if(item.media_type==='video'){const video=document.createElement('video');video.src=item.signedUrl;video.controls=true;video.playsInline=true;video.preload='metadata';wrap.append(video);}
   else{const image=document.createElement('img');image.src=item.signedUrl;image.alt='Mídia publicada por '+name;image.loading='lazy';wrap.append(image);}
   gallery.append(wrap);
  });
  if(media.length>1){let active=0;const controls=document.createElement('div');controls.className='home-post-gallery-controls';const previous=makeButton('‹','post-gallery-arrow',()=>show(active-1));const counter=document.createElement('span');counter.textContent='1 / '+media.length;const next=makeButton('›','post-gallery-arrow',()=>show(active+1));function show(nextIndex){active=(nextIndex+media.length)%media.length;[...gallery.children].forEach((el,i)=>el.hidden=i!==active);counter.textContent=(active+1)+' / '+media.length;}controls.append(previous,counter,next);gallery.append(controls);}
  card.append(gallery);
 }
 if(post.caption){const caption=document.createElement('p');caption.className='home-post-caption';const author=document.createElement('strong');author.textContent=name+' ';caption.append(author,document.createTextNode(post.caption));card.append(caption);}
 const actions=document.createElement('div');actions.className='home-post-actions';const liked=likes.some(l=>l.user_id===currentUser.id);const likeButton=makeButton((liked?'♥':'♡')+' '+likes.length,'post-like-button'+(liked?' is-liked':''),async()=>{likeButton.disabled=true;try{if(liked){const {error}=await db.from('post_likes').delete().eq('post_id',post.id).eq('user_id',currentUser.id);if(error)throw error;}else{const {error}=await db.from('post_likes').insert({post_id:post.id,user_id:currentUser.id});if(error)throw error;}await loadPosts();}catch(e){postNotice('Não foi possível registrar a curtida: '+e.message,true);}finally{likeButton.disabled=false;}});const commentToggle=makeButton('Comentários · '+commentCount,'post-comment-toggle',()=>toggleComments(post.id,commentsBox));actions.append(likeButton,commentToggle);card.append(actions);
 const commentsBox=document.createElement('div');commentsBox.className='home-post-comments';commentsBox.hidden=true;card.append(commentsBox);return card;
}
async function toggleComments(postId,root){if(!root.hidden){root.hidden=true;return;}root.hidden=false;await loadComments(postId,root);}
async function loadComments(postId,root){root.replaceChildren();const loading=document.createElement('small');loading.textContent='Carregando comentários...';root.append(loading);try{const {data,error}=await db.rpc('get_post_comments',{p_post_id:postId});if(error)throw error;root.replaceChildren();for(const item of data||[]){const row=document.createElement('p');row.className='post-comment';const author=document.createElement('strong');author.textContent=(item.display_name||'Pessoa')+' ';row.append(author,document.createTextNode(item.body));root.append(row);}const form=document.createElement('form');form.className='post-comment-form';const input=document.createElement('input');input.maxLength=1000;input.required=true;input.placeholder='Escreva um comentário...';const send=document.createElement('button');send.type='submit';send.className='button button-primary';send.textContent='Enviar';form.append(input,send);form.addEventListener('submit',async e=>{e.preventDefault();send.disabled=true;const {error}=await db.from('post_comments').insert({post_id:postId,user_id:currentUser.id,body:input.value.trim()});if(error){postNotice('Não foi possível comentar: '+error.message,true);send.disabled=false;return;}const countButton=root.closest('.home-post-card')?.querySelector('.post-comment-toggle');if(countButton){const count=Number((countButton.textContent.match(/\\d+/)||['0'])[0])+1;countButton.textContent='Comentários · '+count;}await loadComments(postId,root);root.hidden=false;});root.append(form);}catch(error){root.textContent='Não foi possível carregar comentários: '+error.message;}}
async function publishPost(event){
 event.preventDefault();if(!currentUser){openModal('loginModal');return;}const caption=$p('postCaption').value.trim();if(!caption&&!selectedFiles.length){postNotice('Adicione uma foto, vídeo ou escreva uma legenda.',true);return;}
 const button=$p('publishPostButton');button.disabled=true;$p('closePostComposer').disabled=true;postNotice('Preparando publicação...');
 let postId=null,uploaded=[];
 try{
  const {data:post,error:postError}=await db.from('posts').insert({user_id:currentUser.id,caption,filter_name:$p('postFilter').value}).select('id').single();if(postError)throw postError;postId=post.id;
  for(let i=0;i<selectedFiles.length;i++){
   const file=selectedFiles[i],ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin',path=currentUser.id+'/'+postId+'/'+crypto.randomUUID()+'.'+ext;
   postNotice('Enviando mídia '+(i+1)+' de '+selectedFiles.length+'...');
   const {error:uploadError}=await db.storage.from('post-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});if(uploadError)throw uploadError;uploaded.push(path);
   const {error:mediaError}=await db.from('post_media').insert({post_id:postId,user_id:currentUser.id,storage_path:path,media_type:file.type.startsWith('video/')?'video':'image',mime_type:file.type,position:i});if(mediaError)throw mediaError;
  }
  const {error:activityError}=await db.from('social_feed_items').insert({user_id:currentUser.id,item_type:'post_created',reference_id:postId,body:(caption||'Compartilhou uma publicação.').slice(0,500)});if(activityError)console.warn('Publicação salva, mas não entrou na central social:',activityError.message);closeComposer();await loadPosts();
 }catch(error){console.error('Falha ao publicar:',error);if(uploaded.length)await db.storage.from('post-media').remove(uploaded);if(postId)await db.from('posts').delete().eq('id',postId);postNotice('Não foi possível publicar: '+error.message,true);}
 finally{button.disabled=false;$p('closePostComposer').disabled=false;}
}
function initPosts(){
 $p('openPostComposer')?.addEventListener('click',openComposer);$p('closePostComposer')?.addEventListener('click',closeComposer);$p('postMediaInput')?.addEventListener('change',event=>{const incoming=[...(event.target.files||[])];for(const file of incoming){if(selectedFiles.length>=MAX_FILES){postNotice('Uma publicação pode ter até 10 arquivos.',true);break;}if(validMedia(file))selectedFiles.push(file);}event.target.value='';renderPreview();});
 $p('postFilter')?.addEventListener('change',renderPreview);$p('postComposer')?.addEventListener('submit',publishPost);
 document.addEventListener('brazilly:screen-changed',event=>{if(event.detail==='homeScreen'&&currentUser)setTimeout(loadPosts,100);});
 db.auth.onAuthStateChange((_event,session)=>{if(session){setTimeout(loadPosts,350);}else{$p('homePostsFeed')?.replaceChildren();closeComposer();}});
 db.auth.getSession().then(({data})=>{if(data.session)setTimeout(loadPosts,250);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPosts);else initPosts();
})();