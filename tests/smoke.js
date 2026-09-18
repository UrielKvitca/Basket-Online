"use strict";
const fs=require("fs");
const vm=require("vm");
const planck=require("planck");
const {Game,constants}=require("../public/js/engine.js");

function assert(value,message){if(!value)throw new Error(message);}
function approx(a,b,tolerance,message){assert(Math.abs(a-b)<=tolerance,`${message}: ${a} vs ${b}`);}
function playIntro(game){for(let i=0;i<90;i++)game.step(1/60);assert(game.phase==="play","La ronda no salió de la presentación");}
function fixedGame(seed,mod={}){
  const game=new Game({seed,mode:"local"});
  game.randomModifiers=()=>{game.mod={map:"street",ball:"normal",body:"normal",hoop:"normal",gravity:"normal",...mod};};
  game.resetRound(false);playIntro(game);return game;
}

// El bundle del navegador debe exponer el mismo motor Planck que usa Node/Render.
const context={console,Math,Date,setTimeout,clearTimeout};
context.globalThis=context;context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync("public/vendor/planck.min.js","utf8"),context,{filename:"planck.min.js"});
vm.runInContext(fs.readFileSync("public/js/engine.js","utf8"),context,{filename:"engine.js"});
assert(context.planck?.World&&context.BasketEngine?.Game,"El bundle del navegador no carga");

// La pelota cruza ambos aros hacia abajo y la arcoíris suma dos puntos.
for(const [ball,points] of [["normal",1],["rainbow",2]]){
  for(const hoopIndex of [0,1]){
    const game=fixedGame(`score-${ball}-${hoopIndex}`,{ball});
    const hoop=game.hoops[hoopIndex],x=(hoop.world.a+hoop.world.b)/2;
    game.ball.setTransform(planck.Vec2(x,hoop.world.rimY+1),0);
    game.ball.setLinearVelocity(planck.Vec2(0,-7));
    for(let i=0;i<45;i++)game.step(1/60);
    const scorer=hoopIndex===0?1:0;
    assert(game.score[scorer]===points,`Puntaje ${ball} incorrecto en aro ${hoopIndex}`);
  }
}

// Pasar por fuera del borde real del aro no debe sumar.
{
  const game=fixedGame("score-outside"),hoop=game.hoops[0],x=Math.min(hoop.world.a,hoop.world.b)-.12;
  game.lastBallPos=planck.Vec2(x,hoop.world.rimY+.25);game.ball.setTransform(planck.Vec2(x,hoop.world.rimY-.25),0);game.ball.setLinearVelocity(planck.Vec2(0,-5));game.checkScore();
  assert(game.score[0]===0&&game.score[1]===0,"Una pelota por fuera del aro contó como canasta");
  const staticKinds=new Set(game.staticBodies.map(body=>body.getUserData()));assert(staticKinds.has("board")&&staticKinds.has("post")&&staticKinds.has("rim"),"Faltan colisiones físicas del tablero, poste o aro");
}

