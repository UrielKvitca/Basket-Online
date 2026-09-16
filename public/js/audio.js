(function(){
  "use strict";
  let ctx=null,enabled=true;
  function ensure(){if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();if(ctx.state==="suspended")ctx.resume();return ctx;}
  function tone(freq,duration=.08,type="square",gain=.045,slide=0){if(!enabled)return;const a=ensure(),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),a.currentTime+duration);g.gain.setValueAtTime(gain,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+duration);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+duration);}
  function play(name){if(name==="press"){tone(260,.055,"square",.035,80);}else if(name==="jump"){tone(130,.07,"square",.025,100);}else if(name==="hit"){tone(85,.045,"sawtooth",.025,-25);}else if(name==="bounce"){tone(115,.04,"sine",.02,35);}else if(name==="whistle"){tone(1350,.16,"sine",.04,420);setTimeout(()=>tone(1150,.12,"sine",.035,250),100);}else if(name==="score"){[330,440,550,760].forEach((f,i)=>setTimeout(()=>tone(f,.11,"square",.04,60),i*75));}else if(name==="win"){[392,523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.24,"square",.045,30),i*125));}else if(name==="lose"){[330,260,196].forEach((f,i)=>setTimeout(()=>tone(f,.25,"sawtooth",.035,-35),i*150));}else if(name==="coin"){tone(820,.08,"square",.035,320);setTimeout(()=>tone(1250,.1,"square",.03,250),90);}}
  document.addEventListener("pointerdown",()=>{try{ensure();}catch(_){ }},{once:true});
  window.BasketAudio={play,setEnabled:v=>enabled=!!v};
})();
