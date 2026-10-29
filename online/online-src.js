// ===================== ONLINE-DUELL =====================
// Wird von online/build.py in eine Kopie der App eingesetzt (online.html). index.html bleibt unverändert.
const WS_BASE="wss://flugduell-proxy.hendrik-bollinger.workers.dev/room/";
const OKEY="flugduell-online-v1";
const O={pid:null,name:"",code:null,ws:null,st:null,online:[],conn:"idle",retry:0,rt:null,creating:false,pending:null,
  leaving:false,searching:false,showFinal:false,screen:"home",err:"",joinCode:"",newCat:"all",newRounds:10,copied:false};
function oLoad(){try{const x=JSON.parse(localStorage.getItem(OKEY))||{};Object.assign(O,{pid:x.pid,name:x.name||"",code:x.code||null,newCat:x.newCat||"all",newRounds:x.newRounds??10});}catch(e){}
  if(!O.pid)O.pid=Math.random().toString(36).slice(2,10).padEnd(8,"x");}
function oSave(){try{localStorage.setItem(OKEY,JSON.stringify({pid:O.pid,name:O.name,code:O.code,newCat:O.newCat,newRounds:O.newRounds}));}catch(e){}}
const CODE_CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode=()=>Array.from({length:4},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join("");
const nameOf=seat=>{const p=O.st&&O.st.players.find(x=>x.seat===seat);return p?p.name:(seat==="p1"?"Player 1":"Player 2");};
const otherSeat=()=>O.st&&O.st.me==="p1"?"p2":"p1";

// ---------- Verbindung ----------
function send(m){if(O.ws&&O.ws.readyState===1){O.ws.send(JSON.stringify(m));return true;}connect();return false;}
function connect(){
  if(!O.code)return;clearTimeout(O.rt);
  if(O.ws&&(O.ws.readyState===0||O.ws.readyState===1))return;
  let ws;try{ws=new WebSocket(WS_BASE+O.code);}catch(e){O.conn="closed";return;}
  O.ws=ws;O.conn="connecting";O.leaving=false;
  ws.onopen=()=>{if(O.ws!==ws)return;O.conn="open";O.retry=0;
    ws.send(JSON.stringify({t:"hello",pid:O.pid,name:O.name,create:O.creating,code:O.code}));if(phase!=="menu")render();};
  ws.onmessage=e=>{if(O.ws!==ws)return;let m;try{m=JSON.parse(e.data);}catch(x){return;}
    if(m.t==="state"){
      if(O.creating){O.creating=false;if(O.pending){ws.send(JSON.stringify({t:"settings",...O.pending}));O.pending=null;}}
      O.st=m.s;O.online=m.online||[];O.err="";onState();}
    else if(m.t==="error")onErr(m.err);};
  ws.onclose=()=>{if(O.ws!==ws)return;O.ws=null;O.conn="closed";
    if(O.code&&!O.leaving){O.retry=Math.min(O.retry+1,6);O.rt=setTimeout(connect,Math.min(800*2**O.retry,15000));if(phase!=="menu")render();}};
}
setInterval(()=>{if(O.ws&&O.ws.readyState===1)O.ws.send('{"t":"ping"}');},25000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&O.code&&(!O.ws||O.ws.readyState>1))connect();});
window.addEventListener("online",()=>{if(O.code)connect();});
function onErr(err){
  if(err==="notfound"||err==="full"){O.err=err==="full"?"Der Raum ist schon voll. Zu zweit, nicht zu dritt.":"Raum nicht gefunden. Prüf den Code oder lass dir einen neuen Link schicken.";
    O.leaving=true;try{O.ws&&O.ws.close(1000,"bye");}catch(e){}O.ws=null;O.code=null;O.st=null;S.game=null;O.screen="home";oSave();phase="menu";render();}
}
function leaveRoom(){send({t:"leave"});O.leaving=true;try{O.ws&&O.ws.close(1000,"bye");}catch(e){}O.ws=null;O.code=null;O.st=null;S.game=null;O.screen="home";O.showFinal=false;oSave();phase="menu";render();}

