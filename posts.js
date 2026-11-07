(() => {
'use strict';
const $p = id => document.getElementById(id);
const FILTERS = {none:'',warm:'sepia(.18) saturate(1.12) contrast(1.03)',mono:'grayscale(1)',vivid:'saturate(1.45) contrast(1.08)',cool:'saturate(.88) hue-rotate(12deg) contrast(1.04)'};
const MAX_FILES=10, IMAGE_LIMIT=15*1024*1024, VIDEO_LIMIT=50*1024*1024;
let selectedFiles=[], previewUrls=[], feedLoading=false, feedCursor=null, feedHasMore=true, editingPost=null, editorItems=[], editorOriginalMedia=[], studioReady=null;
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
  if(file.type.startsWith('image/')&&file.type!=='image/gif'){
   const edit=makeButton('✎ Editar','post-preview-edit',async()=>{edit.disabled=true;try{const api=await studioReady;const result=await api.edit(file);if(result&&selectedFiles[index]===file){selectedFiles[index]=result;renderPreview();}}catch(error){postNotice(error.message||'Não foi possível abrir o editor.',true);}finally{edit.disabled=false;}});
   item.append(edit);
  }else if(file.type.startsWith('video/')){const note=document.createElement('span');note.className='post-preview-video-note';note.textContent='Editor de vídeo em breve';item.append(note);}
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remover arquivo');remove.addEventListener('click',()=>{selectedFiles.splice(index,1);renderPreview();});
  item.append(remove);root.append(item);
 });
}
function validMedia(file,notify=postNotice){
 if(file.type.startsWith('image/')){
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){notify('Formato de imagem não aceito. Use JPG, PNG, WEBP ou GIF.',true);return false;}
  if(file.size>IMAGE_LIMIT){notify('Cada foto pode ter no máximo 15 MB.',true);return false;}
  return true;
 }
 if(file.type.startsWith('video/')){
  if(!['video/mp4','video/webm','video/quicktime'].includes(file.type)){notify('Formato de vídeo não aceito. Use MP4, WebM ou MOV.',true);return false;}
  if(file.size>VIDEO_LIMIT){notify('Cada vídeo pode ter no máximo 50 MB.',true);return false;}
  return true;
 }
 notify('Escolha uma foto ou vídeo compatível.',true);return false;
}
function openComposer(){if(!currentUser){openModal('loginModal');return;}const form=$p('postComposer');form.hidden=false;$p('postCaption').focus();}
function closeComposer(){const form=$p('postComposer');form.hidden=true;form.reset();selectedFiles=[];renderPreview();postNotice('');}
function formatPostDate(value){return new Date(value).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'});}
function makeButton(label,className,handler){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.addEventListener('click',handler);return b;}
async function loadPosts(append=false){
 const root=$p('homePostsFeed');if(!root||!currentUser||feedLoading||(append&&!feedHasMore))return;feedLoading=true;
 if(!append){feedCursor=null;feedHasMore=true;root.replaceChildren();}
 const loading=document.createElement('p');loading.className='field-note posts-loading';loading.textContent='Carregando publicações...';root.append(loading);
 try{
  const {data:posts,error}=await db.rpc('get_home_posts',{p_limit:10,p_before_created_at:append?feedCursor?.created_at:null,p_before_id:append?feedCursor?.id:null});if(error)throw error;loading.remove();
  if(!posts?.length){feedHasMore=false;if(!append){const empty=document.createElement('div');empty.className='post-feed-empty';empty.innerHTML='<strong>Seu feed ainda está vazio.</strong><span>Publique a primeira foto ou vídeo e dê início à movimentação por aqui.</span>';empty.append(makeButton('＋ Fazer a primeira publicação','button button-primary',openComposer));root.append(empty);}return;}
  feedCursor={created_at:posts[posts.length-1].created_at,id:posts[posts.length-1].id};feedHasMore=posts.length===10;
  const ids=posts.map(p=>p.id);const [mediaResult,likesResult,commentsResult]=await Promise.all([db.from('post_media').select('id,post_id,storage_path,media_type,mime_type,position').in('post_id',ids).order('position'),db.from('post_likes').select('post_id,user_id').in('post_id',ids),db.from('post_comments').select('post_id').in('post_id',ids)]);
  for(const r of [mediaResult,likesResult,commentsResult])if(r.error)throw r.error;
  const mediaRows=await Promise.all((mediaResult.data||[]).map(async item=>{const {data,error}=await db.storage.from('post-media').createSignedUrl(item.storage_path,3600);if(error)throw error;return {...item,signedUrl:data.signedUrl};}));
  const mediaByPost=new Map(),likesByPost=new Map(),commentsByPost=new Map();for(const m of mediaRows){if(!mediaByPost.has(m.post_id))mediaByPost.set(m.post_id,[]);mediaByPost.get(m.post_id).push(m);}for(const l of likesResult.data||[])likesByPost.set(l.post_id,(likesByPost.get(l.post_id)||[]).concat(l));for(const c of commentsResult.data||[])commentsByPost.set(c.post_id,(commentsByPost.get(c.post_id)||0)+1);
  const fragment=document.createDocumentFragment();for(const post of posts)fragment.append(renderPost(post,post.display_name||'Pessoa do Brazilly',mediaByPost.get(post.id)||[],likesByPost.get(post.id)||[],commentsByPost.get(post.id)||0));root.append(fragment);
  if(!feedHasMore){const end=document.createElement('p');end.className='posts-feed-end';end.textContent='Você chegou ao fim das publicações por enquanto.';root.append(end);}
 }catch(error){console.error('Falha ao carregar feed:',error);loading.remove();const message=document.createElement('p');message.className='field-note';message.textContent='Não foi possível carregar o feed: '+error.message;root.append(message);}
 finally{feedLoading=false;}
}
async function openPostEditor(post,media){
 if(!currentUser||post.user_id!==currentUser.id)return;
 editingPost=post;editorOriginalMedia=media.map(item=>({...item}));editorItems=await Promise.all(media.map(async item=>{if(item.signedUrl)return {...item};const {data,error}=await db.storage.from('post-media').createSignedUrl(item.storage_path,3600);if(error)throw error;return {...item,signedUrl:data.signedUrl};}));
 $p('postEditorCaption').value=post.caption||'';$p('postEditorCaptionCount').textContent=String((post.caption||'').length);setEditorFilter(post.filter_name||'none');renderPostEditor();$p('postEditorStatus').textContent='';$p('postEditorStatus').classList.remove('is-error');$p('postEditorModal').hidden=false;document.body.style.overflow='hidden';
}
function closePostEditor(){const modal=$p('postEditorModal');if(!modal)return;modal.hidden=true;document.body.style.overflow='';editorItems.forEach(item=>{if(item.objectUrl)URL.revokeObjectURL(item.objectUrl);});editorItems=[];editorOriginalMedia=[];editingPost=null;$p('postEditorFileInput').value='';}
function editorMessage(message,error=false){const el=$p('postEditorStatus');el.textContent=message;el.classList.toggle('is-error',error);}
function setEditorFilter(name){$p('postEditorFilter').value=name;document.querySelectorAll('[data-editor-filter]').forEach(button=>button.classList.toggle('is-active',button.dataset.editorFilter===name));renderPostEditor();}
async function editExistingPhoto(item){
 try{
  const api=await studioReady;let file=item.file;
  if(!file){const response=await fetch(item.signedUrl);if(!response.ok)throw new Error('Não foi possível baixar a foto para edição.');const blob=await response.blob();file=new File([blob],'foto-original.'+((item.mime_type||'image/jpeg').split('/')[1]||'jpg'),{type:item.mime_type||blob.type||'image/jpeg'});}
  const result=await api.edit(file);if(!result)return;
  if(item.objectUrl)URL.revokeObjectURL(item.objectUrl);
  item.file=result;item.objectUrl=URL.createObjectURL(result);item.media_type='image';item.mime_type=result.type;delete item.signedUrl;renderPostEditor();
 }catch(error){editorMessage(error.message||'Não foi possível editar a foto.',true);}
}
function renderPostEditor(){
 const root=$p('postEditorMediaList');root.replaceChildren();$p('postEditorMediaCount').textContent=editorItems.length+'/10';
 editorItems.forEach((item,index)=>{
  const card=document.createElement('div');card.className='post-editor-media-item';const url=item.objectUrl||item.signedUrl;let media;
  if(item.media_type==='video'){media=document.createElement('video');media.src=url;media.muted=true;media.playsInline=true;}else{media=document.createElement('img');media.src=url;media.alt='Mídia '+(index+1);}
  applyFilter(media,$p('postEditorFilter').value);card.append(media);
  const type=document.createElement('span');type.className='editor-media-type';type.textContent=item.media_type==='video'?'VÍDEO':'FOTO';card.append(type);
  const actions=document.createElement('div');actions.className='editor-media-actions';
  const up=makeButton('↑','',()=>{if(index>0){[editorItems[index-1],editorItems[index]]=[editorItems[index],editorItems[index-1]];renderPostEditor();}});up.disabled=index===0;up.setAttribute('aria-label','Mover para esquerda');
  const down=makeButton('↓','',()=>{if(index<editorItems.length-1){[editorItems[index+1],editorItems[index]]=[editorItems[index],editorItems[index+1]];renderPostEditor();}});down.disabled=index===editorItems.length-1;down.setAttribute('aria-label','Mover para direita');
  const replace=makeButton('↻','',()=>fileInput.click());replace.setAttribute('aria-label','Substituir mídia');
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';fileInput.hidden=true;
  fileInput.addEventListener('change',()=>{const file=fileInput.files?.[0];if(!file)return;if(!validMedia(file,editorMessage)){fileInput.value='';return;}if(editorItems[index].objectUrl)URL.revokeObjectURL(editorItems[index].objectUrl);const objectUrl=URL.createObjectURL(file);editorItems[index]={...editorItems[index],file,objectUrl,media_type:file.type.startsWith('video/')?'video':'image',mime_type:file.type};renderPostEditor();});
  const remove=makeButton('×','editor-remove',()=>{const removed=editorItems.splice(index,1)[0];if(removed.objectUrl)URL.revokeObjectURL(removed.objectUrl);renderPostEditor();});remove.setAttribute('aria-label','Remover mídia');
  if(item.media_type==='image'){const editPhoto=makeButton('✎','',()=>editExistingPhoto(item));editPhoto.setAttribute('aria-label','Editar foto no Brazilly Studio');actions.append(editPhoto);}
  actions.append(up,down,replace,remove);card.append(fileInput,actions);root.append(card);
 });
}
async function savePostEditor(){
 if(!editingPost||!currentUser)return;
 const button=$p('savePostEditor'),modal=$p('postEditorModal');button.disabled=true;modal.classList.add('editor-busy');editorMessage('Salvando alterações...');
 const oldCaption=editingPost.caption||'',oldFilter=editingPost.filter_name||'none',newUploads=[],oldRows=editorOriginalMedia.map(({signedUrl,...row})=>row);
 let mediaRowsChanged=false,postUpdated=false;
 try{
  for(let i=0;i<editorItems.length;i++){
   const item=editorItems[i];if(item.file){
    const ext=(item.file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin',path=currentUser.id+'/'+editingPost.id+'/'+crypto.randomUUID()+'.'+ext;
    editorMessage('Enviando arquivo '+(i+1)+' de '+editorItems.length+'...');
    const {error}=await db.storage.from('post-media').upload(path,item.file,{contentType:item.file.type,upsert:false,cacheControl:'3600'});if(error)throw error;
    newUploads.push(path);item.storage_path=path;item.mime_type=item.file.type;item.user_id=currentUser.id;item.post_id=editingPost.id;
   }
  }
  editorMessage('Atualizando publicação...');
  const caption=$p('postEditorCaption').value.trim(),filter_name=$p('postEditorFilter').value;
  const {error:updateError}=await db.from('posts').update({caption,filter_name}).eq('id',editingPost.id).eq('user_id',currentUser.id);if(updateError)throw updateError;postUpdated=true;
  const {error:deleteError}=await db.from('post_media').delete().eq('post_id',editingPost.id);if(deleteError)throw deleteError;mediaRowsChanged=true;
  const rows=editorItems.map((item,position)=>({post_id:editingPost.id,user_id:currentUser.id,storage_path:item.storage_path,media_type:item.media_type,mime_type:item.mime_type,position}));
  if(rows.length){const {error:insertError}=await db.from('post_media').insert(rows);if(insertError)throw insertError;}
  const retained=new Set(editorItems.filter(item=>!item.file||item.storage_path).map(item=>item.storage_path));
  const removed=editorOriginalMedia.map(item=>item.storage_path).filter(path=>!retained.has(path));
  if(removed.length){const {error:removeError}=await db.storage.from('post-media').remove(removed);if(removeError)console.warn('Mídia removida do post, mas o arquivo antigo não foi apagado:',removeError.message);}
  closePostEditor();await loadPosts();
 }catch(error){
  console.error('Falha ao editar publicação:',error);
  if(mediaRowsChanged){await db.from('post_media').delete().eq('post_id',editingPost.id);if(oldRows.length)await db.from('post_media').insert(oldRows);}
  if(postUpdated)await db.from('posts').update({caption:oldCaption,filter_name:oldFilter}).eq('id',editingPost.id).eq('user_id',currentUser.id);
  if(newUploads.length)await db.storage.from('post-media').remove(newUploads);
  editorMessage('Não foi possível salvar: '+error.message,true);
 }finally{button.disabled=false;modal.classList.remove('editor-busy');}
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
 const actions=document.createElement('div');actions.className='home-post-actions';const liked=likes.some(l=>l.user_id===currentUser.id);const likeButton=makeButton((liked?'♥':'♡')+' '+likes.length,'post-like-button'+(liked?' is-liked':''),async()=>{likeButton.disabled=true;try{if(liked){const {error}=await db.from('post_likes').delete().eq('post_id',post.id).eq('user_id',currentUser.id);if(error)throw error;}else{const {error}=await db.from('post_likes').insert({post_id:post.id,user_id:currentUser.id});if(error)throw error;}await loadPosts();}catch(e){postNotice('Não foi possível registrar a curtida: '+e.message,true);}finally{likeButton.disabled=false;}});const commentToggle=makeButton('Comentários · '+commentCount,'post-comment-toggle',()=>toggleComments(post.id,commentsBox));actions.append(likeButton,commentToggle);if(post.user_id===currentUser.id){const editButton=makeButton('✎ Editar','post-editor-edit-button',()=>openPostEditor(post,media).catch(error=>{console.error(error);alert('Não foi possível abrir o editor: '+error.message);}));actions.append(editButton);}card.append(actions);
 const commentsBox=document.createElement('div');commentsBox.className='home-post-comments';commentsBox.hidden=true;card.append(commentsBox);return card;
}
async function toggleComments(postId,root){if(!root.hidden){root.hidden=true;return;}root.hidden=false;await loadComments(postId,root);}
async function loadComments(postId,root){root.replaceChildren();const loading=document.createElement('small');loading.textContent='Carregando comentários...';root.append(loading);try{const {data,error}=await db.rpc('get_post_comments',{p_post_id:postId});if(error)throw error;root.replaceChildren();for(const item of data||[]){const row=document.createElement('p');row.className='post-comment';const author=document.createElement('strong');author.textContent=(item.display_name||'Pessoa')+' ';row.append(author,document.createTextNode(item.body));root.append(row);}const form=document.createElement('form');form.className='post-comment-form';const input=document.createElement('input');input.maxLength=1000;input.required=true;input.placeholder='Escreva um comentário...';const send=document.createElement('button');send.type='submit';send.className='button button-primary';send.textContent='Enviar';form.append(input,send);form.addEventListener('submit',async e=>{e.preventDefault();send.disabled=true;const {error}=await db.from('post_comments').insert({post_id:postId,user_id:currentUser.id,body:input.value.trim()});if(error){postNotice('Não foi possível comentar: '+error.message,true);send.disabled=false;return;}const countButton=root.closest('.home-post-card')?.querySelector('.post-comment-toggle');if(countButton){const count=Number((countButton.textContent.match(/\d+/)||['0'])[0])+1;countButton.textContent='Comentários · '+count;}await loadComments(postId,root);root.hidden=false;});root.append(form);}catch(error){root.textContent='Não foi possível carregar comentários: '+error.message;}}
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
 studioReady=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='studio.js';script.onload=()=>resolve(window.BrazillyStudio);script.onerror=()=>reject(new Error('Não foi possível carregar o Brazilly Studio.'));document.head.append(script);});
 $p('openPostComposer')?.addEventListener('click',openComposer);$p('closePostComposer')?.addEventListener('click',closeComposer);$p('postMediaInput')?.addEventListener('change',event=>{const incoming=[...(event.target.files||[])];for(const file of incoming){if(selectedFiles.length>=MAX_FILES){postNotice('Uma publicação pode ter até 10 arquivos.',true);break;}if(validMedia(file))selectedFiles.push(file);}event.target.value='';renderPreview();});
 $p('postFilter')?.addEventListener('change',renderPreview);$p('postComposer')?.addEventListener('submit',publishPost);
 $p('closePostEditor')?.addEventListener('click',closePostEditor);$p('cancelPostEditor')?.addEventListener('click',closePostEditor);$p('savePostEditor')?.addEventListener('click',savePostEditor);
 $p('postEditorModal')?.querySelector('[data-close-post-editor]')?.addEventListener('click',closePostEditor);
 $p('postEditorFileInput')?.addEventListener('change',event=>{for(const file of [...(event.target.files||[])]){if(editorItems.length>=MAX_FILES){editorMessage('Uma publicação pode ter até 10 mídias.',true);break;}if(validMedia(file,editorMessage)){const objectUrl=URL.createObjectURL(file);editorItems.push({file,objectUrl,media_type:file.type.startsWith('video/')?'video':'image',mime_type:file.type});}}event.target.value='';renderPostEditor();});
 $p('postEditorCaption')?.addEventListener('input',event=>$p('postEditorCaptionCount').textContent=String(event.target.value.length));
 document.querySelectorAll('[data-editor-filter]').forEach(button=>button.addEventListener('click',()=>setEditorFilter(button.dataset.editorFilter)));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$p('postEditorModal').hidden)closePostEditor();});
 $p('homePostsFeed')?.addEventListener('scroll',()=>{const root=$p('homePostsFeed');if(root.scrollTop+root.clientHeight>=root.scrollHeight-500)loadPosts(true);},{passive:true});
 db.auth.onAuthStateChange((_event,session)=>{if(session){setTimeout(loadPosts,350);}else{$p('homePostsFeed')?.replaceChildren();closeComposer();}});
 db.auth.getSession().then(({data})=>{if(data.session)setTimeout(loadPosts,250);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPosts);else initPosts();
})();