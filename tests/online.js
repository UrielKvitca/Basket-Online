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
function connect(transport="websocket"){const socket=io(url,{transports:[transport],upgrade:false,reconnection:false,timeout:3000});sockets.push(socket);return socket;}
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
  let down=false,inputSeqA=0,inputSeqB=0;
  const timer=setInterval(()=>{down=!down;a.emit("input",{action:"control",down,seq:++inputSeqA});setTimeout(()=>b.emit("input",{action:"control",down,seq:++inputSeqB}),70);},260);
  await new Promise(resolve=>setTimeout(resolve,5400));clearInterval(timer);
  a.emit("input",{action:"control",down:false,seq:++inputSeqA});b.emit("input",{action:"control",down:false,seq:++inputSeqB});
  await new Promise(resolve=>setTimeout(resolve,120));
  if(states.a.length<130||states.b.length<130)throw new Error(`Snapshots insuficientes para 30 Hz: ${states.a.length}/${states.b.length}`);
  const sa=states.a.at(-1),sb=states.b.at(-1),early=states.a[10];
  const sync=Math.abs(sa.ball.x-sb.ball.x)+Math.abs(sa.ball.y-sb.ball.y)+Math.abs(sa.players[0].x-sb.players[0].x);
  const motion=Math.abs(sa.ball.x-early.ball.x)+Math.abs(sa.ball.y-early.ball.y)+Math.abs(sa.players[0].x-early.players[0].x);
  if(sync>.001)throw new Error(`Desincronización: ${sync}`);
  if(motion<20)throw new Error("La partida online no avanzó");
  if(sa.players.length!==4||sa.players.some(p=>p.arms.length!==1||p.legs.length!==2))throw new Error("Personajes incorrectos en snapshot");
  if(!states.a.some(s=>s.players.some(p=>p.control)))throw new Error("El servidor no registró el control mantenido");
  if(states.a.some((s,i)=>i&&s.net.seq<=states.a[i-1].net.seq))throw new Error("La secuencia de snapshots no es creciente");
  if(sa.net?.hz!==30||sa.net?.physicsHz!==60)throw new Error("Las frecuencias de red o física son incorrectas");
  const serverIntervals=states.a.slice(1).map((s,i)=>s.net.serverTime-states.a[i].net.serverTime),averageInterval=serverIntervals.reduce((sum,value)=>sum+value,0)/serverIntervals.length;
  if(averageInterval<25||averageInterval>43)throw new Error(`Cadencia de red inestable: ${averageInterval.toFixed(1)} ms`);
  if(states.a.some((s,i)=>i&&s.time<=states.a[i-1].time))throw new Error("Hay snapshots repetidos o fuera de orden temporal");
  if((sa.net?.ack?.[0]||0)<inputSeqA-1||(sb.net?.ack?.[1]||0)<inputSeqB-1)throw new Error("Faltan confirmaciones de entradas online");
  if(!Number.isFinite(sa.players[0].body.vx+sa.players[0].body.vy+sa.players[0].body.omega))throw new Error("El snapshot no incluye velocidades para suavizado");
  const lan=await fetch(`${url}/api/lan`).then(res=>res.json());if(!Array.isArray(lan.urls))throw new Error("El servidor no publicó información LAN");

  a.close();b.close();third.close();
  const c=connect(),d=connect();await Promise.all([waitEvent(c,"connect"),waitEvent(d,"connect")]);
  const roomCreated=waitEvent(c,"public-room-created");c.emit("create-public",{name:"PUBLICO 1"});const publicRoom=await roomCreated;
  const roomsListed=waitEvent(d,"public-rooms");d.emit("list-public-rooms");const listing=await roomsListed;
  if(!listing.rooms.some(room=>room.id===publicRoom.roomId&&room.host==="PUBLICO 1"))throw new Error("La sala pública no apareció en el navegador");
  const publicC=waitEvent(c,"match-start"),publicD=waitEvent(d,"match-start");
  d.emit("join-public-room",{roomId:publicRoom.roomId,profile:{name:"PUBLICO 2"}});
  await Promise.all([publicC,publicD]);
  c.close();d.close();

  // Si WebSocket está bloqueado, el navegador cae en HTTP polling. También
  // debe conservar la cadencia, las confirmaciones y el mismo estado en ambos clientes.
  const e=connect("polling"),f=connect("polling");await Promise.all([waitEvent(e,"connect"),waitEvent(f,"connect")]);
  const pollingCreated=waitEvent(e,"room-created");e.emit("create-private",{name:"POLL A"});const pollingCode=(await pollingCreated).code;
  const pollingStartE=waitEvent(e,"match-start"),pollingStartF=waitEvent(f,"match-start");f.emit("join-private",{code:pollingCode,profile:{name:"POLL B"}});await Promise.all([pollingStartE,pollingStartF]);
  const pollingStates={e:[],f:[]};e.on("snapshot",s=>pollingStates.e.push(s));f.on("snapshot",s=>pollingStates.f.push(s));
  const ackStarted=Date.now(),pollingAck=waitEvent(e,"input-ack");e.emit("input",{action:"control",down:true,seq:1});const ackData=await pollingAck,ackDelay=Date.now()-ackStarted;
  await new Promise(resolve=>setTimeout(resolve,1650));
  e.emit("input",{action:"control",down:false,seq:2});
  if(ackData.seq!==1||ackDelay>500)throw new Error(`Confirmación lenta por polling: ${ackDelay} ms`);
  if(pollingStates.e.length<38||pollingStates.f.length<38)throw new Error(`Polling perdió demasiados snapshots: ${pollingStates.e.length}/${pollingStates.f.length}`);
  const pe=pollingStates.e.at(-1),pf=pollingStates.f.at(-1),pollingSync=Math.abs(pe.ball.x-pf.ball.x)+Math.abs(pe.ball.y-pf.ball.y)+Math.abs(pe.players[0].x-pf.players[0].x);
  if(pollingSync>.001)throw new Error(`Polling desincronizado: ${pollingSync}`);
  if(pollingStates.e.some((s,i)=>i&&s.net.seq<=pollingStates.e[i-1].net.seq))throw new Error("Polling recibió snapshots fuera de orden");
  close(0,`online-suite: PASS ${JSON.stringify({privateCode:code,snapshots:[states.a.length,states.b.length],snapshotHz:30,physicsHz:60,averageInterval:Math.round(averageInterval),syncDelta:sync,motion:Math.round(motion),inputAck:true,lanReady:true,publicBrowser:true,polling:{snapshots:[pollingStates.e.length,pollingStates.f.length],ackMs:ackDelay,syncDelta:pollingSync}})}`);
}

server.stderr.on("data",data=>process.stderr.write(data));
server.on("exit",code=>{if(!finished)close(1,`El servidor terminó antes de la prueba (${code})`);});
server.stdout.on("data",data=>{if(data.toString().includes("escuchando"))run().catch(error=>close(1,error.stack||String(error)));});
setTimeout(()=>close(1,"Timeout de la prueba online"),20000);
