(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  if(typeof db==='undefined'||!db||!$('storiesStrip'))return;
  let stories=[],viewerIndex=0,viewerTimer=null,loadVersion=0,currentStoryId=null;
  async function loadStories(){
    const version=++loadVersion;
    const strip=$('storiesStrip');strip.innerHTML='';
    if(typeof currentUser==='undefined'||!currentUser)return;
    strip.innerHTML='<span class="field-note">Carregando stories...</span>';
    const {data,error}=await db.rpc('get_story_feed_fast');
    if(version!==loadVersion)return;
    if(error){strip.textContent='Não foi possível carregar stories.';console.warn(error);return;}
    const uniqueStories=new Map();
    for(const story of data||[])if(!uniqueStories.has(story.story_id))uniqueStories.set(story.story_id,story);
    stories=[...uniqueStories.values()];
    const avatarUrls=new Map();
    for(const story of stories){
      if(!story.avatar_storage_path||avatarUrls.has(story.user_id))continue;
      const {data}=db.storage.from('profile-photos').getPublicUrl(story.avatar_storage_path);
      if(data?.publicUrl)avatarUrls.set(story.user_id,data.publicUrl);
    }
    if(!avatarUrls.has(currentUser.id)){
      const {data:photos,error:photoError}=await db.rpc('get_story_avatars',{p_user_ids:[currentUser.id]});
      if(version!==loadVersion)return;
      if(!photoError){
        const ownPhoto=(photos||[]).find(photo=>photo.user_id===currentUser.id);
        if(ownPhoto){
          const {data}=db.storage.from('profile-photos').getPublicUrl(ownPhoto.storage_path);
          if(data?.publicUrl)avatarUrls.set(currentUser.id,data.publicUrl);
        }
      }else console.warn('Não foi possível carregar o avatar do seu story:',photoError);
    }
    if(version!==loadVersion)return;
    const own=stories.filter(s=>s.user_id===currentUser.id);
    const add=document.createElement('button');add.type='button';add.className='story-tile story-create';
    const ownAvatar=document.createElement('span');ownAvatar.className='story-avatar';ownAvatar.textContent=(currentProfile?.name||currentProfile?.display_name||currentUser.email||'Você').trim().slice(0,1).toUpperCase();
    if(avatarUrls.has(currentUser.id)){ownAvatar.style.backgroundImage='url("'+avatarUrls.get(currentUser.id)+'")';ownAvatar.classList.add('has-photo');ownAvatar.textContent='';}
    const plus=document.createElement('span');plus.className='story-add-badge';plus.textContent='+';
    ownAvatar.append(plus);add.append(ownAvatar);
    const ownName=document.createElement('strong');ownName.textContent='Seu story';add.append(ownName);
    add.addEventListener('click',()=> $('storyComposer').hidden=!$('storyComposer').hidden);strip.append(add);
    const grouped=new Map();
    stories.forEach(story=>{if(!grouped.has(story.user_id))grouped.set(story.user_id,[]);grouped.get(story.user_id).push(story);});
    for(const [userId,items] of grouped){
      if(userId===currentUser.id)continue;
      const item=items[0],tile=document.createElement('button');tile.type='button';tile.className='story-tile';
      const hasUnseen=items.some(x=>!x.viewed_by_me);
      const avatar=document.createElement('span');avatar.className='story-avatar '+(hasUnseen?'unread':'seen');avatar.textContent=(item.display_name||'B').trim().slice(0,1).toUpperCase();
      if(avatarUrls.has(userId)){avatar.style.backgroundImage='url("'+avatarUrls.get(userId)+'")';avatar.classList.add('has-photo');avatar.textContent='';}
      const name=document.createElement('strong');name.textContent=item.display_name||'Pessoa';
      tile.append(avatar,name);tile.addEventListener('click',()=>openViewer(items[0]));strip.append(tile);
    }
    if(own.length){const ownTile=add.querySelector('strong');ownTile.textContent='Seu story';}
  }
  async function renderStoryReactions(story){
    const root=$('storyReactionButtons'),summary=$('storyReactionSummary');
    if(!root||!summary)return;
    root.querySelectorAll('button').forEach(button=>{button.disabled=true;button.classList.remove('is-selected');});
    summary.textContent='Carregando reações...';
    const {data,error}=await db.from('story_reactions').select('user_id,reaction').eq('story_id',story.story_id);
    if(error){summary.textContent='Reações indisponíveis no momento.';console.warn('Story reactions:',error);return;}
    const counts=new Map();let mine=null;
    for(const row of data||[]){counts.set(row.reaction,(counts.get(row.reaction)||0)+1);if(row.user_id===currentUser.id)mine=row.reaction;}
    root.querySelectorAll('button').forEach(button=>{
      const reaction=button.dataset.reaction,count=counts.get(reaction)||0;
      button.disabled=story.user_id===currentUser.id;
      button.classList.toggle('is-selected',mine===reaction);
      button.setAttribute('aria-pressed',String(mine===reaction));
      button.title=reaction+' · '+count+' reação(ões)';
      button.textContent=count?reaction+' '+count:reaction;
      button.dataset.count=String(count);
    });
    const total=Array.from(counts.values()).reduce((sum,count)=>sum+count,0);
    summary.textContent=total?total+' '+(total===1?'reação':'reações')+(mine?' · sua reação: '+mine:''):'Seja a primeira pessoa a reagir.';
  }
  $('storyReactionButtons')?.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-reaction]');
    if(!button||!currentUser||!currentStoryId)return;
    const story=stories.find(item=>item.story_id===currentStoryId);
    if(!story||story.user_id===currentUser.id)return;
    const reaction=button.dataset.reaction;
    button.disabled=true;
    try{
      const {data:existing,error:readError}=await db.from('story_reactions').select('reaction').eq('story_id',story.story_id).eq('user_id',currentUser.id).maybeSingle();
      if(readError)throw readError;
      if(existing?.reaction===reaction){
        const {error}=await db.from('story_reactions').delete().eq('story_id',story.story_id).eq('user_id',currentUser.id);
        if(error)throw error;
      }else{
        const {error}=await db.from('story_reactions').upsert({story_id:story.story_id,user_id:currentUser.id,reaction},{onConflict:'story_id,user_id'});
        if(error)throw error;
      }
      await renderStoryReactions(story);
    }catch(error){console.warn(error);$('storyReactionSummary').textContent='Não foi possível registrar sua reação. Tente novamente.';}
    finally{button.disabled=false;}
  });
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
    currentStoryId=story.story_id;
    const replyForm=$('storyReplyForm');if(replyForm)replyForm.hidden=story.user_id===currentUser.id;
    await renderStoryReactions(story);
    if(story.user_id!==currentUser.id&&!story.viewed_by_me){
      const {error}=await db.from('story_views').insert({story_id:story.story_id,viewer_id:currentUser.id});
      if(!error)story.viewed_by_me=true;
    }
    let start=Date.now();const tick=()=>{const pct=Math.min(100,(Date.now()-start)/6000*100);$('storyViewerProgress').style.width=pct+'%';if(pct>=100)showStory(list,index+1);else viewerTimer=setTimeout(tick,80);};tick();
    $('storyViewerImage').onclick=()=>showStory(list,index+1);
  }
  $('storyReplyForm')?.addEventListener('submit',async event=>{
    event.preventDefault();const input=$('storyReplyInput'),body=input.value.trim();
    if(!body||!currentUser||!currentStoryId)return;
    const story=stories.find(item=>item.story_id===currentStoryId);
    if(!story||story.user_id===currentUser.id)return;
    const button=$('storyReplyForm').querySelector('button');button.disabled=true;
    try{
      const {data:conversationId,error:conversationError}=await db.rpc('get_or_create_conversation',{p_other_user:story.user_id});
      if(conversationError)throw conversationError;
      const {error}=await db.from('messages').insert({conversation_id:conversationId,sender_id:currentUser.id,body,message_type:'story_reply',story_id:story.story_id});
      if(error)throw error;
      input.value='';$('storyReplySummary')?.remove();
      const note=document.createElement('small');note.id='storyReplySummary';note.className='story-reaction-summary';note.textContent='Resposta enviada para as mensagens.';
      $('storyReplyForm').after(note);
    }catch(error){console.warn('Story reply:',error);alert('Não foi possível responder ao story: '+error.message);}
    finally{button.disabled=false;}
  });
  $('storyReplyInput')?.addEventListener('focus',()=>{if(viewerTimer)clearTimeout(viewerTimer);viewerTimer=null;});
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
  document.addEventListener('click',e=>{if(e.target.closest('[data-screen="homeScreen"]'))setTimeout(loadStories,150);});
  db.auth.onAuthStateChange(()=>setTimeout(loadStories,250));
  loadStories();
  window.refreshBrazillyStories=loadStories;
})();

// Carrega o módulo social de jogos sem acoplar o código ao fluxo de stories.
(() => {
  const script = document.createElement('script');
  script.src = 'games/games.js';
  script.defer = true;
  document.body.append(script);
})();
