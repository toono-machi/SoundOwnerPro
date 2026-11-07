'use strict';
window.AudioEngine = {
  context:null, playing:false, startedAt:0, startedClock:0, sources:[], previewSource:null, previewCtx:null, raf:0,
  async ensure(){ if(!this.context)this.context=new (window.AudioContext||window.webkitAudioContext)(); if(this.context.state==='suspended')await this.context.resume(); return this.context; },
  getNow(){ if(!this.playing)return App.state.playhead;return Math.max(0,this.startedAt+(this.context.currentTime-this.startedClock)); },
  modeAllows(track,mode){if(mode==='all')return true;if(mode==='characters')return track.type==='character';if(mode==='noncharacters')return track.type!=='character';return track.type===mode;},
  audible(track,tracks,mode){if(!this.modeAllows(track,mode)||track.muted)return false;const solos=tracks.filter(t=>t.solo&&!t.muted&&this.modeAllows(t,mode));return !solos.length||track.solo;},
  impulse(ctx,seconds=1.5){const length=Math.max(1,Math.floor(ctx.sampleRate*Math.min(5,seconds)));const buf=ctx.createBuffer(2,length,ctx.sampleRate);for(let ch=0;ch<2;ch++){let s=(ch+11)*1439;const arr=buf.getChannelData(ch);for(let i=0;i<length;i++){s^=s<<13;s^=s>>>17;s^=s<<5;arr[i]=((s>>>0)/2147483648-1)*Math.pow(1-i/length,1.9);}}return buf;},
  buildTrack(ctx,track,output){
    const fx=track.effects||{},eq=fx.eq||{};const input=ctx.createGain();let last=input;
    if(eq.enabled){
      const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=Math.max(20,eq.lowCut||20);last.connect(hp);last=hp;
      const freqs=[120,400,1200,3500,8500];(eq.bands||[0,0,0,0,0]).forEach((gain,i)=>{const f=ctx.createBiquadFilter();f.type=i===0?'lowshelf':i===4?'highshelf':'peaking';f.frequency.value=freqs[i];if(i>0&&i<4)f.Q.value=.85;f.gain.value=Number(gain)||0;last.connect(f);last=f;});
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=Math.min(ctx.sampleRate/2-1,eq.highCut||20000);last.connect(lp);last=lp;
    }
    if(fx.compressor?.enabled){const c=ctx.createDynamicsCompressor();c.threshold.value=Number(fx.compressor.threshold??-22);c.ratio.value=Number(fx.compressor.ratio??3);c.knee.value=8;c.attack.value=.003;c.release.value=.22;last.connect(c);last=c;}
    if(fx.limiter?.enabled){const l=ctx.createDynamicsCompressor();l.threshold.value=Number(fx.limiter.threshold??-1);l.ratio.value=20;l.knee.value=0;l.attack.value=.001;l.release.value=.08;last.connect(l);last=l;}
    const gain=ctx.createGain();gain.gain.value=Math.pow(10,(Number(track.gainDb)||0)/20);
    if(fx.reverb?.enabled&&fx.reverb.wet>0){const dry=ctx.createGain(),wet=ctx.createGain(),conv=ctx.createConvolver();const amt=Math.max(0,Math.min(.8,Number(fx.reverb.wet)||0));dry.gain.value=1-amt*.45;wet.gain.value=amt;conv.buffer=this.impulse(ctx,Number(fx.reverb.size)||1);last.connect(dry);last.connect(conv);conv.connect(wet);dry.connect(gain);wet.connect(gain);}else last.connect(gain);
    gain.connect(output);return input;
  },
  scheduleClip(ctx,clip,buffer,entry,startAt,renderStart,renderEnd){
    const begin=clip.start,end=clip.start+clip.duration;const from=Math.max(begin,renderStart);const to=Math.min(end,renderEnd);
    if(to<=from+0.001)return null;
    const offset=(Number(clip.offset)||0)+(from-begin);
    if(offset>=buffer.duration)return null;
    const duration=Math.min(to-from,buffer.duration-offset);
    if(duration<=0)return null;
    const src=ctx.createBufferSource();src.buffer=buffer;
    const gain=ctx.createGain();const amplitude=Math.pow(10,(Number(clip.gainDb)||0)/20);const baseTime=Math.max(0,startAt+(from-renderStart));
    const fIn=Math.max(0,Math.min(clip.fadeIn||0,clip.duration));const fOut=Math.max(0,Math.min(clip.fadeOut||0,clip.duration));
    const evalFade=t=>{const x=t-clip.start;let g=1;if(fIn>0)g=Math.min(g,Math.min(1,x/fIn));if(fOut>0)g=Math.min(g,Math.min(1,(clip.duration-x)/fOut));return Math.max(0,g);};
    const nodes=[{t:0,g:evalFade(from)},{t:duration,g:evalFade(from+duration)}];
    if(fIn>0&&from<clip.start+fIn&&from+duration>clip.start+fIn)nodes.push({t:clip.start+fIn-from,g:evalFade(clip.start+fIn)});
    if(fOut>0&&from<end-fOut&&from+duration>end-fOut)nodes.push({t:end-fOut-from,g:evalFade(end-fOut)});
    nodes.sort((a,b)=>a.t-b.t);gain.gain.setValueAtTime(amplitude*nodes[0].g,baseTime);for(let i=1;i<nodes.length;i++)gain.gain.linearRampToValueAtTime(amplitude*nodes[i].g,baseTime+nodes[i].t);
    src.connect(gain);gain.connect(entry);src.start(baseTime,Math.max(0,offset),duration);return src;
  },
  async start(at){
    const ctx=await this.ensure();this.stop(false);const state=App.state;const start=Math.min(Math.max(0,at),App.length());if(start>=App.length())return;
    const output=ctx.createGain();output.gain.value=Math.pow(10,(Number(state.masterDb)||0)/20);output.connect(ctx.destination);
    const entries=new Map();for(const track of state.tracks){if(!this.audible(track,state.tracks,state.playMode))continue;entries.set(track.id,this.buildTrack(ctx,track,output));}
    const startTime=ctx.currentTime+.035;for(const clip of state.clips){const entry=entries.get(clip.trackId),buffer=App.buffers.get(clip.mediaId);if(!entry||!buffer)continue;try{const src=this.scheduleClip(ctx,clip,buffer,entry,startTime,start,App.length());if(src)this.sources.push(src);}catch(e){console.warn('Cannot schedule clip',e);}}
    this.playing=true;this.startedAt=start;this.startedClock=startTime;state.playhead=start;this.tick();App.refreshTransport();
  },
  tick(){cancelAnimationFrame(this.raf);const loop=()=>{if(!this.playing)return;const t=this.getNow();if(t>=App.length()){if(App.state.loop){this.start(0);return;}this.stop();App.state.playhead=App.length();App.updateHead();return;}App.state.playhead=t;App.updateHead();this.raf=requestAnimationFrame(loop);};this.raf=requestAnimationFrame(loop);},
  stop(update=true){if(this.playing&&update)App.state.playhead=Math.min(App.length(),Math.max(0,this.getNow()));this.playing=false;cancelAnimationFrame(this.raf);for(const src of this.sources)try{src.stop();src.disconnect();}catch(_){}this.sources=[];if(update&&window.App)App.refreshTransport();},
  async seek(t){let wasPlaying=this.playing;this.stop(false);App.state.playhead=Math.max(0,Math.min(Math.max(60,App.length()+15),t));App.updateHead();if(wasPlaying)await this.start(App.state.playhead);},
  async preview(media){const buffer=App.buffers.get(media.id);if(!buffer)return;if(this.previewSource){try{this.previewSource.stop();}catch(_){}this.previewSource=null;App.refreshMedia();return;}
    const ctx=await this.ensure();const source=ctx.createBufferSource();const gain=ctx.createGain();source.buffer=buffer;gain.gain.value=Number(App.state.previewVolume??.75);source.connect(gain);gain.connect(ctx.destination);source.onended=()=>{if(this.previewSource===source){this.previewSource=null;App.refreshMedia();}};source.start();this.previewSource=source;App.refreshMedia();
  },
  stopPreview(){if(this.previewSource)try{this.previewSource.stop();}catch(_){}this.previewSource=null;}
};
