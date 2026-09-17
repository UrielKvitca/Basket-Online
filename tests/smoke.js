"use strict";
const fs=require("fs");
const vm=require("vm");
const planck=require("planck");
const {Game}=require("../public/js/engine.js");

function assert(value,message){if(!value)throw new Error(message);}
function playIntro(game){for(let i=0;i<80;i++)game.step(1/60);game.phase="play";}

// El mismo bundle que usa el navegador debe exponer Planck y el motor.
const context={console,Math,Date,setTimeout,clearTimeout};
context.globalThis=context;context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync("public/vendor/planck.min.js","utf8"),context,{filename:"planck.min.js"});
vm.runInContext(fs.readFileSync("public/js/engine.js","utf8"),context,{filename:"engine.js"});
assert(context.planck?.World&&context.BasketEngine?.Game,"El bundle del navegador no carga");

// La pelota debe poder entrar en ambos aros y la arcoiris debe sumar doble.
for(const [ball,points] of [["normal",1],["rainbow",2]]){
  for(const hoopIndex of [0,1]){
    const game=new Game({seed:`score-${ball}-${hoopIndex}`,mode:"local"});
    game.randomModifiers=()=>{game.mod={map:"street",ball,body:"normal",hoop:"normal",gravity:"normal"};};
    game.resetRound(false);playIntro(game);
    const hoop=game.hoops[hoopIndex],x=(hoop.world.a+hoop.world.b)/2;
    game.ball.setTransform(planck.Vec2(x,hoop.world.rimY+1),0);
    game.ball.setLinearVelocity(planck.Vec2(0,-7));
    for(let i=0;i<45;i++)game.step(1/60);
    const scorer=hoopIndex===0?1:0;
    assert(game.score[scorer]===points,`Puntaje ${ball} incorrecto en aro ${hoopIndex}`);
  }
}

// Un contacto desde cualquiera de los cuatro jugadores debe terminar en tiro válido.
for(const team of [0,1])for(const index of [0,1]){
  const game=new Game({seed:`shot-${team}-${index}`,mode:"local"});playIntro(game);
  const player=game.players.find(p=>p.team===team&&p.index===index);
  const hand=player.arms[0].getWorldPoint(planck.Vec2(0,-player.armLen/2));
  game.ball.setTransform(hand.clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));player.grip=.2;
  assert(game.gripBall(player,1/60),`El jugador ${team}/${index} no tomó la pelota`);
  for(let i=0;i<220&&game.phase==="play";i++)game.step(1/60);
  assert(game.score[team]>0,`El tiro del jugador ${team}/${index} no llegó al aro`);
}

// Todas las variantes deben seguir finitas y dentro de la cancha bajo entradas agresivas.
const variants=[
  {ball:"normal",body:"normal",hoop:"normal",gravity:"normal",map:"street"},
  {ball:"light",body:"longArms",hoop:"high",gravity:"float",map:"beach"},
  {ball:"heavy",body:"shortArms",hoop:"low",gravity:"fast",map:"gym"},
  {ball:"rainbow",body:"bigHead",hoop:"wide",gravity:"normal",map:"snow"},
  {ball:"tiny",body:"smallHead",hoop:"normal",gravity:"normal",map:"street"},
  {ball:"bouncy",body:"business",hoop:"high",gravity:"normal",map:"gym"}
];
for(const [i,variant] of variants.entries()){
  const game=new Game({seed:`variant-${i}`,mode:"local"});
  game.randomModifiers=()=>{game.mod={...variant};};game.resetRound(false);
  for(let frame=0;frame<2400;frame++){
    if(frame%13===0)game.input(0);if(frame%17===0)game.input(1);game.step(1/60);
    const state=game.snapshot();
    assert(Number.isFinite(state.ball.x+state.ball.y),`Pelota inválida en variante ${i}`);
    assert(state.players.every(p=>p.torso.y>=300&&p.torso.y<=700),`Jugador fuera de cancha en variante ${i}`);
  }
}

// HTML y JavaScript tienen que coincidir en todos los IDs directos usados por la app.
const html=fs.readFileSync("public/index.html","utf8"),app=fs.readFileSync("public/js/app.js","utf8");
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const used=[...app.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)].map(m=>m[1]);
const missing=[...new Set(used.filter(id=>!ids.has(id)))];
assert(!missing.length,`Faltan IDs en el HTML: ${missing.join(", ")}`);

console.log("smoke-suite: PASS",{variants:variants.length,players:4,domIds:new Set(used).size});
