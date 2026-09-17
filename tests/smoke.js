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

// Los cuatro personajes agarran únicamente por proximidad física, mantienen la pelota
// mientras la tecla está apretada y la sueltan al levantarla.
for(const team of [0,1])for(const index of [0,1]){
  const game=fixedGame(`catch-${team}-${index}`);
  const player=game.players.find(p=>p.team===team&&p.index===index),hand=game.handPoint(player);
  game.ball.setTransform(hand.clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));
  game.setControl(team,true);
  assert(game.holder?.id===player.id&&game.holdJoint,`El jugador ${team}/${index} no agarró por contacto`);
  for(let i=0;i<26;i++)game.step(1/60);
  const heldDistance=planck.Vec2.distance(game.handPoint(player),game.ball.getPosition());
  assert(heldDistance<.8,`La pelota no quedó sujeta en ${team}/${index}: ${heldDistance}`);
  game.setControl(team,false);
  assert(!game.holder&&!game.holdJoint,`El jugador ${team}/${index} no soltó al levantar la tecla`);
  const released=game.ball.getLinearVelocity();
  assert(released.length()>2.5,`El lanzamiento ${team}/${index} no heredó velocidad física`);
  assert(released.x*player.attackDir>2,`El jugador ${team}/${index} lanzó detrás de su propio cuerpo`);
  assert(released.y>8,`El jugador ${team}/${index} no generó un arco utilizable`);
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
  game.ball.setTransform(hand.clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.setControl(0,true);
  for(let i=0;i<22;i++)game.step(1/60);game.setControl(0,false);
  return game.ball.getLinearVelocity();
}
{
  const normal=releaseVector("normal"),high=releaseVector("high");
  approx(normal.x,high.x,.0001,"El aro está alterando el tiro horizontal");
  approx(normal.y,high.y,.0001,"El aro está alterando el tiro vertical");
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
    assert(state.players.every(p=>p.arms.length===1&&p.legs.length===0),"El personaje no conserva el esqueleto pixel original");
  }
}

// HTML y JavaScript tienen que coincidir en todos los IDs usados por la app.
const html=fs.readFileSync("public/index.html","utf8"),app=fs.readFileSync("public/js/app.js","utf8");
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const used=[...app.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)].map(m=>m[1]);
const missing=[...new Set(used.filter(id=>!ids.has(id)))];
assert(!missing.length,`Faltan IDs en el HTML: ${missing.join(", ")}`);

console.log("smoke-suite: PASS",{variants:variantCount,players:4,domIds:new Set(used).size,jump:"physical",catch:"hold/release",aimAssist:false});
