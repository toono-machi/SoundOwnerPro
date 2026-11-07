'use strict';
window.ExportEngine={
  clean(s){return String(s||'audio').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[.\s]+$/,'').slice(0,90)||'audio';},
  getGroups(mode){const tracks=App.state.tracks,chars=App.state.characters;const byType=t=>tracks.filter(x=>x.type===t).map(x=>x.id);const cs=byType('character');
    if(mode==='all'||mode==='preview')return[{name:mode==='preview'?'視聴用':'全体',ids:tracks.map(x=>x.id)}];
    if(mode==='characters')return[{name:'キャラクター',ids:cs}];
    if(mode==='selectedCharacters'){const selected=App.getSelectedExportCharacters();return[{name:'選択キャラクター',ids:tracks.filter(t=>t.type==='character'&&selected.includes(t.characterId)).map(t=>t.id)}];}
    if(mode==='perCharacter')return chars.map(c=>({name:c.name,ids:tracks.filter(t=>t.characterId===c.id).map(t=>t.id)})).filter(g=>g.ids.length);
    if(mode==='perCategory')return[{name:'キャラクター',ids:cs},{name:'効果音',ids:byType('sfx')},{name:'環境音',ids:byType('env')},{name:'BGM',ids:byType('bgm')}].filter(g=>g.ids.length);
    return[];
  },
  getRanges(mode){const end=App.length();if(mode==='preview'){const s=App.state.previewStart,e=App.state.previewEnd;if(s==null||e==null||e-s<.05)throw Error('視聴用マーカーの開始と終了を、タイムラインに設定してください。');return[{start:Math.max(0,s),end:Math.min(e,end)}];}
    const split=document.querySelector('input[name="exportRange"]:checked')?.value==='markers';if(!split)return[{start:0,end}];
    const points=[0,...App.state.markers.filter(m=>m.type==='normal'&&m.time>0&&m.time<end).map(m=>m.time).sort((a,b)=>a-b),end];return points.slice(0,-1).map((s,i)=>({start:s,end:points[i+1]})).filter(r=>r.end-r.start>.02);
  },
  async render(group,range,mode){const rate=44100;const frames=Math.max(1,Math.ceil((range.end-range.start)*rate));if(frames>rate*1800)throw Error('1ファイル30分を超えるため書き出しできません。範囲を分割してください。');
    const ctx=new OfflineAudioContext(2,frames,rate);const master=ctx.createGain();master.gain.value=Math.pow(10,(Number(App.state.masterDb)||0)/20);master.connect(ctx.destination);
    const entries=new Map();const modeFilter=mode==='preview'?App.state.playMode:'all';const active=App.state.tracks.filter(t=>group.ids.includes(t.id));for(const tr of active){if(!AudioEngine.audible(tr,active,modeFilter))continue;entries.set(tr.id,AudioEngine.buildTrack(ctx,tr,master));}
    for(const clip of App.state.clips){const entry=entries.get(clip.trackId),buffer=App.buffers.get(clip.mediaId);if(!entry||!buffer)continue;AudioEngine.scheduleClip(ctx,clip,buffer,entry,0,range.start,range.end);}
    const rendered=await ctx.startRendering();if(mode==='preview'){let gain=0;const fadeIn=Math.min((Number(document.getElementById('previewFadeIn').value)||0),rendered.duration/2),fadeOut=Math.min((Number(document.getElementById('previewFadeOut').value)||0),rendered.duration/2);
      for(let ch=0;ch<rendered.numberOfChannels;ch++){const samples=rendered.getChannelData(ch);for(let i=0;i<samples.length;i++){const t=i/rate;gain=Math.min(1,fadeIn>0?t/fadeIn:1,fadeOut>0?(rendered.duration-t)/fadeOut:1);samples[i]*=Math.max(0,gain);}}
    }return rendered;
  },
  encodeWav(buffer){const left=buffer.getChannelData(0),right=buffer.numberOfChannels>1?buffer.getChannelData(1):left;const len=left.length,bytes=new ArrayBuffer(44+len*4),dv=new DataView(bytes);let pos=0;const str=s=>{for(let i=0;i<s.length;i++)dv.setUint8(pos++,s.charCodeAt(i));};const u16=n=>{dv.setUint16(pos,n,true);pos+=2;};const u32=n=>{dv.setUint32(pos,n,true);pos+=4;};str('RIFF');u32(36+len*4);str('WAVE');str('fmt ');u32(16);u16(1);u16(2);u32(buffer.sampleRate);u32(buffer.sampleRate*4);u16(4);u16(16);str('data');u32(len*4);
    for(let i=0;i<len;i++){const l=Math.max(-1,Math.min(1,left[i])),r=Math.max(-1,Math.min(1,right[i]));dv.setInt16(pos,l<0?l*32768:l*32767,true);dv.setInt16(pos+2,r<0?r*32768:r*32767,true);pos+=4;}return new Blob([bytes],{type:'audio/wav'});
  },
  lameReady:null,
  async ensureMp3(){if(window.lamejs?.Mp3Encoder)return;if(this.lameReady)return this.lameReady;
    this.lameReady=new Promise((resolve,reject)=>{const urls=['https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js','https://unpkg.com/lamejs@1.2.1/lame.min.js'];let i=0;function next(){if(i>=urls.length)return reject(new Error('MP3エンコーダーを取得できません。インターネット接続を確認するか、WAVで書き出してください。'));const s=document.createElement('script');s.src=urls[i++];s.onload=()=>window.lamejs?.Mp3Encoder?resolve():next();s.onerror=next;document.head.append(s);}next();}).catch(e=>{this.lameReady=null;throw e;});return this.lameReady;
  },
  async encodeMp3(buffer){await this.ensureMp3();const encoder=new window.lamejs.Mp3Encoder(2,buffer.sampleRate,192);const left=buffer.getChannelData(0),right=buffer.numberOfChannels>1?buffer.getChannelData(1):left;const chunks=[];for(let i=0;i<left.length;i+=1152){const l=new Int16Array(Math.min(1152,left.length-i)),r=new Int16Array(l.length);for(let j=0;j<l.length;j++){const a=Math.max(-1,Math.min(1,left[i+j])),b=Math.max(-1,Math.min(1,right[i+j]));l[j]=a<0?a*32768:a*32767;r[j]=b<0?b*32768:b*32767;}const b=encoder.encodeBuffer(l,r);if(b.length)chunks.push(new Uint8Array(b));if(i%(1152*300)===0)await new Promise(ok=>setTimeout(ok,0));}const last=encoder.flush();if(last.length)chunks.push(new Uint8Array(last));return new Blob(chunks,{type:'audio/mpeg'});},
  async toBlob(buffer,format){return format==='mp3'?this.encodeMp3(buffer):this.encodeWav(buffer);},
  crc(bytes){let c=0xffffffff;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let j=0;j<8;j++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return(c^0xffffffff)>>>0;},
  async zip(files){const encoder=new TextEncoder(),entries=[],parts=[];let offset=0;const write=(dv,p,n,size)=>{if(size===2)dv.setUint16(p,n,true);else dv.setUint32(p,n>>>0,true);};for(const file of files){const data=new Uint8Array(await file.blob.arrayBuffer()),name=encoder.encode(file.name),crc=this.crc(data),head=new Uint8Array(30+name.length),v=new DataView(head.buffer);write(v,0,0x04034b50,4);write(v,4,20,2);write(v,6,0x800,2);write(v,8,0,2);write(v,14,crc,4);write(v,18,data.length,4);write(v,22,data.length,4);write(v,26,name.length,2);head.set(name,30);parts.push(head,data);entries.push({offset,crc,len:data.length,name});offset+=head.length+data.length;}
    const startCentral=offset;for(const e of entries){const head=new Uint8Array(46+e.name.length),v=new DataView(head.buffer);write(v,0,0x02014b50,4);write(v,4,20,2);write(v,6,20,2);write(v,8,0x800,2);write(v,16,e.crc,4);write(v,20,e.len,4);write(v,24,e.len,4);write(v,28,e.name.length,2);write(v,42,e.offset,4);head.set(e.name,46);parts.push(head);offset+=head.length;}
    const end=new Uint8Array(22),v=new DataView(end.buffer);write(v,0,0x06054b50,4);write(v,8,entries.length,2);write(v,10,entries.length,2);write(v,12,offset-startCentral,4);write(v,16,startCentral,4);parts.push(end);return new Blob(parts,{type:'application/zip'});
  },
  download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);},
  async run(){const button=document.getElementById('exportAudio');if(button.disabled)return;button.disabled=true;try{if(!App.state.clips.length)throw Error('書き出す音声クリップがありません。');const mode=document.getElementById('exportMode').value,format=document.getElementById('exportFormat').value,groups=this.getGroups(mode).filter(g=>App.state.clips.some(c=>g.ids.includes(c.trackId))),ranges=this.getRanges(mode);if(!groups.length||!groups.some(g=>g.ids.length))throw Error('対象トラックがありません。');if(!ranges.length)throw Error('有効な書き出し範囲がありません。');if(format==='mp3'){App.setExportStatus('MP3エンコーダーを準備しています…');await this.ensureMp3();}
    const files=[],n=groups.length*ranges.length,prefix=this.clean(App.state.projectName||'SoundOwnerPro'),names=App.state.fileNames.filter(s=>s.trim());let index=0;
    for(const group of groups){for(let r=0;r<ranges.length;r++){index++;App.setExportStatus(`書き出し中 ${index} / ${n}：${group.name}`);await new Promise(ok=>setTimeout(ok,10));const rendered=await this.render(group,ranges[r],mode);const blob=await this.toBlob(rendered,format);const num=String(r+1).padStart(3,'0'),custom=names[r]?this.clean(names[r]):'';const section=ranges.length>1?(custom?`${num}_${custom}`:num):'';const groupPart=groups.length>1||mode==='characters'||mode==='selectedCharacters'?`_${this.clean(group.name)}`:'';const filename=section?`${section}${groupPart}.${format}`:`${prefix}${groupPart}${mode==='preview'?'_視聴用':''}.${format}`;files.push({name:filename,blob});}}
    if(files.length===1)this.download(files[0].blob,files[0].name);else{App.setExportStatus('ZIPにまとめています…');const blob=await this.zip(files);this.download(blob,`${prefix}_書き出し.zip`);}
    App.setExportStatus(`${files.length} ファイルの書き出しが完了しました。`);App.toast(`書き出し完了：${files.length} ファイル`);
  }catch(e){App.setExportStatus(`エラー：${e.message}`);App.toast(e.message,true);console.error(e);}finally{button.disabled=false;}}
};
