const ADMIN_USERNAME = "ikbaludin";

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

async function getSessionUser(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies["session"];
  if (!token) return null;

  const row = await env.DB.prepare(
    "SELECT s.user_id, s.expires_at, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  )
    .bind(token)
    .first();

  if (!row) return null;
  if (row.expires_at < Date.now()) return null;

  return { id: row.user_id, username: row.username };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);

  if (!user) {
    return Response.json({ error: "Belum login" }, { status: 401 });
  }
  if (user.username !== ADMIN_USERNAME) {
    return Response.json({ error: "Bukan admin" }, { status: 403 });
  }

  const totalUsers = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first();
  const totalLinks = await env.DB.prepare("SELECT COUNT(*) AS c FROM links").first();
  const totalClicks = await env.DB.prepare(
    "SELECT COALESCE(SUM(views), 0) AS c FROM links"
  ).first();

  const { results: userList } = await env.DB.prepare(
    `SELECT u.id, u.username, u.created_at,
            (SELECT COUNT(*) FROM links l WHERE l.user_id = u.id) AS link_count
     FROM users u
     ORDER BY u.created_at DESC`
  ).all();

  return Response.json({
    total_users: totalUsers.c,
    total_links: totalLinks.c,
    total_clicks: totalClicks.c,
    users: userList,
  });
}
