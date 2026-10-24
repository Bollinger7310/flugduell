// Cloudflare Worker: reicht Live-Flugdaten mit CORS-Freigabe an die Flugduell-App weiter
const ALLOW = ["api.adsb.lol", "opendata.adsb.fi", "api.airplanes.live", "api.adsbdb.com", "api.planespotters.net", "globe.adsb.lol"];
// Nur die eigene App darf die Weiterleitung nutzen
const ORIGINS = ["https://bollinger7310.github.io"];
const CORS = {
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
// Wie lange eine Antwort zwischengespeichert wird (Sekunden)
function ttlFor(url) {
  if (url.hostname === "api.adsbdb.com" || url.hostname === "api.planespotters.net") return 3600;
  if (/\/traces\//.test(url.pathname)) return 30;
  if (/\/hex\//.test(url.pathname)) return 4;
  return 20; // Gebietsabfragen
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export default {
  async fetch(req) {
    const origin = req.headers.get("Origin") || "";
    if (!ORIGINS.includes(origin)) return new Response("forbidden", { status: 403 });
    const cors = { ...CORS, "Access-Control-Allow-Origin": origin };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const raw = new URL(req.url).searchParams.get("url");
    let target;
    try { target = new URL(raw); } catch { return new Response("bad url", { status: 400, headers: cors }); }
    if (!ALLOW.includes(target.hostname)) return new Response("forbidden", { status: 403, headers: cors });
    const isPost = req.method === "POST";
    const body = isPost ? await req.text() : undefined;
    let res;
    for (let i = 0; i < 4; i++) {
      res = await fetch(target, {
        method: isPost ? "POST" : "GET",
        body,
        headers: { "Content-Type": "application/json", "User-Agent": "flugduell/1.1 (private quiz app)", "Accept": "application/json" },
        cf: isPost ? undefined : { cacheTtl: ttlFor(target), cacheEverything: true },
      });
      if (res.status !== 429 && res.status < 500) break;
      await sleep(600 * (i + 1));
    }
    return new Response(res.body, {
      status: res.status,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  },
};
