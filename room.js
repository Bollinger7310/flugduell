// Flugduell Online – ein Spielraum als Cloudflare Durable Object (WebSockets mit Ruhemodus)
import { DurableObject } from "cloudflare:workers";
import { RoomCore } from "./room-core.js";

const IDLE_DELETE = 24 * 3600 * 1000; // Räume ohne Aktivität werden nach 24 h gelöscht

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = new RoomCore(null);
    ctx.blockConcurrencyWhile(async () => { this.core = new RoomCore((await ctx.storage.get("s")) || null); });
  }

  async fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    let m; try { m = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data)); } catch { return; }
    if (m.t === "ping") { ws.send('{"t":"pong"}'); return; }
    if (m.t === "hello") {
      if (typeof m.pid !== "string" || !/^[a-z0-9]{6,16}$/.test(m.pid)) { ws.send('{"t":"error","err":"bad"}'); return; }
      ws.serializeAttachment({ pid: m.pid });
    }
    const pid = (ws.deserializeAttachment() || {}).pid;
    if (!pid) return;
    const r = this.core.handle(pid, m, Date.now());
    if (r && r.err) {
      ws.send(JSON.stringify({ t: "error", err: r.err }));
      if (["notfound", "full"].includes(r.err)) { ws.serializeAttachment({}); }
      if (m.t !== "hello" || !this.core.s) return;
    }
    if (r && r.changed) {
      await this.ctx.storage.put("s", this.core.s);
      await this.ctx.storage.setAlarm(Date.now() + IDLE_DELETE);
    }
    this.broadcast();
  }

  async webSocketClose(ws) { await this.gone(ws); }
  async webSocketError(ws) { await this.gone(ws); }
  async gone(ws) {
    try { ws.serializeAttachment({}); } catch {}
    const online = this.ctx.getWebSockets().filter(w => w !== ws).map(w => (w.deserializeAttachment() || {}).pid).filter(Boolean);
    if (this.core.searcherGone(online, Date.now())) await this.ctx.storage.put("s", this.core.s);
    this.broadcast();
  }

  async alarm() {
    const s = this.core.s;
    if (!s || Date.now() - s.updated >= IDLE_DELETE - 60000) { await this.ctx.storage.deleteAll(); this.core = new RoomCore(null); }
  }

  broadcast() {
    if (!this.core.s) return;
    const sockets = this.ctx.getWebSockets();
    const online = [...new Set(sockets.map(w => (w.deserializeAttachment() || {}).pid).filter(Boolean))].map(p => this.core.seatOf(p)).filter(Boolean);
    for (const w of sockets) {
      const pid = (w.deserializeAttachment() || {}).pid; if (!pid || !this.core.seatOf(pid)) continue;
      try { w.send(JSON.stringify({ t: "state", s: this.core.view(pid), online })); } catch {}
    }
  }
}