// ---------- Serverzustand → Spielobjekt der App ----------
function syncGame(){
  const st=O.st;if(!st){S.game=null;return;}
  const prev=S.game;
  const g={mode:"duo",online:true,cat:st.settings.cat,area:"world",rounds:st.settings.rounds,players:[nameOf("p1"),nameOf("p2")],
    history:st.history.map(h=>({...h})),round:null,finished:false};
  if(st.round){const r=st.round,f=r.flight,keep=prev&&prev.round&&prev.round.hex===f.hex?prev.round:null;
    const guess={},mode={},raw={};
    for(const seat of ["p1","p2"]){const x=r.guesses[seat];guess[seat]=x?(x.hidden?"•":x.model):null;mode[seat]=r.opts&&r.opts[seat]?"mc":"text";if(x&&x.raw)raw[seat]=x.raw;}
    if(r.revealed&&st.history.length)Object.assign(raw,st.history.at(-1).raw||{});
    g.round={...f,options:(r.opts&&r.opts[O.st.me])||null,guess,mode,raw,draft:keep?keep.draft:{},revealed:r.revealed,
      trail:keep?keep.trail:[[f.ac.lat,f.ac.lon,f.ac.alt_baro]],me:null,traceNote:""};
    if(!keep&&f.ac&&f.ac.lat!=null){live=f.ac;lastOk=Date.now();}}
  S.game=g;
}
function derivePhase(){
  if(O.screen!=="room"||!O.code)return "menu";
  if(!O.st)return "room";
  const p=O.st.phase;
  if(p==="lobby")return "room";
  if(p==="search")return "loading";
  if(p==="searchfail")return "error";
  if(p==="reveal"&&O.st.over&&O.showFinal)return "final";
  return "game";
}
const TAKEOVER=25000;
// Wartet der andere auf eine Suche, zählt der Übernehmen-Knopf herunter
setInterval(()=>{if(phase==="loading"&&O.st&&!O.st.searcherIsMe)render();},1000);
function onState(){
  if(O.st.phase==="search"){if(O.searchKey!==O.st.searchSince){O.searchKey=O.st.searchSince;O.searchSeen=Date.now();}}else O.searchKey=null;
  if(O.st.phase==="lobby")O.showFinal=false;
  const before=phase,beforeHex=S.game&&S.game.round?S.game.round.hex:null;
  syncGame();
  // Hat der andere die Suche übernommen oder ist sie beendet, eigene Suche sofort stoppen
  if(O.searching&&!(O.st.phase==="search"&&O.st.searcherIsMe)){if(searchCtl)searchCtl.cancelled=true;O.searching=false;}
  if(O.st.phase==="search"&&O.st.searcherIsMe&&!O.searching)doSearch();
  const p=derivePhase();
  // Tippt der Spieler gerade, nur Gegner-Karte und Leiste auffrischen, damit die Tastatur nicht zuklappt
  const ae=document.activeElement,typing=ae&&ae.id&&ae.id.startsWith("in-");
  if(typing&&p==="game"&&before==="game"&&S.game.round&&S.game.round.hex===beforeHex&&!S.game.round.revealed){paintOpponent();guessDock(S.game.round);return;}
  phase=p;render();
  if(phase==="game")poll();
}

