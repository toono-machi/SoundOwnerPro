'use strict';
const $=id=>document.getElementById(id);
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'id_'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clone=obj=>JSON.parse(JSON.stringify(obj));
const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS=['#ffca68','#ec9fbb','#a6d18b','#8ac3e0','#b5a0e5','#f5ae8a','#b9d0ac','#eac7a5'];
const TYPE={character:{label:'キャラクター',icon:'♩',color:'#ffc86a'},sfx:{label:'効果音',icon:'✦',color:'#a8d77e'},env:{label:'環境音',icon:'♧',color:'#8fc7eb'},bgm:{label:'BGM',icon:'♫',color:'#b8a0e5'}};
const DEFAULT_FX=()=>({eq:{enabled:true,bands:[0,0,0,0,0],lowCut:20,highCut:20000},reverb:{enabled:false,size:1,wet:.2},compressor:{enabled:false,threshold:-22,ratio:3},limiter:{enabled:true,threshold:-1}});
const FX_LABELS={eq:'イコライザー',reverb:'リバーブ',compressor:'コンプレッサー',limiter:'リミッター'};
const FX_HINTS={eq:'ローカット・ハイカットと5バンドの周波数調整',reverb:'空間の広さと残響量を調整',compressor:'声の大小差を抑えて聴きやすく',limiter:'音量のピークを制限'};
const FX_KEYS=Object.keys(FX_LABELS);
const fxPreset=(name,settings)=>({name,settings});
const BUILTIN_FX_PRESETS={
  eq:[
    fxPreset('標準（フラット）',{enabled:true,bands:[0,0,0,0,0],lowCut:20,highCut:20000}),
    fxPreset('ラジオ音声',{enabled:true,bands:[-8,-1,4,2,-8],lowCut:220,highCut:5100}),
    fxPreset('電話音声',{enabled:true,bands:[-12,1,5,1,-12],lowCut:400,highCut:3300}),
    fxPreset('遠くの声',{enabled:true,bands:[-7,-5,-5,-7,-12],lowCut:140,highCut:2000}),
    fxPreset('壁越しの声',{enabled:true,bands:[-2,-4,-10,-12,-12],lowCut:85,highCut:760}),
    fxPreset('柔らかなナレーション',{enabled:true,bands:[1,1,0,-1,-2],lowCut:85,highCut:14000})
  ],
  reverb:[
    fxPreset('残響なし',{enabled:false,size:1,wet:0}),
    fxPreset('小さな部屋',{enabled:true,size:.45,wet:.12}),
    fxPreset('普通の部屋',{enabled:true,size:1.1,wet:.24}),
    fxPreset('広い部屋',{enabled:true,size:1.8,wet:.28}),
    fxPreset('大ホール',{enabled:true,size:3,wet:.36}),
    fxPreset('長い廊下',{enabled:true,size:2.5,wet:.46})
  ],
  compressor:[
    fxPreset('オフ',{enabled:false,threshold:-22,ratio:3}),
    fxPreset('自然な音声',{enabled:true,threshold:-18,ratio:2}),
    fxPreset('ボイスドラマ標準',{enabled:true,threshold:-23,ratio:3}),
    fxPreset('小声を聴きやすく',{enabled:true,threshold:-29,ratio:4}),
    fxPreset('強めの圧縮',{enabled:true,threshold:-31,ratio:5})
  ],
  limiter:[
    fxPreset('オフ',{enabled:false,threshold:-1}),
    fxPreset('標準（-1.0 dB）',{enabled:true,threshold:-1}),
    fxPreset('余裕を持たせる（-2.0 dB）',{enabled:true,threshold:-2}),
    fxPreset('ピークを強く抑える（-4.0 dB）',{enabled:true,threshold:-4})
  ]
};
const normalizeFxSettings=(type,settings)=>{
  const base=clone(DEFAULT_FX()[type]);
  if(!settings||typeof settings!=='object'||Array.isArray(settings))return base;
  const numeric={eq:{lowCut:[20,1500],highCut:[500,20000]},reverb:{size:[.2,4],wet:[0,.8]},compressor:{threshold:[-50,0],ratio:[1,12]},limiter:{threshold:[-12,0]}};
  base.enabled=typeof settings.enabled==='boolean'?settings.enabled:base.enabled;
  for(const [k,[a,b]] of Object.entries(numeric[type]||{})){const v=Number(settings[k]);if(settings[k]!==undefined&&Number.isFinite(v))base[k]=clamp(v,a,b);}
  if(type==='eq'&&Array.isArray(settings.bands)){base.bands=Array.from({length:5},(_,i)=>{const v=Number(settings.bands[i]);return Number.isFinite(v)?clamp(v,-15,15):0;});}
  return base;
};
const legacyPresetType=name=>/部屋|ホール|廊下|残響|リバーブ/.test(name)?'reverb':/コンプレッサ|圧縮/.test(name)?'compressor':/リミッター|ピーク/.test(name)?'limiter':'eq';
const migratePresetEntries=items=>{
  const out=[];
  for(const item of items||[]){if(!item||!item.name)continue;
    if(FX_KEYS.includes(item.type)&&item.settings){out.push({type:item.type,name:String(item.name).slice(0,50),settings:normalizeFxSettings(item.type,item.settings)});continue;}
    if(item.effects&&typeof item.effects==='object'){
      const preferred=legacyPresetType(String(item.name));
      // 旧形式はトラック全体の設定を保持しているため、4種類に切り分けて保存する。
      for(const type of FX_KEYS){if(!item.effects[type])continue;out.push({type,name:type===preferred?String(item.name).slice(0,50):`${String(item.name).slice(0,39)}（${FX_LABELS[type]}）`,settings:normalizeFxSettings(type,item.effects[type])});}
    }
  }
  return out.filter((p,i,a)=>a.findLastIndex(x=>x.type===p.type&&x.name===p.name)===i);
};
const emptyState=()=>({version:1,projectId:uid(),projectName:'新しいプロジェクト',scriptText:'',characters:[],media:[],folders:{sfx:['共通'],env:['共通'],bgm:['共通']},tracks:[{id:uid(),type:'sfx',name:'効果音',characterId:null,gainDb:0,muted:false,solo:false,effects:DEFAULT_FX()},{id:uid(),type:'env',name:'環境音',characterId:null,gainDb:0,muted:false,solo:false,effects:DEFAULT_FX()},{id:uid(),type:'bgm',name:'BGM',characterId:null,gainDb:-4,muted:false,solo:false,effects:DEFAULT_FX()}],clips:[],markers:[],previewStart:null,previewEnd:null,previewFadeIn:1,previewFadeOut:2,masterDb:0,previewVolume:.75,playhead:0,playMode:'all',fileNames:[],loop:false});
window.App={
  state:emptyState(),buffers:new Map(),rawFiles:new Map(),scriptEntries:[],mediaCategory:'character',mediaFolder:'すべて',scriptTab:'script',fxTab:'properties',inspectorTab:'media',selectedFxType:'eq',selectedClip:null,selectedTrack:null,selectedScript:null,currentView:'edit',librarySearch:'',dashboardRecords:[],pxPerSecond:24,exportCharacters:new Set(),userPresets:[],dragging:null,
  toast(message,error=false){const node=document.createElement('div');node.className='toast'+(error?' error':'');node.textContent=message;$('toastArea').append(node);setTimeout(()=>node.remove(),3800);},
  modal(title,html,buttons){$('modalTitle').textContent=title;$('modalContent').innerHTML=html;$('modalActions').replaceChildren();(buttons||[{text:'閉じる',action:()=>true}]).forEach(b=>{const btn=document.createElement('button');btn.type='button';btn.textContent=b.text;btn.className=b.primary?'primary':'';if(b.danger)btn.classList.add('danger');btn.onclick=async()=>{const result=await b.action();if(result!==false)$('modal').close();};$('modalActions').append(btn);});$('modal').showModal();},
  length(){return Math.max(0,...this.state.clips.map(c=>c.start+c.duration));},
  fmt(time,ms=true){const n=Math.max(0,Number(time)||0),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=Math.floor(n%60),millis=Math.floor(n*1000)%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${ms?'.'+String(millis).padStart(3,'0'):''}`;},
  short(time){const v=Math.max(0,time);return `${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`;},
  parseScript(source){const lines=String(source||'').replace(/\r/g,'').split('\n');const entries=[];let current=null;for(const line of lines){const m=line.match(/^\s*(\d{3})\s+([^：:\n]{1,40})\s*[：:]\s*(.*)$/);if(m){current={number:m[1],name:m[2].trim(),text:m[3].trim(),index:entries.length};entries.push(current);}else if(current&&line.trim()){current.text+='\n'+line.trim();}}return entries;},
  syncCharactersFromScript(){this.scriptEntries=this.parseScript(this.state.scriptText);for(const row of this.scriptEntries)if(!this.state.characters.some(c=>c.name===row.name))this.state.characters.push({id:uid(),name:row.name,color:COLORS[this.state.characters.length%COLORS.length]});this.reclassifyMedia();},
  reclassifyMedia(){const numMap=new Map(this.scriptEntries.map(e=>[e.number,e.name]));for(const m of this.state.media){if(m.type!=='character')continue;const prefix=m.name.match(/^(\d{3})(?!\d)/)?.[1];const name=prefix?numMap.get(prefix):null;const char=name?this.state.characters.find(c=>c.name===name):null;if(char){m.characterId=char.id;m.folder=char.name;}else if(!m.characterId||!this.state.characters.some(c=>c.id===m.characterId)){m.characterId=null;m.folder='未分類';}}},
  init(){try{const current=localStorage.getItem('sound-owner-presets-v2');const older=current===null?localStorage.getItem('sound-owner-presets-v1'):null;const parsed=JSON.parse(current??older??'[]');this.userPresets=migratePresetEntries(Array.isArray(parsed)?parsed:[]);if(older!==null)this.persistFxPresets();}catch(_){this.userPresets=[];}
    this.bindUI();this.changeInspectorTab(this.inspectorTab);this.renderAll();if(location.hash==='#manual')this.openNav('manual');window.addEventListener('resize',()=>this.resizeTimeline());window.addEventListener('keydown',e=>this.shortcut(e));window.addEventListener('beforeunload',e=>{if(this.state.clips.length||this.state.scriptText){e.preventDefault();e.returnValue='';}});
  },
  bindUI(){
    $('projectName').addEventListener('input',e=>this.state.projectName=e.target.value);
    $('newProject').onclick=()=>{if(confirm('新規プロジェクトを作成しますか？保存していない変更は失われます。'))this.newProject();};
    $('openProject').onclick=()=>$('projectFile').click();$('saveProject').onclick=()=>this.saveProject();$('projectFile').onchange=e=>this.loadProject(e.target.files[0]).finally(()=>e.target.value='');
    $('openSettings').onclick=()=>this.showSettings();$('openHelp').onclick=()=>this.showHelp();
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>this.openNav(b.dataset.view));
    document.querySelectorAll('[data-script-tab]').forEach(b=>b.onclick=()=>this.changeScriptTab(b.dataset.scriptTab));
    $('importScript').onclick=()=>$('scriptFile').click();$('scriptFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;this.state.scriptText=await f.text();this.applyScript();e.target.value='';};
    $('pasteScript').onclick=async()=>{try{const text=await navigator.clipboard.readText();if(text){this.state.scriptText=text;this.applyScript();this.toast('クリップボードから台本を読み込みました。');return;}}catch(_){}this.editScript();this.toast('台本を入力して「台本を反映」を押してください。');};
    $('editScript').onclick=()=>this.editScript();$('cancelScript').onclick=()=>this.closeScriptEditor();$('applyScript').onclick=()=>{this.state.scriptText=$('scriptText').value;this.applyScript();this.closeScriptEditor();};
    $('addCharacter').onclick=()=>this.addCharacter($('characterName').value);$('characterName').onkeydown=e=>{if(e.key==='Enter')this.addCharacter(e.target.value);};
    document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{this.mediaCategory=b.dataset.category;this.mediaFolder='すべて';AudioEngine.stopPreview();this.refreshMedia();});
    $('mediaImportBottom').onclick=()=>$('audioFiles').click();$('audioFiles').onchange=async e=>{await this.importAudio([...e.target.files]);e.target.value='';};
    $('addFolder').onclick=()=>this.addFolder();$('mediaSearch').oninput=()=>this.refreshMediaList();$('mediaSort').onclick=()=>{this.state.media.sort((a,b)=>a.name.localeCompare(b.name,'ja',{numeric:true}));this.refreshMediaList();};
    $('previewVolume').oninput=e=>{this.state.previewVolume=Number(e.target.value)/100;};
    const mp=document.querySelector('.media-panel');mp.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();mp.style.outline='3px dashed #ffce7b';}});mp.addEventListener('dragleave',()=>mp.style.outline='');mp.addEventListener('drop',async e=>{e.preventDefault();mp.style.outline='';if(e.dataTransfer?.files?.length)await this.importAudio([...e.dataTransfer.files]);});
    $('toStart').onclick=()=>AudioEngine.seek(0);$('backFive').onclick=()=>AudioEngine.seek(this.state.playhead-5);$('forwardFive').onclick=()=>AudioEngine.seek(this.state.playhead+5);
    $('playBtn').onclick=()=>this.togglePlay();$('stopBtn').onclick=()=>{AudioEngine.stop();this.state.playhead=0;this.updateHead();};
    $('addMarker').onclick=()=>this.markerModal();$('splitClip').onclick=()=>this.splitClip();$('addTrack').onclick=()=>this.trackModal();$('removeTrack').onclick=()=>this.deleteSelectedTrack();
    $('timeScale').onchange=e=>{this.pxPerSecond=Number(e.target.value);this.renderTimeline();};
    $('zoomOut').onclick=()=>this.changeZoom(-1);$('zoomIn').onclick=()=>this.changeZoom(1);
    $('timelineScroll').addEventListener('scroll',()=>{$('trackHeaders').scrollTop=$('timelineScroll').scrollTop;});
    $('ruler').addEventListener('pointerdown',e=>this.rulerSeek(e));$('markerLane').addEventListener('pointerdown',e=>{if(e.target===$('markerLane'))this.rulerSeek(e);});
    document.querySelectorAll('[data-inspector-tab]').forEach(b=>b.onclick=()=>this.changeInspectorTab(b.dataset.inspectorTab));
    $('effectTrack').onchange=e=>this.selectTrack(e.target.value);$('fxTrack').onchange=e=>this.selectTrack(e.target.value);
    document.querySelectorAll('[data-fx-kind]').forEach(b=>b.onclick=()=>this.changeFxType(b.dataset.fxKind));
    $('fxEnabled').onchange=e=>{const tr=this.selectedFxTrack();if(!tr)return;tr.effects[this.selectedFxType].enabled=e.target.checked;this.refreshFx();if(AudioEngine.playing)this.replay();};
    $('effectPreset').onchange=e=>this.applyFxPreset(e.target.value,'eq');
    $('applyPreset').onclick=()=>this.applyFxPreset($('fxPreset').value,this.selectedFxType);
    $('savePreset').onclick=()=>this.saveFxPreset();$('exportPresets').onclick=()=>this.exportFxPresets();$('importPresets').onclick=()=>$('presetFile').click();$('presetFile').onchange=async e=>{await this.importFxPresets(e.target.files[0]);e.target.value='';};
    $('exportMode').onchange=()=>this.refreshExportOptions();$('editFilenames').onclick=()=>this.showFilenameEditor();$('exportAudio').onclick=()=>ExportEngine.run();
    $('previewFadeIn').onchange=e=>this.state.previewFadeIn=Number(e.target.value)||0;$('previewFadeOut').onchange=e=>this.state.previewFadeOut=Number(e.target.value)||0;
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{this.state.playMode=b.dataset.mode;this.refreshModes();if(AudioEngine.playing)this.replay();});
    $('returnToEditor').onclick=()=>this.openNav('edit');
    $('exportEditMarkers').onclick=()=>{this.openNav('edit');this.markerModal();};
    $('dashboardView').addEventListener('click',e=>this.dashboardClick(e));
  },
  shortcut(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();this.saveProject();return;}
    if(this.currentView!=='edit')return;
    if($('modal').open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
    if(e.code==='Space'){e.preventDefault();this.togglePlay();}if(e.key.toLowerCase()==='m')this.addMarker('normal');if(e.key.toLowerCase()==='s')this.splitClip();if(e.key==='Delete'||e.key==='Backspace')this.deleteSelectedClip();if(e.key==='ArrowLeft')AudioEngine.seek(this.state.playhead-(e.shiftKey?5:.5));if(e.key==='ArrowRight')AudioEngine.seek(this.state.playhead+(e.shiftKey?5:.5));
  },
  openNav(view){
    if(view==='assets'||view==='library')view='home';
    if(!['home','edit','markers','project','export','manual'].includes(view))view='edit';
    this.currentView=view;
    document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
    $('mainContent').classList.toggle('dash-mode',view!=='edit');
    $('dashboardView').classList.toggle('hidden',view==='edit'||view==='export');
    $('exportScreen').classList.toggle('hidden',view!=='export');
    if(view==='export'){
      $('exportProjectName').textContent=this.state.projectName||'名称未設定';
      $('exportClipCount').textContent=this.state.clips.length;
      $('exportMarkerCount').textContent=this.state.markers.filter(m=>m.type==='normal').length;
      $('exportTrackCount').textContent=this.state.tracks.length;
      this.refreshExportOptions();
      this.resizeTimeline();
    }else if(view!=='edit')this.refreshDashboard();
    else this.resizeTimeline();
  },
  openProjectLibrary(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('このブラウザではIndexedDBを使えません。'));return;}
      const request=indexedDB.open('SoundOwnerProProjectLibrary',1);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('保存領域を開けません。'));
      request.onblocked=()=>reject(new Error('ほかのタブが保存領域を使用中です。'));
    });
  },
  async recentDb(action,payload){
    const db=await this.openProjectLibrary();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('projects',action==='get'||action==='all'?'readonly':'readwrite');
      const store=tx.objectStore('projects');
      let req;
      if(action==='all')req=store.getAll();
      else if(action==='get')req=store.get(payload);
      else if(action==='put')req=store.put(payload);
      else if(action==='delete')req=store.delete(payload);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('履歴を更新できません。'));
      tx.oncomplete=()=>db.close();
      tx.onabort=()=>db.close();
    });
  },
  async rememberProject(packed,blob){
    const st=packed.state||this.state;
    const item={id:st.projectId||uid(),name:st.projectName||'名称未設定',updatedAt:Date.now(),duration:Math.max(0,...(st.clips||[]).map(c=>c.start+c.duration)),mediaCount:st.media?.length||0,trackCount:st.tracks?.length||0,clipCount:st.clips?.length||0,blob};
    await this.recentDb('put',item);
  },
  async refreshDashboard(){
    const view=this.currentView;if(view==='edit')return;
    if(view==='manual'){this.renderDashboard();return;}
    let warning='';
    try{this.dashboardRecords=(await this.recentDb('all')).sort((a,b)=>b.updatedAt-a.updatedAt);}catch(e){this.dashboardRecords=[];warning=`ブラウザ内のプロジェクト履歴を取得できませんでした（${escapeText(e.message)}）。JSONファイルからの読み込みは利用できます。`;}
    if(this.currentView!==view)return;
    this.renderDashboard(warning);
  },
  renderProjectRows(maxCount=0){
    const query=this.librarySearch.trim().toLocaleLowerCase();
    const list=this.dashboardRecords.filter(p=>!query||p.name.toLocaleLowerCase().includes(query));
    const shown=maxCount?list.slice(0,maxCount):list;
    if(!shown.length){
      return `<div class="dash-empty"><strong>${query?'該当するプロジェクトがありません':'まだ保存したプロジェクトはありません'}</strong>${query?'別のキーワードで検索してください。':'上部の「保存」で音声込みJSONを保存すると、ここにも履歴が登録されます。<br>既存のJSONは「プロジェクトを開く」から登録できます。'}</div>`;
    }
    return shown.map(item=>`<div class="dash-project-item">
      <span class="dash-project-symbol" aria-hidden="true">♫</span>
      <button class="dash-project-open" data-dash-action="open-recent" data-id="${escapeText(item.id)}" title="${escapeText(item.name)}を開く"><strong>${escapeText(item.name)}</strong><span>最終保存・読み込み：${new Date(item.updatedAt).toLocaleString('ja-JP')}　／　素材 ${item.mediaCount}件　／　${this.fmt(item.duration,false)}</span></button>
      <div class="dash-project-actions"><button data-dash-action="open-recent" data-id="${escapeText(item.id)}">開く</button><button data-dash-action="download-recent" data-id="${escapeText(item.id)}" title="JSONを再ダウンロード">JSON</button><button data-dash-action="delete-recent" data-id="${escapeText(item.id)}" class="danger-outline" title="ブラウザ内の履歴を削除">削除</button></div>
    </div>`).join('');
  },
  renderDashboard(warning=''){
    const view=this.currentView;
    const target=$('dashboardView');
    if(view==='manual'){
      target.classList.add('manual-mode');
      target.replaceChildren($('manualTemplate').content.cloneNode(true));
      target.scrollTop=0;
      target.querySelector('.manual-toc-link')?.classList.add('active');
      return;
    }
    target.classList.remove('manual-mode');
    const title={home:'ようこそ、Sound Owner Proへ',markers:'マーカー管理',project:'プロジェクト管理'}[view]||'ホーム';
    const subtitle={home:'台本と音声をひとつに。保存済みのすべてのプロジェクトをここから再開できます。',markers:'分割用マーカーと視聴範囲の位置を管理します。',project:'現在編集中のプロジェクトを確認・保存できます。'}[view]||'';
    const hero=`<header class="dash-hero"><div class="dash-hero-text"><div class="dash-eyebrow">Sound Owner Pro · Studio</div><h1>${title}</h1><p>${subtitle}</p></div><img src="assets/pudding.png" alt="" class="dash-hero-art"></header>`;
    const warnings=warning?`<p class="dash-note" role="status">${warning}</p>`:'';
    let body='';
    if(view==='home'){
      const count=0;
      body=`<div class="dash-actions"><button data-dash-action="new">＋ 新規プロジェクト</button><button data-dash-action="import">▱ プロジェクトを開く（JSON）</button><button data-dash-action="edit">♫ 編集画面に戻る</button></div>
        <div class="dash-grid"><section class="dash-card"><div class="dash-card-head"><h2>◷ 保存済みプロジェクト</h2><small>${this.dashboardRecords.length} 件</small></div><div class="dash-search"><label for="dashQuery">検索</label><input id="dashQuery" type="search" placeholder="プロジェクト名で検索"></div><div class="dash-projects" id="dashProjectRows">${this.renderProjectRows(count)}</div></section>
        <aside class="dash-card"><div class="dash-card-head"><h2>✧ はじめての方へ</h2></div><div class="dash-card-body">
        <div class="dash-tip"><strong>1. 台本を読み込む</strong>「編集」から台本を読み込み、セリフ番号に合わせて音声を整理します。</div>
        <div class="dash-tip"><strong>2. 音声編集・ミックス</strong>クリップをタイムラインに配置し、音量やエフェクトを調整します。</div>
        <div class="dash-tip"><strong>3. 保存して再開</strong>「保存」で音声込みJSONをダウンロードすると、このブラウザにも履歴が残ります。</div>
        <div class="dash-tip"><strong>別の端末・ブラウザでは</strong>以前保存したJSONを「プロジェクトを開く」で取り込んでください。</div>
        <button class="dash-action" data-dash-action="manual">📖 詳しい使い方マニュアル</button></div></aside></div>`;
    }else if(view==='project'){
      body=`<div class="dash-actions"><button data-dash-action="save">↓ プロジェクトを保存</button><button data-dash-action="import">▱ JSONを読み込む</button><button data-dash-action="home">保存済みプロジェクトを開く</button><button data-dash-action="edit">編集画面に戻る</button></div>
        <div class="dash-stat-grid"><div class="dash-stat"><b>${this.state.characters.length}</b><span>キャラクター</span></div><div class="dash-stat"><b>${this.state.media.length}</b><span>音声素材</span></div><div class="dash-stat"><b>${this.state.clips.length}</b><span>配置クリップ</span></div></div>
        <section class="dash-card"><div class="dash-card-head"><h2>現在のプロジェクト</h2></div><div class="dash-card-body"><div class="dash-tip"><strong>名前</strong>${escapeText(this.state.projectName)}</div><div class="dash-tip"><strong>再生時間</strong>${this.fmt(this.length())}</div><div class="dash-tip"><strong>保存形式</strong>音声素材を含む .soundowner.json（ダウンロードとブラウザ内履歴）</div></div></section>`;
    }else if(view==='markers'){
      const markers=[...this.state.markers.map(m=>({id:m.id,label:m.name,time:m.time})),...(this.state.previewStart!==null?[{id:'preview-start',label:'視聴開始',time:this.state.previewStart}]:[]),...(this.state.previewEnd!==null?[{id:'preview-end',label:'視聴終了',time:this.state.previewEnd}]:[])].sort((a,b)=>a.time-b.time);
      body=`<div class="dash-actions"><button data-dash-action="add-marker">⚑ 現在位置にマーカーを追加</button><button data-dash-action="edit">編集画面に戻る</button></div><section class="dash-card"><div class="dash-card-head"><h2>マーカー一覧</h2><small>${markers.length} 件</small></div><div class="dash-marker-list">${markers.length?markers.map(m=>`<div class="dash-marker-row"><span><strong>${escapeText(m.label)}</strong>　${this.fmt(m.time)}</span><button data-dash-action="seek-marker" data-id="${escapeText(m.id)}">位置へ移動</button><button data-dash-action="delete-marker" data-id="${escapeText(m.id)}">削除</button></div>`).join(''):'<div class="dash-empty">まだマーカーがありません。編集画面の「⚑＋」から追加してください。</div>'}</div></section>`;
    }
    $('dashboardView').innerHTML=hero+warnings+body;
    const search=$('dashQuery');if(search){search.value=this.librarySearch;search.oninput=e=>{this.librarySearch=e.target.value;$('dashProjectRows').innerHTML=this.renderProjectRows();};}
  },
  async dashboardClick(event){
    const chapter=event.target.closest('[data-manual-target]');
    if(chapter){
      const target=$('dashboardView').querySelector(`#${chapter.dataset.manualTarget}`);
      if(target){
        $('dashboardView').querySelectorAll('[data-manual-target]').forEach(el=>el.classList.toggle('active',el===chapter));
        target.scrollIntoView({behavior:'smooth',block:'start'});
      }
      return;
    }
    const b=event.target.closest('[data-dash-action]');if(!b)return;
    const action=b.dataset.dashAction,id=b.dataset.id;
    if(action==='new'){if(this.state.clips.length||this.state.scriptText){if(!confirm('編集中の内容を破棄して新規作成しますか？'))return;}this.newProject();this.openNav('edit');}
    else if(action==='import')$('projectFile').click();
    else if(action==='edit')this.openNav('edit');
    else if(action==='home'||action==='library')this.openNav('home');
    else if(action==='manual')this.showHelp();
    else if(action==='save')await this.saveProject();
    else if(action==='add-marker'){this.openNav('edit');this.markerModal();}
    else if(action==='open-recent'){
      if(this.state.clips.length||this.state.scriptText){if(!confirm('現在の編集内容が置き換わります。プロジェクトを開きますか？'))return;}
      try{const record=await this.recentDb('get',id);if(!record?.blob)throw Error('保存ファイルが見つかりません。');await this.loadProject(record.blob,{remember:false});}catch(e){this.toast('履歴を開けません：'+e.message,true);}
    }else if(action==='download-recent'){
      try{const item=await this.recentDb('get',id);if(!item?.blob)throw Error('保存データがありません。');ExportEngine.download(item.blob,`${ExportEngine.clean(item.name)}.soundowner.json`);}catch(e){this.toast('JSONの取得に失敗：'+e.message,true);}
    }else if(action==='delete-recent'){
      const item=this.dashboardRecords.find(x=>x.id===id);
      if(!confirm(`「${item?.name||'このプロジェクト'}」をブラウザのライブラリから削除しますか？（ダウンロード済みのJSONは削除されません）`))return;
      try{await this.recentDb('delete',id);await this.refreshDashboard();}catch(e){this.toast('履歴の削除に失敗：'+e.message,true);}
    }else if(action==='seek-marker'||action==='delete-marker'){
      const marker=this.state.markers.find(x=>x.id===id),time=marker?.time??(id==='preview-start'?this.state.previewStart:this.state.previewEnd);
      if(action==='seek-marker'){if(time!=null){this.openNav('edit');AudioEngine.seek(time);}}
      else{if(id==='preview-start')this.state.previewStart=null;else if(id==='preview-end')this.state.previewEnd=null;else this.state.markers=this.state.markers.filter(x=>x.id!==id);this.renderMarkers();this.renderDashboard();}
    }
  },
  renderAll(){this.syncCharactersFromScript();$('projectName').value=this.state.projectName;this.changeScriptTab(this.scriptTab);this.refreshMedia();this.refreshCharacters();this.renderTimeline();this.refreshFx();this.refreshMixer();this.refreshExportOptions();this.refreshModes();this.refreshTransport();$('previewVolume').value=String(Math.round(this.state.previewVolume*100));$('previewFadeIn').value=this.state.previewFadeIn;$('previewFadeOut').value=this.state.previewFadeOut;if(this.currentView!=='edit')this.refreshDashboard();},
  newProject(){AudioEngine.stop();AudioEngine.stopPreview();this.state=emptyState();this.buffers.clear();this.rawFiles.clear();this.selectedClip=null;this.selectedTrack=null;this.scriptEntries=[];this.exportCharacters=new Set();$('mediaSearch').value='';this.mediaCategory='character';this.mediaFolder='すべて';this.renderAll();this.openNav('edit');this.toast('新しいプロジェクトを作成しました。');},
  changeScriptTab(tab){this.scriptTab=tab;document.querySelectorAll('[data-script-tab]').forEach(b=>b.classList.toggle('active',b.dataset.scriptTab===tab));$('scriptTab').classList.toggle('hidden',tab!=='script');$('characterTab').classList.toggle('hidden',tab!=='characters');if(tab==='script')this.refreshScript();else this.refreshCharacters();},
  editScript(){$('scriptText').value=this.state.scriptText;$('scriptLines').classList.add('hidden');$('scriptEditor').classList.remove('hidden');$('scriptText').focus();},
  closeScriptEditor(){$('scriptLines').classList.remove('hidden');$('scriptEditor').classList.add('hidden');},
  applyScript(){this.syncCharactersFromScript();this.refreshScript();this.refreshCharacters();this.refreshMedia();this.refreshFx();this.refreshExportOptions();this.toast(`台本を反映：${this.scriptEntries.length} 件のセリフ`);},
  refreshScript(){$('scriptCount').textContent=`${this.scriptEntries.length} セリフ`;$('scriptLines').replaceChildren();if(!this.scriptEntries.length){$('scriptLines').innerHTML='<div class="empty-state">台本を読み込むか、貼り付けてください。<br><small>001 キャラ名：セリフ</small></div>';return;}for(const item of this.scriptEntries){const b=document.createElement('button');b.className='script-line'+(this.selectedScript===item.index?' selected':'');b.innerHTML=`<span class="line-num">${escapeText(item.number)}</span><span class="line-text"><strong>${escapeText(item.name)}：</strong><br>${escapeText(item.text)}</span>`;b.onclick=()=>{this.selectedScript=item.index;this.refreshScript();const match=this.state.clips.find(c=>{const m=this.state.media.find(f=>f.id===c.mediaId);return m?.name.match(/^(\d{3})(?!\d)/)?.[1]===item.number;});if(match){this.selectClip(match.id);AudioEngine.seek(match.start);}else{this.mediaCategory='character';this.mediaFolder=item.name;this.refreshMedia();}};$('scriptLines').append(b);}},
  addCharacter(name){name=String(name||'').trim();if(!name)return this.toast('キャラクター名を入力してください。',true);if(this.state.characters.some(c=>c.name===name))return this.toast('同名のキャラクターが登録されています。',true);const c={id:uid(),name,color:COLORS[this.state.characters.length%COLORS.length]};this.state.characters.push(c);$('characterName').value='';this.reclassifyMedia();this.refreshCharacters();this.refreshMedia();this.refreshExportOptions();this.toast(`${name} を登録しました。`);},
  refreshCharacters(){$('characterList').replaceChildren();for(const c of this.state.characters){const row=document.createElement('div');row.className='character-entry';const dot=document.createElement('span');dot.className='char-dot';dot.style.background=c.color;const name=document.createElement('span');name.className='character-name';name.textContent=c.name;const track=document.createElement('button');track.className='char-action';track.textContent='＋ トラック';track.onclick=()=>{this.ensureTrack('character',c.id);this.renderTimeline();this.refreshFx();this.refreshMixer();};const del=document.createElement('button');del.className='char-action';del.title='登録を削除';del.textContent='×';del.onclick=()=>this.removeCharacter(c.id);row.append(dot,name,track,del);$('characterList').append(row);}},
  removeCharacter(id){const c=this.state.characters.find(x=>x.id===id);if(!c||!confirm(`「${c.name}」を削除しますか？関連トラックとクリップも削除されます。`))return;const tids=new Set(this.state.tracks.filter(t=>t.characterId===id).map(t=>t.id));this.state.tracks=this.state.tracks.filter(t=>!tids.has(t.id));this.state.clips=this.state.clips.filter(x=>!tids.has(x.trackId));this.state.characters=this.state.characters.filter(x=>x.id!==id);for(const media of this.state.media)if(media.characterId===id){media.characterId=null;media.folder='未分類';}this.selectedTrack=null;this.selectedClip=null;this.refreshCharacters();this.refreshMedia();this.renderTimeline();this.refreshFx();this.refreshMixer();this.refreshExportOptions();},
  getFolders(){if(this.mediaCategory==='character')return['すべて',...this.state.characters.map(c=>c.name),'未分類'];return['すべて',...(this.state.folders[this.mediaCategory]||[])];},
  refreshMedia(){document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category===this.mediaCategory));const folders=this.getFolders();if(!folders.includes(this.mediaFolder))this.mediaFolder='すべて';$('mediaFolders').replaceChildren();folders.forEach(f=>{const b=document.createElement('button');b.textContent=f;b.title='フォルダーを開く';b.className='folder-chip'+(this.mediaFolder===f?' active':'');b.onclick=()=>{this.mediaFolder=f;this.refreshMedia();};if(f!=='すべて'&&this.mediaCategory!=='character')b.oncontextmenu=e=>{e.preventDefault();this.folderMenu(f);};$('mediaFolders').append(b);});$('addFolder').disabled=this.mediaCategory==='character';this.refreshMediaList();},
  refreshMediaList(){const query=$('mediaSearch').value.toLocaleLowerCase().trim();const files=this.state.media.filter(m=>m.type===this.mediaCategory&&(this.mediaFolder==='すべて'||m.folder===this.mediaFolder)&&(!query||m.name.toLocaleLowerCase().includes(query))).sort((a,b)=>a.name.localeCompare(b.name,'ja',{numeric:true}));$('mediaList').replaceChildren();if(!files.length){$('mediaList').innerHTML='<div class="empty-state">音声素材がありません。<br><small>「＋ 音声素材を追加」またはドラッグ＆ドロップ</small></div>';return;}for(const media of files){const item=document.createElement('div');item.className='media-item';const preview=document.createElement('button');preview.className='media-preview'+(AudioEngine.previewSource?.__mediaId===media.id?' playing':'');preview.textContent=AudioEngine.previewSource?.__mediaId===media.id?'■':'▶';preview.title='試聴';preview.onclick=()=>this.previewMedia(media);const name=document.createElement('button');name.className='media-filename';name.textContent=media.name;name.title='クリックして分類・名前を編集';name.style.border='0';name.style.background='transparent';name.style.color='inherit';name.onclick=()=>this.mediaDetails(media.id);const length=document.createElement('span');length.className='media-length';length.textContent=this.short(media.duration||0);const add=document.createElement('button');add.className='media-add';add.textContent='+';add.title='シーク位置に追加';add.onclick=()=>this.addMediaToTimeline(media.id);const del=document.createElement('button');del.className='media-delete';del.title=`${media.name} を削除`;del.setAttribute('aria-label',`${media.name} を削除`);del.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 3h4M7 7l1 14h8l1-14M10 11v6m4-6v6"/></svg>';del.onclick=()=>this.deleteMedia(media.id);item.append(preview,name,length,add,del);$('mediaList').append(item);}},
  deleteMedia(id,alreadyConfirmed=false){
    const media=this.state.media.find(m=>m.id===id);if(!media)return false;
    const count=this.state.clips.filter(c=>c.mediaId===id).length;
    if(!alreadyConfirmed&&!confirm(`音声素材「${media.name}」を削除しますか？${count?`\nタイムライン上の ${count} 個のクリップも削除されます。`:''}`))return false;
    AudioEngine.stopPreview();if(AudioEngine.playing)AudioEngine.stop();
    this.state.media=this.state.media.filter(m=>m.id!==id);
    this.state.clips=this.state.clips.filter(c=>c.mediaId!==id);
    this.buffers.delete(id);this.rawFiles.delete(id);
    if(!this.state.clips.some(c=>c.id===this.selectedClip))this.selectedClip=null;
    this.renderTimeline();this.refreshMedia();this.refreshFx();this.refreshMixer();
    this.toast(`「${media.name}」を削除しました。`);
    return true;
  },
  async previewMedia(media){if(AudioEngine.previewSource&&AudioEngine.previewSource.__mediaId!==media.id)AudioEngine.stopPreview();await AudioEngine.preview(media);if(AudioEngine.previewSource)AudioEngine.previewSource.__mediaId=media.id;this.refreshMediaList();},
  addFolder(){if(this.mediaCategory==='character')return;const type=this.mediaCategory;this.modal('サブタブを追加',`<label>フォルダー名 <input id="newFolderName" maxlength="30" placeholder="例：明るいBGM"></label>`,[{text:'キャンセル',action:()=>true},{text:'追加',primary:true,action:()=>{const name=$('newFolderName').value.trim();if(!name)return false;if(this.state.folders[type].includes(name)){this.toast('同名のサブタブがあります。',true);return false;}this.state.folders[type].push(name);this.mediaFolder=name;this.refreshMedia();return true;}}]);},
  folderMenu(folder){const type=this.mediaCategory;this.modal('サブタブ管理',`<p>「${escapeText(folder)}」</p><label>新しい名前 <input id="renameFolder" maxlength="30" value="${escapeText(folder)}"></label>`,[{text:'削除',danger:true,action:()=>{this.state.folders[type]=this.state.folders[type].filter(x=>x!==folder);for(const m of this.state.media)if(m.type===type&&m.folder===folder)m.folder='共通';if(!this.state.folders[type].includes('共通'))this.state.folders[type].unshift('共通');this.mediaFolder='すべて';this.refreshMedia();return true;}},{text:'名前を変更',primary:true,action:()=>{const name=$('renameFolder').value.trim();if(!name||name!==folder&&this.state.folders[type].includes(name))return false;this.state.folders[type]=this.state.folders[type].map(x=>x===folder?name:x);for(const m of this.state.media)if(m.type===type&&m.folder===folder)m.folder=name;this.mediaFolder=name;this.refreshMedia();return true;}}]);},
  async importAudio(files){const audio=files.filter(f=>/\.(mp3|wav)$/i.test(f.name)||f.type.startsWith('audio/'));if(!audio.length){this.toast('WAVまたはMP3音声ファイルを選択してください。',true);return;}let ok=0;for(const file of audio){try{const ab=await file.arrayBuffer();const ctx=await AudioEngine.ensure();const buffer=await ctx.decodeAudioData(ab.slice(0));const id=uid(),type=this.mediaCategory;const prefix=file.name.match(/^(\d{3})(?!\d)/)?.[1];const charName=prefix?this.scriptEntries.find(x=>x.number===prefix)?.name:null;const character=charName?this.state.characters.find(c=>c.name===charName):null;const folder=type==='character'?(character?.name||'未分類'):(this.mediaFolder==='すべて'?'共通':this.mediaFolder);
      const meta={id,name:file.name,type,folder,characterId:type==='character'?character?.id||null:null,duration:buffer.duration,mime:file.type||(/\.mp3$/i.test(file.name)?'audio/mpeg':'audio/wav')};this.state.media.push(meta);this.buffers.set(id,buffer);this.rawFiles.set(id,file);ok++;}catch(e){console.error(e);this.toast(`読み込み失敗：${file.name}`,true);}}
    this.refreshMedia();this.toast(`${ok} 件の音声素材を読み込みました。`);},
  mediaDetails(id){const m=this.state.media.find(x=>x.id===id);if(!m)return;const cats=Object.entries(TYPE).map(([key,v])=>`<option value="${key}" ${m.type===key?'selected':''}>${v.label}</option>`).join('');const folders=(this.state.folders[m.type]||[]).map(f=>`<option ${m.folder===f?'selected':''}>${escapeText(f)}</option>`).join('');const chars=this.state.characters.map(c=>`<option value="${escapeText(c.id)}" ${c.id===m.characterId?'selected':''}>${escapeText(c.name)}</option>`).join('');this.modal('音声素材を管理',`<label>ファイル名 <input id="mediaEditName" value="${escapeText(m.name)}"></label><label>カテゴリ <select id="mediaEditType">${cats}</select></label><label id="mediaEditFolderRow">サブタブ <select id="mediaEditFolder">${folders}</select></label><label id="mediaEditCharRow">キャラクター <select id="mediaEditChar"><option value="">未分類</option>${chars}</select></label><p class="note">長さ ${this.fmt(m.duration)} ／ タイムラインに配置済みの素材を削除すると該当クリップも消えます。</p>`,[{text:'素材を削除',danger:true,action:()=>{return this.deleteMedia(id);}},{text:'変更を保存',primary:true,action:()=>{m.name=$('mediaEditName').value.trim()||m.name;m.type=$('mediaEditType').value;if(m.type==='character'){m.characterId=$('mediaEditChar').value||null;m.folder=this.state.characters.find(c=>c.id===m.characterId)?.name||'未分類';}else{m.characterId=null;const folder=$('mediaEditFolder').value;m.folder=this.state.folders[m.type]?.includes(folder)?folder:'共通';}this.refreshMedia();this.renderTimeline();return true;}}]);
    const update=()=>{const type=$('mediaEditType').value;$('mediaEditFolderRow').classList.toggle('hidden',type==='character');$('mediaEditCharRow').classList.toggle('hidden',type!=='character');if(type!=='character')$('mediaEditFolder').innerHTML=(this.state.folders[type]||['共通']).map(f=>`<option>${escapeText(f)}</option>`).join('');};$('mediaEditType').onchange=update;update();},
  ensureTrack(type,characterId=null){let t=this.state.tracks.find(t=>t.type===type&&(type!=='character'||t.characterId===characterId));if(t)return t;const char=this.state.characters.find(c=>c.id===characterId);if(type==='character'&&!char)throw Error('キャラクターを登録してください。');t={id:uid(),type,name:type==='character'?char.name:TYPE[type].label,characterId:type==='character'?characterId:null,gainDb:type==='bgm'?-4:0,muted:false,solo:false,effects:DEFAULT_FX()};this.state.tracks.push(t);return t;},
  addMediaToTimeline(id){const m=this.state.media.find(x=>x.id===id);if(!m)return;try{const track=this.ensureTrack(m.type,m.characterId);const clip={id:uid(),mediaId:id,trackId:track.id,start:this.state.playhead,duration:m.duration,offset:0,gainDb:0,fadeIn:0,fadeOut:0};this.state.clips.push(clip);this.selectedClip=clip.id;this.selectedTrack=track.id;this.renderTimeline();this.refreshMixer();this.refreshFx();this.toast(`${m.name} をシーク位置に追加しました。`);}catch(e){this.toast(e.message,true);}},
  trackModal(){let chars=this.state.characters.map(c=>`<option value="${escapeText(c.id)}">${escapeText(c.name)}</option>`).join('');this.modal('トラックを追加',`<label>トラック種類 <select id="newTrackType"><option value="character">キャラクター</option><option value="sfx">効果音</option><option value="env">環境音</option><option value="bgm">BGM</option></select></label><label id="chooseCharacter">キャラクター <select id="newTrackCharacter">${chars}</select></label><p class="note">キャラクタートラックは登録名が使用されます。カテゴリ別のトラックは既存のトラックがあれば再利用されます。</p>`,[{text:'キャンセル',action:()=>true},{text:'トラックを追加',primary:true,action:()=>{const type=$('newTrackType').value,charId=$('newTrackCharacter').value;try{const track=this.ensureTrack(type,type==='character'?charId:null);this.selectedTrack=track.id;this.renderTimeline();this.refreshFx();this.refreshMixer();return true;}catch(e){this.toast(e.message,true);return false;}}}]);$('newTrackType').onchange=e=>$('chooseCharacter').classList.toggle('hidden',e.target.value!=='character');},
  deleteSelectedTrack(){const id=this.selectedTrack,t=this.state.tracks.find(x=>x.id===id);if(!t){this.toast('トラックを選択してください。',true);return;}if(!confirm(`トラック「${t.name}」を削除しますか？配置済みクリップも削除されます。`))return;AudioEngine.stop();this.state.tracks=this.state.tracks.filter(x=>x.id!==id);this.state.clips=this.state.clips.filter(c=>c.trackId!==id);this.selectedTrack=null;this.selectedClip=null;this.renderTimeline();this.refreshMixer();this.refreshFx();},
  selectTrack(id){this.selectedTrack=id;this.selectedClip=null;this.renderTrackHeaders();this.renderClips();this.refreshFx();this.updateSelectionInfo();},
  selectClip(id){const c=this.state.clips.find(x=>x.id===id);if(!c)return;this.selectedClip=id;this.selectedTrack=c.trackId;this.renderTrackHeaders();document.querySelectorAll('.clip').forEach(x=>x.classList.toggle('selected',x.dataset.clipId===id));this.refreshFx();this.updateSelectionInfo();},
  deleteSelectedClip(){const id=this.selectedClip;if(!id)return;this.state.clips=this.state.clips.filter(c=>c.id!==id);this.selectedClip=null;if(AudioEngine.playing)this.replay();this.renderTimeline();this.refreshFx();},
  splitClip(){const c=this.state.clips.find(c=>c.id===this.selectedClip);if(!c){this.toast('分割するクリップを選択してください。',true);return;}const cut=this.state.playhead;if(cut<=c.start+.02||cut>=c.start+c.duration-.02){this.toast('クリップ内部にシークバーを移動してください。',true);return;}const right={...c,id:uid(),start:cut,offset:c.offset+(cut-c.start),duration:c.duration-(cut-c.start),fadeIn:0};c.duration=cut-c.start;c.fadeOut=0;this.state.clips.push(right);this.selectedClip=right.id;if(AudioEngine.playing)this.replay();this.renderTimeline();this.refreshFx();this.toast('クリップを分割しました。');},
  togglePlay(){if(AudioEngine.playing)AudioEngine.stop();else AudioEngine.start(this.state.playhead).catch(e=>this.toast(e.message,true));},
  replay(){const pos=AudioEngine.getNow();AudioEngine.stop(false);AudioEngine.start(pos).catch(e=>this.toast(e.message,true));},
  refreshTransport(){$('playBtn').textContent=AudioEngine.playing?'Ⅱ':'▶';this.updateHead();},
  updateHead(){const t=this.state.playhead;$('timeDisplay').textContent=this.fmt(t);$('durationDisplay').textContent=this.fmt(this.length());$('playhead').style.left=(t*this.pxPerSecond)+'px';},
  changeZoom(direction){const choices=[12,24,48,96,192],at=choices.indexOf(this.pxPerSecond);this.pxPerSecond=choices[clamp(at+direction,0,choices.length-1)];$('timeScale').value=String(this.pxPerSecond);this.renderTimeline();},
  renderTimeline(){const scroll=$('timelineScroll'),oldX=scroll.scrollLeft,oldY=scroll.scrollTop;this.resizeTimeline();this.renderTrackHeaders();this.renderClips();scroll.scrollLeft=oldX;scroll.scrollTop=oldY;this.updateHead();this.updateSelectionInfo();},
  updateSelectionInfo(){const c=this.state.clips.find(x=>x.id===this.selectedClip),tr=this.state.tracks.find(x=>x.id===this.selectedTrack);$('selectionInfo').textContent=c?`${this.state.media.find(m=>m.id===c.mediaId)?.name||'音声'}｜${this.fmt(c.start)}〜${this.fmt(c.start+c.duration)}`:tr?`選択トラック：${tr.name}`:'トラック / クリップ未選択';},
  resizeTimeline(){const el=$('timelineSurface'),scroll=$('timelineScroll'),px=this.pxPerSecond;const width=Math.max(scroll.clientWidth,Math.ceil((Math.max(60,this.length()+15))*px));el.style.width=width+'px';el.style.setProperty('--pxsec',px+'px');el.style.height=55+this.state.tracks.length*49+'px';const ruler=$('ruler');ruler.replaceChildren();const secStep=px>=90?1:px>=40?5:10;for(let s=0;s*px<=width;s+=secStep){const tick=document.createElement('div');tick.className='tick major';tick.style.left=(s*px)+'px';const label=document.createElement('span');label.className='tick-label';label.textContent=this.short(s);tick.append(label);ruler.append(tick);}for(let s=0;s*px<=width;s+=secStep/5){if(s%secStep===0)continue;const tick=document.createElement('div');tick.className='tick';tick.style.left=(s*px)+'px';ruler.append(tick);}this.renderMarkers();this.updateHead();},
  renderTrackHeaders(){$('trackHeaders').replaceChildren();for(const track of this.state.tracks){const wrap=document.createElement('div');wrap.className='track-header'+(this.selectedTrack===track.id?' selected':'');wrap.style.borderLeft='4px solid '+(track.type==='character'?(this.state.characters.find(c=>c.id===track.characterId)?.color||TYPE.character.color):TYPE[track.type].color);const icon=document.createElement('span');icon.className='track-icon';icon.textContent=TYPE[track.type].icon;const name=document.createElement('span');name.className='track-name';name.textContent=track.name;name.title=track.name;const mute=document.createElement('button');mute.className='track-mini'+(track.muted?' on':'');mute.textContent='M';mute.title='ミュート';mute.onclick=e=>{e.stopPropagation();track.muted=!track.muted;this.renderTrackHeaders();if(AudioEngine.playing)this.replay();};const solo=document.createElement('button');solo.className='track-mini'+(track.solo?' on':'');solo.textContent='S';solo.title='ソロ';solo.onclick=e=>{e.stopPropagation();track.solo=!track.solo;this.renderTrackHeaders();if(AudioEngine.playing)this.replay();};wrap.append(icon,name,mute,solo);wrap.onclick=()=>this.selectTrack(track.id);$('trackHeaders').append(wrap);}},
  renderClips(){const lanes=$('trackLanes');lanes.replaceChildren();for(const track of this.state.tracks){const row=document.createElement('div');row.className='track-lane';row.dataset.trackId=track.id;row.ondblclick=e=>{if(e.target===row){this.selectedTrack=track.id;this.trackModal();}};for(const clip of this.state.clips.filter(c=>c.trackId===track.id)){const media=this.state.media.find(m=>m.id===clip.mediaId),buffer=this.buffers.get(clip.mediaId);const node=document.createElement('div');node.className='clip'+(this.selectedClip===clip.id?' selected':'');node.dataset.clipId=clip.id;node.style.left=(clip.start*this.pxPerSecond)+'px';node.style.width=Math.max(5,clip.duration*this.pxPerSecond)+'px';node.style.background=media?.type==='character'?'#e9a545':media?.type==='sfx'?'#9abf5d':media?.type==='env'?'#79b6d9':'#ab88cd';node.title=`${media?.name||'音声'}\n${this.fmt(clip.start)} / ${this.fmt(clip.duration)}`;
      const canvas=document.createElement('canvas');node.append(canvas);if(buffer)this.drawWave(canvas,buffer,clip);const label=document.createElement('span');label.textContent=media?.name||'';node.append(label);for(const side of ['left','right']){const grip=document.createElement('i');grip.className='trim-handle '+side;grip.dataset.trim=side;node.append(grip);}node.addEventListener('pointerdown',e=>this.startClipDrag(e,clip,node));node.onclick=e=>{e.stopPropagation();this.selectClip(clip.id);};row.append(node);}lanes.append(row);}},
  drawWave(canvas,buffer,clip){const width=Math.min(2500,Math.max(16,Math.round(clip.duration*this.pxPerSecond))),height=38;canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');const data=buffer.getChannelData(0),sampleRate=buffer.sampleRate,base=Math.floor(clip.offset*sampleRate),end=Math.min(data.length,Math.floor((clip.offset+clip.duration)*sampleRate));ctx.strokeStyle='rgba(255,245,206,.93)';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<width;x++){const a=base+Math.floor((end-base)*x/width),b=base+Math.ceil((end-base)*(x+1)/width);let lo=0,hi=0;const stride=Math.max(1,Math.floor((b-a)/45));for(let i=a;i<b;i+=stride){const v=data[i]||0;if(v<lo)lo=v;if(v>hi)hi=v;}ctx.moveTo(x+.5,19-hi*16);ctx.lineTo(x+.5,19-lo*16);}ctx.stroke();},
  startClipDrag(event,clip,node){if(event.button!==0)return;event.stopPropagation();this.selectClip(clip.id);if(AudioEngine.playing)AudioEngine.stop();const trim=event.target.dataset.trim||'move',initial={start:clip.start,duration:clip.duration,offset:clip.offset,trackId:clip.trackId},startX=event.clientX;let changed=false;const move=e=>{const delta=(e.clientX-startX)/this.pxPerSecond;changed=true;if(trim==='move'){clip.start=Math.max(0,initial.start+delta);node.style.left=clip.start*this.pxPerSecond+'px';const r=document.elementFromPoint(e.clientX,e.clientY)?.closest('.track-lane');if(r)node.style.opacity=r.dataset.trackId!==clip.trackId?'.67':'1';}else if(trim==='left'){const shift=clamp(delta,Math.max(-initial.offset,-initial.start),initial.duration-.04);clip.start=Math.max(0,initial.start+shift);clip.offset=initial.offset+shift;clip.duration=initial.duration-shift;node.style.left=clip.start*this.pxPerSecond+'px';node.style.width=clip.duration*this.pxPerSecond+'px';}else{clip.duration=Math.max(.04,Math.min(initial.duration+delta,(this.buffers.get(clip.mediaId)?.duration||999)-clip.offset));node.style.width=clip.duration*this.pxPerSecond+'px';}};
    const up=e=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);if(changed&&trim==='move'){const row=document.elementFromPoint(e.clientX,e.clientY)?.closest('.track-lane');if(row){clip.trackId=row.dataset.trackId;this.selectedTrack=clip.trackId;}}this.renderTimeline();this.refreshFx();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);},
  rulerSeek(event){if(event.button!==0)return;event.preventDefault();const t=e=>clamp((e.clientX-$('timelineScroll').getBoundingClientRect().left+$('timelineScroll').scrollLeft)/this.pxPerSecond,0,Math.max(60,this.length()+15));AudioEngine.seek(t(event));const move=e=>{AudioEngine.seek(t(e));};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);},
  addMarker(type='normal',name=''){const time=clamp(this.state.playhead,0,Math.max(this.length(),0));if(type==='preview-start')this.state.previewStart=time;else if(type==='preview-end')this.state.previewEnd=time;else this.state.markers.push({id:uid(),time,name:name||`マーカー ${this.state.markers.length+1}`,type:'normal'});this.renderMarkers();this.toast(type==='normal'?'分割マーカーを追加しました。':(type==='preview-start'?'視聴開始マーカー':'視聴終了マーカー')+'を設定しました。');},
  markerModal(purpose='normal'){this.modal('マーカーを挿入',`<p>シークバー位置：<strong>${this.fmt(this.state.playhead)}</strong></p><label>マーカー名 <input id="markerName" placeholder="シーン名（省略可）"></label><p class="note">通常マーカー：書き出し時の分割位置。視聴マーカー：視聴用音声の開始／終了位置。</p>`,[{text:'通常マーカー',primary:purpose!=='preview',action:()=>{this.addMarker('normal',$('markerName').value);return true;}},{text:'視聴開始',primary:purpose==='preview',action:()=>{this.addMarker('preview-start');return true;}},{text:'視聴終了',action:()=>{this.addMarker('preview-end');return true;}}]);},
  renderMarkers(){const lane=$('markerLane');lane.replaceChildren();const make=(id,time,label,type)=>{const node=document.createElement('button');node.className='marker '+type;node.title=`${label} — ${this.fmt(time)}（ドラッグ移動、ダブルクリックで削除）`;node.style.left=time*this.pxPerSecond+'px';node.textContent=type==='normal'?'⚑':(type==='preview-start'?'IN':'OUT');node.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const startX=e.clientX,first=time;let moved=false;const move=ev=>{const t=clamp(first+(ev.clientX-startX)/this.pxPerSecond,0,this.length());moved=true;node.style.left=t*this.pxPerSecond+'px';if(type==='preview-start')this.state.previewStart=t;else if(type==='preview-end')this.state.previewEnd=t;else{const m=this.state.markers.find(m=>m.id===id);if(m)m.time=t;}};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);if(moved)this.renderMarkers();else AudioEngine.seek(first);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);};node.ondblclick=e=>{e.stopPropagation();if(type==='preview-start')this.state.previewStart=null;else if(type==='preview-end')this.state.previewEnd=null;else this.state.markers=this.state.markers.filter(m=>m.id!==id);this.renderMarkers();};lane.append(node);};for(const m of this.state.markers)make(m.id,m.time,m.name,'normal');if(this.state.previewStart!=null)make('ps',this.state.previewStart,'視聴開始','preview-start');if(this.state.previewEnd!=null)make('pe',this.state.previewEnd,'視聴終了','preview-end');if(this.state.previewStart!=null&&this.state.previewEnd!=null&&this.state.previewStart<this.state.previewEnd){const bg=document.createElement('div');bg.className='preview-region';bg.style.left=this.state.previewStart*this.pxPerSecond+'px';bg.style.width=(this.state.previewEnd-this.state.previewStart)*this.pxPerSecond+'px';bg.style.top='0';bg.style.bottom='0';bg.style.zIndex='0';lane.prepend(bg);}},
  markerManager(){const markers=[...this.state.markers.map(m=>({id:m.id,name:m.name,time:m.time,type:'normal'})),...(this.state.previewStart!=null?[{id:'ps',name:'視聴開始',time:this.state.previewStart,type:'preview-start'}]:[]),...(this.state.previewEnd!=null?[{id:'pe',name:'視聴終了',time:this.state.previewEnd,type:'preview-end'}]:[])].sort((a,b)=>a.time-b.time);const html=markers.map(m=>`<div class="menu-item"><strong>${escapeText(m.name)}</strong>　${this.fmt(m.time)} <button class="light-button" data-go-marker="${escapeText(m.id)}">移動</button> <button class="light-button" data-del-marker="${escapeText(m.id)}">削除</button></div>`).join('')||'<p>マーカーがありません。</p>';this.modal('マーカー管理',`<p>通常マーカーは音声分割、視聴開始・終了は試聴用書き出しに使用します。</p>${html}`,[{text:'閉じる',primary:true,action:()=>true},{text:'現在位置に追加',action:()=>{this.markerModal();return true;}}]);$('modalContent').querySelectorAll('[data-go-marker]').forEach(b=>b.onclick=()=>{const m=markers.find(x=>x.id===b.dataset.goMarker);if(m){AudioEngine.seek(m.time);$('modal').close();}});$('modalContent').querySelectorAll('[data-del-marker]').forEach(b=>b.onclick=()=>{const id=b.dataset.delMarker;if(id==='ps')this.state.previewStart=null;else if(id==='pe')this.state.previewEnd=null;else this.state.markers=this.state.markers.filter(x=>x.id!==id);this.renderMarkers();this.markerManager();});},
  refreshModes(){document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===this.state.playMode));},
  changeInspectorTab(tab){
    if(!['media','properties','effects','mixer'].includes(tab))tab='media';
    this.inspectorTab=tab;
    document.querySelectorAll('[data-inspector-tab]').forEach(b=>{const active=b.dataset.inspectorTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    for(const [kind,id] of Object.entries({media:'mediaTab',properties:'propertiesTab',effects:'effectsTab',mixer:'mixerTab'})){
      $(id).classList.toggle('hidden',kind!==tab);
    }
    if(tab==='properties'||tab==='effects'){this.fxTab=tab;this.refreshFx();}
    if(tab==='mixer')this.refreshMixer();
  },
  changeFxTab(tab,type){
    if(FX_KEYS.includes(type)&&type!==this.selectedFxType){this.selectedFxType=type;$('fxPreset').value='';}
    this.changeInspectorTab(tab==='properties'?'properties':'effects');
  },
  changeFxType(type){if(!FX_KEYS.includes(type))return;this.selectedFxType=type;$('fxPreset').value='';this.refreshFx();$('fxControls').scrollTop=0;},
  selectedFxTrack(){return this.state.tracks.find(t=>t.id===this.selectedTrack)||this.state.tracks[0]||null;},
  fxOptions(type=this.selectedFxType){if(!FX_KEYS.includes(type))return[];return[...(BUILTIN_FX_PRESETS[type]||[]),...this.userPresets.filter(p=>p.type===type)];},
  renderTrackSelect(element){const previous=element.value;element.replaceChildren();for(const tr of this.state.tracks){const o=document.createElement('option');o.value=tr.id;o.textContent=tr.name;element.append(o);}const tr=this.selectedFxTrack();element.value=tr?.id||previous;},
  renderPresetSelect(el,type){const selected=el.value;el.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent=`${FX_LABELS[type]}のプリセット`;el.append(blank);this.fxOptions(type).forEach((p,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=p.name;el.append(o);});el.value=selected!==''&&Number.isInteger(Number(selected))&&Number(selected)>=0&&Number(selected)<this.fxOptions(type).length?selected:'';},
  refreshFx(){
    this.renderTrackSelect($('effectTrack'));this.renderTrackSelect($('fxTrack'));
    this.renderPresetSelect($('effectPreset'),'eq');this.renderPresetSelect($('fxPreset'),this.selectedFxType);
    const tr=this.selectedFxTrack();$('effectTarget').textContent=tr?`対象：${tr.name}`:'トラックを追加してください';
    $('effectChain').replaceChildren();$('fxControls').replaceChildren();
    document.querySelectorAll('[data-fx-kind]').forEach(b=>{const active=b.dataset.fxKind===this.selectedFxType;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.classList.toggle('fx-disabled',!!tr&&!tr.effects?.[b.dataset.fxKind]?.enabled);});
    $('fxEditorTitle').textContent=FX_LABELS[this.selectedFxType];$('fxEditorHint').textContent=FX_HINTS[this.selectedFxType];
    $('fxEnabled').disabled=!tr;$('fxEnabled').checked=!!tr?.effects?.[this.selectedFxType]?.enabled;
    $('fxPreset').disabled=!tr;$('applyPreset').disabled=!tr;$('savePreset').disabled=!tr;
    $('effectPreset').disabled=!tr;
    if(!tr){this.drawEQ();$('clipProps').replaceChildren();return;}
    const labels=[['reverb','リバーブ'],['eq','イコライザー'],['compressor','コンプレッサー'],['limiter','リミッター']];
    for(const [key,label] of labels){const row=document.createElement('div');row.className='effect-row';
      const l=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!!tr.effects[key].enabled;
      check.onchange=()=>{tr.effects[key].enabled=check.checked;this.refreshFx();if(AudioEngine.playing)this.replay();};
      const s=document.createElement('span');s.textContent=`${label}（${this.effectCaption(tr,key)}）`;l.append(check,s);
      const b=document.createElement('button');b.textContent='設定 ›';b.title=`${label}の詳細設定`;b.setAttribute('aria-label',`${label}の設定を開く`);b.onclick=()=>this.changeFxTab('effects',key);
      row.append(l,b);$('effectChain').append(row);
    }
    this.renderFxControls(tr);this.drawEQ();this.refreshClipProps();
  },
  effectCaption(tr,key){const fx=tr.effects;switch(key){case'reverb':return`${Number(fx.reverb.size||1).toFixed(1)}秒`;case'eq':return fx.eq.highCut<5000?'音質調整':'5バンド';case'compressor':return`${fx.compressor.threshold} dB`;case'limiter':return`${fx.limiter.threshold} dB`;}return'';},
  renderFxControls(tr){
    const config={
      eq:[['eq.lowCut','ローカット',20,1500,10,'Hz'],['eq.highCut','ハイカット',500,20000,100,'Hz'],['eq.bands.0','120 Hz',-15,15,.5,'dB'],['eq.bands.1','400 Hz',-15,15,.5,'dB'],['eq.bands.2','1.2 kHz',-15,15,.5,'dB'],['eq.bands.3','3.5 kHz',-15,15,.5,'dB'],['eq.bands.4','8.5 kHz',-15,15,.5,'dB']],
      reverb:[['reverb.size','部屋の広さ・残響時間',.2,4,.1,'秒'],['reverb.wet','残響のかかり具合',0,.8,.01,'']],
      compressor:[['compressor.threshold','圧縮開始の音量（閾値）',-50,0,1,'dB'],['compressor.ratio','圧縮比率',1,12,.5,':1']],
      limiter:[['limiter.threshold','ピークの上限',-12,0,.5,'dB']]
    }[this.selectedFxType]||[];
    for(const [path,label,min,max,step,unit] of config){const keys=path.split('.');let value=tr.effects[keys[0]][keys[1]];if(keys[2]!==undefined)value=value[Number(keys[2])];
      const row=document.createElement('div');row.className='fx-control';const text=document.createElement('label');const title=document.createElement('span');title.textContent=label;
      const val=document.createElement('strong');const show=n=>n.toFixed(step===.01?2:step===.1||step===.5?1:0)+' '+unit;val.textContent=show(Number(value));text.append(title,val);
      const slider=document.createElement('input');slider.type='range';slider.min=min;slider.max=max;slider.step=step;slider.value=String(value);slider.disabled=!tr.effects[this.selectedFxType].enabled;
      slider.oninput=()=>{const n=Number(slider.value);if(keys[2]!==undefined)tr.effects[keys[0]][keys[1]][Number(keys[2])]=n;else tr.effects[keys[0]][keys[1]]=n;val.textContent=show(n);if(this.selectedFxType==='eq')this.drawEQ();};
      slider.onchange=()=>{if(AudioEngine.playing)this.replay();};row.append(text,slider);$('fxControls').append(row);
    }
  },
  drawEQ(){const canvas=$('eqCanvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#69402f';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#a77a5888';ctx.lineWidth=1;for(let i=0;i<=8;i++){const y=12+(h-25)*i/8;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}for(let i=0;i<=10;i++){const x=25+(w-50)*i/10;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    const tr=this.selectedFxTrack();const fx=tr?.effects?.eq;if(!fx)return;const freqs=[120,400,1200,3500,8500],bands=fx.bands||[0,0,0,0,0];const points=[];for(let i=0;i<=150;i++){const x=25+(w-50)*i/150,f=30*Math.pow(20000/30,i/150);let db=0;for(let j=0;j<5;j++){const d=Math.log2(f/freqs[j]);db+=(bands[j]||0)*Math.exp(-d*d/(j===0||j===4?3.5:1.3));}if(f<fx.lowCut)db-=Math.min(22,24*Math.log2(fx.lowCut/f));if(f>fx.highCut)db-=Math.min(22,24*Math.log2(f/fx.highCut));db=clamp(db,-18,18);points.push({x,y:h/2-db*(h-25)/36});}
    ctx.fillStyle='#ffcb6a25';ctx.beginPath();ctx.moveTo(points[0].x,h/2);for(const p of points)ctx.lineTo(p.x,p.y);ctx.lineTo(points[points.length-1].x,h/2);ctx.closePath();ctx.fill();ctx.beginPath();for(let i=0;i<points.length;i++){if(!i)ctx.moveTo(points[i].x,points[i].y);else ctx.lineTo(points[i].x,points[i].y);}ctx.strokeStyle=fx.enabled?'#ffd37c':'#ab9170';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#fff2d6';ctx.font='12px sans-serif';['60','120','250','500','1k','2k','4k','8k','16k'].forEach((t,i)=>ctx.fillText(t,8+i*(w-42)/8,h-4));},
  refreshClipProps(){const target=$('clipProps');target.replaceChildren();const clip=this.state.clips.find(c=>c.id===this.selectedClip);if(!clip){target.textContent='クリップを選択すると、ゲインとフェードを調整できます。';return;}const line=document.createElement('strong');line.textContent='クリップ：';target.append(line);for(const [key,label,step,min,max] of [['gainDb','音量(dB)',.5,-36,18],['fadeIn','IN(秒)',.1,0,30],['fadeOut','OUT(秒)',.1,0,30]]){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.value=clip[key]||0;input.onchange=()=>{clip[key]=clamp(Number(input.value)||0,min,key==='gainDb'?max:Math.min(max,clip.duration));if(AudioEngine.playing)this.replay();this.renderClips();};wrap.append(input);target.append(wrap);}const del=document.createElement('button');del.className='small-btn';del.textContent='クリップ削除';del.onclick=()=>this.deleteSelectedClip();target.append(del);},
  applyFxPreset(index,type=this.selectedFxType){
    if(index===''||index==null||!FX_KEYS.includes(type))return;
    const preset=this.fxOptions(type)[Number(index)],tr=this.selectedFxTrack();if(!preset||!tr)return;
    tr.effects[type]=normalizeFxSettings(type,preset.settings);
    this.refreshFx();if(AudioEngine.playing)this.replay();this.toast(`「${preset.name}」の${FX_LABELS[type]}設定を ${tr.name} に適用しました。`);
  },
  persistFxPresets(){try{localStorage.setItem('sound-owner-presets-v2',JSON.stringify(this.userPresets));return true;}catch(_){this.toast('ブラウザへの保存に失敗しました。JSONでバックアップしてください。',true);return false;}},
  saveFxPreset(){
    const track=this.selectedFxTrack(),type=this.selectedFxType;if(!track)return this.toast('トラックがありません。',true);
    this.modal(`${FX_LABELS[type]}のプリセットを登録`,`<label>プリセット名 <input id="presetNewName" placeholder="例：${type==='eq'?'ラジオ風ボイス':type==='reverb'?'広い洋館の廊下':type==='compressor'?'朗読用':'ピーク抑制'}" maxlength="50"></label><p class="note">保存するのは「${FX_LABELS[type]}」の設定のみです。他のエフェクトの設定は含まれません。ほかのプロジェクトでも再利用できます。</p>`,[{text:'キャンセル',action:()=>true},{text:'登録',primary:true,action:()=>{
      const name=$('presetNewName').value.trim();if(!name)return false;
      if(this.userPresets.some(p=>p.type===type&&p.name===name)&&!confirm(`「${name}」を上書きしますか？`))return false;
      this.userPresets=this.userPresets.filter(p=>!(p.type===type&&p.name===name));this.userPresets.push({type,name,settings:normalizeFxSettings(type,track.effects[type])});
      this.persistFxPresets();this.refreshFx();this.toast(`「${name}」を${FX_LABELS[type]}のプリセットに保存しました。`);return true;
    }}]);
  },
  exportFxPresets(){
    const groups=Object.fromEntries(FX_KEYS.map(type=>[type,this.userPresets.filter(p=>p.type===type).map(p=>({name:p.name,settings:clone(p.settings)}))]));
    const data={format:'SoundOwnerProEffects',version:2,groups};ExportEngine.download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'SoundOwnerPro_エフェクト別プリセット.json');
    this.toast(`${this.userPresets.length} 個のプリセットを種類別にJSON保存しました。`);
  },
  async importFxPresets(file){if(!file)return;try{
    const parsed=JSON.parse(await file.text());if(parsed.format!=='SoundOwnerProEffects')throw Error('プリセットJSONではありません。');
    let items=[];if(parsed.groups&&typeof parsed.groups==='object'){
      for(const type of FX_KEYS){if(!Array.isArray(parsed.groups[type]))continue;for(const item of parsed.groups[type])items.push({type,name:item.name,settings:item.settings});}
    }else if(Array.isArray(parsed.presets)){items=parsed.presets;}else throw Error('プリセットの種類が不正です。');
    const imported=migratePresetEntries(items);if(!imported.length)throw Error('有効なプリセットがありません。');
    for(const p of imported){this.userPresets=this.userPresets.filter(old=>!(old.type===p.type&&old.name===p.name));this.userPresets.push(p);}
    this.persistFxPresets();this.refreshFx();this.toast(`${imported.length} 個のエフェクト別プリセットを読み込みました。`);
  }catch(e){this.toast('プリセットの読み込みに失敗：'+e.message,true);}},
  refreshMixer(){const container=$('mixerGrid');container.replaceChildren();const channels=[...this.state.tracks.map(t=>({id:t.id,name:t.name,color:t.type==='character'?(this.state.characters.find(c=>c.id===t.characterId)?.color||TYPE.character.color):TYPE[t.type].color,db:t.gainDb,track:t})),{id:'master',name:'マスター',color:'#ffd478',db:this.state.masterDb,track:null}];for(const ch of channels){const el=document.createElement('div');el.className='channel';el.style.setProperty('--slider-color',ch.color);const name=document.createElement('div');name.className='channel-name';name.textContent=ch.name;name.title=ch.name;const range=document.createElement('input');range.type='range';range.min='-36';range.max='12';range.step='.5';range.value=ch.db;range.title=ch.name+' 音量';const val=document.createElement('div');val.className='channel-value';val.textContent=Number(ch.db).toFixed(1)+' dB';range.oninput=()=>{const db=Number(range.value);if(ch.track)ch.track.gainDb=db;else this.state.masterDb=db;val.textContent=db.toFixed(1)+' dB';};range.onchange=()=>{if(AudioEngine.playing)this.replay();};const meter=document.createElement('div');meter.className='channel-meter';const fill=document.createElement('b');fill.style.width=clamp(50+ch.db*2,0,100)+'%';meter.append(fill);el.append(name,range,val,meter);container.append(el);}},
  getSelectedExportCharacters(){return Array.from(this.exportCharacters);},
  refreshExportOptions(){const mode=$('exportMode').value;const showSelected=mode==='selectedCharacters';$('exportCharacterChecks').classList.toggle('hidden',!showSelected);$('previewOptions').classList.toggle('hidden',mode!=='preview');$('filenameRow').classList.toggle('hidden',mode==='preview');document.querySelectorAll('input[name="exportRange"]').forEach(r=>r.disabled=mode==='preview');if(mode==='preview')document.querySelector('input[name="exportRange"][value="full"]').checked=true;
    const box=$('exportCharacterChecks');box.replaceChildren();if(showSelected&&!this.exportCharacters.size)this.exportCharacters=new Set(this.state.characters.map(c=>c.id));for(const c of this.state.characters){const l=document.createElement('label');const inp=document.createElement('input');inp.type='checkbox';inp.checked=this.exportCharacters.has(c.id);inp.onchange=()=>{if(inp.checked)this.exportCharacters.add(c.id);else this.exportCharacters.delete(c.id);};l.append(inp,document.createTextNode(c.name));box.append(l);}this.setExportStatus('');},
  setExportStatus(text){$('exportStatus').textContent=text;},
  showFilenameEditor(){this.modal('分割音声のファイル名',`<p>通常マーカーで分割した音声に、上から順番に名前を割り当てます。各行の先頭には 001、002、003… が自動で付きます。</p><textarea id="filenameNames" placeholder="出会いのシーン&#10;雨の音&#10;エンディング">${escapeText(this.state.fileNames.join('\n'))}</textarea><p class="note">入力しない場合は連番のみで書き出します。キャラクター別の場合も同じ区間名を使用します。</p>`,[{text:'キャンセル',action:()=>true},{text:'保存',primary:true,action:()=>{this.state.fileNames=$('filenameNames').value.replace(/\r/g,'').split('\n');this.toast('音声名を保存しました。');return true;}}]);},
  showSettings(){this.modal('アプリ設定',`<label><input type="checkbox" id="loopPlayback" ${this.state.loop?'checked':''}> 再生終了時に先頭からループする</label><p class="note">タイムラインはドラッグで移動・トリミングできます。入力音声はWAVとMP3。書き出し時は44.1 kHz / 16bitステレオWAV、MP3は192 kbpsステレオです。</p><p class="note">音声はブラウザ内で処理します。プロジェクトJSONには音声素材がすべて含まれ、ファイルサイズが大きくなることがあります。</p>`,[{text:'キャンセル',action:()=>true},{text:'設定を保存',primary:true,action:()=>{this.state.loop=$('loopPlayback').checked;return true;}}]);},
  showHelp(){this.openNav('manual');},
  projectInfo(){this.modal('プロジェクト管理',`<p><strong>名前：</strong>${escapeText(this.state.projectName)}</p><p><strong>音声素材：</strong>${this.state.media.length} 件　<strong>トラック：</strong>${this.state.tracks.length} 件　<strong>クリップ：</strong>${this.state.clips.length} 件</p><p><strong>再生時間：</strong>${this.fmt(this.length())}</p><p class="note">保存形式：Sound Owner Pro専用JSON（音声データも格納）。別のブラウザ・PCでも読み込めます。</p>`,[{text:'閉じる',action:()=>true},{text:'JSONを保存',primary:true,action:()=>{this.saveProject();return true;}}]);},
  readAsDataURL(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error);fr.readAsDataURL(file);});},
  async saveProject(){try{this.toast('音声を含むプロジェクトJSONを作成します。');const assets={};for(const media of this.state.media){const raw=this.rawFiles.get(media.id);if(!raw){this.toast(`音声データがありません：${media.name}`,true);continue;}assets[media.id]={name:media.name,mime:media.mime,data:await this.readAsDataURL(raw)};}
      const packed={format:'SoundOwnerProProject',version:1,savedAt:new Date().toISOString(),state:{...this.state,playhead:0},assets};const blob=new Blob([JSON.stringify(packed)],{type:'application/json'});ExportEngine.download(blob,`${ExportEngine.clean(this.state.projectName||'project')}.soundowner.json`);try{await this.rememberProject(packed,blob);this.toast('プロジェクトJSONを保存し、ライブラリに登録しました。');}catch(storageError){console.warn(storageError);this.toast('JSONは保存しましたが、ブラウザ履歴には登録できませんでした。保存容量・プライベートモードをご確認ください。',true);}if(this.currentView!=='edit')await this.refreshDashboard();}catch(e){console.error(e);this.toast('保存に失敗：'+e.message,true);}},
  dataUrlToBlob(url){const parts=url.split(','),type=/^data:([^;,]+)/.exec(parts[0])?.[1]||'audio/wav',raw=atob(parts[1]||'');const chunkSize=32768,arr=[];for(let i=0;i<raw.length;i+=chunkSize){const s=raw.slice(i,i+chunkSize),b=new Uint8Array(s.length);for(let j=0;j<s.length;j++)b[j]=s.charCodeAt(j);arr.push(b);}return new Blob(arr,{type});},
  async loadProject(file,{remember=true}={}){if(!file)return;try{const result=JSON.parse(await file.text());if(result.format!=='SoundOwnerProProject'||!result.state||!result.assets)throw Error('Sound Owner ProのプロジェクトJSONではありません。');const s=result.state;if(!Array.isArray(s.tracks)||!Array.isArray(s.media)||!Array.isArray(s.clips))throw Error('プロジェクトデータが破損しています。');AudioEngine.stop();AudioEngine.stopPreview();const restored={...emptyState(),...s,projectId:s.projectId||uid(),playhead:0};const files=new Map(),buffers=new Map(),ctx=await AudioEngine.ensure();for(const media of restored.media){const item=result.assets[media.id];if(!item?.data)throw Error(`「${media.name}」の音声データが見つかりません。`);const blob=this.dataUrlToBlob(item.data);const ab=await blob.arrayBuffer(),buffer=await ctx.decodeAudioData(ab.slice(0));files.set(media.id,blob);buffers.set(media.id,buffer);media.duration=buffer.duration;}
      this.state=restored;this.buffers=buffers;this.rawFiles=files;this.selectedClip=null;this.selectedTrack=null;this.mediaFolder='すべて';this.exportCharacters=new Set();this.renderAll();this.openNav('edit');if(remember){try{await this.rememberProject({...result,state:restored},new Blob([JSON.stringify(result)],{type:'application/json'}));}catch(storageError){console.warn('ブラウザの履歴に登録できませんでした',storageError);}}else{try{const record=await this.recentDb('get',restored.projectId);if(record)await this.recentDb('put',{...record,updatedAt:Date.now()});}catch(_){}}this.toast(`プロジェクトを開きました（素材 ${restored.media.length} 件）。`);}catch(e){console.error(e);this.toast('プロジェクト読み込み失敗：'+e.message,true);}},
};
window.addEventListener('DOMContentLoaded',()=>App.init());
