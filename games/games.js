(() => {
  'use strict';
  if (!window.supabase || !db) return;

  const glyph = { wk:'♔', wq:'♕', wr:'♖', wb:'♗', wn:'♘', wp:'♙', bk:'♚', bq:'♛', br:'♜', bb:'♝', bn:'♞', bp:'♟︎' };
  let currentRoom = null;
  let roomChannel = null;
  let roomState = null;
  let chess = null;
  let selectedSquare = null;
  let legalTargets = [];
  let loading = false;

  const nav = document.querySelector('.header-nav');
  const navButton = document.createElement('button');
  navButton.type = 'button';
  navButton.className = 'nav-link';
  navButton.textContent = 'Jogos';
  navButton.addEventListener('click', openGames);
  nav?.insertBefore(navButton, document.getElementById('messagesButton'));

  const screen = document.createElement('section');
  screen.id = 'gamesScreen';
  screen.className = 'screen inner-screen';
  screen.innerHTML = `
    <div class="games-container">
      <header class="inner-header games-page-header">
        <button class="back-button" type="button" data-games-home aria-label="Voltar">←</button>
        <div><h2>Brazilly Games</h2><span class="status">Salas sociais para jogar e conversar</span></div>
        <button class="button button-small button-outline" type="button" id="gamesRefreshButton">Atualizar</button>
      </header>
      <section id="gamesDirectory">
        <div class="games-intro"><div><span class="section-kicker">JOGUE JUNTO</span><h1>Uma partida começa com uma conversa.</h1><p>Crie uma sala, convide alguém ou entre em uma mesa aberta. Quem não estiver jogando pode acompanhar e conversar.</p></div><div class="games-chess-mark">♞</div></div>
        <div class="games-directory-actions">
          <button class="button button-primary" type="button" id="gamesCreateRoomButton">＋ Criar sala de xadrez</button>
          <form id="gamesJoinCodeForm" class="games-join-code"><input id="gamesInviteCodeInput" maxlength="8" placeholder="Código de convite" aria-label="Código de convite"><button class="button button-outline" type="submit">Entrar por código</button></form>
        </div>
        <form id="gamesCreateRoomForm" class="games-create-form" hidden>
          <h3>Nova sala de xadrez</h3>
          <label for="gamesRoomNameInput">Nome da sala</label><input id="gamesRoomNameInput" maxlength="60" minlength="3" required placeholder="Ex.: Xadrez e resenha">
          <label for="gamesRoomVisibility">Visibilidade</label><select id="gamesRoomVisibility"><option value="public">Pública, qualquer pessoa pode entrar</option><option value="private">Privada, somente com código</option></select>
          <div class="games-form-actions"><button class="button button-outline" type="button" id="gamesCancelCreateButton">Cancelar</button><button class="button button-primary" type="submit" id="gamesSubmitCreateButton">Criar sala</button></div>
        </form>
        <div class="games-list-heading"><div><h3>Salas abertas</h3><p>Entre para jogar ou assistir.</p></div><span id="gamesRoomCount" class="games-count">0 salas</span></div>
        <div id="gamesRoomsList" class="games-rooms-list"><p class="field-note">Carregando salas...</p></div>
      </section>
      <section id="chessRoomView" class="chess-room-view" hidden>
        <header class="chess-room-top"><button class="back-button" type="button" id="chessBackToRooms">←</button><div class="chess-room-heading"><h2 id="chessRoomTitle">Sala de xadrez</h2><small id="chessRoomSubtitle">Carregando participantes...</small></div><button class="button button-small button-outline" type="button" id="chessCopyInvite">Copiar código</button></header>
        <div class="chess-room-layout">
          <section class="chess-play-panel">
            <div class="chess-player-bar" id="chessBlackPlayer"></div>
            <div class="chess-board-wrap"><div id="chessBoard" class="chess-board" role="group" aria-label="Tabuleiro de xadrez"></div></div>
            <div class="chess-player-bar" id="chessWhitePlayer"></div>
            <div id="chessGameStatus" class="chess-game-status" aria-live="polite">Aguardando partida.</div>
            <div class="chess-game-actions"><button class="button button-primary" type="button" id="chessStartGameButton" hidden>Iniciar partida</button><button class="button button-outline" type="button" id="chessResignButton" hidden>Abandonar partida</button></div>
            <details class="chess-move-history"><summary>Histórico de jogadas</summary><div id="chessMoveHistory" class="chess-move-list">Nenhuma jogada ainda.</div></details>
          </section>
          <aside class="chess-social-panel">
            <section class="chess-members-card"><h3>Na sala <span id="chessMemberCount">0</span></h3><div id="chessRoomMembers" class="chess-room-members"></div><p class="field-note">Espectadores podem acompanhar a partida sem ocupar uma cor.</p></section>
            <section class="chess-chat-card"><h3>Conversa da sala</h3><div id="chessRoomMessages" class="chess-room-messages" aria-live="polite"></div><form id="chessRoomMessageForm" class="chess-room-message-form"><input id="chessRoomMessageInput" maxlength="1000" placeholder="Converse com a sala..." required><button class="button button-primary" type="submit" aria-label="Enviar mensagem">➤</button></form></section>
          </aside>
        </div>
      </section>
      <p id="gamesNotice" class="games-notice" role="status"></p>
    </div>`;
  const main = document.querySelector('main');
  main?.append(screen);
  if (typeof screens !== 'undefined') screens.push(screen);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'games/games.css';
  document.head.append(css);

  const $g = (id) => document.getElementById(id);
  const notice = (message, bad = false) => { const node=$g('gamesNotice'); node.textContent=message||''; node.classList.toggle('is-error',bad); };
  const api = async (action, payload = {}) => {
    const { data, error } = await db.functions.invoke('chess-api', { body: { action, ...payload } });
    if (error) throw new Error(data?.error || error.message || 'Não foi possível concluir a operação.');
    if (data?.error) throw new Error(data.error);
    return data || {};
  };
  function requireAccount() {
    if (currentUser) return true;
    const modal=document.getElementById('loginModal');
    if(modal) modal.hidden=false;
    else alert('Entre na sua conta para acessar as salas de jogos.');
    return false;
  }
  function openGames() {
    if(!requireAccount())return;
    if(typeof showScreen==='function')showScreen('gamesScreen');
    loadRooms();
  }
  navButton.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')openGames();});
  $g('gamesRefreshButton').addEventListener('click',loadRooms);
  $g('gamesCreateRoomButton').addEventListener('click',()=>{if(requireAccount())$g('gamesCreateRoomForm').hidden=!$g('gamesCreateRoomForm').hidden;});
  $g('gamesCancelCreateButton').addEventListener('click',()=>$g('gamesCreateRoomForm').hidden=true);
  $g('gamesCreateRoomForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!requireAccount())return;
    const button=$g('gamesSubmitCreateButton');button.disabled=true;button.textContent='Criando...';
    try{const result=await api('create_room',{name:$g('gamesRoomNameInput').value.trim(),is_public:$g('gamesRoomVisibility').value==='public'});$g('gamesCreateRoomForm').reset();$g('gamesCreateRoomForm').hidden=true;await enterRoom(result.room.id);notice('Sala criada. Compartilhe o código para chamar alguém.');}
    catch(error){notice(error.message,true);}
    finally{button.disabled=false;button.textContent='Criar sala';}
  });
  $g('gamesJoinCodeForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!requireAccount())return;
    const code=$g('gamesInviteCodeInput').value.trim().toUpperCase();if(!code){notice('Digite o código da sala.',true);return;}
    try{const result=await api('join_room',{invite_code:code});$g('gamesInviteCodeInput').value='';await enterRoom(result.room.id);}
    catch(error){notice(error.message,true);}
  });
  $g('chessBackToRooms').addEventListener('click',()=>{leaveRoomView();loadRooms();});
  $g('chessCopyInvite').addEventListener('click',async()=>{
    if(!roomState?.room?.invite_code)return;
    try{await navigator.clipboard.writeText(roomState.room.invite_code);notice('Código '+roomState.room.invite_code+' copiado.');}
    catch{notice('Código da sala: '+roomState.room.invite_code);}
  });
  $g('chessStartGameButton').addEventListener('click',async()=>{
    if(!currentRoom)return;const button=$g('chessStartGameButton');button.disabled=true;
    try{await api('start_game',{room_id:currentRoom});await refreshRoom();notice('Partida iniciada. Boa partida!');}
    catch(error){notice(error.message,true);}
    finally{button.disabled=false;}
  });
  $g('chessResignButton').addEventListener('click',async()=>{
    if(!currentRoom||!confirm('Tem certeza de que deseja abandonar esta partida?'))return;
    try{await api('resign',{room_id:currentRoom});await refreshRoom();}
    catch(error){notice(error.message,true);}
  });
  $g('chessRoomMessageForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!currentRoom)return;const input=$g('chessRoomMessageInput'),body=input.value.trim();if(!body)return;
    input.disabled=true;
    try{await api('send_message',{room_id:currentRoom,body});input.value='';await refreshRoomMessages();}
    catch(error){notice(error.message,true);}
    finally{input.disabled=false;input.focus();}
  });
  document.querySelectorAll('[data-games-home]').forEach(button=>button.addEventListener('click',()=>{if(typeof showScreen==='function')showScreen('homeScreen');}));

  async function loadRooms(){
    if(!requireAccount())return;
    const root=$g('gamesRoomsList');root.innerHTML='<p class="field-note">Carregando salas...</p>';
    try{
      const {rooms=[]}=await api('list_rooms');
      $g('gamesRoomCount').textContent=rooms.length+' '+(rooms.length===1?'sala':'salas');
      root.replaceChildren();
      if(!rooms.length){root.innerHTML='<div class="games-empty"><span>♟</span><strong>Nenhuma sala aberta por enquanto.</strong><p>Crie a primeira e convide alguém para jogar.</p></div>';return;}
      for(const room of rooms){
        const card=document.createElement('article');card.className='games-room-card';
        const main=document.createElement('div');main.className='games-room-card-main';
        const icon=document.createElement('span');icon.className='games-room-icon';icon.textContent='♟';
        const copy=document.createElement('div');copy.className='games-room-copy';
        const title=document.createElement('h3');title.textContent=room.name;
        const meta=document.createElement('p');meta.textContent=(room.status==='playing'?'Partida em andamento':'Aguardando jogadores')+' · '+room.player_count+'/2 jogadores · '+room.spectator_count+' espectadores';
        copy.append(title,meta);main.append(icon,copy);
        const button=document.createElement('button');button.type='button';button.className='button button-primary';button.textContent=room.status==='playing'?'Assistir / entrar':'Entrar na sala';button.addEventListener('click',async()=>{try{await api('join_room',{room_id:room.id});await enterRoom(room.id);}catch(error){notice(error.message,true);}});
        card.append(main,button);root.append(card);
      }
    }catch(error){root.innerHTML='';const p=document.createElement('p');p.className='field-note';p.textContent='Não foi possível carregar as salas: '+error.message;root.append(p);}
  }

  async function enterRoom(roomId){
    if(!requireAccount())return;
    currentRoom=roomId;$g('gamesDirectory').hidden=true;$g('chessRoomView').hidden=false;notice('');
    if(typeof showScreen==='function')showScreen('gamesScreen');
    await refreshRoom();
    if(roomChannel)db.removeChannel(roomChannel);
    roomChannel=db.channel('chess-room-'+roomId)
      .on('postgres_changes',{event:'*',schema:'public',table:'chess_games',filter:'room_id=eq.'+roomId},()=>refreshRoom())
      .on('postgres_changes',{event:'*',schema:'public',table:'chess_room_members',filter:'room_id=eq.'+roomId},()=>refreshRoom())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chess_room_messages',filter:'room_id=eq.'+roomId},()=>refreshRoomMessages())
      .subscribe();
  }
  function leaveRoomView(){
    if(roomChannel)db.removeChannel(roomChannel);roomChannel=null;currentRoom=null;roomState=null;chess=null;selectedSquare=null;legalTargets=[];
    $g('chessRoomView').hidden=true;$g('gamesDirectory').hidden=false;notice('');
  }
  async function refreshRoom(){
    if(!currentRoom)return;
    try{
      const state=await api('get_room',{room_id:currentRoom});roomState=state;
      $g('chessRoomTitle').textContent=state.room.name;
      $g('chessRoomSubtitle').textContent=(state.room.is_public?'Sala pública':'Sala privada')+' · Código '+state.room.invite_code;
      renderMembers();renderChat(state.messages||[]);renderGame();
    }catch(error){notice(error.message,true);}
  }
  async function refreshRoomMessages(){
    if(!currentRoom)return;
    try{const state=await api('get_room',{room_id:currentRoom});if(roomState)roomState.messages=state.messages;renderChat(state.messages||[]);}
    catch(error){console.warn('Falha ao atualizar chat da sala:',error);}
  }
  function renderMembers(){
    const members=roomState?.members||[];$g('chessMemberCount').textContent=String(members.length);
    const root=$g('chessRoomMembers');root.replaceChildren();
    for(const member of members){
      const row=document.createElement('div');row.className='chess-member-row';
      const avatar=document.createElement('span');avatar.className='chess-member-avatar';avatar.textContent=(member.display_name||'J').trim().slice(0,1).toUpperCase();
      const name=document.createElement('strong');name.textContent=member.display_name||'Jogador';
      const seat=document.createElement('small');seat.textContent=member.seat==='white'?'Brancas':member.seat==='black'?'Pretas':member.role==='host'?'Anfitrião':'Espectador';
      row.append(avatar,name,seat);root.append(row);
    }
    const me=members.find(m=>m.user_id===currentUser?.id);
    $g('chessStartGameButton').hidden=!(me?.role==='host'&&members.some(m=>m.seat==='white')&&members.some(m=>m.seat==='black')&&roomState?.game?.status!=='active');
  }
  function renderChat(messages){
    const root=$g('chessRoomMessages');root.replaceChildren();
    for(const item of messages){
      const row=document.createElement('article');row.className='chess-chat-message'+(item.user_id===currentUser?.id?' mine':'');
      const name=document.createElement('strong');name.textContent=item.user_id===currentUser?.id?'Você':item.display_name||'Jogador';
      const body=document.createElement('p');body.textContent=item.body;
      const time=document.createElement('time');time.textContent=new Date(item.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      row.append(name,body,time);root.append(row);
    }
    root.scrollTop=root.scrollHeight;
  }
  function renderGame(){
    const game=roomState?.game;
    chess=game?new Chess(game.fen):null;selectedSquare=null;legalTargets=[];
    const status=$g('chessGameStatus'),resign=$g('chessResignButton');
    if(!game){status.textContent='A sala está pronta. O anfitrião pode iniciar quando houver dois jogadores.';resign.hidden=true;$g('chessMoveHistory').textContent='Nenhuma jogada ainda.';renderBoard();return;}
    const me=roomState.members.find(m=>m.user_id===currentUser?.id);
    const turn=chess.turn()==='w'?'white':'black';
    const canMove=game.status==='active'&&me?.seat===turn;
    if(game.status==='checkmate')status.textContent='Xeque-mate! '+(game.winner==='white'?'Brancas':'Pretas')+' venceram.';
    else if(game.status==='draw')status.textContent='Empate. A partida terminou.';
    else if(game.status==='resigned')status.textContent='Desistência. '+(game.winner==='white'?'Brancas':'Pretas')+' venceram.';
    else status.textContent=(turn==='white'?'Vez das brancas':'Vez das pretas')+(chess.isCheck()?' · Xeque':'')+(canMove?' · É sua vez':'');
    resign.hidden=game.status!=='active'||!['white','black'].includes(me?.seat);
    const history=chess.history();$g('chessMoveHistory').textContent=history.length?history.map((move,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+move).join('  '):'Nenhuma jogada ainda.';
    renderBoard();
  }
  function renderBoard(){
    const root=$g('chessBoard');root.replaceChildren();
    const board=chess?chess.board():Array.from({length:8},()=>Array(8).fill(null));
    const me=roomState?.members?.find(m=>m.user_id===currentUser?.id);
    const turn=chess?.turn()==='w'?'white':'black';
    const canMove=Boolean(chess&&roomState?.game?.status==='active'&&me?.seat===turn);
    for(let rank=0;rank<8;rank++)for(let file=0;file<8;file++){
      const square='abcdefgh'[file]+(8-rank),piece=board[rank][file],button=document.createElement('button');
      button.type='button';button.className='chess-square '+(((rank+file)%2===0)?'is-light':'is-dark');
      button.setAttribute('aria-label',square+(piece?' '+(piece.color==='w'?'peça branca':'peça preta'):' vazio'));
      if(selectedSquare===square)button.classList.add('is-selected');
      if(legalTargets.includes(square))button.classList.add(piece?'is-capture':'is-target');
      if(file===0){const coord=document.createElement('small');coord.className='chess-coordinate rank';coord.textContent=String(8-rank);button.append(coord);}
      if(rank===7){const coord=document.createElement('small');coord.className='chess-coordinate file';coord.textContent='abcdefgh'[file];button.append(coord);}
      if(piece){const span=document.createElement('span');span.className='chess-piece '+(piece.color==='w'?'white-piece':'black-piece');span.textContent=glyph[piece.color+piece.type];button.append(span);}
      button.addEventListener('click',()=>onSquareClick(square));root.append(button);
    }
    root.classList.toggle('is-disabled',!canMove);
  }
  async function onSquareClick(square){
    if(!chess||roomState?.game?.status!=='active')return;
    const me=roomState.members.find(m=>m.user_id===currentUser?.id),turn=chess.turn()==='w'?'white':'black';
    if(me?.seat!==turn){notice('Você está acompanhando como espectador ou aguardando sua vez.');return;}
    if(selectedSquare&&legalTargets.includes(square)){
      const candidates=chess.moves({square:selectedSquare,verbose:true}).filter(m=>m.to===square);
      let promotion='q';
      if(candidates.some(m=>m.promotion)){
        const choice=(prompt('Promover para: D (dama), T (torre), B (bispo) ou C (cavalo).','D')||'D').toLowerCase();
        promotion=({d:'q',q:'q',t:'r',r:'r',b:'b',c:'n',n:'n'})[choice]||'q';
      }
      const from=selectedSquare;selectedSquare=null;legalTargets=[];renderBoard();
      try{notice('Registrando jogada...');await api('move',{room_id:currentRoom,from,to:square,promotion});await refreshRoom();notice('');}
      catch(error){notice(error.message,true);await refreshRoom();}
      return;
    }
    const piece=chess.get(square);
    if(piece&&piece.color===chess.turn()){
      selectedSquare=square;legalTargets=chess.moves({square,verbose:true}).map(m=>m.to);renderBoard();
    }else{selectedSquare=null;legalTargets=[];renderBoard();}
  }
  loadRooms();
  window.addEventListener('beforeunload',()=>{if(roomChannel)db.removeChannel(roomChannel);});
})();