// ---------- Flug suchen (nur der vom Server bestimmte Spieler) ----------
// Schnelle Suche: je zwei Regionen parallel, kurze Zeitlimits, Routen zwischengespeichert, harte Obergrenze 40 s
const SEARCH_LIMIT=40000,routeCache={};
async function routeQuick(cs){
  if(cs in routeCache)return routeCache[cs];
  let r=null;
  try{const d=await getJSON(viaProxy("https://api.adsbdb.com/v0/callsign/"+cs),6000);const f=d.response&&d.response.flightroute;
    if(f){const m=a=>({icao:a.icao_code,iata:a.iata_code,name:a.name,location:a.municipality,lat:a.latitude,lon:a.longitude});r={callsign:cs,_airports:[m(f.origin),m(f.destination)]};}
    routeCache[cs]=r;}catch(e){/* bei Netzfehler nicht merken */}
  return r;
}
async function searchRegion(la,lo,cat,exclude,recent,deadline,ctl){
  let data=null;
  for(let i=0;i<2&&!data;i++){if(Date.now()>deadline||ctl.cancelled)return null;
    try{const d=await getJSON(viaProxy(SRC.area(la,lo,250)),Math.min(i?9000:7000,Math.max(1500,deadline-Date.now())));data=d.ac||[];netFails=0;}
    catch(e){note(`Region ${la},${lo}: ${errTxt(e)}`);if(!e.status)netFails++;else if(e.status!==429&&e.status<500)return null;}}
  if(!data||ctl.cancelled)return null;
  const cands=varietyPick(data.filter(a=>isCandidate(a,cat,12000)).filter(a=>!exclude.has(a.hex)),recent,null,6);
  note(`Region ${la},${lo}: ${data.length} Flugzeuge, ${cands.length} Kandidaten`);
  if(!cands.length)return null;
  // Routen parallel prüfen, der erste passende Kandidat gewinnt
  return await new Promise(res=>{let left=cands.length;
    cands.forEach(async ac=>{let hit=null;
      try{const cs=parseCs(ac).cs,rt=await routeQuick(cs);
        if(rt){const leg=legFor(rt,[ac.lat,ac.lon]);
          if(leg){const total=dist([leg.o.lat,leg.o.lon],[leg.d.lat,leg.d.lon]);
            if(total>=150&&leg.dev<=Math.max(250,total*.25)&&dist([ac.lat,ac.lon],[leg.d.lat,leg.d.lon])>=120)
              hit={hex:ac.hex,cs,al:parseCs(ac).al,type:ac.t,reg:ac.r||"",o:leg.o,d:leg.d,ac};}}}catch(e){}
      if(hit){left=-99;res(hit);}else if(--left===0)res(null);});});
}
async function findFlightFast(exclude,cat,ctl){
  const start=Date.now(),deadline=start+SEARCH_LIMIT,recent=(G()&&G().history||[]).slice(-6);
  const pool=[...(cat==="long"?LONG_REGIONS:REGIONS)].sort(()=>Math.random()-.5);
  netDown=false;netFails=0;
  const timer=setInterval(()=>!ctl.cancelled&&setStatus(`Radar läuft … ${Math.round((Date.now()-start)/1000)} s`),1000);
  try{
    for(let i=0;i<pool.length&&Date.now()<deadline&&!ctl.cancelled;i+=2){
      const wave=pool.slice(i,i+2).map(([la,lo])=>searchRegion(la,lo,cat,exclude,recent,deadline,ctl));
      const found=await new Promise(res=>{let left=wave.length;wave.forEach(p=>p.then(f=>{if(f){left=-99;res(f);}else if(--left===0)res(null);}).catch(()=>{if(--left===0)res(null);}));});
      if(found)return ctl.cancelled?null:found;
      if(!navigator.onLine){netDown=true;return null;}
    }
  }finally{clearInterval(timer);}
  if(netFails>0)netDown=true;
  return null;
}
async function doSearch(){
  // Jede Suche hat ihren eigenen Abbruch-Schalter; eine ältere Suche kann nie mehr einen Flug melden
  if(searchCtl)searchCtl.cancelled=true;
  const ctl={cancelled:false};searchCtl=ctl;O.searching=true;DIAG=[];
  const key=O.st.searchSince,recent=new Set((G()?G().history:[]).map(h=>h.hex));
  let f=null;
  try{f=await findFlightFast(recent,O.st.settings.cat,ctl);}catch(e){note("Fehler: "+e.message);}
  if(ctl.cancelled)return;
  O.searching=false;
  if(!O.st||O.st.searchSince!==key)return;
  if(!O.st||O.st.phase!=="search"||!O.st.searcherIsMe)return;
  if(!f){send({t:"fail",msg:netDown?"Die Verbindung war zu schwach, um Live-Daten zu laden.":"Gerade passte kein Flug zu euren Einstellungen."});return;}
  const a=f.ac;
  send({t:"found",flight:{hex:f.hex,cs:f.cs,al:f.al,type:f.type,model:TYPE[f.type],reg:f.reg,o:f.o,d:f.d,
    ac:{lat:a.lat,lon:a.lon,alt_baro:a.alt_baro,gs:a.gs,track:a.track,baro_rate:a.baro_rate}}});
}

