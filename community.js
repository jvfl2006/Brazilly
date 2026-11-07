(() => {
  'use strict';
  const el = id => document.getElementById(id);
  let randomSessionId = null, randomPartnerId = null, randomChannel = null, randomPoll = null, randomSessionWatch = null;
  let communityId = null, communityChannel = null;
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
    randomChannel=db.channel('random-chat-messages-'+randomSessionId).on('postgres_changes',{event:'INSERT',schema:'public',table:'random_chat_messages',filter:'session_id=eq.'+randomSessionId},payload=>{
      if(payload.new.sender_id!==currentUser?.id)appendChatMessage(root,payload.new,false);
    }).subscribe();
    randomSessionWatch=db.channel('random-chat-session-'+randomSessionId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'random_chat_sessions',filter:'id=eq.'+randomSessionId},payload=>{
      if(payload.new.status==='ended'){setText('randomStatus','A outra pessoa encerrou a conversa. Você pode procurar alguém novo.');stopRandomWatch();randomSessionId=null;randomPartnerId=null;el('randomMessageForm').querySelector('button').disabled=true;el('randomMessageInput').disabled=true;}
    }).subscribe();
  }
  async function findRandomPartner(){
    if(!requireLogin())return;
    if(randomSessionId)return;
    const start=el('findRandomButton');start.disabled=true;start.textContent='Procurando...';
    el('randomMessageForm').querySelector('button').disabled=true;el('randomMessageInput').disabled=true;
    el('randomMessages').innerHTML='';setText('randomStatus','Procurando alguém disponível...');
    try{
      const {data,error}=await db.rpc('find_random_chat');if(error)throw error;
      if(data?.status==='matched'){await activateRandomSession(data);return;}
      setText('randomStatus','Na fila. Assim que alguém estiver disponível, a conversa começa.');
      if(!randomPoll)randomPoll=setInterval(async()=>{
        if(!currentUser||randomSessionId){stopRandomWatch();return;}
        const {data:next,error:pollError}=await db.rpc('find_random_chat');
        if(pollError){setText('randomStatus','Falha na busca: '+pollError.message);stopRandomWatch();return;}
        if(next?.status==='matched')await activateRandomSession(next);
      },2500);
    }catch(error){setText('randomStatus','Não foi possível entrar na fila: '+error.message);start.disabled=false;start.textContent='Encontrar alguém';}
  }
  async function activateRandomSession(match){
    stopRandomWatch();randomSessionId=match.session_id;randomPartnerId=match.partner_id;
    el('findRandomButton').disabled=false;el('findRandomButton').textContent='Próxima pessoa';
    el('leaveRandomButton').hidden=false;el('randomMessageInput').disabled=false;el('randomMessageForm').querySelector('button').disabled=false;
    setText('randomStatus','Conectado com '+(match.partner_name||'alguém')+' · conversa anônima');
    await loadRandomMessages();el('randomMessageInput').focus();
  }
  async function leaveRandomChat(){
    stopRandomWatch();
    try{const {error}=await db.rpc('leave_random_chat',{p_session_id:randomSessionId});if(error)throw error;}catch(error){console.warn(error);}
    randomSessionId=null;randomPartnerId=null;el('leaveRandomButton').hidden=true;el('findRandomButton').disabled=false;el('findRandomButton').textContent='Encontrar alguém';
    el('randomMessageInput').disabled=true;el('randomMessageForm').querySelector('button').disabled=true;
    el('randomMessages').innerHTML='';setText('randomStatus','Você saiu da conversa. Encontre outra pessoa quando quiser.');
  }
  el('findRandomButton').addEventListener('click',()=>{if(randomSessionId)leaveRandomChat().then(findRandomPartner);else findRandomPartner();});
  el('leaveRandomButton').addEventListener('click',leaveRandomChat);
  el('randomMessageForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!randomSessionId||!currentUser)return;
    const input=el('randomMessageInput'),body=input.value.trim();if(!body)return;
    input.value='';
    const {data,error}=await db.from('random_chat_messages').insert({session_id:randomSessionId,sender_id:currentUser.id,body}).select('id,sender_id,body,created_at').single();
    if(error){input.value=body;setText('randomStatus','Erro ao enviar: '+error.message);return;}
    appendChatMessage(el('randomMessages'),data,true);
  });

  async function renderCommunities(){
    if(!requireLogin())return;
    const root=el('communityList');root.innerHTML='<p class="field-note">Carregando comunidades...</p>';
    const {data:groups,error}=await db.from('communities').select('id,name,description,category,created_at,created_by').order('created_at',{ascending:false}).limit(100);
    if(error){root.textContent='Não foi possível carregar comunidades: '+error.message;return;}
    const {data:members}=await db.from('community_members').select('community_id,user_id').eq('user_id',currentUser.id);
    const mine=new Set((members||[]).map(x=>x.community_id));root.innerHTML='';
    if(!groups?.length){root.innerHTML='<p class="field-note">Ainda não existem comunidades. Crie a primeira.</p>';return;}
    for(const group of groups){
      const card=document.createElement('article');card.className='community-card';
      const title=document.createElement('h3');title.textContent=group.name;
      const category=document.createElement('small');category.textContent=group.category||'Geral';
      const desc=document.createElement('p');desc.textContent=group.description||'Uma comunidade para conversar.';
      const action=document.createElement('button');action.type='button';action.className='button button-small '+(mine.has(group.id)?'button-primary':'button-outline');action.textContent=mine.has(group.id)?'Abrir comunidade':'Participar';
      action.addEventListener('click',()=>mine.has(group.id)?openCommunity(group):joinCommunity(group));
      card.append(title,category,desc,action);root.append(card);
    }
  }
  async function joinCommunity(group){
    const {error}=await db.from('community_members').insert({community_id:group.id,user_id:currentUser.id,role:'member'});
    if(error&&error.code!=='23505'){setText('communityStatus','Não foi possível participar: '+error.message);return;}
    await openCommunity(group);await renderCommunities();
  }
  async function openCommunity(group){
    communityId=group.id;if(communityChannel){db.removeChannel(communityChannel);communityChannel=null;}
    el('communityDirectory').hidden=true;el('communityRoom').hidden=false;setText('communityRoomTitle',group.name);setText('communityRoomDescription',group.description||group.category||'Comunidade Brazilly');
    const root=el('communityMessages');root.innerHTML='';
    const {data:rows,error}=await db.from('community_messages').select('id,sender_id,body,created_at').eq('community_id',communityId).order('created_at').limit(250);
    if(error){systemMessage(root,'Não foi possível abrir as mensagens: '+error.message);return;}
    for(const row of rows||[])appendChatMessage(root,row,row.sender_id===currentUser.id);
    communityChannel=db.channel('community-'+communityId).on('postgres_changes',{event:'INSERT',schema:'public',table:'community_messages',filter:'community_id=eq.'+communityId},payload=>{
      if(payload.new.sender_id!==currentUser?.id)appendChatMessage(root,payload.new,false);
    }).subscribe();
    setText('communityStatus','Você está participando desta comunidade.');
  }
  el('openCreateCommunity').addEventListener('click',()=>{if(requireLogin())el('createCommunityForm').hidden=!el('createCommunityForm').hidden;});
  el('createCommunityForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!requireLogin())return;
    const button=el('createCommunitySubmit');button.disabled=true;
    try{
      const {data,error}=await db.rpc('create_community',{p_name:el('newCommunityName').value.trim(),p_description:el('newCommunityDescription').value.trim(),p_category:el('newCommunityCategory').value});
      if(error)throw error;
      const {data:group,error:loadError}=await db.from('communities').select('id,name,description,category,created_at,created_by').eq('id',data).single();
      if(loadError)throw loadError;
      el('createCommunityForm').reset();el('createCommunityForm').hidden=true;await renderCommunities();await openCommunity(group);
    }catch(error){setText('communityStatus','Não foi possível criar: '+error.message);}
    finally{button.disabled=false;}
  });
  el('backToCommunities').addEventListener('click',async()=>{
    if(communityChannel){db.removeChannel(communityChannel);communityChannel=null;}
    communityId=null;el('communityRoom').hidden=true;el('communityDirectory').hidden=false;await renderCommunities();
  });
  el('communityMessageForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!communityId||!currentUser)return;
    const input=el('communityMessageInput'),body=input.value.trim();if(!body)return;input.value='';
    const {data,error}=await db.from('community_messages').insert({community_id:communityId,sender_id:currentUser.id,body}).select('id,sender_id,body,created_at').single();
    if(error){input.value=body;setText('communityStatus','Erro ao enviar: '+error.message);return;}
    appendChatMessage(el('communityMessages'),data,true);
  });
  el('refreshCommunities').addEventListener('click',renderCommunities);
  document.querySelectorAll('[data-open="randomChatScreen"],[data-open="communitiesScreen"]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.open==='randomChatScreen'&&!currentUser){openModal('loginModal');return;}
    if(button.dataset.open==='communitiesScreen'){if(!currentUser){openModal('loginModal');return;}renderCommunities();}
  }));
  db.auth.onAuthStateChange((_event,session)=>{if(!session){leaveRandomChat();if(communityChannel)db.removeChannel(communityChannel);} });
  window.addEventListener('beforeunload',()=>{if(randomPoll)clearInterval(randomPoll);});
})();