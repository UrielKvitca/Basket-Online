"use strict";
const {spawn}=require("child_process");
const {io}=require("socket.io-client");

const port=3197,url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,["server.js"],{env:{...process.env,PORT:String(port)},stdio:["ignore","pipe","pipe"]});
let finished=false;
const sockets=[];

function close(code,message){
  if(finished)return;finished=true;
  for(const socket of sockets)socket.close();
  server.kill("SIGTERM");
  (code?console.error:console.log)(message);
  setTimeout(()=>process.exit(code),80);
}
function connect(){const socket=io(url,{transports:["websocket"],reconnection:false,timeout:3000});sockets.push(socket);return socket;}
function waitEvent(socket,event,timeout=4000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Timeout: ${event}`)),timeout);socket.once(event,data=>{clearTimeout(timer);resolve(data);});socket.once("connect_error",error=>{clearTimeout(timer);reject(error);});});}

async function run(){
  const a=connect(),b=connect(),third=connect();
  await Promise.all([waitEvent(a,"connect"),waitEvent(b,"connect"),waitEvent(third,"connect")]);
  const created=waitEvent(a,"room-created");a.emit("create-private",{name:"ALFA",number:10,skin:"neon"});
  const {code}=await created;
  const startA=waitEvent(a,"match-start"),startB=waitEvent(b,"match-start");
  b.emit("join-private",{code,profile:{name:"BETA",number:7,skin:"sunset"}});
  const [matchA,matchB]=await Promise.all([startA,startB]);
  if(matchA.team!==0||matchB.team!==1)throw new Error("Asignación de equipos incorrecta");
  const rejected=waitEvent(third,"error-message");third.emit("join-private",{code,profile:{name:"TERCERO"}});await rejected;

  const states={a:[],b:[]};a.on("snapshot",s=>states.a.push(s));b.on("snapshot",s=>states.b.push(s));
  let down=false;
  const timer=setInterval(()=>{down=!down;a.emit("input",{action:"control",down});setTimeout(()=>b.emit("input",{action:"control",down}),70);},260);
  await new Promise(resolve=>setTimeout(resolve,5400));clearInterval(timer);
  a.emit("input",{action:"control",down:false});b.emit("input",{action:"control",down:false});
  if(states.a.length<120||states.b.length<120)throw new Error(`Snapshots insuficientes: ${states.a.length}/${states.b.length}`);
  const sa=states.a.at(-1),sb=states.b.at(-1),early=states.a[10];
  const sync=Math.abs(sa.ball.x-sb.ball.x)+Math.abs(sa.ball.y-sb.ball.y)+Math.abs(sa.players[0].x-sb.players[0].x);
  const motion=Math.abs(sa.ball.x-early.ball.x)+Math.abs(sa.ball.y-early.ball.y)+Math.abs(sa.players[0].x-early.players[0].x);
  if(sync>.001)throw new Error(`Desincronización: ${sync}`);
  if(motion<20)throw new Error("La partida online no avanzó");
  if(sa.players.length!==4||sa.players.some(p=>p.arms.length!==1||p.legs.length!==2))throw new Error("Personajes incorrectos en snapshot");
  if(!states.a.some(s=>s.players.some(p=>p.control)))throw new Error("El servidor no registró el control mantenido");
  if(states.a.some((s,i)=>i&&s.net.seq<=states.a[i-1].net.seq))throw new Error("La secuencia de snapshots no es creciente");

  a.close();b.close();third.close();
  const c=connect(),d=connect();await Promise.all([waitEvent(c,"connect"),waitEvent(d,"connect")]);
  const roomCreated=waitEvent(c,"public-room-created");c.emit("create-public",{name:"PUBLICO 1"});const publicRoom=await roomCreated;
  const roomsListed=waitEvent(d,"public-rooms");d.emit("list-public-rooms");const listing=await roomsListed;
  if(!listing.rooms.some(room=>room.id===publicRoom.roomId&&room.host==="PUBLICO 1"))throw new Error("La sala pública no apareció en el navegador");
  const publicC=waitEvent(c,"match-start"),publicD=waitEvent(d,"match-start");
  d.emit("join-public-room",{roomId:publicRoom.roomId,profile:{name:"PUBLICO 2"}});
  await Promise.all([publicC,publicD]);
  close(0,`online-suite: PASS ${JSON.stringify({privateCode:code,snapshots:[states.a.length,states.b.length],syncDelta:sync,motion:Math.round(motion),heldInput:true,publicBrowser:true})}`);
}

server.stderr.on("data",data=>process.stderr.write(data));
server.on("exit",code=>{if(!finished)close(1,`El servidor terminó antes de la prueba (${code})`);});
server.stdout.on("data",data=>{if(data.toString().includes("escuchando"))run().catch(error=>close(1,error.stack||String(error)));});
setTimeout(()=>close(1,"Timeout de la prueba online"),15000);