// ---------- Spielaktionen gehen an den Server ----------
newRound=function(){send({t:"next"});};
startGame=function(){O.showFinal=false;send({t:"rematch"});};
reveal=function(){send({t:"reveal"});};
unlock=function(pid){send({t:"unguess"});};
pickOption=function(pid,t){send({t:"guess",model:t});};
lockText=function(pid){
  const inp=document.getElementById("in-"+pid),raw=inp?inp.value:"",m=normalize(raw);
  if(!m){const e=document.getElementById("err-"+pid);if(e){e.textContent="Typ nicht erkannt. Beispiele: A330, B787, B77W";e.hidden=false;}return;}
  if(inp)inp.blur();
  send({t:"guess",model:m,raw:raw.trim(),exact:exactSub(raw,G().round.type)});
};
drawOptions=function(){
  const r=G().round,model=TYPE[r.type],total=dist([r.o.lat,r.o.lon],[r.d.lat,r.d.lon]);
  let pool=fleetIn(r.al,G().cat);if(pool.length<3)pool=AL[r.al][1];
  const fleet=pool.filter(t=>t!==model),fits=t=>total>=RANGE[t][0]&&total<=RANGE[t][1],near=t=>Math.abs(RANGE[t][1]-total);
  const others=[...fleet.filter(fits).sort(()=>Math.random()-.5),...fleet.filter(t=>!fits(t)).sort((a,b)=>near(a)-near(b))].slice(0,2);
  send({t:"options",options:[model,...others].sort(()=>Math.random()-.5)});
};

