"use strict";
const fs=require("fs");
const vm=require("vm");
const planck=require("planck");
const {Game,constants,extrapolateSnapshot}=require("../public/js/engine.js");

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

// Si ambos equipos abren el juego desde una IP privada, el cliente debe usar
// automáticamente ese servidor de la misma WiFi sin editar config.js.
const lanContext={console,location:{hostname:"192.168.1.20",protocol:"http:",origin:"http://192.168.1.20:3000"}};
lanContext.window=lanContext;lanContext.BASKET_CONFIG={SERVER_URL:""};vm.createContext(lanContext);
vm.runInContext(fs.readFileSync("public/js/network.js","utf8"),lanContext,{filename:"network.js"});
assert(new lanContext.BasketNetwork().getUrl()===lanContext.location.origin,"El cliente no detectó automáticamente el servidor LAN");

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

// Cada tipo de pelota conserva su comportamiento: liviana cae lento y rebota
// mucho, pesada cae rápido y casi no rebota, y la multicolor multiplica el gol.
function ballMotion(type){
  const game=fixedGame(`ball-motion-${type}`,{ball:type}),radius=game.ballCfg.radius;
  game.ball.setTransform(planck.Vec2(12,game.groundY+4),0);game.ball.setLinearVelocity(planck.Vec2(0,0));
  let fallSpeed=0,reboundSpeed=0,touched=false;
  for(let frame=0;frame<180;frame++){
    game.step(1/60);const position=game.ball.getPosition(),vy=game.ball.getLinearVelocity().y;
    if(position.y<=game.groundY+radius+.12)touched=true;
    if(touched)reboundSpeed=Math.max(reboundSpeed,vy);else fallSpeed=Math.min(fallSpeed,vy);
  }
  return{fallSpeed,reboundSpeed,mass:game.ball.getMass(),radius,points:game.ballCfg.points};
}
{
  const light=ballMotion("light"),normal=ballMotion("normal"),heavy=ballMotion("heavy"),double=ballMotion("rainbow");
  assert(light.mass<normal.mass&&normal.mass<heavy.mass,"Los pesos de las pelotas no respetan liviana/normal/pesada");
  assert(light.radius<normal.radius&&normal.radius<heavy.radius,"Los tamaños de las pelotas no respetan liviana/normal/pesada");
  assert(light.fallSpeed>normal.fallSpeed&&normal.fallSpeed>heavy.fallSpeed,"Las velocidades de caída de las pelotas son incorrectas");
  assert(light.reboundSpeed>normal.reboundSpeed*1.2&&normal.reboundSpeed>heavy.reboundSpeed*3,"Los rebotes liviano/normal/pesado son incorrectos");
  assert(double.points===2,"La pelota multiplicadora no vale dos puntos");
}

// Pasar por fuera del borde real del aro no debe sumar.
{
  const game=fixedGame("score-outside"),hoop=game.hoops[0],x=Math.min(hoop.world.a,hoop.world.b)-.12;
  game.lastBallPos=planck.Vec2(x,hoop.world.rimY+.25);game.ball.setTransform(planck.Vec2(x,hoop.world.rimY-.25),0);game.ball.setLinearVelocity(planck.Vec2(0,-5));game.checkScore();
  assert(game.score[0]===0&&game.score[1]===0,"Una pelota por fuera del aro contó como canasta");
  const staticKinds=new Set(game.staticBodies.map(body=>body.getUserData()));assert(staticKinds.has("board")&&staticKinds.has("post")&&staticKinds.has("rim"),"Faltan colisiones físicas del tablero, poste o aro");
}

