(function(){
  "use strict";
  class Network{
    constructor(handlers={}){this.socket=null;this.handlers=handlers;this.connected=false;this.url="";this.loading=null;this.pingTimer=null;this.latency=0;this.inputSeq=0;this.transportName="";}
    isLanOrigin(){const host=location.hostname;return/^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||host.includes(":")||host.endsWith(".local");}
    getUrl(){const saved=window.BasketStore?.get().settings.serverUrl,configured=saved||window.BASKET_CONFIG?.SERVER_URL||"";if(configured)return configured.replace(/\/$/,"");const host=location.hostname;if(location.protocol.startsWith("http")&&(host.endsWith(".onrender.com")||this.isLanOrigin()))return location.origin;return"";}
    async lanUrls(){if(!this.isLanOrigin())return[];try{const response=await fetch(`${location.origin}/api/lan`,{cache:"no-store"});if(!response.ok)return[];const data=await response.json();return Array.isArray(data.urls)?data.urls:[];}catch(_error){return[];}}
    loadClient(url){if(window.io)return Promise.resolve();if(this.loading)return this.loading;this.loading=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=`${url}/socket.io/socket.io.js`;s.onload=resolve;s.onerror=()=>reject(new Error("No se pudo cargar Socket.IO"));document.head.appendChild(s);});return this.loading;}
    async connect(){
      this.url=this.getUrl();if(!this.url){if(location.hostname==="localhost"||location.hostname==="127.0.0.1")this.url=location.origin;else throw new Error("Configurá la URL de Render en js/config.js");}
      await this.loadClient(this.url);if(this.socket?.connected)return this.socket;
      if(!this.socket){
        this.socket=window.io(this.url,{transports:["websocket","polling"],tryAllTransports:true,upgrade:true,rememberUpgrade:true,reconnection:true,reconnectionAttempts:8,reconnectionDelay:500,reconnectionDelayMax:2500,timeout:10000});
        const events=["connect","disconnect","status","room-created","public-room-created","public-rooms","queueing","match-found","match-start","snapshot","input-ack","game-event","opponent-left","error-message"];
        for(const ev of events)this.socket.on(ev,data=>{if(ev==="connect"){this.connected=true;this.watchTransport();this.startLatencyProbe();}if(ev==="disconnect"){this.connected=false;this.transportName="";this.stopLatencyProbe();}this.handlers[ev]?.(data);});
      }
      if(!this.socket.connected)this.socket.connect();
      return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("El servidor tardó demasiado")),11000);this.socket.once("connect",()=>{clearTimeout(timer);resolve(this.socket);});this.socket.once("connect_error",err=>{clearTimeout(timer);reject(err);});});
    }
    watchTransport(){const engine=this.socket?.io?.engine;if(!engine)return;const report=()=>{this.transportName=engine.transport?.name||"";this.handlers.transport?.({name:this.transportName});};report();engine.off?.("upgrade",report);engine.on("upgrade",report);}
    startLatencyProbe(){this.stopLatencyProbe();const probe=()=>{if(!this.socket?.connected)return;const started=performance.now();this.socket.timeout(2500).emit("latency-ping",Date.now(),err=>{if(err)return;const sample=Math.round(performance.now()-started);this.latency=this.latency?Math.round(this.latency*.7+sample*.3):sample;this.handlers.latency?.({ms:this.latency});});};probe();this.pingTimer=setInterval(probe,4000);}
    stopLatencyProbe(){clearInterval(this.pingTimer);this.pingTimer=null;}
    async listPublicRooms(){const s=await this.connect();s.emit("list-public-rooms");}
    async quickMatch(profile){const s=await this.connect();s.emit("quick-match",profile);}
    async createPublicRoom(profile){const s=await this.connect();s.emit("create-public",profile);}
    async joinPublicRoom(roomId,profile){const s=await this.connect();s.emit("join-public-room",{roomId:String(roomId).toUpperCase(),profile});}
    async createRoom(profile){const s=await this.connect();s.emit("create-private",profile);}
    async joinRoom(code,profile){const s=await this.connect();s.emit("join-private",{code:String(code).toUpperCase(),profile});}
    input(down){const seq=++this.inputSeq;this.socket?.emit("input",{action:"control",down:!!down,seq,at:Date.now()});return seq;}
    cancel(){this.socket?.emit("leave-match");}
    disconnect(){this.stopLatencyProbe();this.socket?.disconnect();this.socket=null;this.connected=false;this.transportName="";}
  }
  window.BasketNetwork=Network;
})();
