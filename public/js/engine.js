(function(root,factory){
  const physics=typeof module!=="undefined"&&module.exports?require("planck"):root.planck;
  const api=factory(physics);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.BasketEngine=api;
})(typeof window!=="undefined"?window:globalThis,function(pl){
  "use strict";
  if(!pl)throw new Error("Planck/Box2D no está cargado");

  const W=1280,H=720,GROUND=618,PPM=50,FIXED=1/60,PIXEL_SCALE=4;
  const V=(x,y)=>pl.Vec2(x,y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
  const mx=x=>x/PPM,my=y=>(H-y)/PPM,px=x=>x*PPM,py=y=>H-y*PPM;
  const MAPS=["street","gym","beach","snow"];
  const BALLS={
    normal:{name:"PELOTA CLÁSICA",sub:"PESO Y REBOTE NORMALES",radius:.42,density:1.05,bounce:.58,gravity:1,points:1,color:"#f08326"},
    light:{name:"PELOTA LIVIANA",sub:"PEQUEÑA · CAÍDA LENTA · MUCHO REBOTE",radius:.34,density:.3,bounce:.9,gravity:.68,points:1,color:"#e9f4ff"},
    heavy:{name:"PELOTA PESADA",sub:"CAÍDA RÁPIDA · CASI SIN REBOTE",radius:.46,density:4.5,bounce:.08,gravity:1.28,points:1,color:"#59616b"},
    rainbow:{name:"PELOTA DOBLE",sub:"LA CANASTA VALE 2",radius:.42,density:.95,bounce:.64,gravity:1,points:2,color:"rainbow"}
  };
  const BODIES={
    normal:{name:"JUGADORES NORMALES",sub:"CUERPO CLÁSICO",head:1,arm:1,business:false},
    longArms:{name:"BRAZOS LARGOS",sub:"MÁS ALCANCE PARA LA PELOTA",head:1,arm:1.42,business:false},
    shortArms:{name:"BRAZOS CORTOS",sub:"HAY QUE ACERCARSE",head:1,arm:.72,business:false},
    bigHead:{name:"CABEZA GIGANTE",sub:"MÁS BLOQUEO",head:1.45,arm:1,business:false},
    smallHead:{name:"CABEZA MINI",sub:"MENOS SUPERFICIE",head:.7,arm:1,business:false},
    business:{name:"MODO BUSINESS",sub:"TRAJES EN LA CANCHA",head:1,arm:1,business:true}
  };
  const HOOPS={
    normal:{name:"AROS NORMALES",sub:"ALTURA CLÁSICA",y:292,width:78},
    high:{name:"AROS ALTOS",sub:"SALTÁ MÁS ALTO",y:238,width:78},
    low:{name:"AROS BAJOS",sub:"MÁS CERCA DEL SUELO",y:350,width:78},
    wide:{name:"AROS ANCHOS",sub:"MÁS ESPACIO PARA ENTRAR",y:292,width:98}
  };
  const GRAVITIES={normal:{name:"GRAVEDAD NORMAL",sub:"CONTROL CLÁSICO",value:-18}};
  const SKINS={
    rookie:{shirt:"#1586d6",shorts:"#e8f5ff",skin:"#d69662",hair:"#251710",accent:"#ffffff"},
    sunset:{shirt:"#ef4638",shorts:"#242026",skin:"#ad7048",hair:"#17110f",accent:"#ffd032"},
    neon:{shirt:"#3acb53",shorts:"#173a26",skin:"#dba574",hair:"#70401b",accent:"#ffffff"},
    ice:{shirt:"#dff8ff",shorts:"#5cc7ea",skin:"#efbd8c",hair:"#eef8ff",accent:"#164b79"},
    royal:{shirt:"#7642de",shorts:"#f2c72b",skin:"#79503a",hair:"#101216",accent:"#ffffff"},
    shadow:{shirt:"#252a34",shorts:"#090c11",skin:"#895f48",hair:"#050608",accent:"#ef3657"},
    gold:{shirt:"#ffc426",shorts:"#fff0a8",skin:"#c98959",hair:"#5a2d12",accent:"#704300"},
    retro:{shirt:"#16bcae",shorts:"#e84964",skin:"#e3aa76",hair:"#3c1d18",accent:"#ffffff"}
  };

  function hashSeed(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function pick(rng,obj){const keys=Array.isArray(obj)?obj:Object.keys(obj);return keys[Math.floor(rng()*keys.length)];}

  class Game{
    constructor(opts={}){
      this.firstTo=opts.firstTo||5;this.seed=opts.seed||Date.now();this.rng=mulberry32(hashSeed(this.seed));this.mode=opts.mode||"cpu";this.difficulty=opts.difficulty??.55;this.onEvent=opts.onEvent||(()=>{});this.profiles=opts.profiles||[{name:"JUGADOR",number:1,skin:"rookie"},{name:"RIVAL",number:2,skin:"sunset"}];
      this.time=0;this.accumulator=0;this.round=0;this.score=[0,0];this.winner=null;this.finished=false;this.freeze=.8;this.phase="intro";this.phaseTimer=.8;this.controls=[false,false];this.autoRelease=[0,0];this.aiClock=.4;this.aiHold=0;this.mod={map:"street",ball:"normal",body:"normal",hoop:"normal",gravity:"normal"};this.resetRound(true);
    }
    randomModifiers(first){if(first){this.mod={map:"street",ball:"normal",body:"normal",hoop:"normal",gravity:"normal"};return;}this.mod={map:pick(this.rng,MAPS),ball:pick(this.rng,BALLS),body:pick(this.rng,BODIES),hoop:pick(this.rng,HOOPS),gravity:"normal"};}
    resetRound(first=false){
      this.randomModifiers(first);this.world=new pl.World(V(0,GRAVITIES.normal.value));this.players=[];this.staticBodies=[];this.holder=null;this.holdJoint=null;this.ballCatchCooldown=0;this.controls=[false,false];this.autoRelease=[0,0];this.buildArena();
      this.players.push(this.makePlayer(0,0,320),this.makePlayer(0,1,490),this.makePlayer(1,0,960),this.makePlayer(1,1,790));this.makeBall();this.round++;this.phase="intro";this.phaseTimer=first ? .9 : 1.08;this.freeze=this.phaseTimer;
      this.onEvent({type:"round",mod:this.mod,details:this.modDetails(),round:this.round});
    }
    fixture(body,shape,opts={}){const type=body.getType(),data=body.getUserData()||{},category=opts.category??(type==="static"?1:data.type==="ball"?4:2),mask=opts.mask??(category===4?3:7);return body.createFixture(shape,{density:opts.density??1,friction:opts.friction??.45,restitution:opts.restitution??.05,filterGroupIndex:opts.group||0,filterCategoryBits:category,filterMaskBits:mask,isSensor:!!opts.sensor});}
    staticBox(x,y,hx,hy,opts={}){const b=this.world.createBody({type:"static",position:V(x,y),userData:opts.userData});this.fixture(b,pl.Box(hx,hy),{friction:opts.friction??.75,restitution:opts.restitution??.08});this.staticBodies.push(b);return b;}
    buildArena(){
      const snow=this.mod.map==="snow";this.groundY=my(GROUND);this.staticBox(mx(W/2),this.groundY-.28,mx(W/2),.28,{friction:snow ? .035 : .82,userData:"ground"});this.staticBox(.12,my(H/2),.12,my(0),{restitution:.35,userData:"wall"});this.staticBox(mx(W)-.12,my(H/2),.12,my(0),{restitution:.35,userData:"wall"});
      const h=HOOPS[this.mod.hoop];this.hoops=[{team:0,x:140,y:h.y,width:h.width,dir:1},{team:1,x:W-140,y:h.y,width:h.width,dir:-1}];
      for(const hoop of this.hoops){const boardX=mx(hoop.team===0?hoop.x-24:hoop.x+24),rimY=my(hoop.y);this.staticBox(boardX,rimY+mx(43),.07,mx(58),{restitution:.38,userData:"board"});const a=mx(hoop.x+hoop.dir*5),b=mx(hoop.x+hoop.dir*hoop.width);for(const x of[a,b]){const rim=this.world.createBody({type:"static",position:V(x,rimY),userData:"rim"});this.fixture(rim,pl.Circle(.075),{friction:.22,restitution:.48});this.staticBodies.push(rim);}hoop.world={rimY,a,b};}
    }
    makePlayer(team,index,xPx){
      const cfg=BODIES[this.mod.body],profile=this.profiles[team]||{},id=team*2+index,group=-(id+1),attackDir=team===0?1:-1,x=mx(xPx),base=this.groundY,bodyW=.72,bodyH=1.62,headR=.46*cfg.head,armLen=1.34*cfg.arm,restAngle=attackDir*.42;
      const body=this.world.createBody({type:"dynamic",position:V(x,base+bodyH/2+.05),angle:attackDir*(index ? .035 : -.035),linearDamping:.22,angularDamping:1.35,allowSleep:false,userData:{type:"body",team,id}});this.fixture(body,pl.Box(bodyW/2,bodyH/2),{density:1.25,friction:this.mod.map==="snow" ? .08 : .82,restitution:.015,group});this.fixture(body,pl.Box(.43,.12,V(attackDir*.12,-bodyH/2),0),{density:.25,friction:this.mod.map==="snow" ? .06 : 1.4,restitution:0,group});
      const head=this.world.createBody({type:"dynamic",position:V(x,base+bodyH+headR*.76),linearDamping:.16,angularDamping:1.25,allowSleep:false,userData:{type:"head",team,id}});this.fixture(head,pl.Circle(headR),{density:.68,friction:.38,restitution:.06,group});const neck=V(x,base+bodyH-.05);this.world.createJoint(pl.RevoluteJoint({enableLimit:true,lowerAngle:-.42,upperAngle:.42,enableMotor:true,motorSpeed:0,maxMotorTorque:7},body,head,neck));
      const shoulder=V(x+attackDir*bodyW*.28,base+bodyH*.83),center=V(shoulder.x+Math.sin(restAngle)*armLen/2,shoulder.y-Math.cos(restAngle)*armLen/2);const arm=this.world.createBody({type:"dynamic",position:center,angle:restAngle,linearDamping:.12,angularDamping:.45,allowSleep:false,userData:{type:"arm",team,id}});this.fixture(arm,pl.Box(.12,armLen/2),{density:.28,friction:.5,restitution:.03,group});this.fixture(arm,pl.Circle(.2,V(0,-armLen/2)),{density:.14,friction:1.2,restitution:.02,group});const armJoint=this.world.createJoint(pl.RevoluteJoint({enableLimit:true,lowerAngle:-2.5,upperAngle:2.5,enableMotor:true,motorSpeed:0,maxMotorTorque:32},body,arm,shoulder));
      return{id,team,index,group,attackDir,body,torso:body,head,arm,arms:[arm],armJoint,armLen,bodyW,bodyH,headR,skin:profile.skin||"rookie",number:profile.number??team+1,jumpBoost:0,heldTime:0};
    }
    makeBall(){const cfg=BALLS[this.mod.ball];this.ball=this.world.createBody({type:"dynamic",position:V(mx(W/2),my(155)),bullet:true,linearDamping:.02,angularDamping:.035,allowSleep:false,userData:{type:"ball"}});this.ballFixture=this.fixture(this.ball,pl.Circle(cfg.radius),{density:cfg.density,friction:.38,restitution:cfg.bounce});this.ball.setGravityScale(cfg.gravity);this.ball.setAngularVelocity((this.rng()-.5)*3);this.ballCfg=cfg;this.lastBallPos=this.ball.getPosition().clone();this.ballIdle=0;}
    modDetails(){const choices=[BALLS[this.mod.ball],BODIES[this.mod.body],HOOPS[this.mod.hoop]],special=choices.filter(v=>!/NORMAL|CLÁSICA|CLÁSICO/.test(v.name)),chosen=special.length?special[special.length-1]:choices[0];return{name:chosen.name,sub:chosen.sub,map:this.mod.map.toUpperCase()};}
    isGrounded(player){const bottom=player.body.getWorldPoint(V(0,-player.bodyH/2-.13));return bottom.y<this.groundY+.2&&Math.abs(player.body.getLinearVelocity().y)<3.2;}
    armTarget(player){return this.controls[player.team]?player.attackDir*2.18:0;}
    updateArm(player){const target=this.armTarget(player),angle=player.armJoint.getJointAngle(),error=target-angle;player.armJoint.setMotorSpeed(clamp(error*11,-18,18));player.armJoint.setMaxMotorTorque(this.controls[player.team]?44:22);}
    setControl(team,down){
      down=!!down;if(team<0||team>1||this.finished||this.phase!=="play"||this.controls[team]===down)return;this.controls[team]=down;
      if(down){for(const player of this.players.filter(p=>p.team===team)){player.heldTime=0;const body=player.body,vel=body.getLinearVelocity();if(this.isGrounded(player)){const ballSide=Math.sign(this.ball.getPosition().x-body.getPosition().x)||player.attackDir,move=ballSide*(this.rng()<.82?1:-1),vx=clamp(vel.x+move*(2.65+this.rng()*.9),-7.2,7.2),vy=11.2+this.rng()*.75;for(const part of[player.body,player.head,player.arm]){const v=part.getLinearVelocity();part.setLinearVelocity(V(vx,Math.max(v.y,vy)));}body.setAngularVelocity(clamp(body.getAngularVelocity()+move*(this.rng()-.42)*2.4,-5,5));player.jumpBoost=.15;}}this.tryCatchBall();this.onEvent({type:"jump",team});}
      else if(this.holder?.team===team)this.releaseBall();
    }
    input(team){this.setControl(team,true);this.autoRelease[team]=.2+this.rng()*.12;}
    handPoint(player){return player.arm.getWorldPoint(V(0,-player.armLen/2));}
    shoulderPoint(player){return player.arm.getWorldPoint(V(0,player.armLen/2));}
    tryCatchBall(){
      if(this.holder||this.ballCatchCooldown>0)return;const ballPos=this.ball.getPosition();let best=null,bestDistance=99;
      for(const player of this.players){if(!this.controls[player.team])continue;const hand=this.handPoint(player),shoulder=this.shoulderPoint(player),handDistance=pl.Vec2.distance(hand,ballPos),dx=hand.x-shoulder.x,dy=hand.y-shoulder.y,length2=dx*dx+dy*dy,t=length2?clamp(((ballPos.x-shoulder.x)*dx+(ballPos.y-shoulder.y)*dy)/length2,0,1):0,closest=V(shoulder.x+dx*t,shoulder.y+dy*t),armDistance=pl.Vec2.distance(closest,ballPos),touchingHand=handDistance<this.ballCfg.radius+1.8,touchingForearm=t>.3&&armDistance<this.ballCfg.radius+.45,distance=Math.min(handDistance,armDistance+.12);if((touchingHand||touchingForearm)&&distance<bestDistance){best=player;bestDistance=distance;}}
      if(!best)return;const hand=this.handPoint(best),offset=V(best.attackDir*this.ballCfg.radius*.45,.04);this.ball.setTransform(V(hand.x+offset.x,hand.y+offset.y),this.ball.getAngle());this.ball.setLinearVelocity(best.arm.getLinearVelocityFromWorldPoint(hand));this.ballFixture.setFilterGroupIndex(best.group);this.holdJoint=this.world.createJoint(pl.WeldJoint({collideConnected:false},best.arm,this.ball,hand));this.holder=best;best.heldTime=0;this.onEvent({type:"catch",team:best.team,player:best.id});
    }
    releaseBall(){
      const player=this.holder;if(!player)return;const hand=this.handPoint(player),shoulder=this.shoulderPoint(player),rawDirection=V(hand.x-shoulder.x,hand.y-shoulder.y);if(rawDirection.lengthSquared()<.01)rawDirection.set(player.attackDir,.65);rawDirection.normalize();const direction=V(player.attackDir*Math.max(.45,Math.abs(rawDirection.x)),Math.max(.35,rawDirection.y));direction.normalize();const handVelocity=player.arm.getLinearVelocityFromWorldPoint(hand),inheritedX=Math.sign(handVelocity.x)===player.attackDir?handVelocity.x:handVelocity.x*.25,charge=clamp(player.heldTime,0,.85),strength=(5.6+charge*5.3)*(.86+this.rng()*.34),forward=2.6+this.rng()*2.4,lift=6.2+this.rng()*3.1;
      const minimumArc=(12.5+charge*3)*Math.sqrt(this.ballCfg.gravity),launchX=clamp(inheritedX+direction.x*strength+player.attackDir*forward,-12.5,12.5),launchY=clamp(Math.max(minimumArc,Math.max(-2,handVelocity.y)+direction.y*strength+lift),-14,19);this.world.destroyJoint(this.holdJoint);this.holdJoint=null;this.holder=null;this.ballFixture.setFilterGroupIndex(0);this.ball.setLinearVelocity(V(launchX,launchY));this.ball.setAngularVelocity(clamp(this.ball.getAngularVelocity()+player.attackDir*(4+charge*4),-14,14));this.ballCatchCooldown=.24;this.onEvent({type:"release",team:player.team,charge});
    }
    aiStep(dt){
      if(this.mode!=="cpu"&&this.mode!=="tournament")return;this.aiClock-=dt;if(this.controls[1]){this.aiHold-=dt;const hasBall=this.holder?.team===1;if((hasBall&&this.holder.heldTime>.2+(.95-this.difficulty)*.32)||this.aiHold<=0){this.setControl(1,false);this.aiClock=.12+this.rng()*(.38-this.difficulty*.18);}return;}if(this.aiClock>0)return;
      const ball=this.ball.getPosition(),nearest=Math.min(...this.players.filter(p=>p.team===1).map(p=>pl.Vec2.distance(this.handPoint(p),ball))),danger=ball.x>mx(W*.53),chance=.18+this.difficulty*.42+(nearest<3 ? .3 : 0)+(danger ? .14 : 0);if(this.rng()<chance){this.setControl(1,true);this.aiHold=.18+this.rng()*(.5-this.difficulty*.2);}else this.aiClock=.12+this.rng()*.32;
    }
    updateControls(dt){
      for(let team=0;team<2;team++)if(this.autoRelease[team]>0){this.autoRelease[team]-=dt;if(this.autoRelease[team]<=0)this.setControl(team,false);}
      for(const player of this.players){this.updateArm(player);if(this.controls[player.team]){player.heldTime+=dt;if(player.jumpBoost>0){player.jumpBoost-=dt;const v=player.body.getLinearVelocity();player.body.setLinearVelocity(V(v.x,Math.min(13.1,v.y+.085)));}}else player.jumpBoost=0;}
    }
    stabilize(){
      const bodies=[this.ball,...this.players.flatMap(p=>[p.body,p.head,p.arm])];for(const body of bodies){const v=body.getLinearVelocity(),p=body.getPosition(),isBall=body===this.ball;if(!Number.isFinite(p.x+p.y+v.x+v.y)){this.resetRound(false);return;}body.setLinearVelocity(V(clamp(v.x,isBall?-17:-9,isBall?17:9),clamp(v.y,isBall?-22:-14,isBall?22:14)));body.setAngularVelocity(clamp(body.getAngularVelocity(),-14,14));if(p.y>my(0)+1||p.y<-2||p.x<-2||p.x>mx(W)+2){if(isBall&&!this.holder){body.setTransform(V(mx(W/2),my(170)),0);body.setLinearVelocity(V(0,0));}else if(!isBall){const data=body.getUserData()||{},side=data.team===0?mx(390):mx(890);body.setTransform(V(side,this.groundY+3),0);body.setLinearVelocity(V(0,0));}}}
      for(const player of this.players){const maxY=this.groundY+5.5,y=player.body.getPosition().y;if(y>maxY){const drop=y-maxY;for(const part of[player.body,player.head,player.arm]){const p=part.getPosition(),v=part.getLinearVelocity();part.setTransform(V(p.x,p.y-drop),part.getAngle());part.setLinearVelocity(V(v.x,Math.min(0,v.y)));}}}
    }
    unstickBall(dt){if(this.holder){this.ballIdle=0;return;}const p=this.ball.getPosition(),v=this.ball.getLinearVelocity(),slow=v.lengthSquared()<.06&&p.y<this.groundY+this.ballCfg.radius+.12;if(!slow){this.ballIdle=0;return;}this.ballIdle+=dt;if(this.ballIdle>2.4){const toward=Math.sign(mx(W/2)-p.x)||1;this.ball.setLinearVelocity(V(toward*(3.1+this.rng()*1.2),5.4+this.rng()*1.1));this.ballIdle=0;}}
    physicsStep(dt){
      this.time+=dt;if(this.finished)return;if(this.phase!=="play"){this.phaseTimer-=dt;this.freeze=Math.max(0,this.phaseTimer);if(this.phaseTimer<=0){if(this.phase==="scored")this.resetRound(false);else if(this.phase==="finished"){this.finished=true;this.onEvent({type:"finish",winner:this.winner,score:[...this.score]});}else{this.phase="play";this.freeze=0;this.onEvent({type:"whistle"});}}return;}
      this.aiStep(dt);this.ballCatchCooldown=Math.max(0,this.ballCatchCooldown-dt);this.updateControls(dt);this.lastBallPos=this.ball.getPosition().clone();this.world.step(dt,10,6);this.tryCatchBall();this.stabilize();this.unstickBall(dt);this.checkScore();
    }
    step(dt){this.accumulator+=Math.min(dt,.05);let loops=0;while(this.accumulator>=FIXED&&loops<4){this.physicsStep(FIXED);this.accumulator-=FIXED;loops++;}}
    checkScore(){if(this.phase!=="play"||this.holder)return;const now=this.ball.getPosition(),vy=this.ball.getLinearVelocity().y;if(vy>=0)return;for(const hoop of this.hoops){const min=Math.min(hoop.world.a,hoop.world.b)-.9,max=Math.max(hoop.world.a,hoop.world.b)+.9;if(this.lastBallPos.y>hoop.world.rimY+.03&&now.y<=hoop.world.rimY+.03&&now.x>min&&now.x<max){const scorer=hoop.team===0?1:0,points=this.ballCfg.points;this.score[scorer]=Math.min(this.firstTo,this.score[scorer]+points);this.onEvent({type:"score",team:scorer,points,score:[...this.score]});if(this.score[scorer]>=this.firstTo){this.winner=scorer;this.phase="finished";this.phaseTimer=.72;}else{this.phase="scored";this.phaseTimer=1.08;}this.freeze=this.phaseTimer;return;}}}
    part(body,extra={}){const p=body.getPosition();return{x:px(p.x),y:py(p.y),rot:-body.getAngle(),...extra};}
    playerSnapshot(player){const hand=this.handPoint(player),body=this.part(player.body,{w:px(player.bodyW),h:px(player.bodyH)}),arm=this.part(player.arm,{w:px(.25),h:px(player.armLen),hand:{x:px(hand.x),y:py(hand.y)}});return{id:player.id,team:player.team,index:player.index,skin:player.skin,number:player.number,x:body.x,y:body.y,rot:body.rot,body,torso:body,head:this.part(player.head,{r:px(player.headR)}),arm,arms:[arm],legs:[],business:!!BODIES[this.mod.body].business,holding:this.holder?.id===player.id,control:this.controls[player.team]};}
    snapshot(){const bp=this.ball.getPosition();return{time:this.time,round:this.round,score:[...this.score],winner:this.winner,finished:this.finished,freeze:this.freeze,phase:this.phase,mod:{...this.mod},players:this.players.map(p=>this.playerSnapshot(p)),ball:{x:px(bp.x),y:py(bp.y),r:px(this.ballCfg.radius),rot:-this.ball.getAngle(),vx:px(this.ball.getLinearVelocity().x),vy:-px(this.ball.getLinearVelocity().y),heldBy:this.holder?.id??null},hoops:this.hoops.map(h=>({team:h.team,x:h.x,y:h.y,width:h.width,dir:h.dir}))};}
  }

  function interpPart(a,b,t){if(!a)return b;return{...b,x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),rot:lerp(a.rot,b.rot,t),hand:b.hand&&a.hand?{x:lerp(a.hand.x,b.hand.x,t),y:lerp(a.hand.y,b.hand.y,t)}:b.hand};}
  function interpolateSnapshot(a,b,t){if(!a)return b;if(!b)return a;return{...b,ball:interpPart(a.ball,b.ball,t),players:b.players.map((p,i)=>{const q=a.players[i];return{...p,x:lerp(q?.x??p.x,p.x,t),y:lerp(q?.y??p.y,p.y,t),rot:lerp(q?.rot??p.rot,p.rot,t),body:interpPart(q?.body,p.body,t),torso:interpPart(q?.torso,p.torso,t),head:interpPart(q?.head,p.head,t),arm:interpPart(q?.arm,p.arm,t),arms:p.arms.map((v,j)=>interpPart(q?.arms?.[j],v,t))};})};}

  class Renderer{
    constructor(canvas){this.canvas=canvas;this.display=canvas.getContext("2d");this.pixelCanvas=document.createElement("canvas");this.pixelCanvas.width=W/PIXEL_SCALE;this.pixelCanvas.height=H/PIXEL_SCALE;this.ctx=this.pixelCanvas.getContext("2d");this.ctx.imageSmoothingEnabled=false;this.display.imageSmoothingEnabled=false;this.shake=0;this.confetti=[];this.trail=[];}
    resize(){const dpr=Math.min(2,window.devicePixelRatio||1),rect=this.canvas.getBoundingClientRect();this.canvas.width=Math.max(1,Math.round(rect.width*dpr));this.canvas.height=Math.max(1,Math.round(rect.height*dpr));this.display.imageSmoothingEnabled=false;}
    burst(color){for(let i=0;i<65;i++)this.confetti.push({x:W/2,y:250,vx:(Math.random()-.5)*700,vy:-150-Math.random()*390,r:8+Math.random()*12,c:color||["#ffd02a","#fff","#31c85b","#168dd8","#ee4337"][i%5],life:1.5+Math.random()});}
    updateFx(dt){for(const q of this.confetti){q.vy+=720*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;q.vx*=.99;}this.confetti=this.confetti.filter(q=>q.life>0&&q.y<H+30);this.shake*=.76;}
    draw(state,profiles){if(!state)return;const c=this.ctx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.pixelCanvas.width,this.pixelCanvas.height);c.setTransform(1/PIXEL_SCALE,0,0,1/PIXEL_SCALE,0,0);c.save();if(this.shake>1)c.translate(Math.round((Math.random()-.5)*this.shake/PIXEL_SCALE)*PIXEL_SCALE,Math.round((Math.random()-.5)*this.shake/PIXEL_SCALE)*PIXEL_SCALE);this.background(state.mod.map,state.time||0);this.court(state.mod.map);for(const hoop of state.hoops)this.hoop(hoop);for(const player of state.players)this.player(player,state.mod,profiles?.[player.team]);this.ball(state.ball,state.mod.ball);for(const q of this.confetti){c.fillStyle=q.c;c.fillRect(Math.round(q.x/4)*4,Math.round(q.y/4)*4,q.r,q.r);}c.restore();this.display.setTransform(1,0,0,1,0,0);this.display.clearRect(0,0,this.canvas.width,this.canvas.height);this.display.imageSmoothingEnabled=false;this.display.drawImage(this.pixelCanvas,0,0,this.canvas.width,this.canvas.height);}
    rect(x,y,w,h,color){const c=this.ctx;c.fillStyle=color;c.fillRect(Math.round(x/4)*4,Math.round(y/4)*4,Math.max(4,Math.round(w/4)*4),Math.max(4,Math.round(h/4)*4));}
    background(map,t){
      const c=this.ctx;if(map==="street"){this.rect(0,0,W,H,"#77a5b8");this.rect(0,392,W,226,"#8b654d");for(let i=0;i<15;i++){const x=i*92-8,h=92+(i%4)*20;this.rect(x,392-h,84,h,"#416d80");for(let yy=316-h;yy<370;yy+=28)for(let xx=x+12;xx<x+75;xx+=24)if((xx+yy+i)%3)this.rect(xx,yy,8,12,"#9ed4d9");}this.rect(0,424,W,20,"#74503c");for(let x=0;x<W;x+=48)this.rect(x,424,12,178,"#74503c");}
      else if(map==="gym"){this.rect(0,0,W,H,"#745f54");for(let y=100;y<570;y+=44){this.rect(0,y,W,4,"#58473f");for(let x=(y/44%2)*48;x<W;x+=96)this.rect(x,y-40,4,40,"#655147");}this.rect(0,72,W,68,"#243142");this.rect(360,92,560,8,"#f2f0dc");this.rect(500,112,280,16,"#d89b31");}
      else if(map==="beach"){this.rect(0,0,W,H,"#71c9df");this.rect(0,360,W,142,"#2f9bc0");for(let x=-40;x<W;x+=120){this.rect(x+((t*18)%120),386,72,8,"#e9ffff");this.rect(x+28+((t*13)%120),422,64,8,"#9ee7ef");}this.rect(0,494,W,124,"#e2b46f");this.rect(1030,58,72,72,"#ffe281");for(const x of[145,1110]){this.rect(x,286,16,196,"#865f3b");for(let i=-3;i<=3;i++){c.save();c.translate(x+8,300);c.rotate(i*.38);this.rect(0,-8,96,16,"#2c9b56");c.restore();}}}
      else{this.rect(0,0,W,H,"#9fb7c9");for(let i=0;i<10;i++){const x=i*150-70;this.rect(x,330-(i%2)*38,170,170+(i%2)*38,"#d9e7ee");}this.rect(0,430,W,188,"#eef8fc");this.rect(512,308,250,150,"#765a49");this.rect(492,292,290,24,"#f7fcff");this.rect(544,366,54,92,"#e2b548");this.rect(672,350,52,108,"#e2b548");for(let i=0;i<55;i++)this.rect((i*97+t*22*(i%3+1))%W,(i*53+t*18)%470,4,4,"#ffffff");}
    }
    court(map){const ground=map==="gym"?"#b0773f":map==="beach"?"#d9aa68":map==="snow"?"#e9f7fb":"#4d5559";this.rect(0,GROUND-24,W,150,ground);this.rect(0,GROUND-8,W,8,map==="snow"?"#ffffff":"#d8e2e4");this.rect(W/2-4,GROUND-24,8,56,"rgba(255,255,255,.48)");for(let x=0;x<W;x+=56)this.rect(x,GROUND+24,28,4,"rgba(20,30,35,.18)");}
    hoop(hoop){const board=hoop.team===0?hoop.x-24:hoop.x+24,dir=hoop.dir;this.rect(board-6,hoop.y-98,12,120,"#edf6f7");this.rect(board-10,hoop.y-98,20,8,"#ffffff");this.rect(hoop.x+dir*4+(dir<0?-hoop.width:0),hoop.y-4,hoop.width,8,"#ec4a31");for(let i=0;i<6;i++){const x=hoop.x+dir*(8+i*(hoop.width-16)/5);this.rect(x-2,hoop.y+4,4,44,"#e5f1f2");}this.rect(board-dir*8,hoop.y+18,10,GROUND-hoop.y-18,"#7a8588");}
    piece(part,w,h,color,outline="#14191e"){const c=this.ctx;c.save();c.translate(Math.round(part.x/4)*4,Math.round(part.y/4)*4);c.rotate(part.rot);this.rect(-w/2-4,-h/2-4,w+8,h+8,outline);this.rect(-w/2,-h/2,w,h,color);c.restore();}
    player(p,mod,profile){
      const c=this.ctx,skin=SKINS[p.skin]||SKINS[profile?.skin]||SKINS.rookie,shirt=p.business?"#25282d":skin.shirt,shorts=p.business?"#111419":skin.shorts,body=p.body||p.torso,arm=p.arm||p.arms[0];this.rect(body.x-34,GROUND,68,8,"rgba(15,20,25,.2)");this.piece(arm,arm.w,arm.h,skin.skin);this.rect(arm.hand.x-10,arm.hand.y-10,20,20,"#13181d");this.rect(arm.hand.x-6,arm.hand.y-6,12,12,skin.skin);
      c.save();c.translate(Math.round(body.x/4)*4,Math.round(body.y/4)*4);c.rotate(body.rot);this.rect(-body.w*.56,-body.h*.54,body.w*1.12,body.h*1.08,"#151a1f");this.rect(-body.w/2,-body.h/2,body.w,body.h*.56,shirt);this.rect(-body.w/2,body.h*.06,body.w,body.h*.27,shorts);this.rect(-body.w*.34,body.h*.32,body.w*.24,body.h*.24,skin.skin);this.rect(body.w*.1,body.h*.32,body.w*.24,body.h*.24,skin.skin);this.rect(-body.w*.5,body.h*.45,body.w*.62,14,"#11171d");this.rect(body.w*.04,body.h*.45,body.w*.62,14,"#11171d");this.rect(-body.w*.45,body.h*.43,body.w*.5,7,skin.accent);this.rect(body.w*.08,body.h*.43,body.w*.5,7,skin.accent);if(p.business){this.rect(-6,-body.h*.43,12,body.h*.48,"#f3f3ed");this.rect(-2,-body.h*.3,4,body.h*.34,"#e2403c");}c.fillStyle=skin.accent;c.font=`900 ${Math.max(16,body.w*.42)}px monospace`;c.textAlign="center";c.textBaseline="middle";c.fillText(String(p.number).slice(-2),0,-body.h*.22);c.restore();
      c.save();c.translate(Math.round(p.head.x/4)*4,Math.round(p.head.y/4)*4);c.rotate(p.head.rot);const r=p.head.r;this.rect(-r-4,-r-4,r*2+8,r*2+8,"#151a1f");this.rect(-r,-r,r*2,r*2,skin.skin);this.rect(-r,-r,r*2,Math.max(12,r*.62),skin.hair);const face=p.team===0?1:-1;this.rect(face*r*.2,-4,6,6,"#171717");this.rect(face*r*.45,r*.34,8,4,"#171717");c.restore();
    }
    ball(ball,type){const c=this.ctx,cfg=BALLS[type];this.trail.unshift({x:ball.x,y:ball.y,r:ball.r});if(this.trail.length>5)this.trail.pop();for(let i=this.trail.length-1;i>1;i--){const q=this.trail[i];c.globalAlpha=.05+(5-i)*.025;this.pixelDisc(q.x,q.y,q.r*(1-i/8),cfg.color==="rainbow"?"#c942dc":cfg.color);}c.globalAlpha=1;c.save();c.translate(Math.round(ball.x/4)*4,Math.round(ball.y/4)*4);c.rotate(ball.rot);if(cfg.color==="rainbow"){this.pixelDisc(0,0,ball.r,"#ef4250");this.rect(-ball.r,-ball.r*.38,ball.r*2,ball.r*.48,"#f1c62d");this.rect(-ball.r,ball.r*.1,ball.r*2,ball.r*.45,"#34bd70");this.rect(-ball.r,ball.r*.52,ball.r*2,ball.r*.28,"#467ad8");}else this.pixelDisc(0,0,ball.r,cfg.color);c.strokeStyle="#2a1a13";c.lineWidth=4;c.beginPath();c.moveTo(-ball.r,0);c.lineTo(ball.r,0);c.moveTo(0,-ball.r);c.lineTo(0,ball.r);c.stroke();c.restore();}
    pixelDisc(x,y,r,color){const step=4;this.ctx.fillStyle=color;for(let yy=-r;yy<=r;yy+=step){const half=Math.sqrt(Math.max(0,r*r-yy*yy)),left=Math.ceil((-half)/step)*step,right=Math.floor(half/step)*step;this.ctx.fillRect(Math.round((x+left)/4)*4,Math.round((y+yy)/4)*4,Math.max(step,right-left+step),step);}}
  }

  return{Game,Renderer,interpolateSnapshot,constants:{W,H,GROUND,MAPS,BALLS,BODIES,HOOPS,GRAVITIES,SKINS}};
});
