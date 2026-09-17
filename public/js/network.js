(function(){
  "use strict";
  class Network{
    constructor(handlers={}){this.socket=null;this.handlers=handlers;this.connected=false;this.url="";this.loading=null;}
    getUrl(){const saved=window.BasketStore?.get().settings.serverUrl,configured=saved||window.BASKET_CONFIG?.SERVER_URL||"";if(configured)return configured.replace(/\/$/,"");if(location.hostname.endsWith(".onrender.com")||location.hostname==="localhost"||location.hostname==="127.0.0.1")return location.origin;return"";}
    loadClient(url){if(window.io)return Promise.resolve();if(this.loading)return this.loading;this.loading=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=`${url}/socket.io/socket.io.js`;s.onload=resolve;s.onerror=()=>reject(new Error("No se pudo cargar Socket.IO"));document.head.appendChild(s);});return this.loading;}
    async connect(){this.url=this.getUrl();if(!this.url){if(location.hostname==="localhost"||location.hostname==="127.0.0.1")this.url=location.origin;else throw new Error("Configurá la URL de Render en js/config.js");}await this.loadClient(this.url);if(this.socket?.connected)return this.socket;this.socket=window.io(this.url,{transports:["websocket","polling"],reconnection:true,reconnectionAttempts:4,timeout:9000});
      const events=["connect","disconnect","status","room-created","queueing","match-found","match-start","snapshot","game-event","opponent-left","error-message"];
      for(const ev of events)this.socket.on(ev,data=>{if(ev==="connect")this.connected=true;if(ev==="disconnect")this.connected=false;this.handlers[ev]?.(data);});
      return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("El servidor tardó demasiado")),10000);this.socket.once("connect",()=>{clearTimeout(timer);resolve(this.socket);});this.socket.once("connect_error",err=>{clearTimeout(timer);reject(err);});});
    }
    async publicMatch(profile){const s=await this.connect();s.emit("join-public",profile);}
    async createRoom(profile){const s=await this.connect();s.emit("create-private",profile);}
    async joinRoom(code,profile){const s=await this.connect();s.emit("join-private",{code:String(code).toUpperCase(),profile});}
    input(down){this.socket?.emit("input",{action:"control",down:!!down,at:Date.now()});}
    cancel(){this.socket?.emit("leave-match");}
    disconnect(){this.socket?.disconnect();this.socket=null;this.connected=false;}
  }
  window.BasketNetwork=Network;
})();