// Los cuatro personajes agarran por cercanía únicamente mientras se mantiene
// el control, hacen snap a la mano y lanzan al soltar la tecla.
for(const team of [0,1])for(const index of [0,1]){
  const game=fixedGame(`catch-${team}-${index}`);
  const player=game.players.find(p=>p.team===team&&p.index===index),hand=game.handPoint(player);
  const contactPoint=planck.Vec2(hand.x+player.attackDir*.72,hand.y),before=contactPoint.clone();game.ball.setTransform(contactPoint,0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.tryCatchBall();
  assert(!game.holder&&!game.holdJoint,`El jugador ${team}/${index} agarró sin mantener la tecla`);
  game.setControl(team,true);
  assert(game.holder?.id===player.id&&game.holdJoint,`El jugador ${team}/${index} no agarró al mantener la tecla`);
  assert(planck.Vec2.distance(before,game.ball.getPosition())>.05,`El agarre ${team}/${index} no acercó la pelota al brazo`);
  assert(planck.Vec2.distance(game.handPoint(player),game.ball.getPosition())<.2,`El snap ${team}/${index} no terminó en la mano`);
  for(let i=0;i<26;i++)game.step(1/60);
  const heldDistance=planck.Vec2.distance(game.handPoint(player),game.ball.getPosition());
  assert(heldDistance<.8,`La pelota no quedó sujeta en ${team}/${index}: ${heldDistance}`);
  game.setControl(team,false);
  assert(!game.holder&&!game.holdJoint,`El jugador ${team}/${index} no soltó al levantar la tecla`);
  const released=game.ball.getLinearVelocity();
  assert(released.length()>.35,`El lanzamiento ${team}/${index} no heredó velocidad física`);
  assert(released.y>0,`El lanzamiento ${team}/${index} salió hacia el piso: ${released.y.toFixed(2)}`);
}

// El imán de agarre es generoso a corta distancia, pero no trae la pelota
// desde cualquier parte de la cancha. El snap inicial termina exactamente en la mano.
{
  const near=fixedGame("catch-generous"),player=near.players[0],hand=near.handPoint(player);
  near.ball.setTransform(planck.Vec2(hand.x+1.35,hand.y),0);near.ball.setLinearVelocity(planck.Vec2(0,0));near.setControl(0,true);
  assert(near.holder===player,"La pelota cercana no se teletransportó a la mano");
  assert(planck.Vec2.distance(near.handPoint(player),near.ball.getPosition())<.02,"El snap cercano no terminó exactamente en la mano");

  const far=fixedGame("catch-not-global"),farPlayer=far.players[0],farHand=far.handPoint(farPlayer);
  far.ball.setTransform(planck.Vec2(farHand.x+1.6,farHand.y),0);far.ball.setLinearVelocity(planck.Vec2(0,0));far.setControl(0,true);
  assert(!far.holder,"El agarre atrajo una pelota demasiado lejana");
}

// El brazo puede rescatar una pelota que quedó detrás del cuerpo. La prioridad
// sigue siendo del jugador realmente más cercano, no de un compañero lejano.
{
  const game=fixedGame("catch-behind"),player=game.players[0],body=player.body.getPosition();
  game.ball.setTransform(planck.Vec2(body.x-player.attackDir*1.05,body.y-.05),0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.setControl(0,true);
  assert(game.holder===player,"El brazo no alcanzó la pelota que quedó detrás del jugador");
  assert(planck.Vec2.distance(game.handPoint(player),game.ball.getPosition())<.02,"El rescate trasero no llevó la pelota a la mano");
}

// Si el jugador queda apoyado sobre la pelota, la tecla todavía debe permitir
// saltar y recuperar la pelota en la mano en el mismo movimiento.
{
  const game=fixedGame("ball-under-player"),player=game.players[0],radius=game.ballCfg.radius;
  game.ball.setTransform(planck.Vec2(player.body.getPosition().x,game.groundY+radius+.02),0);game.ball.setLinearVelocity(planck.Vec2(0,0));
  const feet=Math.min(...player.legs.map(leg=>leg.getWorldPoint(planck.Vec2(0,-player.legLen/2-.1)).y)),target=game.ball.getPosition().y+radius+.02,shift=target-feet;
  for(const part of[player.body,player.head,player.arm,...player.legs]){const position=part.getPosition();part.setTransform(planck.Vec2(position.x,position.y+shift),part.getAngle());part.setLinearVelocity(planck.Vec2(0,0));}
  assert(game.ballTrappedBy(player)&&game.isGrounded(player),"La pelota debajo del jugador no fue reconocida como apoyo");
  const startY=player.body.getPosition().y;game.setControl(0,true);
  assert(game.holder===player,"El jugador parado sobre la pelota no pudo recuperarla");
  for(let frame=0;frame<8;frame++)game.step(1/60);
  assert(player.body.getPosition().y>startY+.25,"El jugador parado sobre la pelota no pudo saltar");
  assert(planck.Vec2.distance(game.handPoint(player),game.ball.getPosition())<.08,"La pelota destrabada no quedó en la mano");
}

// Incluso sin pulsar, el brazo debe conservar un balanceo visible y físico.
{
  const game=fixedGame("arm-sway"),player=game.players[0],angles=[];
  for(let frame=0;frame<360;frame++){game.step(1/60);if(frame>60)angles.push(player.armJoint.getJointAngle());}
  const range=Math.max(...angles)-Math.min(...angles);
  assert(range>1,`El brazo quedó demasiado rígido: ${range.toFixed(3)} rad`);
}

// Después del agarre termina el balanceo amplio: el brazo se estabiliza y
// apunta aproximadamente al aro rival para que el tiro no salga al azar.
for(const team of[0,1]){
  const game=fixedGame(`held-arm-aim-${team}`),player=game.players.find(candidate=>candidate.team===team&&candidate.index===0),hoop=game.hoops[team===0?1:0];
  game.controls[team]=true;game.ball.setTransform(game.handPoint(player).clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.tryCatchBall();
  assert(game.holder===player,`No se pudo preparar el agarre del equipo ${team}`);
  const errors=[];for(let frame=0;frame<90;frame++){game.step(1/60);if(frame>54){const shoulder=game.shoulderPoint(player),target=game.heldAimPoint(player),desired=Math.atan2(target.x-shoulder.x,-(target.y-shoulder.y)),actual=player.arm.getAngle();errors.push(Math.abs(Math.atan2(Math.sin(desired-actual),Math.cos(desired-actual))));}}
  const shoulder=game.shoulderPoint(player),hand=game.handPoint(player),target=game.heldAimPoint(player),arm=planck.Vec2(hand.x-shoulder.x,hand.y-shoulder.y),toward=planck.Vec2(target.x-shoulder.x,target.y-shoulder.y),alignment=planck.Vec2.dot(arm,toward)/(arm.length()*toward.length());
  assert(alignment>.88,`El brazo del equipo ${team} no apuntó al aro: ${alignment.toFixed(3)}`);
  assert(Math.max(...errors)<.7,`El brazo del equipo ${team} siguió agitándose con la pelota: ${Math.max(...errors).toFixed(3)} rad`);
}

// Estar parado sobre otro jugador también cuenta como apoyo para saltar: así
// una pila de cuerpos no deja bloqueado al personaje superior.
{
  const game=fixedGame("player-under-player"),lower=game.players[0],upper=game.players[2],top=lower.head.getPosition().y+lower.headR;
  const feet=upper.legs.map(leg=>leg.getWorldPoint(planck.Vec2(0,-upper.legLen/2-.12))),averageFeet=feet.reduce((sum,point)=>sum+point.y,0)/feet.length,dx=lower.body.getPosition().x-upper.body.getPosition().x,dy=top+.08-averageFeet;
  for(const part of[upper.body,upper.head,upper.arm,...upper.legs]){const position=part.getPosition();part.setTransform(planck.Vec2(position.x+dx,position.y+dy),part.getAngle());part.setLinearVelocity(planck.Vec2(0,0));}
  assert(game.playerSupport(upper)&&game.isGrounded(upper),"El jugador inferior no fue reconocido como apoyo");
  const startY=upper.body.getPosition().y;game.setControl(1,true);
  assert(upper.body.getLinearVelocity().y>10,"El jugador superior no recibió impulso de salto");
  for(let frame=0;frame<6;frame++)game.step(1/60);
  assert(upper.body.getPosition().y>startY+.35,"El jugador superior siguió bloqueado sobre el rival");
}

// Si la pelota llega durante un salto, soltar la tecla debe lanzarla.
{
  const game=fixedGame("catch-on-held-input"),player=game.players[0];
  game.setControl(0,true);game.ball.setTransform(game.handPoint(player).clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.tryCatchBall();
  assert(game.holder===player,"No atrapó la pelota durante el salto");
  game.setControl(0,false);
  assert(!game.holder&&!game.holdJoint,"Soltar la tecla no lanzó la pelota");
}

// La extrapolación online usa velocidades lineales y angulares, pero nunca
// predice más de 50 ms para evitar saltos largos en una conexión mala.
{
  const game=fixedGame("network-extrapolation"),state=game.snapshot();
  state.ball.vx=120;state.ball.vy=-30;state.ball.omega=2;
  const future=extrapolateSnapshot(state,.2);
  approx(future.time,state.time+.05,.0001,"La extrapolación superó el límite temporal");
  approx(future.ball.x,state.ball.x+6,.0001,"La extrapolación horizontal de la pelota falló");
  approx(future.ball.y,state.ball.y-1.5,.0001,"La extrapolación vertical de la pelota falló");
}

// El salto tiene altura útil, pero ninguna pieza puede salir volando fuera de la cancha.
{
  const game=fixedGame("jump-height"),startY=game.snapshot().players[0].body.y;
  game.setControl(0,true);let apex=startY,maxAngle=0;
  for(let i=0;i<120;i++){if(i===28)game.setControl(0,false);game.step(1/60);apex=Math.min(apex,game.snapshot().players[0].body.y);maxAngle=Math.max(maxAngle,Math.abs(game.players[0].body.getAngle()));}
  const height=startY-apex;
  assert(height>125,`El salto sigue siendo demasiado bajo: ${Math.round(height)} px`);
  assert(height<330,`El jugador salió volando: ${Math.round(height)} px`);
  assert(maxAngle>.45,`El salto no tiene balanceo visible: ${maxAngle.toFixed(3)} rad`);
}

// La nieve/hielo conserva el movimiento y recorre mucho más que el piso normal.
function slideDistance(map){
  const game=fixedGame(`slide-${map}`,{map}),player=game.players[0],start=player.body.getPosition().x;
  for(const part of[player.body,player.head,player.arm,...player.legs])part.setLinearVelocity(planck.Vec2(3,0));
  for(let frame=0;frame<120;frame++)game.step(1/60);
  return Math.abs(player.body.getPosition().x-start);
}
{
  const street=slideDistance("street"),snow=slideDistance("snow");
  assert(snow>street*3,`El hielo no desliza claramente más: calle ${street.toFixed(2)} m / hielo ${snow.toFixed(2)} m`);
}

// La ayuda de tiro es parcial: respeta la física del brazo, pero orienta la
// pelota con fuerza hacia el aro rival y levanta más el tiro si el aro es alto.
function releaseVector(hoop,ball="normal",team=0){
  const game=fixedGame(`assisted-${hoop}-${ball}-${team}`,{hoop,ball}),player=game.players.find(candidate=>candidate.team===team);
  game.setControl(team,true);game.ball.setTransform(game.handPoint(player).clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.tryCatchBall();
  for(let i=0;i<22;i++)game.step(1/60);game.setControl(team,false);
  return game.ball.getLinearVelocity();
}
{
  const normal=releaseVector("normal"),high=releaseVector("high");
  assert(normal.x>7,`El tiro izquierdo no salió con fuerza hacia el aro rival: ${normal.x.toFixed(2)}`);
  assert(high.y>normal.y+.35,`El aro alto no recibió una parábola más elevada: ${normal.y.toFixed(2)} / ${high.y.toFixed(2)}`);
}
for(const ball of ["normal","light","heavy","rainbow"])for(const team of [0,1]){
  const velocity=releaseVector("normal",ball,team),toward=team===0?velocity.x:-velocity.x;
  assert(toward>7,`El tiro ${ball} del equipo ${team} no salió con fuerza hacia el aro: ${velocity.x.toFixed(2)}`);
  assert(velocity.y>5,`El tiro ${ball} del equipo ${team} no tuvo altura suficiente: ${velocity.y.toFixed(2)}`);
}

// Un lanzamiento que ya llega alto y descendiendo recibe la corrección final
// hacia el hueco en todas las combinaciones de pelota y aro.
for(const ball of ["normal","light","heavy","rainbow"])for(const hoopType of ["normal","high","low","wide"])for(const team of[0,1]){
  const game=fixedGame(`funnel-${ball}-${hoopType}-${team}`,{ball,hoop:hoopType}),hoop=game.hoops[team===0?1:0],center=(hoop.world.a+hoop.world.b)/2,dir=team===0?1:-1;
  game.shotAssistTimer=1;game.shotTeam=team;game.shotGuided=false;game.ball.setTransform(planck.Vec2(center-dir*.9,hoop.world.rimY+1),0);game.ball.setLinearVelocity(planck.Vec2(dir*8,-5));game.guideShotIntoHoop();
  assert(game.shotGuided,`La asistencia final no detectó ${ball}/${hoopType}/${team}`);
  for(let frame=0;frame<45&&game.score[team]===0;frame++)game.step(1/60);
  assert(game.score[team]===game.ballCfg.points,`La asistencia no completó el tiro ${ball}/${hoopType}/${team}`);
}

// La ayuda cercana no debe convertir un lanzamiento ascendente o hacia abajo
// en una canasta automática.
{
  const game=fixedGame("funnel-reject"),hoop=game.hoops[1],center=(hoop.world.a+hoop.world.b)/2,start=planck.Vec2(center-.8,hoop.world.rimY+1);
  game.shotAssistTimer=1;game.shotTeam=0;game.ball.setTransform(start,0);game.ball.setLinearVelocity(planck.Vec2(8,3));game.guideShotIntoHoop();
  assert(!game.shotGuided&&planck.Vec2.distance(game.ball.getPosition(),start)<.001,"La asistencia aceptó un tiro que todavía subía");
}

// La orientación real del brazo manda al soltar: arriba produce un tiro alto
// y abajo conserva un tiro descendente, sin que la ayuda al aro lo invierta.
function directionalRelease(team,angle){
  const game=fixedGame(`directional-release-${team}-${angle}`),player=game.players.find(candidate=>candidate.team===team&&candidate.index===0);
  game.controls[team]=true;game.ball.setTransform(game.handPoint(player).clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));game.tryCatchBall();
  const shoulder=player.armJoint.getAnchorA(),center=planck.Vec2(shoulder.x+Math.sin(angle)*player.armLen/2,shoulder.y-Math.cos(angle)*player.armLen/2);
  player.arm.setTransform(center,angle);player.arm.setLinearVelocity(planck.Vec2(0,0));player.arm.setAngularVelocity(0);game.ball.setTransform(game.handPoint(player).clone(),0);game.ball.setLinearVelocity(planck.Vec2(0,0));player.heldTime=.35;game.setControl(team,false);return game.ball.getLinearVelocity();
}
for(const team of[0,1]){
  const sign=team===0?1:-1,up=directionalRelease(team,sign*2.15),down=directionalRelease(team,sign*.68);
  assert(up.y>6,`El brazo hacia arriba del equipo ${team} no lanzó hacia arriba: ${up.y.toFixed(2)}`);
  assert(down.y<-3,`El brazo hacia abajo del equipo ${team} no lanzó hacia abajo: ${down.y.toFixed(2)}`);
  assert(up.x*sign>6&&down.x*sign>5,`La orientación horizontal del equipo ${team} no se respetó`);
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

// Si la pelota se pierde detrás del tablero, sale animada de la cancha y sólo
// se reinicia la ronda: el marcador del partido queda intacto.
{
  const game=fixedGame("out-return"),hoop=game.hoops[0],round=game.round;game.score=[2,3];game.ball.setTransform(planck.Vec2(hoop.world.boardX-.3,hoop.world.rimY),0);game.step(1/60);
  assert(game.phase==="out","La salida no inició la animación de reposición");
  const startX=game.ball.getPosition().x;for(let i=0;i<24;i++)game.step(1/60);
  assert(game.ball.getPosition().x<startX-.4,"La pelota perdida no se animó hacia afuera");
  for(let i=0;i<110;i++)game.step(1/60);
  const state=game.snapshot();assert(game.phase==="play","La reposición no devolvió el juego a fase activa");assert(state.score[0]===2&&state.score[1]===3,"La reposición reinició el marcador");assert(game.round===round+1,"La salida no inició una ronda nueva");assert(Math.abs(state.ball.x-constants.W/2)<2,"La pelota no volvió por el centro");
}

// Un globo muy alto no está afuera: debe seguir la parábola y volver a caer.
// La única salida válida es cruzar detrás de uno de los tableros.
{
  const game=fixedGame("high-ball-stays"),round=game?.round;
  game.ball.setTransform(planck.Vec2(constants.W/100,(constants.H+180)/50),0);game.ball.setLinearVelocity(planck.Vec2(0,2));
  for(let frame=0;frame<20;frame++)game.step(1/60);
  assert(game.phase==="play"&&!game.ballIsOut(),"Un tiro alto fue marcado incorrectamente como pelota afuera");
  assert(game.round===round,"El tiro alto reinició la ronda");
}

// Una pelota inmóvil entre los bordes del aro se libera sola hacia arriba y
// hacia adentro, sin regalar un punto ni reiniciar la ronda.
{
  const game=fixedGame("rim-unstuck"),hoop=game.hoops[0],round=game.round;game.score=[1,2];game.ball.setGravityScale(0);game.ball.setTransform(planck.Vec2((hoop.world.a+hoop.world.b)/2,hoop.world.rimY),0);game.ball.setLinearVelocity(planck.Vec2(0,0));
  for(let frame=0;frame<50;frame++)game.step(1/60);
  const velocity=game.ball.getLinearVelocity();assert(velocity.y>5&&velocity.x>1,"La pelota siguió trabada en el aro izquierdo");assert(game.round===round&&game.score[0]===1&&game.score[1]===2,"Destrabar el aro alteró la ronda o el marcador");
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
for(const code of["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowLeft","ArrowDown","ArrowRight"])assert(app.includes(code),`Falta el control alternativo ${code}`);
const reactions=fs.readdirSync("public/assets/goal-reactions").filter(name=>/^goal-\d\d\.(?:png|webp)$/.test(name));
assert(reactions.length===44,"No se incluyeron las 44 reacciones de gol");
for(const name of reactions){const file=`public/assets/goal-reactions/${name}`,data=fs.readFileSync(file),png=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=data.subarray(0,4).toString()==="RIFF"&&data.subarray(8,12).toString()==="WEBP";assert(data.length>1024&&(png||webp),`La reacción ${name} está vacía o dañada`);}
const localResources=[...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(match=>match[1].split(/[?#]/)[0]).filter(ref=>ref&&!/^(?:https?:|data:|#)/.test(ref));
for(const ref of localResources)assert(fs.existsSync(`public/${ref.replace(/^\.\//,"")}`),`Falta el recurso local ${ref}`);
assert(html.includes('id="goal-reaction"')&&app.includes("showGoalReaction()")&&app.includes("},2000)"),"La animación aleatoria de gol no está conectada durante dos segundos");
assert(app.includes("onlineInputPrediction")&&app.includes("Math.min(.016,networkRenderTime-newest.time)"),"El online no limita la extrapolación ni predice el salto local");

console.log("smoke-suite: PASS",{variants:variantCount,players:4,domIds:new Set(used).size,legs:2,selfRighting:true,armSway:"rear-reaching",iceSliding:true,ballTypes:true,ballUnstuck:true,rimUnstuck:true,playerSupportJump:true,goalReactions:reactions.length,steals:true,outReturn:"round-only",jump:"tilt-based",catch:"magnetic-hold-release",shotDirection:"arm-led-up-or-down",onlineExtrapolation:"16ms-render-cap",aimAssist:"adaptive-ballistic"});