// ---------- Darstellung ----------
const _renderVerdict=renderVerdict;
renderVerdict=function(below,r){
  _renderVerdict(below,r);
  if(isOver())dock([btn("cta","Ergebnis ansehen",()=>{O.showFinal=true;phase="final";render();})]);
  else dock([btn("cta","Nächster Flug",newRound)]);
};
const _renderFinal=renderFinal;
renderFinal=function(below){
  _renderFinal(below);
  dock([btn("sec","Menü",()=>{phase="menu";render();}),btn("cta","Revanche",startGame)]);
};
function oppCard(r){
  const seat=otherSeat(),i=seat==="p1"?0:1,on=O.online.includes(seat),done=!!r.guess[seat];
  const el=$(`<section class="panel gc" id="gc-${seat}" style="--c:${PCOL[i]};--cs:${PSOFT[i]}"><div class="who"><i></i><span>${esc(nameOf(seat))}</span></div></section>`);
  el.appendChild(done?$(`<div class="sealed"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Tipp abgegeben</div>`)
    :$(`<div class="waiting"><span class="wd"></span><span class="wd"></span><span class="wd"></span><b>${on?"tippt noch …":"nicht verbunden"}</b></div>`));
  return el;
}
function paintOpponent(){const r=G()&&G().round,old=document.getElementById("gc-"+otherSeat());if(r&&old)old.replaceWith(oppCard(r));}
function guessDock(r){
  const me=O.st.me,mine=!!r.guess[me],theirs=!!r.guess[otherSeat()],other=nameOf(otherSeat());
  if(!mine)dock([btn("cta",theirs?`${esc(other)} hat getippt – du bist dran`:"Dein Tipp fehlt",null,true)]);
  else dock([btn("sec","Ohne Tipp auflösen",reveal),btn("cta",`Warte auf ${esc(other)} …`,null,true)]);
}
function renderOGuesses(below,r){
  const me=O.st.me,mi=me==="p1"?0:1;
  const gh=$(`<div class="ghead"><span class="cap">Eure Tipps</span></div>`);
  gh.appendChild(btn("pill",r.options?"Deine Auswahl aktiv":"3 Typen zeigen",drawOptions,!!r.options||!!r.guess[me]));below.appendChild(gh);
  const box=$(`<div class="guesses"></div>`);
  const el=$(`<section class="panel gc" id="gc-${me}" style="--c:${PCOL[mi]};--cs:${PSOFT[mi]}"><div class="who"><i></i><span>${esc(nameOf(me))} (du)</span></div></section>`);
  if(r.guess[me]){el.appendChild($(`<div class="sealed"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>${esc(disp(r.guess[me]))}</div>`));el.appendChild(btn("undo","Ändern",()=>unlock(me)));}
  else if(r.mode[me]==="mc"&&r.options){for(const t of r.options)el.appendChild(btn("choice",disp(t),()=>pickOption(me,t)));}
  else{const inp=$(`<input id="in-${me}" type="text" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" placeholder="Typ" aria-label="Dein Tipp">`);
    inp.value=r.draft[me]||"";inp.oninput=()=>{r.draft[me]=inp.value;};inp.onkeydown=e=>{if(e.key==="Enter")lockText(me)};
    el.appendChild(inp);el.appendChild($(`<span class="err" id="err-${me}" hidden></span>`));el.appendChild(btn("lock","Abgeben",()=>lockText(me)));}
  const opp=oppCard(r);
  if(me==="p1")box.append(el,opp);else box.append(opp,el);
  below.appendChild(box);guessDock(r);
}
function connBanner(root){
  if(O.code&&O.conn!=="open")root.appendChild($(`<div class="obanner"><span class="wd"></span>${O.conn==="connecting"&&O.retry===0?"Verbinde mit dem Raum …":"Verbindung unterbrochen – verbinde neu …"}</div>`));
  else if(O.st&&O.st.players.length===2&&O.online.length<2&&phase!=="room")root.appendChild($(`<div class="obanner off">${esc(nameOf(otherSeat()))} ist gerade nicht verbunden</div>`));
}
renderInner=function(){
  const root=document.getElementById("root"),below=document.getElementById("below");root.innerHTML="";below.innerHTML="";
  if(phase==="menu"){O.screen="home";showMap(false);renderOHome(root);return;}
  if(phase==="room"||!O.st||!G()){showMap(false);renderORoom(root);return;}
  renderHead(root);
  const back=root.querySelector(".back");if(back)back.onclick=()=>{phase="menu";render();};
  connBanner(root);
  if(phase==="loading"){showMap(false);
    const mine=O.st.searcherIsMe,age=Date.now()-(O.searchSeen||Date.now());
    below.appendChild($(`<section class="panel wait"><div class="scope"></div><b id="status">${mine?"Radar läuft …":esc(nameOf(O.st.searcherSeat))+" sucht einen Flug …"}</b><span>Gleich seht ihr beide denselben Live-Flug</span></section>`));
    if(mine)dock([btn("sec","Suche abbrechen",()=>{if(searchCtl)searchCtl.cancelled=true;O.searching=false;send({t:"fail",msg:"Die Suche wurde abgebrochen."});})]);
    else dock([btn("sec",age>=TAKEOVER?"Selbst suchen":`Selbst suchen (in ${Math.ceil((TAKEOVER-age)/1000)} s)`,()=>send({t:"next"}),age<TAKEOVER)]);
    return;}
  if(phase==="error"){showMap(false);
    const box=$(`<section class="panel problem"><b>Kein Flug gefunden</b><span>${esc(O.st.failMsg||"Gerade passte kein Flug.")} Einer von euch kann es einfach nochmal versuchen.</span></section>`);
    if(DIAG.length){box.appendChild($(`<details class="det"><summary>Technische Details</summary><div class="diag">${esc(DIAG.join("\n"))}</div></details>`));}
    below.appendChild(box);dock([btn("cta","Nochmal suchen",newRound)]);return;}
  if(phase==="final"){showMap(false);renderFinal(below);return;}
  const r=G().round;if(!r){dock([btn("cta","Flug ziehen",newRound)]);return;}
  if(r.revealed){renderVerdict(root,r);showMap(true);renderFlight(below,r);}
  else{showMap(true);renderFlight(below,r);renderOGuesses(below,r);}
  tick();
};
function renderOHome(root){
  root.appendChild($(`<div class="brand"><div class="logo"><svg width="18" height="18" viewBox="0 0 24 24">${PLANE_PATH}</svg>Flugduell</div><div class="status"><i></i>Online</div></div>`));
  root.appendChild($(`<div class="hero2">${RADAR}<span class="cap" style="position:relative;z-index:1">Online-Duell · Beta</span><h1 style="margin-top:8px">Duell auf <em>Distanz</em>.</h1><p class="sub">Zwei Handys, derselbe Live-Flug. Ihr tippt verdeckt, aufgelöst wird bei beiden gleichzeitig.</p></div>`));
  if(O.err)root.appendChild($(`<section class="panel problem" style="padding:14px 16px"><b>${esc(O.err)}</b></section>`));
  if(O.code){const card=$(`<section class="panel rcard"></section>`);
    const b=$(`<button type="button" class="rmain"><div><b>Raum ${esc(O.code)}</b><div class="s">${O.st&&O.st.players.length===2?esc(nameOf("p1"))+" vs "+esc(nameOf("p2")):"Warte auf Mitspieler"}</div></div><span class="go">Zurück →</span></button>`);
    b.onclick=()=>{O.screen="room";O.err="";phase=derivePhase();render();connect();};
    const x=btn("rx",`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,leaveRoom);x.setAttribute("aria-label","Raum verlassen");
    card.append(b,x);root.appendChild(card);}
  const ng=$(`<div class="group"><div class="cap">Dein Name</div></div>`),nl=$(`<div class="panel list"></div>`);
  const nr=$(`<label class="name-row" style="--c:var(--p1)"><i></i><input id="oname" maxlength="16" autocomplete="off" autocapitalize="words" placeholder="Wie heißt du?" aria-label="Dein Name"></label>`);
  const ni=nr.querySelector("input");ni.value=O.name;ni.oninput=()=>{O.name=ni.value.trim();oSave();if(O.code)send({t:"rename",name:O.name});};
  nl.appendChild(nr);ng.appendChild(nl);root.appendChild(ng);
  const cg=$(`<div class="group"><div class="cap">Neuen Raum erstellen</div></div>`),cb=$(`<section class="panel setbox"></section>`);
  cb.appendChild(segRow("Flugzeuge",[["long","Lang"],["short","Kurz & Mittel"],["all","Alle"]],O.newCat,v=>{O.newCat=v;oSave();render();}));
  cb.appendChild(segRow("Runden",[[5,"5"],[10,"10"],[15,"15"],[0,"Endlos"]],O.newRounds,v=>{O.newRounds=v;oSave();render();}));
  const go=btn("obtn","Raum erstellen",()=>{if(!needName())return;O.code=newCode();O.creating=true;O.pending={cat:O.newCat,rounds:O.newRounds};
    O.st=null;S.game=null;O.screen="room";O.err="";O.showFinal=false;oSave();try{O.ws&&O.ws.close(1000,"bye");}catch(e){}O.ws=null;connect();phase="room";render();});
  cb.appendChild(go);cg.appendChild(cb);root.appendChild(cg);
  const jg=$(`<div class="group"><div class="cap">Raum beitreten</div></div>`),jb=$(`<section class="panel ojoin"></section>`);
  const ji=$(`<input id="ocode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" aria-label="Raumcode">`);ji.value=O.joinCode;
  ji.oninput=()=>{ji.value=ji.value.toUpperCase().replace(/[^A-Z0-9]/g,"");O.joinCode=ji.value;};
  const jbtn=btn("obtn","Beitreten",()=>{if(!needName())return;const c=(O.joinCode||"").toUpperCase();if(!/^[A-Z0-9]{4}$/.test(c)){ji.focus();return;}
    if(O.code&&O.code!==c)send({t:"leave"});O.code=c;O.creating=false;O.st=null;S.game=null;O.screen="room";O.err="";O.showFinal=false;oSave();try{O.ws&&O.ws.close(1000,"bye");}catch(e){}O.ws=null;connect();phase="room";render();});
  jb.append(ji,jbtn);jg.appendChild(jb);root.appendChild(jg);
  root.appendChild($(`<a class="lastset" href="./" style="text-decoration:none;margin-top:8px">← Zur Solo- & 1-vs-1-App</a>`));
  dock([]);
}
function needName(){if(O.name)return true;const i=document.getElementById("oname");if(i){i.focus();i.closest(".panel").classList.add("shake");setTimeout(()=>i.closest(".panel").classList.remove("shake"),500);}return false;}
function renderORoom(root){
  const bar=$(`<div class="bar"></div>`);bar.appendChild(btn("back",BACK+"Zurück",()=>{phase="menu";render();}));
  bar.appendChild($(`<span class="tag">Online-Raum</span>`));root.appendChild(bar);
  connBanner(root);
  const st=O.st;
  root.appendChild($(`<div class="hero2"><span class="cap">Raumcode</span><div class="bigcode">${esc(O.code||"")}</div><p class="sub">Schick deinem Mitspieler den Link oder den Code. Er öffnet ihn, gibt seinen Namen ein und ist drin.</p></div>`));
  const url=location.origin+location.pathname+"#"+O.code;
  const sh=btn("obtn sec2",O.copied?"Link kopiert ✓":"Einladung teilen",async()=>{
    const text=`Lass uns Flugduell spielen! Raum ${O.code}: ${url}`;
    try{if(navigator.share){await navigator.share({title:"Flugduell",text:`Lass uns Flugduell spielen! Raum ${O.code}`,url});return;}}catch(e){if(e&&e.name==="AbortError")return;}
    try{await navigator.clipboard.writeText(text);O.copied=true;render();setTimeout(()=>{O.copied=false;if(phase==="room")render();},2500);}catch(e){const u=document.getElementById("olink");if(u){const rg=document.createRange();rg.selectNodeContents(u);const sl=getSelection();sl.removeAllRanges();sl.addRange(rg);}}
  });
  root.appendChild(sh);
  root.appendChild($(`<div class="lastset" id="olink" style="user-select:all;-webkit-user-select:all">${esc(url)}</div>`));
  const pl=$(`<div class="group"><div class="cap">Spieler</div></div>`),pb=$(`<div class="panel list"></div>`);
  ["p1","p2"].forEach((seat,i)=>{const p=st&&st.players.find(x=>x.seat===seat),on=O.online.includes(seat);
    pb.appendChild($(`<div class="prow" style="--c:${PCOL[i]}"><span class="av">${p?esc((p.name[0]||"?").toUpperCase()):"?"}</span><div><b>${p?esc(p.name):"Noch frei"}</b>${p&&st.me===seat?" <span class='you'>du</span>":""}${p&&st.hostSeat===seat?" <span class='you'>Host</span>":""}<div class="s">${p?(on?"verbunden":"nicht verbunden"):"Warte auf Mitspieler …"}</div></div><span class="odot ${p&&on?"on":""}"></span></div>`));});
  pl.appendChild(pb);root.appendChild(pl);
  if(st){
    const sg=$(`<div class="group"><div class="cap">Einstellungen</div></div>`),sb=$(`<section class="panel setbox"></section>`);
    if(st.isHost){
      sb.appendChild(segRow("Flugzeuge",[["long","Lang"],["short","Kurz & Mittel"],["all","Alle"]],st.settings.cat,v=>send({t:"settings",cat:v,rounds:st.settings.rounds})));
      sb.appendChild(segRow("Runden",[[5,"5"],[10,"10"],[15,"15"],[0,"Endlos"]],[5,10,15,0].includes(st.settings.rounds)?st.settings.rounds:null,v=>send({t:"settings",cat:st.settings.cat,rounds:v})));
    }else sb.appendChild($(`<div class="hintline" style="padding:14px 2px 2px">${esc(CAT_SHORT[st.settings.cat])} · ${st.settings.rounds?st.settings.rounds+" Runden":"Endlos"}<br>Die Einstellungen legt ${esc(nameOf(st.hostSeat))} fest.</div>`));
    sg.appendChild(sb);root.appendChild(sg);}
  const two=st&&st.players.length===2;
  if(!st)dock([btn("cta","Verbinde …",null,true)]);
  else if(st.isHost)dock([btn("cta",two?"Spiel starten":"Warte auf Mitspieler …",()=>send({t:"next"}),!two)]);
  else dock([btn("cta",`Warte auf Start durch ${esc(nameOf(st.hostSeat))} …`,null,true)]);
}

// ---------- Start ----------
oLoad();load();
{const m=(location.hash||"").replace("#","").toUpperCase();
  if(/^[A-Z0-9]{4}$/.test(m)){if(m===O.code){O.screen="room";}else{O.joinCode=m;}history.replaceState(null,"",location.pathname);}}
if(O.code){O.screen="room";connect();}
phase=derivePhase();
render();
