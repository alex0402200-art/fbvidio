function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies["session"];

  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");

  return new Response(JSON.stringify({ ok: true }), { headers });
}
