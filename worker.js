// Cloudflare Worker: reicht Live-Flugdaten mit CORS-Freigabe an die Flugduell-App weiter
const ALLOW = ["api.adsb.lol", "opendata.adsb.fi", "api.airplanes.live", "api.adsbdb.com"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export default {
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const raw = new URL(req.url).searchParams.get("url");
    let target;
    try { target = new URL(raw); } catch { return new Response("bad url", { status: 400, headers: CORS }); }
    if (!ALLOW.includes(target.hostname)) return new Response("forbidden", { status: 403, headers: CORS });
    const res = await fetch(target, {
      method: req.method === "POST" ? "POST" : "GET",
      body: req.method === "POST" ? await req.text() : undefined,
      headers: { "Content-Type": "application/json", "User-Agent": "flugduell/1.0" },
    });
    return new Response(res.body, {
      status: res.status,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  },
};
