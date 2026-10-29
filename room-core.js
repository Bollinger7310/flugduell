// Flugduell Online – Spielraum-Logik (ohne Cloudflare-Abhängigkeiten, damit sie auch lokal testbar ist)
// Ein Raum = zwei Spieler, die gleichzeitig denselben Live-Flug sehen und verdeckt tippen.

const SEATS = ["p1", "p2"];
const SEARCH_TIMEOUT = 60000; // nach 60 s darf ein anderer Spieler die Suche übernehmen

export class RoomCore {
  constructor(s) { this.s = s || null; }

  init(code, now) {
    this.s = {
      code, created: now, updated: now,
      settings: { cat: "all", rounds: 10 },
      players: [], host: null,
      phase: "lobby",          // lobby | search | guess | reveal | searchfail
      searcher: null, searchSince: 0, failMsg: "",
      round: null, history: [], v: 0,
    };
  }

  seatOf(pid) { const p = this.s && this.s.players.find(x => x.pid === pid); return p ? p.seat : null; }
  over() { const s = this.s; return !!(s.settings.rounds && s.history.length >= s.settings.rounds); }

  // Verarbeitet eine Nachricht. Rückgabe: {changed} oder {err}
  handle(pid, m, now = Date.now()) {
    if (!m || typeof m.t !== "string") return { err: "bad" };
    if (m.t === "hello") {
      if (!this.s) { if (!m.create) return { err: "notfound" }; this.init(m.code || "", now); }
      const name = String(m.name || "").trim().slice(0, 16);
      const p = this.s.players.find(x => x.pid === pid);
      if (p) { if (name) p.name = name; }
      else {
        if (this.s.players.length >= 2) return { err: "full" };
        const seat = SEATS.find(st => !this.s.players.some(x => x.seat === st));
        this.s.players.push({ pid, name: name || `Player ${seat === "p1" ? 1 : 2}`, seat });
        if (!this.s.host) this.s.host = pid;
      }
      return this.touch(now);
    }
    const s = this.s; if (!s) return { err: "notfound" };
    if (s.round && !s.round.opts) s.round.opts = {};   // Räume aus der Vorversion
    const seat = this.seatOf(pid); if (!seat) return { err: "notmember" };
    const isHost = s.host === pid;

    switch (m.t) {
      case "settings": {
        if (!isHost || !["lobby"].includes(s.phase)) return { err: "denied" };
        const cat = ["all", "long", "short"].includes(m.cat) ? m.cat : s.settings.cat;
        let rounds = Math.round(Number(m.rounds)); if (!(rounds >= 0 && rounds <= 99)) rounds = s.settings.rounds;
        s.settings = { cat, rounds };
        return this.touch(now);
      }
      case "rename": {
        const p = s.players.find(x => x.pid === pid); const n = String(m.name || "").trim().slice(0, 16);
        if (n) p.name = n; return this.touch(now);
      }
      case "next": {   // Flug ziehen (Spielstart oder nächste Runde)
        const okPhase = (s.phase === "lobby" && s.players.length === 2) || (s.phase === "reveal" && !this.over()) || s.phase === "searchfail";
        const stale = s.phase === "search" && now - s.searchSince > SEARCH_TIMEOUT;
        if (!okPhase && !stale) return { changed: false };
        s.phase = "search"; s.searcher = pid; s.searchSince = now; s.failMsg = "";
        return this.touch(now);
      }
      case "found": {  // Suchender liefert den Flug
        if (s.phase !== "search" || s.searcher !== pid) return { err: "denied" };
        const f = m.flight || {};
        if (!f.hex || !f.cs || !f.type || !f.model || !f.o || !f.d) return { err: "bad" };
        s.round = { n: s.history.length + 1, flight: f, opts: {}, guesses: {}, revealed: false };
        s.phase = "guess"; s.searcher = null;
        return this.touch(now);
      }
      case "fail": {
        if (s.phase !== "search" || s.searcher !== pid) return { changed: false };
        s.phase = "searchfail"; s.searcher = null; s.failMsg = String(m.msg || "").slice(0, 200);
        return this.touch(now);
      }
      case "options": {  // „3 Typen zeigen“ gilt nur für den Spieler, der sie anfordert
        const r = s.round; if (s.phase !== "guess" || !r || r.opts[seat] || r.guesses[seat]) return { changed: false };
        const o = Array.isArray(m.options) ? m.options.map(String).slice(0, 3) : [];
        if (o.length !== 3 || new Set(o).size !== 3 || !o.includes(r.flight.model)) return { err: "bad" };
        r.opts[seat] = o;
        return this.touch(now);
      }
      case "guess": {
        const r = s.round; if (s.phase !== "guess" || !r) return { err: "denied" };
        const model = String(m.model || ""); if (!model) return { err: "bad" };
        const mine = r.opts[seat], mode = mine ? "mc" : "text";
        if (mode === "mc" && !mine.includes(model)) return { err: "bad" };
        r.guesses[seat] = { model, mode, raw: mode === "text" ? String(m.raw || "").slice(0, 24) : "", exact: mode === "text" && !!m.exact };
        if (s.players.every(p => r.guesses[p.seat])) this.reveal();
        return this.touch(now);
      }
      case "unguess": {
        const r = s.round; if (s.phase !== "guess" || !r) return { changed: false };
        delete r.guesses[seat]; return this.touch(now);
      }
      case "reveal": {
        const r = s.round; if (s.phase !== "guess" || !r || !Object.keys(r.guesses).length) return { changed: false };
        this.reveal(); return this.touch(now);
      }
      case "rematch": {
        if (!(s.phase === "reveal" && this.over())) return { changed: false };
        s.history = []; s.round = null; s.phase = "lobby"; s.searcher = null;
        return this.touch(now);
      }
      case "leave": {
        s.players = s.players.filter(x => x.pid !== pid);
        if (s.host === pid) s.host = s.players[0] ? s.players[0].pid : null;
        if (s.players.length < 2 && ["search", "searchfail"].includes(s.phase)) { s.phase = s.round && s.round.revealed ? "reveal" : (s.round ? "guess" : "lobby"); s.searcher = null; }
        return this.touch(now);
      }
      default: return { err: "unknown" };
    }
  }

