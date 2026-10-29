"""Einmaliges Zusammenführen: Online-Duell (online-src.js + online.css) wird Teil von index.html.
Solo-Spielstände bleiben unter demselben Schlüssel; Online nutzt ein eigenes Spielobjekt (O.game)."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / "index.html").read_text()
js = (root / "online" / "online-src.js").read_text()
css = (root / "online" / "online.css").read_text()

def rep(text, a, b, n=1):
    assert text.count(a) == n, (text.count(a), a[:70])
    return text.replace(a, b)

# ---------- Online-Modul anpassen ----------
js = js[:js.index("// ---------- Start ----------")]
js = rep(js, "// Wird von online/build.py in eine Kopie der App eingesetzt (online.html). index.html bleibt unverändert.\n",
         "// Teil der Haupt-App. Eigener Spielstand (O.game), eigener Speicher (flugduell-online-v1); Solo-Daten bleiben unberührt.\nconst onl={};\n")
js = rep(js, "const O={pid:null,", "const O={active:false,game:null,pid:null,")
js = rep(js, "function oLoad(){", "ONLINE=O;\nfunction oLoad(){")
# eigenes Spielobjekt statt S.game (alle Vorkommen im Online-Modul betreffen das Online-Spiel)
js = js.replace("S.game", "O.game")
assert "S.game" not in js, "S.game noch im Online-Modul"
# eigener Such-Schalter, damit Solo- und Online-Suche sich nie gegenseitig abbrechen
js = js.replace("searchCtl", "oCtl")
js = js.replace("const SEARCH_LIMIT=", "let oCtl=null;\nconst SEARCH_LIMIT=", 1)
# Online-Startseite heißt jetzt "onlinehome" (Solo-Hauptmenü bleibt "menu")
js = js.replace('phase="menu"', 'phase="onlinehome"').replace('phase==="menu"', 'phase==="onlinehome"').replace('phase!=="menu"', 'phase!=="onlinehome"')
js = rep(js, 'if(O.screen!=="room"||!O.code)return "menu";', 'if(O.screen!=="room"||!O.code)return "onlinehome";')
# nur zeichnen, wenn der Online-Bereich offen ist
js = js.replace('if(phase!=="onlinehome")render();', 'if(O.active)render();')
js = rep(js, "  const p=derivePhase();\n  // Tippt", "  if(!O.active)return;\n  const p=derivePhase();\n  // Tippt")
js = rep(js, 'setInterval(()=>{if(phase==="loading"&&O.st&&!O.st.searcherIsMe)render();},1000);', 'setInterval(()=>{if(O.active&&phase==="loading"&&O.st&&!O.st.searcherIsMe)render();},1000);')
js = rep(js, "!ctl.cancelled&&setStatus(", "!ctl.cancelled&&O.active&&setStatus(")
js = rep(js, 'O.screen="home";oSave();phase="onlinehome";render();}\n}', 'O.screen="home";oSave();if(O.active){phase="onlinehome";render();}}\n}')
# Aktionen als Online-Varianten
for n in ["newRound", "startGame", "reveal", "unlock", "pickOption", "lockText", "drawOptions", "renderInner"]:
    js = re.sub(rf"(?m)^{n}=function", f"onl.{n}=function", js)
js = rep(js, "const _renderVerdict=renderVerdict;\nrenderVerdict=function(below,r){\n  _renderVerdict(below,r);", "onl.renderVerdict=function(below,r){\n  base.renderVerdict(below,r);")
js = rep(js, "const _renderFinal=renderFinal;\nrenderFinal=function(below){\n  _renderFinal(below);", "onl.renderFinal=function(below){\n  base.renderFinal(below);")
# Online-Bereich merkt sich, dass er offen war
js = rep(js, "onl.renderInner=function(){\n", "onl.renderInner=function(){\n  if(S.view!==\"online\"){S.view=\"online\";save();}\n")
# Zurück-Leiste statt Link zur Solo-App
js = rep(js, "function renderOHome(root){\n", "function renderOHome(root){\n  const tb=$(`<div class=\"bar\"></div>`);tb.appendChild(btn(\"back\",BACK+\"Hauptmenü\",leaveOnline));tb.appendChild($(`<span class=\"tag\">Online</span>`));root.appendChild(tb);\n")
js = rep(js, "  root.appendChild($(`<a class=\"lastset\" href=\"./\" style=\"text-decoration:none;margin-top:8px\">← Zur Solo- & 1-vs-1-App</a>`));\n", "")
js += r'''
// ---------- Umschalten zwischen Solo/1-vs-1 und Online ----------
const base={};
["newRound","startGame","reveal","unlock","pickOption","lockText","drawOptions","renderInner","renderVerdict","renderFinal"].forEach(n=>{
  base[n]=window[n];window[n]=function(){return (O.active&&onl[n]?onl[n]:base[n]).apply(this,arguments);};});
function enterOnline(){
  O.active=true;live=null;lastOk=0;mapKey=null;
  if(!O.name){const n=(S.setup&&S.setup.names&&S.setup.names[0]||"").trim();if(n&&!/^Player \d$/.test(n)){O.name=n;oSave();}}
  if(O.code)connect();else O.screen="home";
  phase=derivePhase();render();window.scrollTo(0,0);if(phase==="game")poll();
}
function leaveOnline(){O.active=false;live=null;lastOk=0;mapKey=null;phase="menu";render();window.scrollTo(0,0);}
'''

# ---------- index.html anpassen ----------
s = rep(s, "const G=()=>S.game;", "let ONLINE=null; // Online-Bereich (eigener Spielstand)\nconst G=()=>ONLINE&&ONLINE.active?ONLINE.game:S.game;")
s = rep(s, "</style>", css + """.tile.wide{flex-direction:row;align-items:center;gap:14px;min-height:0;padding:16px;margin-top:2px;text-align:left}
.tile.wide .tic{margin:0;flex:none}
.tile.wide .tt{margin:0;display:block}
.tile.wide .td{height:auto;display:block;-webkit-line-clamp:unset}
.tile.wide .twrap{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.olive{font:500 11px var(--m);color:var(--ok);background:var(--ok-soft);padding:3px 8px;border-radius:999px;white-space:nowrap;margin-right:18px}
</style>""")
s = rep(s, "  root.appendChild($(`<div class=\"lastset\">Zuletzt: ${esc(setupLine())}</div>`));\n", """  root.appendChild($(`<div class="lastset">Zuletzt: ${esc(setupLine())}</div>`));
  const ot=$(`<button class="panel tile wide"><span class="tic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17"/></svg></span><span class="twrap"><span class="tt">Online-Duell</span><span class="td">Zwei Handys, ein Flug. Freunde per Link einladen.</span></span>${O.code?`<span class="olive">Raum ${esc(O.code)}</span>`:""}</button>`);
  ot.onclick=enterOnline;root.appendChild(ot);
""")
s = rep(s, 'const APP_VERSION="1.16";', 'const APP_VERSION="2.0";')
i = s.index("\nload();\n{const v=S.view")
j = s.index("</script>", i)
boot = r'''
// ===================== ONLINE =====================
''' + js + r'''
// ===================== Start =====================
// Einmalige Sicherungskopie der Solo-Spielstände vor dem ersten Start der zusammengelegten App
try{if(!localStorage.getItem("flugduell-v3-sicherung")&&localStorage.getItem(KEY))localStorage.setItem("flugduell-v3-sicherung",localStorage.getItem(KEY));}catch(e){}
oLoad();load();
{const m=(location.hash||"").replace("#",""),code=m.toUpperCase();let goOnline=false;
  if(m==="online")goOnline=true;
  else if(/^[A-Z0-9]{4}$/.test(code)){goOnline=true;if(code===O.code)O.screen="room";else{O.joinCode=code;O.screen="home";}}
  if(m)history.replaceState(null,"",location.pathname);
  const v=S.view,g=S.game;
  if(goOnline||v==="online"){O.active=true;if(O.code)connect();else O.screen="home";phase=derivePhase();}
  else if(v==="game"&&g&&g.round&&!g.finished)phase="game";
  else if(v==="final"&&g&&g.finished)phase="final";
  else if(["setup","ach","rules"].includes(v))phase=v;
  else if(!v&&g&&g.round&&!g.finished)phase="game";
  else phase="menu";}
render();
if(phase==="game")poll();
'''
s = s[:i] + boot + s[j:]
(root / "index.html").write_text(s)
print("index.html zusammengeführt,", len(s), "Zeichen")
