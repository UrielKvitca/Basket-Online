"use strict";
const path=require("path");
const http=require("http");
const express=require("express");
const {Server}=require("socket.io");
const BasketEngine=require("./public/js/engine.js");

const PORT=process.env.PORT||3000;
const origins=(process.env.CLIENT_ORIGIN||"*").split(",").map(x=>x.trim());
const app=express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname,"public"),{extensions:["html"]}));
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:origins.includes("*")?true:origins,methods:["GET","POST"]},pingInterval:8000,pingTimeout:15000,maxHttpBufferSize:1e5});

const rooms=new Map();
const privateCodes=new Map();
const TICK_MS=1000/60;
const SNAPSHOT_MS=1000/30;

function sanitizeProfile(raw={}){const skins=new Set(["rookie","sunset","neon","ice","royal","shadow","gold","retro"]);return{name:String(raw.name||"JUGADOR").replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 _-]/g,"").trim().slice(0,12).toUpperCase()||"JUGADOR",number:Math.max(0,Math.min(99,Number(raw.number)||0)),skin:skins.has(raw.skin)?raw.skin:"rookie",rank:String(raw.rank||"NOVATO").replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 _-]/g,"").slice(0,12).toUpperCase()};}
function code(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let out;do{out="";for(let i=0;i<5;i++)out+=chars[Math.floor(Math.random()*chars.length)];}while(privateCodes.has(out));return out;}
function publicId(){let out;do{out=`P${Math.random().toString(36).slice(2,7)}`.toUpperCase();}while(rooms.has(out));return out;}
function newRoom(type,roomCode=null){const id=type==="public"?publicId():`r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;const room={id,type,code:roomCode,players:[],profiles:[],game:null,tick:null,broadcast:null,started:false,closed:false,createdAt:Date.now(),snapshotSeq:0};rooms.set(id,room);if(roomCode)privateCodes.set(roomCode,id);return room;}
function roomOf(socket){return rooms.get(socket.data.roomId);}
function removeFromRoom(socket,notify=true){const room=roomOf(socket);if(!room)return;room.players=room.players.filter(id=>id!==socket.id);room.profiles=room.players.map(id=>io.sockets.sockets.get(id)?.data.profile||sanitizeProfile());socket.leave(room.id);socket.data.roomId=null;if(notify&&room.started)socket.to(room.id).emit("opponent-left");if(room.players.length===0||room.started)closeRoom(room);else broadcastPublicRooms();}
function closeRoom(room){if(!room||room.closed)return;room.closed=true;clearInterval(room.tick);clearInterval(room.broadcast);rooms.delete(room.id);if(room.code)privateCodes.delete(room.code);for(const id of room.players){const s=io.sockets.sockets.get(id);if(s){s.data.roomId=null;s.leave(room.id);}}broadcastPublicRooms();}
function joinRoom(socket,room,profile){if(!room||room.closed||room.started||room.players.length>=2)return false;removeFromRoom(socket,false);socket.data.profile=sanitizeProfile(profile);socket.data.roomId=room.id;socket.data.lastInput=0;socket.data.control=false;room.players.push(socket.id);room.profiles.push(socket.data.profile);socket.join(room.id);broadcastPublicRooms();if(room.players.length===2)startRoom(room);return true;}
function publicRoomList(){return [...rooms.values()].filter(r=>r.type==="public"&&!r.closed&&!r.started&&r.players.length===1).sort((a,b)=>a.createdAt-b.createdAt).map(r=>({id:r.id,host:r.profiles[0]?.name||"JUGADOR",rank:r.profiles[0]?.rank||"NOVATO",skin:r.profiles[0]?.skin||"rookie",createdAt:r.createdAt,players:r.players.length,maxPlayers:2}));}
function broadcastPublicRooms(){io.emit("public-rooms",{rooms:publicRoomList(),online:io.engine.clientsCount});}
function sendSnapshot(room,target=io.to(room.id)){if(room.closed||!room.game)return;const snapshot=room.game.snapshot();snapshot.net={seq:++room.snapshotSeq,serverTime:Date.now()};target.emit("snapshot",snapshot);}
function startRoom(room){if(room.started||room.players.length!==2)return;room.started=true;const a=io.sockets.sockets.get(room.players[0]),b=io.sockets.sockets.get(room.players[1]);if(!a||!b){closeRoom(room);return;}
  const seed=`${room.id}-${Date.now()}`;room.game=new BasketEngine.Game({mode:"online",seed,profiles:room.profiles,firstTo:5,onEvent:e=>{io.to(room.id).emit("game-event",e);if(e.type==="finish")setTimeout(()=>closeRoom(room),7000);}});
  room.game.freeze=2.35;room.game.phaseTimer=2.35;
  const initial=room.game.snapshot();initial.net={seq:0,serverTime:Date.now()};
  a.emit("match-found",{opponent:room.profiles[1],code:room.code||null});b.emit("match-found",{opponent:room.profiles[0],code:room.code||null});
  a.emit("match-start",{team:0,profiles:room.profiles,snapshot:initial});b.emit("match-start",{team:1,profiles:room.profiles,snapshot:initial});
  let last=process.hrtime.bigint();room.tick=setInterval(()=>{const now=process.hrtime.bigint(),dt=Math.min(.033,Number(now-last)/1e9);last=now;room.game.step(dt);},TICK_MS);
  // Un estado atrasado no sirve: volatile impide que una conexión lenta juegue varios segundos "en el pasado".
  room.broadcast=setInterval(()=>sendSnapshot(room,io.to(room.id).volatile),SNAPSHOT_MS);
  broadcastPublicRooms();
}

app.get("/health",(_req,res)=>res.json({ok:true,rooms:rooms.size,publicRooms:publicRoomList().length,uptime:Math.round(process.uptime())}));
app.get("/api/status",(_req,res)=>res.json({online:true,rooms:rooms.size,players:[...rooms.values()].reduce((n,r)=>n+r.players.length,0),publicRooms:publicRoomList()}));

io.on("connection",socket=>{
  socket.data.profile=sanitizeProfile();socket.data.roomId=null;socket.emit("status",{online:true,players:io.engine.clientsCount});socket.emit("public-rooms",{rooms:publicRoomList(),online:io.engine.clientsCount});
  socket.on("list-public-rooms",()=>socket.emit("public-rooms",{rooms:publicRoomList(),online:io.engine.clientsCount}));
  const quickMatch=profile=>{socket.data.profile=sanitizeProfile(profile);const waiting=[...rooms.values()].filter(r=>r.type==="public"&&!r.started&&!r.closed&&r.players.length===1).sort((a,b)=>a.createdAt-b.createdAt)[0];if(waiting){joinRoom(socket,waiting,socket.data.profile);}else{const room=newRoom("public");joinRoom(socket,room,socket.data.profile);socket.emit("queueing",{roomId:room.id,position:1});}};
  socket.on("quick-match",quickMatch);
  socket.on("join-public",quickMatch);
  socket.on("create-public",profile=>{removeFromRoom(socket,false);const room=newRoom("public");joinRoom(socket,room,profile);socket.emit("public-room-created",{roomId:room.id});});
  socket.on("join-public-room",payload=>{const room=rooms.get(String(payload?.roomId||"").toUpperCase());if(!room||room.type!=="public"||room.started||room.players.length>=2){socket.emit("error-message",{message:"ESA SALA YA NO ESTÁ DISPONIBLE"});broadcastPublicRooms();return;}joinRoom(socket,room,payload?.profile);});
  socket.on("create-private",profile=>{removeFromRoom(socket,false);const roomCode=code(),room=newRoom("private",roomCode);joinRoom(socket,room,profile);socket.emit("room-created",{code:roomCode});});
  socket.on("join-private",payload=>{const roomId=privateCodes.get(String(payload?.code||"").toUpperCase()),room=rooms.get(roomId);if(!room||room.started||room.players.length>=2){socket.emit("error-message",{message:"SALA INEXISTENTE O LLENA"});return;}joinRoom(socket,room,payload?.profile);});
  socket.on("input",payload=>{const room=roomOf(socket);if(!room?.started||room.closed)return;const team=room.players.indexOf(socket.id);if(team<0||team>1)return;if(payload?.action==="jump"){room.game.input(team);return;}if(payload?.action!=="control")return;const down=!!payload.down;if(socket.data.control===down)return;const now=Date.now();if(down&&now-socket.data.lastInput<18)return;socket.data.lastInput=now;socket.data.control=down;room.game.setControl(team,down);});
  socket.on("latency-ping",(sent,ack)=>{if(typeof ack==="function")ack({sent:Number(sent)||0,serverTime:Date.now()});});
  socket.on("leave-match",()=>removeFromRoom(socket,true));
  socket.on("disconnect",()=>removeFromRoom(socket,true));
});

setInterval(()=>{const now=Date.now();for(const room of rooms.values())if(!room.started&&now-room.createdAt>20*60*1000)closeRoom(room);},60000).unref();
server.listen(PORT,()=>console.log(`Basket Random Arena escuchando en http://localhost:${PORT}`));