// Los cuatro personajes agarran únicamente por proximidad física, mantienen la pelota
// mientras la tecla está apretada y la sueltan al levantarla.
for(const team of [0,1])for(const index of [0,1]){
  const game=fixedGame(`catch-${team}-${index}`);
  const player=game.players.find(p=>p.team===team&&p.index===index),hand=game.handPoint(player);
  game.setControl(team,true);game.ball.setTransform(game.handPoint(player).clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.tryCatchBall();for(let i=0;i<3&&!game.holder;i++)game.step(1/60);
  assert(game.holder?.id===player.id&&game.holdJoint,`El jugador ${team}/${index} no agarró por contacto`);
  for(let i=0;i<26;i++)game.step(1/60);
  const heldDistance=planck.Vec2.distance(game.handPoint(player),game.ball.getPosition());
  assert(heldDistance<.8,`La pelota no quedó sujeta en ${team}/${index}: ${heldDistance}`);
  game.setControl(team,false);
  assert(!game.holder&&!game.holdJoint,`El jugador ${team}/${index} no soltó al levantar la tecla`);
  const released=game.ball.getLinearVelocity();
  assert(released.length()>.35,`El lanzamiento ${team}/${index} no heredó velocidad física`);
}

// El salto tiene altura útil, pero ninguna pieza puede salir volando fuera de la cancha.
{
  const game=fixedGame("jump-height"),startY=game.snapshot().players[0].body.y;
  game.setControl(0,true);let apex=startY;
  for(let i=0;i<120;i++){if(i===28)game.setControl(0,false);game.step(1/60);apex=Math.min(apex,game.snapshot().players[0].body.y);}
  const height=startY-apex;
  assert(height>125,`El salto sigue siendo demasiado bajo: ${Math.round(height)} px`);
  assert(height<330,`El jugador salió volando: ${Math.round(height)} px`);
}

// Cambiar la altura del aro no cambia el vector de lanzamiento: no existe auto-aim.
function releaseVector(hoop){
  const game=fixedGame("no-aim",{hoop}),player=game.players[0],hand=game.handPoint(player);
  game.setControl(0,true);game.ball.setTransform(game.handPoint(player).clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.tryCatchBall();
  for(let i=0;i<22;i++)game.step(1/60);game.setControl(0,false);
  return game.ball.getLinearVelocity();
}
{
  const normal=releaseVector("normal"),high=releaseVector("high");
  approx(normal.x,high.x,.0001,"El aro está alterando el tiro horizontal");
  approx(normal.y,high.y,.0001,"El aro está alterando el tiro vertical");
}

// El cuerpo se autoendereza mediante torque físico y centro de masa bajo.
{
  const game=fixedGame("upright"),player=game.players[0];
  player.body.setAngle(1.35);player.body.setAngularVelocity(0);
  for(let i=0;i<300;i++)game.step(1/60);
  const angle=Math.abs(Math.atan2(Math.sin(player.body.getAngle()),Math.cos(player.body.getAngle())));
  assert(angle<.16,`El jugador quedó tirado en vez de pararse: ${angle.toFixed(3)} rad`);
  assert(game.isGrounded(player),"El jugador se enderezó sin recuperar apoyo en el piso");
}

// El impulso horizontal depende de la inclinación, no de la posición de la pelota.
function tiltedJump(angle){const game=fixedGame(`tilt-${angle}`),player=game.players[0];player.body.setAngle(angle);for(const part of[player.body,player.head,player.arm,...player.legs])part.setLinearVelocity(planck.Vec2(0,0));game.setControl(0,true);return player.body.getLinearVelocity().x;}
{
  const right=tiltedJump(-.45),left=tiltedJump(.45);
  assert(right>1&&left<-1,`El salto no siguió la inclinación: ${right.toFixed(2)} / ${left.toFixed(2)}`);
}

// Un rival que toca la pelota con el brazo levantado puede quitársela al poseedor.
{
  const game=fixedGame("steal"),holder=game.players[0],rival=game.players[2];
  game.controls[0]=true;game.ball.setTransform(game.handPoint(holder).clone(),0);game.tryCatchBall();
  assert(game.holder===holder,"No se pudo preparar la posesión para probar el robo");
  game.controls[1]=true;game.ballContacts.set(rival.id,1);game.ballCatchCooldown=0;game.tryCatchBall();
  assert(game.holder===rival,"El rival tocó la pelota pero no pudo robarla");
}

// Una pelota afuera muestra una reposición y vuelve desde arriba sin reiniciar el marcador.
{
  const game=fixedGame("out-return");game.score=[2,3];game.ball.setTransform(planck.Vec2(constants.W/100,20),0);game.step(1/60);
  assert(game.phase==="out","La salida no inició la animación de reposición");
  for(let i=0;i<60;i++)game.step(1/60);
  const state=game.snapshot();assert(game.phase==="play","La reposición no devolvió el juego a fase activa");assert(state.score[0]===2&&state.score[1]===3,"La reposición reinició el marcador");assert(Math.abs(state.ball.x-constants.W/2)<2,"La pelota no volvió por el centro");
}

// Todas las variantes auténticas permanecen finitas con controles mantenidos/soltados.
let variantCount=0;
for(const map of constants.MAPS)for(const ball of Object.keys(constants.BALLS))for(const body of Object.keys(constants.BODIES))for(const hoop of Object.keys(constants.HOOPS)){
  const game=fixedGame(`variant-${variantCount}`,{map,ball,body,hoop});variantCount++;
  for(let frame=0;frame<180;frame++){
    if(frame%54===0){game.setControl(0,true);game.setControl(1,true);}
    if(frame%54===24){game.setControl(0,false);game.setControl(1,false);}
    game.step(1/60);
    const state=game.snapshot();
    assert(Number.isFinite(state.ball.x+state.ball.y),`Pelota inválida en variante ${variantCount}`);
    assert(state.players.every(p=>Number.isFinite(p.body.x+p.body.y)&&p.body.y>=285&&p.body.y<=690),`Jugador fuera de cancha en variante ${variantCount}`);
    assert(state.players.every(p=>p.arms.length===1&&p.legs.length===2),"El personaje no conserva torso, brazo y dos piernas físicas");
  }
}

// HTML y JavaScript tienen que coincidir en todos los IDs usados por la app.
const html=fs.readFileSync("public/index.html","utf8"),app=fs.readFileSync("public/js/app.js","utf8");
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const used=[...app.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)].map(m=>m[1]);
const missing=[...new Set(used.filter(id=>!ids.has(id)))];
assert(!missing.length,`Faltan IDs en el HTML: ${missing.join(", ")}`);

console.log("smoke-suite: PASS",{variants:variantCount,players:4,domIds:new Set(used).size,legs:2,selfRighting:true,steals:true,outReturn:true,jump:"tilt-based",catch:"contact",aimAssist:false});
