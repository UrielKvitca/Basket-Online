(function(){
  "use strict";
  const KEY="basket-random-arena-save-v1";
  const SHOP=[
    {id:"rookie",name:"CLÁSICO",description:"El equipo inicial",price:0,skin:"rookie"},
    {id:"sunset",name:"FUEGO",description:"Rojo de visitante",price:120,skin:"sunset"},
    {id:"neon",name:"NEÓN",description:"Brilla en la noche",price:220,skin:"neon"},
    {id:"ice",name:"HIELO",description:"Listo para la nieve",price:320,skin:"ice"},
    {id:"royal",name:"ROYAL",description:"Violeta de campeón",price:450,skin:"royal"},
    {id:"retro",name:"RETRO",description:"Colores del arcade",price:560,skin:"retro"},
    {id:"shadow",name:"SOMBRA",description:"Edición nocturna",price:750,skin:"shadow"},
    {id:"gold",name:"LEYENDA",description:"Solo para ganadores",price:1000,skin:"gold"}
  ];
  const DEFAULT={profile:{name:"JUGADOR",number:1,color:"#2d9cff",skin:"rookie"},coins:80,unlocked:["rookie"],stats:{wins:0,games:0,trophies:0,streak:0},tournament:{lastStarted:0,bestRound:0},settings:{serverUrl:""}};
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||"null");if(!raw)return clone(DEFAULT);return{...clone(DEFAULT),...raw,profile:{...DEFAULT.profile,...raw.profile},stats:{...DEFAULT.stats,...raw.stats},tournament:{...DEFAULT.tournament,...raw.tournament},settings:{...DEFAULT.settings,...raw.settings},unlocked:Array.isArray(raw.unlocked)?raw.unlocked:["rookie"]};}catch(_){return clone(DEFAULT);}}
  let data=load();
  function save(){localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new CustomEvent("basket-save",{detail:data}));}
  function profile(p){data.profile={...data.profile,...p};save();return data.profile;}
  function addCoins(n){data.coins=Math.max(0,Math.round(data.coins+n));save();return data.coins;}
  function recordGame(win){data.stats.games++;if(win){data.stats.wins++;data.stats.streak++;}else data.stats.streak=0;save();}
  function buy(id){const item=SHOP.find(x=>x.id===id);if(!item)return{ok:false,reason:"No existe"};if(data.unlocked.includes(id)){data.profile.skin=id;save();return{ok:true,equipped:true};}if(data.coins<item.price)return{ok:false,reason:"MONEDAS INSUFICIENTES"};data.coins-=item.price;data.unlocked.push(id);data.profile.skin=id;save();return{ok:true,purchased:true};}
  function tournamentAvailable(cooldownMinutes=30){const remaining=data.tournament.lastStarted+cooldownMinutes*60000-Date.now();return{available:remaining<=0,remaining:Math.max(0,remaining)};}
  function startTournament(){data.tournament.lastStarted=Date.now();save();}
  function winTournament(){data.stats.trophies++;data.tournament.bestRound=4;save();}
  window.BasketStore={get:()=>data,save,profile,addCoins,recordGame,buy,tournamentAvailable,startTournament,winTournament,SHOP};
})();
