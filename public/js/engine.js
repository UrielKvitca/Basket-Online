(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else root.BasketEngine=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  const W=1280,H=720,GROUND=618;
  const MAPS=["street","gym","beach","snow"];
  const BALLS={
    normal:{name:"PELOTA CLÁSICA",sub:"EQUILIBRADA",radius:24,mass:1,bounce:.73,gravity:1,points:1,color:"#ef7d27"},
    light:{name:"PELOTA LIVIANA",sub:"CAÍDA LENTA · REBOTE ALTO",radius:20,mass:.58,bounce:.91,gravity:.68,points:1,color:"#e7eef7"},
    heavy:{name:"PELOTA PESADA",sub:"CAÍDA RÁPIDA · REBOTE BAJO",radius:29,mass:2.25,bounce:.34,gravity:1.33,points:1,color:"#555d69"},
    rainbow:{name:"PELOTA DOBLE",sub:"LA CANASTA VALE 2",radius:23,mass:.92,bounce:.79,gravity:.94,points:2,color:"rainbow"},
    tiny:{name:"MINI PELOTA",sub:"RÁPIDA E IMPREDECIBLE",radius:14,mass:.48,bounce:.88,gravity:.86,points:1,color:"#ffb32c"},
    bouncy:{name:"SUPER REBOTE",sub:"NO DEJA DE SALTAR",radius:24,mass:.9,bounce:1.04,gravity:.88,points:1,color:"#b26eff"}
  };
  const BODIES={
    normal:{name:"JUGADORES NORMALES",sub:"TODO EN SU MEDIDA",head:1,arm:1,body:1},
    longArms:{name:"BRAZOS LARGOS",sub:"ALCANCE GIGANTE",head:1,arm:1.65,body:1},
    shortArms:{name:"BRAZOS CORTOS",sub:"PEGADOS AL CUERPO",head:1,arm:.62,body:1},
    bigHead:{name:"CABEZA GIGANTE",sub:"BLOQUEO TOTAL",head:1.48,arm:1,body:1},
    smallHead:{name:"CABEZA MINI",sub:"MÁS LIVIANOS",head:.67,arm:1,body:.95},
    giant:{name:"EQUIPO GIGANTE",sub:"MÁS FUERZA · MENOS CONTROL",head:1.2,arm:1.2,body:1.28},
    business:{name:"MODO BUSINESS",sub:"TRAJES EN LA CANCHA",head:1,arm:1,body:1,business:true}
  };
  const HOOPS={normal:{name:"AROS NORMALES",sub:"ALTURA CLÁSICA",y:292,width:58},high:{name:"AROS ALTOS",sub:"A VOLAR",y:225,width:57},low:{name:"AROS BAJOS",sub:"LLUVIA DE DUNKS",y:360,width:61},wide:{name:"AROS ANCHOS",sub:"MÁS FÁCIL · MÁS CAOS",y:295,width:78}};
  const GRAVITIES={normal:{name:"GRAVEDAD NORMAL",sub:"PIES EN LA TIERRA",value:1450},float:{name:"CÁMARA LENTA",sub:"CAÍDA SUAVE",value:880},fast:{name:"GRAVEDAD FUERTE",sub:"CAÍDA RÁPIDA",value:1950}};
  const SKINS={
    rookie:{shirt:"#1e8de1",shorts:"#e7f2ff",skin:"#d99a64",hair:"#2a1a12",accent:"#fff"},
    sunset:{shirt:"#f05b45",shorts:"#311818",skin:"#b56f43",hair:"#17110f",accent:"#ffc430"},
    neon:{shirt:"#7dfc43",shorts:"#172c20",skin:"#d8a56c",hair:"#713f18",accent:"#141c2a"},
    ice:{shirt:"#dff8ff",shorts:"#65c9ee",skin:"#f0bd8e",hair:"#e8f4ff",accent:"#164b79"},
    royal:{shirt:"#8a58ff",shorts:"#f0d540",skin:"#79503a",hair:"#101216",accent:"#fff"},
    shadow:{shirt:"#222936",shorts:"#090c11",skin:"#895f48",hair:"#050608",accent:"#ff3d64"},
    gold:{shirt:"#ffc928",shorts:"#fff3bc",skin:"#c98959",hair:"#5a2d12",accent:"#7b4a00"},
    retro:{shirt:"#18c7b9",shorts:"#ed4f68",skin:"#e3aa76",hair:"#3c1d18",accent:"#fff"}
  };
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function lerp(a,b,t){return a+(b-a)*t;}
  function hashSeed(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function pick(rng,obj){const keys=Array.isArray(obj)?obj:Object.keys(obj);return keys[Math.floor(rng()*keys.length)];}

  class Game{
    constructor(opts={}){
      this.firstTo=opts.firstTo||5;this.seed=opts.seed||Date.now();this.rng=mulberry32(hashSeed(this.seed));
      this.mode=opts.mode||"cpu";this.difficulty=opts.difficulty||.54;this.onEvent=opts.onEvent||(()=>{});
      this.profiles=opts.profiles||[{name:"JUGADOR",number:1,skin:"rookie"},{name:"RIVAL",number:2,skin:"sunset"}];
      this.time=0;this.round=0;this.score=[0,0];this.winner=null;this.freeze=0;this.finished=false;this.lastScorer=-1;this.aiClock=0;
      this.mod={map:"street",ball:"normal",body:"normal",hoop:"normal",gravity:"normal"};
      this.resetRound(true);
    }
    makePlayer(team,index){
      const side=team===0?1:-1;const base=team===0?(index===0?320:500):(index===0?960:780);
      const profile=this.profiles[team]||{};
      return {id:team*2+index,team,index,x:base,y:GROUND-68,vx:0,vy:0,rot:0,vr:0,armPhase:index*Math.PI,armSpeed:0,grounded:true,squash:0,flash:0,side,skin:profile.skin||("rookie"),number:profile.number??(team+1)};
    }
    randomModifiers(first){
      if(first){this.mod={map:"street",ball:"normal",body:"normal",hoop:"normal",gravity:"normal"};return;}
      let map=pick(this.rng,MAPS),ball=pick(this.rng,Object.keys(BALLS)),body=pick(this.rng,Object.keys(BODIES)),hoop=pick(this.rng,Object.keys(HOOPS));
      let gravity=this.rng()<.32?pick(this.rng,Object.keys(GRAVITIES)):"normal";
      if(map==="snow"&&this.rng()<.55) gravity="normal";
      this.mod={map,ball,body,hoop,gravity};
    }
    resetRound(first=false){
      this.randomModifiers(first);this.players=[this.makePlayer(0,0),this.makePlayer(0,1),this.makePlayer(1,0),this.makePlayer(1,1)];
      const b=BALLS[this.mod.ball];this.ball={x:W/2,y:160,vx:(this.rng()-.5)*40,vy:10,r:b.radius,rot:0,spin:0,lastY:160,trail:[]};
      this.hoops=this.buildHoops();this.freeze=first ? .65 : 1.25;this.round++;
      this.onEvent({type:"round",mod:this.mod,details:this.modDetails(),round:this.round});
    }
    buildHoops(){const h=HOOPS[this.mod.hoop];return[{team:0,x:91,y:h.y,width:h.width,dir:1},{team:1,x:W-91,y:h.y,width:h.width,dir:-1}];}
    modDetails(){const all=[BALLS[this.mod.ball],BODIES[this.mod.body],HOOPS[this.mod.hoop],GRAVITIES[this.mod.gravity]];const special=all.filter(x=>!/NORMA|CLÁSICA|MEDIDA|TIERRA/.test(x.name));const chosen=special.length?special[special.length-1]:BALLS[this.mod.ball];return{name:chosen.name,sub:chosen.sub,map:this.mod.map.toUpperCase()};}
    input(team,power=1){
      if(this.freeze>0||this.finished)return;
      const dir=team===0?1:-1;for(const p of this.players.filter(x=>x.team===team)){
        const grounded=p.y>GROUND-90||p.grounded;
        p.vy-=grounded?690*power:245*power;p.vx+=dir*(grounded?245:105)*power+(this.rng()-.5)*55;p.vr+=dir*(this.rng()>.5?5.5:-4.2);p.armSpeed+=dir*15*power;p.grounded=false;p.squash=.22;
      }
      this.onEvent({type:"jump",team});
    }
    aiStep(dt){
      if(this.mode!=="cpu"&&this.mode!=="tournament")return;this.aiClock-=dt;if(this.aiClock>0)return;
      const front=this.players[2],mate=this.players[3],b=this.ball;const near=Math.min(Math.abs(front.x-b.x),Math.abs(mate.x-b.x));
      const ballThreat=b.x>W*.55||b.vx>120;let chance=.08+this.difficulty*.3;if(near<190)chance+=.34;if(ballThreat)chance+=.19;if(b.y<380)chance+=.07;
      if(this.rng()<chance)this.input(1,.88+this.difficulty*.28);this.aiClock=clamp(.42-this.difficulty*.25+this.rng()*.25,.10,.48);
    }
    step(dt){
      dt=Math.min(dt,.033);this.time+=dt;if(this.finished)return;this.aiStep(dt);
      if(this.freeze>0){this.freeze-=dt;if(this.freeze<=0)this.onEvent({type:"whistle"});return;}
      const grav=GRAVITIES[this.mod.gravity].value;const body=BODIES[this.mod.body];const snow=this.mod.map==="snow";
      for(const p of this.players){
        p.flash=Math.max(0,p.flash-dt);p.squash=Math.max(0,p.squash-dt);p.vy+=grav*dt;p.vx*=Math.pow(snow ? .998 : .982,dt*60);p.vr*=Math.pow(.975,dt*60);p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;p.armPhase+=p.armSpeed*dt;p.armSpeed*=Math.pow(.90,dt*60);
        const radius=31*body.body;if(p.y+radius>GROUND){p.y=GROUND-radius;p.vy*=-.28;p.vx*=snow ? .97 : .82;p.vr*=.72;p.grounded=true;}else p.grounded=false;
        if(p.x-radius<36){p.x=36+radius;p.vx=Math.abs(p.vx)*.52;}if(p.x+radius>W-36){p.x=W-36-radius;p.vx=-Math.abs(p.vx)*.52;}
        p.rot=clamp(p.rot,-1.25,1.25);
      }
      this.playerCollisions();this.ballStep(dt,grav);this.scoreCheck();
    }
    playerCollisions(){
      const body=BODIES[this.mod.body];for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
        const a=this.players[i],b=this.players[j],dx=b.x-a.x,dy=b.y-a.y,min=49*body.body,d=Math.hypot(dx,dy)||1;if(d<min){const nx=dx/d,ny=dy/d,push=(min-d)*.5;a.x-=nx*push;b.x+=nx*push;a.y-=ny*push;b.y+=ny*push;const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){const imp=-rel*.42;a.vx-=nx*imp;b.vx+=nx*imp;a.vy-=ny*imp;b.vy+=ny*imp;}}
      }
    }
    ballStep(dt,grav){
      const b=this.ball,cfg=BALLS[this.mod.ball];b.lastY=b.y;b.vy+=grav*cfg.gravity*dt;b.vx*=Math.pow(.997,dt*60);b.vy*=Math.pow(.999,dt*60);b.x+=b.vx*dt;b.y+=b.vy*dt;b.rot+=b.vx*dt*.012;b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>7)b.trail.pop();
      if(b.x-b.r<22){b.x=22+b.r;b.vx=Math.abs(b.vx)*cfg.bounce;b.spin+=.4;}if(b.x+b.r>W-22){b.x=W-22-b.r;b.vx=-Math.abs(b.vx)*cfg.bounce;b.spin-=.4;}if(b.y-b.r<20){b.y=20+b.r;b.vy=Math.abs(b.vy)*cfg.bounce;}
      if(b.y+b.r>GROUND){b.y=GROUND-b.r;b.vy=-Math.abs(b.vy)*cfg.bounce;b.vx*=this.mod.map==="snow" ? .985 : .90;if(Math.abs(b.vy)<42)b.vy=-42;this.onEvent({type:"bounce",strength:Math.abs(b.vy)});}
      for(const hoop of this.hoops){
        const boardX=hoop.team===0?hoop.x-26:hoop.x+26;if(Math.abs(b.x-boardX)<b.r+8&&b.y>hoop.y-105&&b.y<hoop.y+14){b.x=boardX+(b.x>boardX?b.r+8:-b.r-8);b.vx=(b.x>boardX?1:-1)*Math.max(160,Math.abs(b.vx))*cfg.bounce;}
        const rimA=hoop.x+hoop.dir*4,rimB=hoop.x+hoop.dir*hoop.width;for(const rx of[rimA,rimB]){const dx=b.x-rx,dy=b.y-hoop.y,d=Math.hypot(dx,dy)||1;if(d<b.r+7){const nx=dx/d,ny=dy/d,over=b.r+7-d;b.x+=nx*over;b.y+=ny*over;const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=1.7*dot*nx;b.vy-=1.7*dot*ny;}}}
      }
      this.ballPlayerCollisions();
    }
    ballPlayerCollisions(){
      const b=this.ball,body=BODIES[this.mod.body],cfg=BALLS[this.mod.ball];for(const p of this.players){
        const parts=[{x:p.x,y:p.y-42*body.body,r:24*body.head},{x:p.x,y:p.y-11*body.body,r:29*body.body}];
        const armLen=50*body.arm;const armAngle=p.armPhase+(p.team===0?-.55:Math.PI+.55);parts.push({x:p.x+Math.cos(armAngle)*armLen,y:p.y-20+Math.sin(armAngle)*armLen,r:13});
        for(const part of parts){const dx=b.x-part.x,dy=b.y-part.y,d=Math.hypot(dx,dy)||1,min=b.r+part.r;if(d<min){const nx=dx/d,ny=dy/d;b.x=part.x+nx*min;b.y=part.y+ny*min;const pvx=p.vx-Math.sin(armAngle)*p.armSpeed*armLen*.32,pvy=p.vy+Math.cos(armAngle)*p.armSpeed*armLen*.32;const rel=(b.vx-pvx)*nx+(b.vy-pvy)*ny;if(rel<0){const impulse=-(1+cfg.bounce*.75)*rel/(1/cfg.mass+.35);b.vx+=nx*impulse/cfg.mass;b.vy+=ny*impulse/cfg.mass;p.vx-=nx*impulse*.12;p.vy-=ny*impulse*.12;p.flash=.08;this.onEvent({type:"hit",strength:Math.abs(impulse)});}}
        }
      }
    }
    scoreCheck(){
      const b=this.ball;if(b.vy<0)return;for(const hoop of this.hoops){const min=hoop.team===0?hoop.x+7:hoop.x-hoop.width+4,max=hoop.team===0?hoop.x+hoop.width-4:hoop.x-7;if(b.lastY<hoop.y-3&&b.y>=hoop.y-3&&b.x>Math.min(min,max)&&b.x<Math.max(min,max)){
          const scorer=hoop.team===0?1:0,pts=BALLS[this.mod.ball].points;this.score[scorer]=Math.min(this.firstTo,this.score[scorer]+pts);this.lastScorer=scorer;this.freeze=1.55;this.onEvent({type:"score",team:scorer,points:pts,score:[...this.score]});
          if(this.score[scorer]>=this.firstTo){this.finished=true;this.winner=scorer;setTimeout(()=>this.onEvent({type:"finish",winner:scorer,score:[...this.score]}),650);}else setTimeout(()=>{if(!this.finished)this.resetRound(false);},1250);return;
      }}
    }
    snapshot(){return{time:this.time,round:this.round,score:this.score,winner:this.winner,finished:this.finished,freeze:this.freeze,mod:this.mod,players:this.players.map(p=>({...p})),ball:{...this.ball,trail:[...this.ball.trail]},hoops:this.hoops.map(h=>({...h}))};}
    loadSnapshot(s){if(!s)return;this.time=s.time;this.round=s.round;this.score=[...s.score];this.winner=s.winner;this.finished=s.finished;this.freeze=s.freeze;this.mod={...s.mod};this.players=s.players.map(p=>({...p}));this.ball={...s.ball,trail:s.ball.trail||[]};this.hoops=s.hoops.map(h=>({...h}));}
  }

  function interpolateSnapshot(a,b,t){if(!a)return b;if(!b)return a;const out={...b,score:b.score,mod:b.mod,hoops:b.hoops};out.ball={...b.ball,x:lerp(a.ball.x,b.ball.x,t),y:lerp(a.ball.y,b.ball.y,t),rot:lerp(a.ball.rot,b.ball.rot,t)};out.players=b.players.map((p,i)=>({...p,x:lerp(a.players[i]?.x??p.x,p.x,t),y:lerp(a.players[i]?.y??p.y,p.y,t),rot:lerp(a.players[i]?.rot??p.rot,p.rot,t),armPhase:lerp(a.players[i]?.armPhase??p.armPhase,p.armPhase,t)}));return out;}

  class Renderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d");this.ctx.imageSmoothingEnabled=false;this.w=W;this.h=H;this.shake=0;this.confetti=[];this.lastMap="";}
    resize(){const dpr=Math.min(2,window.devicePixelRatio||1),rect=this.canvas.getBoundingClientRect();this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);this.ctx.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);this.ctx.imageSmoothingEnabled=false;}
    burst(color){for(let i=0;i<70;i++)this.confetti.push({x:W/2,y:270,vx:(Math.random()-.5)*750,vy:-200-Math.random()*420,r:3+Math.random()*7,c:color||["#ffc832","#fff","#34d16f","#2d9cff","#ff4a4a"][i%5],life:1.8+Math.random()});}
    updateFx(dt){for(const q of this.confetti){q.vy+=740*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;q.vx*=.99;}this.confetti=this.confetti.filter(q=>q.life>0&&q.y<H+30);this.shake*=.82;}
    draw(state,profiles){if(!state)return;const c=this.ctx;c.save();if(this.shake>1)c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.background(state.mod.map,state.time||0);this.court(state.mod.map);for(const h of state.hoops)this.hoop(h);for(const p of state.players)this.player(p,state.mod,profiles?.[p.team]);this.ball(state.ball,state.mod.ball);for(const q of this.confetti){c.fillStyle=q.c;c.fillRect(q.x,q.y,q.r,q.r);}c.restore();}
    background(map,t){const c=this.ctx;let sky;if(map==="beach")sky=c.createLinearGradient(0,0,0,H),sky.addColorStop(0,"#59c9ef"),sky.addColorStop(.7,"#ffd885");else if(map==="snow")sky=c.createLinearGradient(0,0,0,H),sky.addColorStop(0,"#7c9fc4"),sky.addColorStop(.7,"#dce8ef");else if(map==="gym")sky=c.createLinearGradient(0,0,0,H),sky.addColorStop(0,"#3c4654"),sky.addColorStop(1,"#1c232c");else sky=c.createLinearGradient(0,0,0,H),sky.addColorStop(0,"#102440"),sky.addColorStop(.65,"#31536b");c.fillStyle=sky;c.fillRect(0,0,W,H);
      if(map==="street"){c.fillStyle="#f4d37d";for(let i=0;i<18;i++)c.fillRect((i*91+37)%W,75+(i%5)*54,5,5);c.fillStyle="#152234";for(let i=0;i<13;i++){const x=i*112-20,h=130+(i%4)*35;c.fillRect(x,GROUND-170-h,100,h);c.fillStyle="#e8bd55";for(let y=GROUND-150-h;y<GROUND-190;y+=28)for(let xx=x+13;xx<x+90;xx+=26)if((xx+y+i)%3)c.fillRect(xx,y,9,12);c.fillStyle="#152234";}c.fillStyle="#7d5337";c.fillRect(0,GROUND-190,W,18);for(let x=0;x<W;x+=48)c.fillRect(x,GROUND-190,12,155);}
      if(map==="gym"){c.fillStyle="#c9a366";c.fillRect(0,170,W,448);c.strokeStyle="#a17d48";c.lineWidth=4;for(let y=200;y<610;y+=42){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}c.fillStyle="#25354b";c.fillRect(0,110,W,65);c.fillStyle="#fff";c.font="900 29px Arial";c.textAlign="center";c.fillText("RANDOM CITY GYM",W/2,151);}
      if(map==="beach"){c.fillStyle="#fff1c6";c.beginPath();c.arc(1080,105,53,0,Math.PI*2);c.fill();c.fillStyle="#2b95c9";c.fillRect(0,430,W,105);c.fillStyle="#65d4df";for(let x=-40;x<W;x+=130){c.beginPath();c.arc(x+(t*20)%130,440,75,0,Math.PI);c.fill();}for(const x of[140,1120]){c.fillStyle="#76512f";c.fillRect(x,300,15,205);c.fillStyle="#2ea557";for(let i=0;i<7;i++){c.save();c.translate(x+7,315);c.rotate((i-3)*.42);c.fillRect(0,-8,90,17);c.restore();}}}
      if(map==="snow"){c.fillStyle="#e9f6ff";for(let i=0;i<45;i++){const x=(i*97+(t*35*(i%3+1)))%W,y=(i*53+(t*22))%520;c.fillRect(x,y,4,4);}c.fillStyle="#5f7892";for(let i=0;i<9;i++){const x=i*165-50;c.beginPath();c.moveTo(x,450);c.lineTo(x+110,245-(i%2)*55);c.lineTo(x+220,450);c.fill();}c.fillStyle="#f3fbff";c.fillRect(0,450,W,170);}
    }
    court(map){const c=this.ctx;c.fillStyle=map==="gym"?"#bb7a37":map==="beach"?"#d9a95f":map==="snow"?"#d9eff7":"#596a78";c.fillRect(0,GROUND-32,W,134);c.fillStyle=map==="snow"?"#fff":"rgba(255,255,255,.42)";c.fillRect(0,GROUND-4,W,7);c.fillStyle="rgba(15,25,35,.18)";for(let x=0;x<W;x+=64)c.fillRect(x,GROUND+14,32,4);c.strokeStyle="rgba(255,255,255,.45)";c.lineWidth=5;c.beginPath();c.arc(W/2,GROUND+4,95,Math.PI,Math.PI*2);c.stroke();c.fillStyle="rgba(0,0,0,.22)";c.fillRect(0,GROUND+54,W,102);}
    hoop(h){const c=this.ctx,dir=h.dir;const boardX=h.team===0?h.x-26:h.x+26;c.strokeStyle="#dbe5ee";c.lineWidth=11;c.beginPath();c.moveTo(boardX,h.y-95);c.lineTo(boardX,h.y+18);c.stroke();c.strokeStyle="#ff5b31";c.lineWidth=8;c.beginPath();c.moveTo(h.x+dir*4,h.y);c.lineTo(h.x+dir*h.width,h.y);c.stroke();c.strokeStyle="rgba(255,255,255,.8)";c.lineWidth=3;for(let i=0;i<6;i++){const x=h.x+dir*(8+i*(h.width-14)/5);c.beginPath();c.moveTo(x,h.y+4);c.lineTo(h.x+dir*h.width/2,h.y+58);c.stroke();}c.strokeStyle="#88939f";c.lineWidth=10;c.beginPath();c.moveTo(boardX,h.y+15);c.lineTo(boardX-dir*20,GROUND);c.stroke();}
    player(p,mod,profile){const c=this.ctx,body=BODIES[mod.body],skin=SKINS[p.skin]||SKINS[profile?.skin]||SKINS.rookie,team=p.team;const shirt=body.business?"#20232b":skin.shirt,shorts=body.business?"#111":skin.shorts;const bob=Math.sin(p.armPhase*.35)*2;c.save();c.translate(Math.round(p.x),Math.round(p.y+bob));c.rotate(p.rot*.35);const armLen=50*body.arm,armA=p.armPhase+(team===0?-.55:Math.PI+.55);
      c.strokeStyle=skin.skin;c.lineWidth=15;c.lineCap="square";c.beginPath();c.moveTo(0,-25);c.lineTo(Math.cos(armA)*armLen, -25+Math.sin(armA)*armLen);c.stroke();c.strokeStyle=shorts;c.lineWidth=18;c.beginPath();c.moveTo(-11,2);c.lineTo(-18,28);c.moveTo(11,2);c.lineTo(18,28);c.stroke();c.strokeStyle=skin.accent;c.lineWidth=12;c.beginPath();c.moveTo(-18,28);c.lineTo(-26,31);c.moveTo(18,28);c.lineTo(26,31);c.stroke();
      c.fillStyle=shirt;c.fillRect(-25*body.body,-47*body.body,50*body.body,53*body.body);if(body.business){c.fillStyle="#fff";c.fillRect(-7,-44,14,36);c.fillStyle="#e84b41";c.fillRect(-3,-40,6,24);}c.fillStyle=skin.accent;c.font=`900 ${18*body.body}px Arial`;c.textAlign="center";c.fillText(String(p.number).slice(-2),0,-15);
      const hr=24*body.head;c.fillStyle=skin.skin;c.beginPath();c.arc(0,-70*body.body,hr,0,Math.PI*2);c.fill();c.fillStyle=skin.hair;c.beginPath();c.arc(0,-76*body.body,hr,Math.PI,Math.PI*2);c.fill();c.fillRect(team===0?6:-15,-72*body.body,9,4);c.fillStyle="#111";c.fillRect(team===0?8:-12,-68*body.body,4,4);if(p.flash>0){c.globalAlpha=.55;c.fillStyle="#fff";c.fillRect(-32,-100,64,105);}c.restore();
    }
    ball(b,type){const c=this.ctx,cfg=BALLS[type];for(let i=b.trail?.length-1;i>=1;i--){const q=b.trail[i];c.globalAlpha=(7-i)/42;c.fillStyle=cfg.color==="rainbow"?`hsl(${(i*55+b.rot*80)%360} 90% 60%)`:cfg.color;c.beginPath();c.arc(q.x,q.y,b.r*(1-i/12),0,Math.PI*2);c.fill();}c.globalAlpha=1;c.save();c.translate(b.x,b.y);c.rotate(b.rot);if(cfg.color==="rainbow"){const g=c.createLinearGradient(-b.r,-b.r,b.r,b.r);["#ff4d4d","#ffd23f","#45e06f","#38a4ff","#a45cff"].forEach((x,i)=>g.addColorStop(i/4,x));c.fillStyle=g;}else c.fillStyle=cfg.color;c.beginPath();c.arc(0,0,b.r,0,Math.PI*2);c.fill();c.strokeStyle="#2b1a12";c.lineWidth=Math.max(2,b.r*.13);c.stroke();c.beginPath();c.arc(0,0,b.r*.93,-1.1,1.1);c.moveTo(-b.r,0);c.lineTo(b.r,0);c.moveTo(0,-b.r);c.bezierCurveTo(-b.r*.5,-b.r*.45,-b.r*.5,b.r*.45,0,b.r);c.stroke();c.restore();}
  }
  return{Game,Renderer,interpolateSnapshot,constants:{W,H,GROUND,MAPS,BALLS,BODIES,HOOPS,GRAVITIES,SKINS}};
});
