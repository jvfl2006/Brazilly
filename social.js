/* Brazilly Social Profiles v1
 * Carregado depois de script.js. Camada de UI para amizades, favoritos,
 * bloqueios e campos sociais do perfil.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!window.supabase || typeof db === 'undefined') return;

  const addProfileFields = () => {
    const step = document.querySelector('.wizard-step[data-step="1"]');
    if (step && !$('religion')) {
      const group = document.createElement('div');
      group.className = 'field-grid social-profile-fields';
      group.innerHTML = `
        <div><label for="profession">Profissão</label><input id="profession" maxlength="80" placeholder="Ex.: Técnico em eletromecânica"></div>
        <div><label for="religion">Religião / crença</label><input id="religion" maxlength="80" placeholder="Prefiro não informar"></div>
        <div><label for="relationshipStatus">Relacionamento</label><select id="relationshipStatus"><option value="">Prefiro não informar</option><option>Solteiro(a)</option><option>Namorando</option><option>Casado(a)</option><option>Relacionamento aberto</option><option>Complicado</option><option>Prefiro não rotular</option></select></div>
      `;
      const bio = $('bio');
      if (bio) bio.parentNode.insertBefore(group, bio);
      else step.append(group);
    }

    const interestsRoot = $('interestCategories');
    if (interestsRoot && !$('customInterestInput')) {
      const custom = document.createElement('div');
      custom.className = 'custom-interest-row';
      custom.innerHTML = '<input id="customInterestInput" maxlength="50" placeholder="Outro interesse..."><button type="button" class="button button-outline" id="addCustomInterest">Adicionar</button>';
      interestsRoot.after(custom);
      $('addCustomInterest').addEventListener('click',()=>{
        const value=$('customInterestInput').value.trim();
        if(!value)return;
        selectedInterests.add(value);
        $('customInterestInput').value='';
        renderSelectedInterests();
      });
    }
    const personalityLabel = document.querySelector('label[for="personality"]');
    if (personalityLabel && !$('personalityTestLink')) {
      const link = document.createElement('a');
      link.id = 'personalityTestLink';
      link.href = 'https://www.16personalities.com/br/teste-de-personalidade';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'personality-test-link';
      link.textContent = 'Fazer o teste gratuito no 16Personalities ↗';
      personalityLabel.after(link);
    }
    const city = $('city');
    if (city) {
      city.setAttribute('list','brazilCities');
      city.setAttribute('autocomplete','off');
      if (!$('brazilCities')) {
        const list=document.createElement('datalist');list.id='brazilCities';document.body.append(list);
      }
      loadBrazilCities();
    }
  };

  let cityLoadStarted = false;
  async function loadBrazilCities() {
    if (cityLoadStarted) return;
    cityLoadStarted = true;
    try {
      const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
      if (!response.ok) throw new Error('IBGE indisponível');
      const cities = await response.json();
      const list = $('brazilCities');
      cities.forEach(city => {
        const uf = city.microrregiao?.mesorregiao?.UF?.sigla
          || city['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla;
        if (!uf || !city.nome) return;
        const option = document.createElement('option');
        option.value = city.nome + ' - ' + uf;
        list.append(option);
      });
    } catch (error) {
      console.warn('Não foi possível carregar a lista de municípios do IBGE:', error);
    }
  }

  const originalGetFormProfile = getFormProfile;
  getFormProfile = function() {
    const p = originalGetFormProfile();
    p.profession = $('profession')?.value.trim() || '';
    p.religion = $('religion')?.value.trim() || '';
    p.relationshipStatus = $('relationshipStatus')?.value || '';
    p.isPrivate = Boolean($('privateProfile')?.checked);
    return p;
  };

  const originalSync = syncProfileToSupabase;
  syncProfileToSupabase = async function(p) {
    await originalSync(p);
    const { error } = await db.from('profiles').update({
      profession: p.profession || null,
      religion: p.religion || null,
      relationship_status: p.relationshipStatus || null,
      is_private: Boolean(p.isPrivate)
    }).eq('user_id', currentUser.id);
    if (error) throw error;
    currentProfile = { ...currentProfile, ...p };
  };

  const originalFetch = fetchProfileFromServer;
  fetchProfileFromServer = async function() {
    const p = await originalFetch();
    if (!p || !currentUser) return p;
    const { data, error } = await db.from('profiles')
      .select('profession,religion,relationship_status,is_private')
      .eq('user_id', currentUser.id).maybeSingle();
    if (error) throw error;
    Object.assign(p, {
      profession: data?.profession || '',
      religion: data?.religion || '',
      relationshipStatus: data?.relationship_status || '',
      isPrivate: Boolean(data?.is_private)
    });
    return p;
  };

  const originalEdit = editProfile;
  editProfile = async function() {
    await originalEdit();
    const p = currentProfile || {};
    if ($('profession')) $('profession').value = p.profession || '';
    if ($('religion')) $('religion').value = p.religion || '';
    if ($('relationshipStatus')) $('relationshipStatus').value = p.relationshipStatus || '';
    if ($('privateProfile')) $('privateProfile').checked = Boolean(p.isPrivate);
  };

  function refreshSignupLabels() {
    if (currentUser && currentProfile) {
      if ($('signupButton')) $('signupButton').textContent = 'Meu perfil';
      if ($('heroSignupButton')) $('heroSignupButton').textContent = 'Editar meu perfil ↗';
      if ($('featureSignupButton')) $('featureSignupButton').textContent = 'Editar meu perfil →';
    } else {
      if ($('signupButton')) $('signupButton').textContent = 'Criar perfil';
      if ($('heroSignupButton')) $('heroSignupButton').textContent = 'Criar meu perfil ↗';
      if ($('featureSignupButton')) $('featureSignupButton').textContent = 'Criar meu perfil →';
    }
  }

  async function renderSocialActions() {
    const root = $('socialProfileActions');
    if (!root || !selectedPublicProfile || !currentUser) return;
    root.innerHTML = '';
    const otherId = selectedPublicProfile.user_id;
    const {data:details,error:detailsError}=await db.rpc('get_profile_details',{p_user_id:otherId});
    if(!detailsError && details?.[0]) {
      const p=details[0];
      const fields=[['Profissão',p.profession],['Religião / crença',p.religion],['Relacionamento',p.relationship_status]];
      const rootDetails=$('profileDetailContent');
      let meta=$('profileSocialMeta');
      if(!meta){meta=document.createElement('div');meta.id='profileSocialMeta';rootDetails.append(meta);}
      meta.innerHTML='';
      fields.filter(x=>x[1]).forEach(([label,value])=>{
        const line=document.createElement('p');line.className='field-note';line.textContent=label+': '+value;meta.append(line);
      });
      if(p.is_private){const line=document.createElement('p');line.className='field-note';line.textContent='Perfil privado';meta.append(line);}
    }
    if (otherId === currentUser.id) return;
    const [favorite, outgoing, incoming, blocked] = await Promise.all([
      db.from('user_favorites').select('favorite_user_id').eq('user_id',currentUser.id).eq('favorite_user_id',otherId).maybeSingle(),
      db.from('friend_requests').select('id,status').eq('requester_id',currentUser.id).eq('recipient_id',otherId).maybeSingle(),
      db.from('friend_requests').select('id,status').eq('requester_id',otherId).eq('recipient_id',currentUser.id).maybeSingle(),
      db.from('user_blocks').select('blocked_id').eq('blocker_id',currentUser.id).eq('blocked_id',otherId).maybeSingle()
    ]);
    const add = (label, action, cls='button-outline') => {
      const b=document.createElement('button');b.type='button';b.className='button '+cls;b.textContent=label;
      b.addEventListener('click',action);root.append(b);return b;
    };
    if (blocked.data) {
      add('Desbloquear', async () => {
        const {error}=await db.from('user_blocks').delete().eq('blocker_id',currentUser.id).eq('blocked_id',otherId);
        if(error) return alert(error.message);
        await renderSocialActions();
      });
    } else {
      if (incoming.data?.status === 'pending') {
        add('Aceitar amizade', async () => {
          const {error}=await db.from('friend_requests').update({status:'accepted'}).eq('id',incoming.data.id);
          if(error) return alert(error.message);
          await renderSocialActions();
        },'button-primary');
        add('Recusar', async () => {
          const {error}=await db.from('friend_requests').update({status:'rejected'}).eq('id',incoming.data.id);
          if(error) return alert(error.message);
          await renderSocialActions();
        });
      } else if (outgoing.data?.status === 'accepted' || incoming.data?.status === 'accepted') {
        add('✓ Amigos',()=>{},'button-primary');
      } else if (outgoing.data?.status === 'pending') {
        add('Solicitação enviada',()=>{});
      } else if (outgoing.data?.status === 'rejected') {
        add('Solicitação recusada',()=>{});
      } else {
        add('＋ Adicionar amigo', async () => {
          const {error}=await db.from('friend_requests').insert({requester_id:currentUser.id,recipient_id:otherId,status:'pending'});
          if(error) return alert(error.message.includes('duplicate')?'Já existe uma solicitação entre vocês.':error.message);
          await renderSocialActions();
        },'button-primary');
      }
      add(favorite.data?'★ Favoritado':'☆ Favoritar', async () => {
        const result = favorite.data
          ? await db.from('user_favorites').delete().eq('user_id',currentUser.id).eq('favorite_user_id',otherId)
          : await db.from('user_favorites').insert({user_id:currentUser.id,favorite_user_id:otherId});
        if(result.error) return alert(result.error.message);
        await renderSocialActions();
      });
      add('Bloquear', async () => {
        if(!confirm('Bloquear esta pessoa? Ela não poderá encontrar seu perfil nem conversar com você.')) return;
        const {error}=await db.rpc('block_user',{p_user_id:otherId});
        if(error) return alert(error.message);
        closeModal('profileDetailModal');
        renderProfiles();
      },'button-danger');
    }
  }

  const originalOpenDetails = openProfileDetails;
  openProfileDetails = async function(profile) {
    await originalOpenDetails(profile);
    await renderSocialActions();
  };

  async function renderIncomingRequests() {
    const root = $('incomingFriendRequests');
    if (!root) return;
    root.innerHTML = '';
    if (!currentUser) { root.textContent = 'Entre para ver solicitações.'; return; }
    const {data:requests,error} = await db.rpc('list_friend_requests');
    if (error) { root.textContent = 'Não foi possível carregar solicitações: ' + error.message; return; }
    if (!requests?.length) { root.textContent = 'Nenhuma solicitação pendente.'; return; }
    requests.forEach(request => {
      const item = document.createElement('div');
      item.className = 'incoming-request-item';
      const name = document.createElement('strong');
      name.textContent = request.display_name || 'Usuário';
      const accept = document.createElement('button');
      accept.type = 'button'; accept.className = 'button button-primary button-small'; accept.textContent = 'Aceitar';
      accept.addEventListener('click', async () => {
        accept.disabled = true;
        const {error:updateError} = await db.from('friend_requests').update({status:'accepted'}).eq('id',request.id);
        if (updateError) { alert(updateError.message); accept.disabled = false; return; }
        await renderIncomingRequests();
      });
      const reject = document.createElement('button');
      reject.type = 'button'; reject.className = 'button button-outline button-small'; reject.textContent = 'Recusar';
      reject.addEventListener('click', async () => {
        reject.disabled = true;
        const {error:updateError} = await db.from('friend_requests').update({status:'rejected'}).eq('id',request.id);
        if (updateError) { alert(updateError.message); reject.disabled = false; return; }
        await renderIncomingRequests();
      });
      item.append(name,accept,reject);
      root.append(item);
    });
  }

  const originalConversationList = renderConversationList;
  renderConversationList = async function() {
    await originalConversationList();
    await renderIncomingRequests();
  };

  // Abre o perfil diretamente pela conversa, sem precisar voltar à descoberta.
  const chatHeader = document.querySelector('.conversation-header');
  if (chatHeader && !$('openChatProfile')) {
    const b=document.createElement('button');
    b.id='openChatProfile';b.type='button';b.className='button button-small button-outline';
    b.textContent='Ver perfil';
    chatHeader.append(b);
    b.addEventListener('click',async()=>{
      if(!activeConversationId)return;
      const {data:rows,error}=await db.rpc('list_my_conversations');
      if(error)return alert(error.message);
      const row=rows?.find(x=>x.conversation_id===activeConversationId);
      if(!row)return;
      const {data,error:profileError}=await db.rpc('get_profile_details',{p_user_id:row.other_user_id});
      if(profileError)return alert(profileError.message);
      if(data?.length)await openProfileDetails(data[0]);
    });
  }

  // Evita manter o destaque de "Criar perfil" após concluir o cadastro.
  const originalPreview = renderProfilePreview;
  renderProfilePreview = async function() {
    await originalPreview();
    if (!currentProfile) return;
    const root=$('profilePreview');
    const fields=[['Profissão',currentProfile.profession],['Religião / crença',currentProfile.religion],['Relacionamento',currentProfile.relationshipStatus]];
    fields.filter(x=>x[1]).forEach(([label,value])=>{
      const line=document.createElement('p');line.className='field-note';line.textContent=label+': '+value;root.append(line);
    });
  };

  const originalSave = saveProfile;
  saveProfile = async function() {
    await originalSave();
    refreshSignupLabels();
  };

  addProfileFields();
  refreshSignupLabels();
  db.auth.onAuthStateChange(() => setTimeout(refreshSignupLabels,500));
  document.addEventListener('click', e => {
    if (e.target.closest('#profileEditButton,#editProfileButton')) setTimeout(addProfileFields,0);
  });
  setTimeout(addProfileFields,300);
})();
