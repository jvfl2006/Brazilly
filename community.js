(() => {
  'use strict';
  const el=id=>document.getElementById(id);if(!db)return;
  let randomSessionId=null,randomPartnerId=null,randomChannel=null,randomPoll=null,randomSessionWatch=null;
  let communityId=null,communityChannel=null,communityReadChannel=null;
  const setText=(id,value)=>{const node=el(id);if(node)node.textContent=value;};
  function requireLogin(){if(!window.supabase||!currentUser){if(typeof openModal==='function')openModal('loginModal');return false;}return true;}
  function systemMessage(root,text){const node=document.createElement('div');node.className='system-message';node.textContent=text;root.append(node);root.scrollTop=root.scrollHeight;}
  function appendChatMessage(root,row,mine){const item=document.createElement('div');item.className='direct-message '+(mine?'sent':'received');const p=document.createElement('p');p.textContent=row.body;const time=document.createElement('time');time.textContent=new Date(row.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});item.append(p,time);root.append(item);root.scrollTop=root.scrollHeight;}
  function stopRandomWatch(){if(randomChannel){db.removeChannel(randomChannel);randomChannel=null;}if(randomSessionWatch){db.removeChannel(randomSessionWatch);randomSessionWatch=null;}if(randomPoll){clearInterval(randomPoll);randomPoll=null;}}
  async function loadRandomMessages(){
    const root=el('randomMessages');root.innerHTML='';
    const {data,error}=await db.from('random_chat_messages').select('id,sender_id,body,created_at').eq('session_id',randomSessionId).order('created_at').limit(200);
    if(error){systemMessage(root,'Não foi possível carregar o histórico: '+error.message);return;}
    (data||[]).forEach(row=>appendChatMessage(root,row,row.sender_id===currentUser.id));
    randomChannel=db.channel('random-chat-messages-'+randomSessionId).on('postgres_changes',{event:'INSERT',schema:'public',table:'random_chat_messages',filter:'session_id=eq.'+randomSessionId},payload=>{if(payload.new.sender_id!==currentUser?.id)appendChatMessage(root,payload.new,false);}).subscribe();
    randomSessionWatch=db.channel('random-chat-session-'+randomSessionId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'random_chat_sessions',filter:'id=eq.'+randomSessionId},payload=>{if(payload.new.status==='ended'){setText('randomStatus','A outra pessoa encerrou a conversa. Você pode procurar alguém novo.');stopRandomWatch();randomSessionId=null;randomPartnerId=null;el('randomMessageForm').querySelector('button').disabled=true;el('randomMessageInput').disabled=true;}}).subscribe();
  }
  async function findRandomPartner(){
    if(!requireLogin()||randomSessionId)return;
    const start=el('findRandomButton');start.disabled=true;start.textContent='Procurando...';el('randomMessageForm').querySelector('button').disabled=true;el('randomMessageInput').disabled=true;el('randomMessages').innerHTML='';setText('randomStatus','Procurando alguém disponível...');
    try{const {data,error}=await db.rpc('find_random_chat');if(error)throw error;if(data?.status==='matched'){await activateRandomSession(data);return;}
      setText('randomStatus','Na fila. Assim que alguém estiver disponível, a conversa começa.');
      if(!randomPoll)randomPoll=setInterval(async()=>{if(!currentUser||randomSessionId){stopRandomWatch();return;}const {data:next,error:pollError}=await db.rpc('find_random_chat');if(pollError){setText('randomStatus','Falha na busca: '+pollError.message);stopRandomWatch();return;}if(next?.status==='matched')await activateRandomSession(next);},2500);
    }catch(error){setText('randomStatus','Não foi possível entrar na fila: '+error.message);start.disabled=false;start.textContent='Encontrar alguém';}
  }
  async function activateRandomSession(match){stopRandomWatch();randomSessionId=match.session_id;randomPartnerId=match.partner_id;el('findRandomButton').disabled=false;el('findRandomButton').textContent='Próxima pessoa';el('leaveRandomButton').hidden=false;el('randomMessageInput').disabled=false;el('randomMessageForm').querySelector('button').disabled=false;setText('randomStatus','Conectado com alguém · conversa anônima');await loadRandomMessages();el('randomMessageInput').focus();}
  async function leaveRandomChat(){stopRandomWatch();try{const {error}=await db.rpc('leave_random_chat',{p_session_id:randomSessionId});if(error)throw error;}catch(error){console.warn(error);}randomSessionId=null;randomPartnerId=null;el('leaveRandomButton').hidden=true;el('findRandomButton').disabled=false;el('findRandomButton').textContent='Encontrar alguém';el('randomMessageInput').disabled=true;el('randomMessageForm').querySelector('button').disabled=true;el('randomMessages').innerHTML='';setText('randomStatus','Você saiu da conversa. Encontre outra pessoa quando quiser.');}
  el('findRandomButton').addEventListener('click',()=>{if(randomSessionId)leaveRandomChat().then(findRandomPartner);else findRandomPartner();});el('leaveRandomButton').addEventListener('click',leaveRandomChat);
  el('randomMessageForm').addEventListener('submit',async event=>{event.preventDefault();if(!randomSessionId||!currentUser)return;const input=el('randomMessageInput'),body=input.value.trim();if(!body)return;input.value='';const {data,error}=await db.from('random_chat_messages').insert({session_id:randomSessionId,sender_id:currentUser.id,body}).select('id,sender_id,body,created_at').single();if(error){input.value=body;setText('randomStatus','Erro ao enviar: '+error.message);return;}appendChatMessage(el('randomMessages'),data,true);});
  let communitiesCache=null,communitiesCacheAt=0,communitiesLoadVersion=0;
  async function renderCommunities(forceRefresh=false){
    if(!requireLogin())return;
    const root=el('communityList'),version=++communitiesLoadVersion;
    root.innerHTML='<p class="field-note">Carregando comunidades...</p>';
    let groups=communitiesCache;
    if(forceRefresh||!groups||Date.now()-communitiesCacheAt>20000){
      const {data,error}=await db.rpc('get_communities_fast');
      if(version!==communitiesLoadVersion)return;
      if(error){root.textContent='Não foi possível carregar comunidades: '+error.message;return;}
      groups=data||[];communitiesCache=groups;communitiesCacheAt=Date.now();
    }
    if(version!==communitiesLoadVersion)return;
    root.innerHTML='';
    if(!groups.length){root.innerHTML='<p class="field-note">Ainda não existem comunidades. Crie a primeira.</p>';return;}
    const fragment=document.createDocumentFragment();
    for(const group of groups){
      const card=document.createElement('article');card.className='community-card';
      const title=document.createElement('h3');title.textContent=group.name;
      const category=document.createElement('small');category.textContent=(group.category||'Geral')+' · '+Number(group.member_count||0)+' participantes';
      const desc=document.createElement('p');desc.textContent=group.description||'Uma comunidade para conversar.';
      const action=document.createElement('button');action.type='button';
      action.className='button button-small '+(group.is_member?'button-primary':'button-outline');
      action.textContent=group.is_member?'Abrir comunidade':'Participar';
      action.addEventListener('click',()=>group.is_member?openCommunity(group):joinCommunity(group));
      card.append(title,category,desc,action);
      if(group.created_by===currentUser.id){const remove=document.createElement('button');remove.type='button';remove.className='button button-small button-outline community-delete-button';remove.textContent='Excluir';remove.addEventListener('click',()=>deleteCommunity(group));card.append(remove);}
      fragment.append(card);
    }
    root.replaceChildren(fragment);
  }
  async function deleteCommunity(group){
    if(!requireLogin()||group.created_by!==currentUser.id)return;
    if(!confirm('Excluir a comunidade “'+group.name+'”? Todas as mensagens, participantes e conteúdos associados também serão apagados. Esta ação não pode ser desfeita.'))return;
    const {error}=await db.from('communities').delete().eq('id',group.id).eq('created_by',currentUser.id);
    if(error){setText('communityStatus','Não foi possível excluir: '+error.message);return;}
    if(communityId===group.id){if(communityChannel)db.removeChannel(communityChannel);if(communityReadChannel)db.removeChannel(communityReadChannel);communityChannel=null;communityReadChannel=null;communityId=null;el('communityRoom').hidden=true;el('communityDirectory').hidden=false;}
    communitiesCache=null;setText('communityStatus','Comunidade excluída.');await renderCommunities(true);
  }
  async function joinCommunity(group){const {error}=await db.from('community_members').insert({community_id:group.id,user_id:currentUser.id,role:'member'});if(error&&error.code!=='23505'){setText('communityStatus','Não foi possível participar: '+error.message);return;}if(!error&&!group.is_member)group.member_count=Number(group.member_count||0)+1;group.is_member=true;communitiesCache=null;await openCommunity(group);await renderCommunities(true);}
  function renderCommunityMessages(rows){
    const root=el('communityMessages');root.innerHTML='';let previous=null;
    for(const row of rows||[]){
      const day=new Date(row.created_at).toLocaleDateString('pt-BR');if(day!==previous?.day){const divider=document.createElement('div');divider.className='chat-day-divider';divider.textContent=day===new Date().toLocaleDateString('pt-BR')?'Hoje':day;root.append(divider);}
      const mine=row.sender_id===currentUser.id;const item=document.createElement('article');item.className='community-message '+(mine?'mine':'theirs');
      if(!mine&&previous?.sender_id!==row.sender_id){const avatar=document.createElement('span');avatar.className='community-avatar';avatar.textContent=(row.sender_name||'P').trim().slice(0,1).toUpperCase();item.append(avatar);}
      const content=document.createElement('div');content.className='community-message-content';
      if(!mine&&previous?.sender_id!==row.sender_id){const name=document.createElement('strong');name.className='community-sender-name';name.textContent=row.sender_name||'Pessoa';content.append(name);}
      const body=document.createElement('p');body.textContent=row.body;const footer=document.createElement('footer');const time=document.createElement('time');time.textContent=new Date(row.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});footer.append(time);
      if(mine){const readCount=Number(row.read_count)||0,others=Math.max(0,(Number(row.member_count)||1)-1),allRead=others>0&&readCount>=others;const ticks=document.createElement('span');ticks.className='message-read-ticks'+(allRead?' is-read':'');ticks.textContent='✓✓';ticks.title=allRead?'Lida por todos ('+readCount+')':readCount+' de '+others+' participantes leram';footer.append(ticks);}
      content.append(body,footer);item.append(content);root.append(item);previous={sender_id:row.sender_id,day};
    }
    root.scrollTop=root.scrollHeight;
  }
  async function refreshCommunityMessages(markRead=false){
    if(!communityId)return;const {data,error}=await db.rpc('get_community_messages',{p_community_id:communityId});if(error){systemMessage(el('communityMessages'),'Não foi possível carregar mensagens: '+error.message);return;}
    renderCommunityMessages(data||[]);
    if(markRead){const {error:readError}=await db.rpc('mark_community_messages_read',{p_community_id:communityId});if(readError)console.warn('Leitura da comunidade não foi registrada:',readError.message);}
  }
  async function openCommunity(group){
    communityId=group.id;if(communityChannel)db.removeChannel(communityChannel);if(communityReadChannel)db.removeChannel(communityReadChannel);
    el('communityDirectory').hidden=true;el('communityRoom').hidden=false;setText('communityRoomTitle',group.name);setText('communityRoomDescription',Number(group.member_count||0)+' participantes · '+(group.description||group.category||'Comunidade Brazilly'));
    const header=el('communityRoom').querySelector('.community-room-header');header.querySelector('[data-delete-community]')?.remove();
    if(group.created_by===currentUser.id){const remove=document.createElement('button');remove.type='button';remove.className='button button-small button-outline community-delete-button';remove.dataset.deleteCommunity='true';remove.textContent='Excluir comunidade';remove.addEventListener('click',()=>deleteCommunity(group));header.append(remove);}
    await refreshCommunityMessages(true);
    communityChannel=db.channel('community-'+communityId).on('postgres_changes',{event:'INSERT',schema:'public',table:'community_messages',filter:'community_id=eq.'+communityId},()=>refreshCommunityMessages(true)).subscribe();
    communityReadChannel=db.channel('community-reads-'+communityId).on('postgres_changes',{event:'INSERT',schema:'public',table:'community_message_reads',filter:'community_id=eq.'+communityId},()=>refreshCommunityMessages(false)).subscribe();
    setText('communityStatus','Você está participando desta comunidade.');
  }
  el('openCreateCommunity').addEventListener('click',()=>{if(requireLogin())el('createCommunityForm').hidden=!el('createCommunityForm').hidden;});
  el('createCommunityForm').addEventListener('submit',async event=>{event.preventDefault();if(!requireLogin())return;const button=el('createCommunitySubmit');button.disabled=true;try{const {data,error}=await db.rpc('create_community',{p_name:el('newCommunityName').value.trim(),p_description:el('newCommunityDescription').value.trim(),p_category:el('newCommunityCategory').value});if(error)throw error;const {data:group,error:loadError}=await db.from('communities').select('id,name,description,category,created_at,created_by').eq('id',data).single();if(loadError)throw loadError;group.member_count=1;group.is_member=true;el('createCommunityForm').reset();el('createCommunityForm').hidden=true;communitiesCache=null;await renderCommunities(true);await openCommunity(group);}catch(error){setText('communityStatus','Não foi possível criar: '+error.message);}finally{button.disabled=false;}});
  el('backToCommunities').addEventListener('click',async()=>{if(communityChannel)db.removeChannel(communityChannel);if(communityReadChannel)db.removeChannel(communityReadChannel);communityChannel=null;communityReadChannel=null;communityId=null;el('communityRoom').hidden=true;el('communityDirectory').hidden=false;await renderCommunities();});
  el('communityMessageForm').addEventListener('submit',async event=>{event.preventDefault();if(!communityId||!currentUser)return;const input=el('communityMessageInput'),body=input.value.trim();if(!body)return;input.value='';const {error}=await db.from('community_messages').insert({community_id:communityId,sender_id:currentUser.id,body});if(error){input.value=body;setText('communityStatus','Erro ao enviar: '+error.message);return;}await refreshCommunityMessages(false);});
  el('refreshCommunities').addEventListener('click',()=>renderCommunities(true));
  document.querySelectorAll('[data-open="randomChatScreen"],[data-open="communitiesScreen"]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.open==='randomChatScreen'&&!currentUser){openModal('loginModal');return;}if(button.dataset.open==='communitiesScreen'){if(!currentUser){openModal('loginModal');return;}renderCommunities();}}));
  db.auth.onAuthStateChange((_event,session)=>{if(!session){leaveRandomChat();if(communityChannel)db.removeChannel(communityChannel);if(communityReadChannel)db.removeChannel(communityReadChannel);}});
  window.addEventListener('beforeunload',()=>{if(randomPoll)clearInterval(randomPoll);});
})();