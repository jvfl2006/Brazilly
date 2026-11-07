(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  if(typeof db==='undefined'||!db||!$('storiesStrip'))return;
  let stories=[],viewerIndex=0,viewerTimer=null;
  const escapeText=value=>String(value||'');
  async function loadStories(){
    const strip=$('storiesStrip');strip.innerHTML='';
    if(!window.currentUser){strip.innerHTML='<p class="stories-hint">Entre para ver e compartilhar stories.</p>';return;}
    const {data,error}=await db.rpc('get_story_feed');
    if(error){strip.textContent='Não foi possível carregar stories.';console.warn(error);return;}
    stories=data||[];
    const own=stories.filter(s=>s.user_id===currentUser.id);
    const userIds=[...new Set(stories.map(s=>s.user_id))];
    const avatarUrls=new Map();
    if(userIds.length){
      const {data:photos,error:photoError}=await db.from('profile_photos').select('user_id,storage_path').in('user_id',userIds).eq('is_primary',true);
      if(!photoError){
        for(const photo of photos||[]){
          const {data}=await db.storage.from('profile-photos').createSignedUrl(photo.storage_path,3600);
          if(data?.signedUrl)avatarUrls.set(photo.user_id,data.signedUrl);
        }
      }
    }
    const add=document.createElement('button');add.type='button';add.className='story-tile story-create';
    const ownAvatar=document.createElement('span');ownAvatar.className='story-avatar';ownAvatar.textContent=(currentProfile?.name||currentUser.email||'Você').trim().slice(0,1).toUpperCase();
    if(avatarUrls.has(currentUser.id)){ownAvatar.style.backgroundImage='url("'+avatarUrls.get(currentUser.id)+'")';ownAvatar.classList.add('has-photo');ownAvatar.textContent='';}
    const plus=document.createElement('span');plus.className='story-add-badge';plus.textContent='+';
    ownAvatar.append(plus);add.append(ownAvatar);
    const ownName=document.createElement('strong');ownName.textContent='Seu story';const ownHint=document.createElement('small');ownHint.textContent='Compartilhar';add.append(ownName,ownHint);
    add.addEventListener('click',()=> $('storyComposer').hidden=!$('storyComposer').hidden);strip.append(add);
    const grouped=new Map();
    stories.forEach(story=>{if(!grouped.has(story.user_id))grouped.set(story.user_id,[]);grouped.get(story.user_id).push(story);});
    for(const [userId,items] of grouped){
      if(userId===currentUser.id)continue;
      const item=items[0],tile=document.createElement('button');tile.type='button';tile.className='story-tile';
      const hasUnseen=items.some(x=>!x.viewed_by_me);
      const avatar=document.createElement('span');avatar.className='story-avatar '+(hasUnseen?'unread':'seen');avatar.textContent=(item.display_name||'B').trim().slice(0,1).toUpperCase();
      if(avatarUrls.has(userId)){avatar.style.backgroundImage='url("'+avatarUrls.get(userId)+'")';avatar.classList.add('has-photo');avatar.textContent='';}
      const name=document.createElement('strong');name.textContent=item.display_name||'Pessoa';const count=document.createElement('small');count.textContent=items.length>1?items.length+' stories':'Story';
      tile.append(avatar,name,count);tile.addEventListener('click',()=>openViewer(items[0]));strip.append(tile);
    }
    if(own.length){const ownTile=add.querySelector('small');ownTile.textContent=own.length+' publicado(s)';}
  }
  async function signedUrl(path){const {data,error}=await db.storage.from('story-media').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
  async function openViewer(story){
    const list=stories.filter(s=>s.user_id===story.user_id);viewerIndex=Math.max(0,list.findIndex(s=>s.story_id===story.story_id));
    const overlay=$('storyViewer');overlay.hidden=false;document.body.classList.add('story-view-open');await showStory(list,viewerIndex);
  }
  async function showStory(list,index){
    if(viewerTimer)clearTimeout(viewerTimer);
    if(index>=list.length){$('storyViewer').hidden=true;document.body.classList.remove('story-view-open');return;}
    viewerIndex=index;const story=list[index],image=$('storyViewerImage');
    $('storyViewerName').textContent=story.display_name||'Story';$('storyViewerCaption').textContent=story.caption||'';
    $('storyViewerProgress').style.width='0%';image.src=await signedUrl(story.media_path);
    if(story.user_id!==currentUser.id&&!story.viewed_by_me){
      const {error}=await db.from('story_views').insert({story_id:story.story_id,viewer_id:currentUser.id});
      if(!error)story.viewed_by_me=true;
    }
    let start=Date.now();const tick=()=>{const pct=Math.min(100,(Date.now()-start)/6000*100);$('storyViewerProgress').style.width=pct+'%';if(pct>=100)showStory(list,index+1);else viewerTimer=setTimeout(tick,80);};tick();
    $('storyViewerImage').onclick=()=>showStory(list,index+1);
  }
  $('storyViewerClose').addEventListener('click',()=>{if(viewerTimer)clearTimeout(viewerTimer);$('storyViewer').hidden=true;document.body.classList.remove('story-view-open');loadStories();});
  $('storyComposerForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!currentUser)return;
    const file=$('storyImageInput').files[0],button=$('publishStoryButton');
    if(!file){alert('Escolha uma imagem para publicar.');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){alert('Use JPG, PNG ou WebP.');return;}
    if(file.size>15*1024*1024){alert('A imagem precisa ter até 15 MB.');return;}
    button.disabled=true;button.textContent='Publicando...';
    const path=currentUser.id+'/'+crypto.randomUUID()+'.'+({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);
    try{
      const {error:uploadError}=await db.storage.from('story-media').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const {error}=await db.from('stories').insert({user_id:currentUser.id,caption:$('storyCaptionInput').value.trim(),media_path:path,audience:$('storyAudience').value});
      if(error){await db.storage.from('story-media').remove([path]);throw error;}
      $('storyComposerForm').reset();$('storyComposer').hidden=true;await loadStories();
    }catch(error){alert('Não foi possível publicar o story: '+error.message);}
    finally{button.disabled=false;button.textContent='Publicar story';}
  });
  document.addEventListener('click',e=>{if(e.target.matches('[data-open="homeScreen"]'))setTimeout(loadStories,150);});
  db.auth.onAuthStateChange(()=>setTimeout(loadStories,250));
  loadStories();
  setTimeout(loadStories,900);
  window.refreshBrazillyStories=loadStories;
})();