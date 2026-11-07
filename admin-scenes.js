(() => {
'use strict';
const $=id=>document.getElementById(id);
const bucket='profile-scene-library';
const allowed=new Set(['image/gif','image/webp','image/png','image/jpeg','image/avif','video/mp4','video/webm']);
const maxBytes=30*1024*1024;
let previewUrl=null;

function isAdmin(){return Boolean(currentUser&&isModerator&&db);}
function status(message){const node=$('adminSceneUploadStatus');if(node)node.textContent=message||'';}
function mediaUrl(path){return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;}
function extFor(file){return ({'image/gif':'gif','image/webp':'webp','image/png':'png','image/jpeg':'jpg','image/avif':'avif','video/mp4':'mp4','video/webm':'webm'})[file.type];}
function showPreview(file){
 const root=$('adminSceneUploadPreview');if(!root)return;
 if(previewUrl)URL.revokeObjectURL(previewUrl);
 previewUrl=URL.createObjectURL(file);root.replaceChildren();
 const media=document.createElement(file.type.startsWith('video/')?'video':'img');
 media.src=previewUrl;media.className='admin-scene-preview-media';
 if(media.tagName==='VIDEO'){media.muted=true;media.loop=true;media.autoplay=true;media.playsInline=true;}
 media.alt='Prévia do cenário selecionado';root.append(media);root.hidden=false;
}
function clearPreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;const root=$('adminSceneUploadPreview');if(root){root.replaceChildren();root.hidden=true;}}
async function loadCatalog(){
 const root=$('adminSceneCatalog');if(!root)return;
 if(!isAdmin()){root.textContent='Acesso restrito à administração.';return;}
 root.replaceChildren(Object.assign(document.createElement('p'),{className:'field-note',textContent:'Carregando cenários...'}));
 const {data,error}=await db.from('profile_scene_catalog').select('id,title,description,storage_path,mime_type,file_size,is_active,sort_order,created_at').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
 if(error){root.textContent='Não foi possível carregar o catálogo: '+error.message;return;}
 root.replaceChildren();
 if(!data?.length){root.append(Object.assign(document.createElement('p'),{className:'admin-scene-empty',textContent:'Nenhum cenário publicado ainda. Envie o primeiro acima.'}));return;}
 for(const item of data){
  const card=document.createElement('article');card.className='admin-scene-item'+(item.is_active?'':' is-disabled');
  const preview=document.createElement('div');preview.className='admin-scene-item-preview';
  const media=document.createElement(item.mime_type.startsWith('video/')?'video':'img');media.src=mediaUrl(item.storage_path);media.alt=item.title;media.loading='lazy';
  if(media.tagName==='VIDEO'){media.muted=true;media.loop=true;media.autoplay=true;media.playsInline=true;}
  preview.append(media);
  const info=document.createElement('div');info.className='admin-scene-item-info';
  const title=document.createElement('strong');title.textContent=item.title;
  const desc=document.createElement('p');desc.textContent=item.description||'Sem descrição';
  const meta=document.createElement('small');meta.textContent=(item.is_active?'Visível na galeria':'Oculto da galeria')+' · '+(item.file_size/1024/1024).toFixed(1)+' MB';
  info.append(title,desc,meta);
  const actions=document.createElement('div');actions.className='admin-scene-item-actions';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='button button-outline';toggle.textContent=item.is_active?'Desativar':'Ativar';
  toggle.addEventListener('click',async()=>{toggle.disabled=true;const {error}=await db.from('profile_scene_catalog').update({is_active:!item.is_active}).eq('id',item.id);if(error){alert('Não foi possível alterar o cenário: '+error.message);toggle.disabled=false;return;}await loadCatalog();});
  const remove=document.createElement('button');remove.type='button';remove.className='button button-danger-outline';remove.textContent='Excluir';
  remove.addEventListener('click',async()=>{if(!confirm('Excluir definitivamente "'+item.title+'"? Perfis que usam este fundo voltarão ao cenário padrão.'))return;remove.disabled=true;const {error:rowError}=await db.from('profile_scene_catalog').delete().eq('id',item.id);if(rowError){alert('Não foi possível excluir o registro: '+rowError.message);remove.disabled=false;return;}const {error:fileError}=await db.storage.from(bucket).remove([item.storage_path]);if(fileError)alert('O cenário saiu da galeria, mas o arquivo não pôde ser removido do armazenamento: '+fileError.message);await loadCatalog();});
  actions.append(toggle,remove);card.append(preview,info,actions);root.append(card);
 }
}
async function publish(event){
 event.preventDefault();if(!isAdmin()){status('Acesso negado.');return;}
 const file=$('adminSceneFile').files?.[0],title=$('adminSceneTitle').value.trim(),description=$('adminSceneDescription').value.trim(),button=$('adminScenePublishButton');
 if(!file){status('Escolha um arquivo primeiro.');return;}
 if(!allowed.has(file.type)||file.size>maxBytes){status('Formato inválido ou arquivo maior que 30 MB.');return;}
 if(!title){status('Informe um nome para o cenário.');return;}
 button.disabled=true;button.textContent='Publicando...';status('Enviando arquivo...');
 const path='library/'+crypto.randomUUID()+'.'+extFor(file);
 try{
  const {error:uploadError}=await db.storage.from(bucket).upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});
  if(uploadError)throw uploadError;
  const {data:existing,error:countError}=await db.from('profile_scene_catalog').select('sort_order').order('sort_order',{ascending:false}).limit(1);
  if(countError)throw countError;
  const nextOrder=(existing?.[0]?.sort_order||0)+10;
  const {error:insertError}=await db.from('profile_scene_catalog').insert({title,description,storage_path:path,mime_type:file.type,file_size:file.size,sort_order:nextOrder,created_by:currentUser.id});
  if(insertError){await db.storage.from(bucket).remove([path]);throw insertError;}
  $('adminSceneUploadForm').reset();clearPreview();status('Cenário publicado! Ele já está disponível na galeria de perfis.');
  await loadCatalog();
 }catch(error){status('Falha ao publicar: '+(error.message||'erro desconhecido'));}
 finally{button.disabled=false;button.textContent='Publicar cenário';}
}
function init(){
 $('adminScenesButton')?.addEventListener('click',()=>showScreen('adminScenesScreen'));
 document.addEventListener('brazilly:screen-changed',event=>{if(event.detail==='adminScenesScreen'){if(!isAdmin()){showScreen('homeScreen');alert('Esta área é exclusiva da administração.');return;}loadCatalog();}});
 $('adminSceneUploadForm')?.addEventListener('submit',publish);
 $('adminSceneRefreshButton')?.addEventListener('click',loadCatalog);
 $('adminSceneFile')?.addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;if(!allowed.has(file.type)||file.size>maxBytes){status('Formato inválido ou arquivo maior que 30 MB.');event.target.value='';clearPreview();return;}if(!$('adminSceneTitle').value.trim())$('adminSceneTitle').value=file.name.split('.').slice(0,-1).join('.').replace(/[-_]+/g,' ');showPreview(file);status(file.name+' selecionado.');});
}
init();
})();