  reveal() {
    const s = this.s, r = s.round, f = r.flight, ans = f.model;
    const h = { hex: f.hex, cs: f.cs, type: f.type, reg: f.reg || "", answer: ans,
      o: f.o.iata || f.o.icao, d: f.d.iata || f.d.icao, guess: {}, mode: {}, raw: {}, pts: {}, bonus: {} };
    for (const st of SEATS) {
      const g = r.guesses[st];
      if (!g) { h.guess[st] = null; h.mode[st] = "text"; h.pts[st] = 0; h.bonus[st] = false; continue; }
      const ok = g.model === ans, bonus = ok && g.mode === "text" && g.exact;
      h.guess[st] = g.model; h.mode[st] = g.mode; h.raw[st] = g.raw;
      h.bonus[st] = bonus; h.pts[st] = ok ? (g.mode === "mc" ? 1 : 2) + (bonus ? 1 : 0) : 0;
    }
    s.history.push(h); r.revealed = true; s.phase = "reveal";
  }

  touch(now) { this.s.updated = now; this.s.v++; return { changed: true }; }

  // Ansicht für einen Spieler: Tipps des Gegners bleiben bis zur Auflösung verdeckt
  view(pid) {
    const s = this.s; if (!s) return null;
    const me = this.seatOf(pid);
    const out = JSON.parse(JSON.stringify(s));
    if (out.round && !out.round.revealed) {
      for (const st of Object.keys(out.round.guesses)) if (st !== me) out.round.guesses[st] = { hidden: true };
      out.round.opts = out.round.opts || {};
      for (const st of Object.keys(out.round.opts)) if (st !== me) delete out.round.opts[st];   // fremde Vorschläge bleiben unsichtbar
    }
    out.me = me; out.over = this.over();
    for (const p of out.players) delete p.pid;           // IDs der Mitspieler nicht herausgeben
    out.isHost = s.host === pid; out.hostSeat = s.host ? this.seatOf(s.host) : null; delete out.host;
    out.searcherIsMe = s.searcher === pid; out.searcherSeat = s.searcher ? this.seatOf(s.searcher) : null; delete out.searcher;
    return out;
  }
}
