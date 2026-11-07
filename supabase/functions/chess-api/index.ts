import { createClient } from "npm:@supabase/supabase-js@2";
import { Chess } from "npm:chess.js@1.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: corsHeaders }); }
function cleanName(value: unknown, fallback: string) { const name=String(value??"").trim(); return (name||fallback).slice(0,60); }
function randomCode() { const bytes=crypto.getRandomValues(new Uint8Array(5)); return Array.from(bytes,b=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b%32]).join(""); }

Deno.serve(async (req: Request) => {
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return reply({error:"Método não permitido."},405);
 try{
  const authHeader=req.headers.get("Authorization")??"",token=authHeader.replace(/^Bearer\\s+/i,"");
  if(!token||token===authHeader)return reply({error:"Entre na sua conta para usar as salas de xadrez."},401);
  const url=Deno.env.get("SUPABASE_URL")??"";
  const publishableKeys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}");
  const secretKeys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}");
  const publishableKey=publishableKeys.default,secretKey=secretKeys.default;
  if(!url||!publishableKey||!secretKey)return reply({error:"Configuração do servidor incompleta."},500);
  const userClient=createClient(url,publishableKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await userClient.auth.getUser(token);
  if(authError||!authData.user)return reply({error:"Sua sessão expirou. Entre novamente."},401);
  const user=authData.user,admin=createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile}=await admin.from("profiles").select("display_name").eq("user_id",user.id).maybeSingle();
  const displayName=cleanName(profile?.display_name,user.email?.split("@")[0]??"Jogador");
  const input=await req.json(),action=String(input?.action??"");

  if(action==="list_rooms"){
   const {data:rooms,error}=await admin.from("chess_rooms").select("id,name,invite_code,is_public,status,created_at,updated_at").eq("is_public",true).neq("status","closed").order("updated_at",{ascending:false}).limit(40);if(error)throw error;
   const ids=(rooms??[]).map(r=>r.id);if(!ids.length)return reply({rooms:[]});
   const [{data:members,error:me},{data:games,error:ge}]=await Promise.all([admin.from("chess_room_members").select("room_id,seat").in("room_id",ids),admin.from("chess_games").select("id,room_id,status,ply,updated_at").in("room_id",ids).order("created_at",{ascending:false})]);if(me)throw me;if(ge)throw ge;
   const latest=new Map();for(const game of games??[])if(!latest.has(game.room_id))latest.set(game.room_id,game);
   return reply({rooms:rooms.map(room=>{const rows=(members??[]).filter(m=>m.room_id===room.id);return {...room,player_count:rows.filter(m=>m.seat!=="spectator").length,spectator_count:rows.filter(m=>m.seat==="spectator").length,game:latest.get(room.id)??null};})});
  }
  if(action==="create_room"){
   const name=String(input?.name??"").trim();if(name.length<3||name.length>60)return reply({error:"O nome da sala precisa ter entre 3 e 60 caracteres."},400);
   const {data:room,error}=await admin.from("chess_rooms").insert({name,invite_code:randomCode(),is_public:input?.is_public!==false,created_by:user.id}).select("*").single();if(error)throw error;
   const {error:memberError}=await admin.from("chess_room_members").insert({room_id:room.id,user_id:user.id,display_name:displayName,seat:"white",role:"host"});
   if(memberError){await admin.from("chess_rooms").delete().eq("id",room.id);throw memberError;}return reply({room});
  }
  if(action==="join_room"){
   const roomId=String(input?.room_id??""),inviteCode=String(input?.invite_code??"").toUpperCase();
   let roomQuery=admin.from("chess_rooms").select("*");
   roomQuery=roomId?roomQuery.eq("id",roomId):inviteCode?roomQuery.eq("invite_code",inviteCode):roomQuery.eq("id","00000000-0000-0000-0000-000000000000");
   const {data:room,error}=await roomQuery.maybeSingle();if(error)throw error;
   if(!room||room.status==="closed")return reply({error:"Esta sala não está disponível."},404);
   if(!room.is_public&&inviteCode!==room.invite_code)return reply({error:"Código de convite inválido."},403);
   const {data:existing,error:ee}=await admin.from("chess_room_members").select("*").eq("room_id",room.id).eq("user_id",user.id).maybeSingle();if(ee)throw ee;if(existing)return reply({room,member:existing});
   const {data:seats,error:se}=await admin.from("chess_room_members").select("seat").eq("room_id",room.id);if(se)throw se;
   const occupied=new Set((seats??[]).map(m=>m.seat));let seat="spectator";
   if(room.status==="open"&&!occupied.has("white"))seat="white";else if(room.status==="open"&&!occupied.has("black"))seat="black";
   const {data:member,error:me}=await admin.from("chess_room_members").insert({room_id:room.id,user_id:user.id,display_name:displayName,seat,role:"member"}).select("*").single();
   if(me){if(me.code==="23505")return reply({error:"Outra pessoa entrou ao mesmo tempo. Atualize a sala e tente novamente."},409);throw me;}
   await admin.from("chess_rooms").update({updated_at:new Date().toISOString()}).eq("id",room.id);return reply({room,member});
  }
  if(action==="get_room"){
   const roomId=String(input?.room_id??"");
   const {data:member,error:me}=await admin.from("chess_room_members").select("*").eq("room_id",roomId).eq("user_id",user.id).maybeSingle();if(me)throw me;if(!member)return reply({error:"Entre na sala antes de visualizar seu conteúdo."},403);
   const [{data:room,error:re},{data:members,error:se},{data:games,error:ge},{data:messages,error:ce}]=await Promise.all([
    admin.from("chess_rooms").select("*").eq("id",roomId).single(),admin.from("chess_room_members").select("user_id,display_name,seat,role,joined_at").eq("room_id",roomId).order("joined_at"),
    admin.from("chess_games").select("*").eq("room_id",roomId).order("created_at",{ascending:false}).limit(1),admin.from("chess_room_messages").select("id,user_id,display_name,body,created_at").eq("room_id",roomId).order("created_at",{ascending:false}).limit(80)
   ]);if(re)throw re;if(se)throw se;if(ge)throw ge;if(ce)throw ce;
   return reply({room,member,members:members??[],game:games?.[0]??null,messages:(messages??[]).reverse()});
  }
  if(action==="start_game"){
   const roomId=String(input?.room_id??"");
   const {data:member,error:me}=await admin.from("chess_room_members").select("role").eq("room_id",roomId).eq("user_id",user.id).maybeSingle();if(me)throw me;if(member?.role!=="host")return reply({error:"Somente quem criou a sala pode iniciar uma partida."},403);
   const {data:members,error:se}=await admin.from("chess_room_members").select("seat").eq("room_id",roomId);if(se)throw se;if(!(members??[]).some(m=>m.seat==="white")||!(members??[]).some(m=>m.seat==="black"))return reply({error:"São necessários dois jogadores para começar."},400);
   const {data:active,error:ae}=await admin.from("chess_games").select("id").eq("room_id",roomId).eq("status","active").maybeSingle();if(ae)throw ae;if(active)return reply({error:"Já existe uma partida em andamento nesta sala."},409);
   const {data:game,error}=await admin.from("chess_games").insert({room_id:roomId,fen:START_FEN,pgn:"",ply:0,status:"active"}).select("*").single();if(error)throw error;
   await admin.from("chess_rooms").update({status:"playing",updated_at:new Date().toISOString()}).eq("id",roomId);return reply({game});
  }
  if(action==="move"){
   const roomId=String(input?.room_id??""),from=String(input?.from??""),to=String(input?.to??""),promotion=String(input?.promotion??"q").toLowerCase();
   if(!/^[a-h][1-8]$/.test(from)||!/^[a-h][1-8]$/.test(to)||!["q","r","b","n"].includes(promotion))return reply({error:"Jogada inválida."},400);
   const [{data:member,error:me},{data:game,error:ge}]=await Promise.all([admin.from("chess_room_members").select("seat").eq("room_id",roomId).eq("user_id",user.id).maybeSingle(),admin.from("chess_games").select("*").eq("room_id",roomId).eq("status","active").maybeSingle()]);if(me)throw me;if(ge)throw ge;
   if(!member||!["white","black"].includes(member.seat))return reply({error:"Somente os dois jogadores podem movimentar as peças."},403);if(!game)return reply({error:"Não existe uma partida ativa."},404);
   const chess=new Chess(game.fen),expected=chess.turn()==="w"?"white":"black";if(member.seat!==expected)return reply({error:"Ainda não é sua vez."},409);
   let move;try{move=chess.move({from,to,promotion});}catch{return reply({error:"Essa jogada não é permitida pelas regras do xadrez."},400);}if(!move)return reply({error:"Essa jogada não é permitida pelas regras do xadrez."},400);
   const checkmate=chess.isCheckmate(),draw=!checkmate&&chess.isDraw(),status=checkmate?"checkmate":draw?"draw":"active",winner=checkmate?(chess.turn()==="w"?"black":"white"):null;
   const {data:updated,error}=await admin.from("chess_games").update({fen:chess.fen(),pgn:chess.pgn(),ply:game.ply+1,status,winner,last_move_san:move.san,updated_at:new Date().toISOString()}).eq("id",game.id).eq("ply",game.ply).eq("status","active").select("*").maybeSingle();if(error)throw error;if(!updated)return reply({error:"Outra jogada foi registrada primeiro. Atualize o tabuleiro."},409);
   if(status!=="active")await admin.from("chess_rooms").update({status:"open",updated_at:new Date().toISOString()}).eq("id",roomId);return reply({game:updated,move:{san:move.san,from,to}});
  }
  if(action==="resign"){
   const roomId=String(input?.room_id??"");
   const [{data:member,error:me},{data:game,error:ge}]=await Promise.all([admin.from("chess_room_members").select("seat").eq("room_id",roomId).eq("user_id",user.id).maybeSingle(),admin.from("chess_games").select("*").eq("room_id",roomId).eq("status","active").maybeSingle()]);if(me)throw me;if(ge)throw ge;
   if(!member||!["white","black"].includes(member.seat))return reply({error:"Somente jogadores podem abandonar a partida."},403);if(!game)return reply({error:"Não existe uma partida ativa."},404);
   const winner=member.seat==="white"?"black":"white";const {data:updated,error}=await admin.from("chess_games").update({status:"resigned",winner,updated_at:new Date().toISOString()}).eq("id",game.id).eq("ply",game.ply).eq("status","active").select("*").maybeSingle();if(error)throw error;if(!updated)return reply({error:"A partida já foi atualizada. Atualize a sala."},409);
   await admin.from("chess_rooms").update({status:"open",updated_at:new Date().toISOString()}).eq("id",roomId);return reply({game:updated});
  }
  if(action==="send_message"){
   const roomId=String(input?.room_id??""),body=String(input?.body??"").trim();if(body.length<1||body.length>1000)return reply({error:"A mensagem precisa ter entre 1 e 1.000 caracteres."},400);
   const {data:member,error:me}=await admin.from("chess_room_members").select("display_name").eq("room_id",roomId).eq("user_id",user.id).maybeSingle();if(me)throw me;if(!member)return reply({error:"Entre na sala para conversar."},403);
   const {data:message,error}=await admin.from("chess_room_messages").insert({room_id:roomId,user_id:user.id,display_name:member.display_name,body}).select("id,user_id,display_name,body,created_at").single();if(error)throw error;return reply({message});
  }
  return reply({error:"Ação desconhecida."},400);
 }catch(error){console.error("chess-api:",error);return reply({error:error instanceof Error?error.message:"Erro interno ao processar a sala."},500);}
});