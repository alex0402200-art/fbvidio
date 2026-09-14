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

// GET satu link (buat prefill halaman edit)
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const user = await getSessionUser(request, env);
  if (!user) return Response.json({ error: "Belum login" }, { status: 401 });

  const row = await env.DB.prepare(
    "SELECT slug, url, views FROM links WHERE slug = ? AND user_id = ?"
  )
    .bind(params.slug, user.id)
    .first();

  if (!row) return Response.json({ error: "Link tidak ditemukan" }, { status: 404 });
  return Response.json(row);
}

// PUT update backhalf dan/atau URL
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const user = await getSessionUser(request, env);
  if (!user) return Response.json({ error: "Belum login" }, { status: 401 });

  const oldSlug = params.slug;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const existing = await env.DB.prepare(
    "SELECT user_id FROM links WHERE slug = ?"
  )
    .bind(oldSlug)
    .first();

  if (!existing || existing.user_id !== user.id) {
    return Response.json({ error: "Link tidak ditemukan" }, { status: 404 });
  }

  const newUrl = body.url;
  const newSlug = (body.slug || oldSlug).trim();

  if (newUrl && !/^https?:\/\//i.test(newUrl)) {
    return Response.json({ error: "URL tidak valid" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(newSlug)) {
    return Response.json({ error: "Backhalf hanya boleh huruf, angka, - dan _" }, { status: 400 });
  }

  if (newSlug !== oldSlug) {
    const clash = await env.DB.prepare("SELECT 1 FROM links WHERE slug = ?")
      .bind(newSlug)
      .first();
    if (clash) {
      return Response.json({ error: "Backhalf baru sudah dipakai" }, { status: 409 });
    }
  }

  await env.DB.prepare(
    "UPDATE links SET slug = ?, url = COALESCE(?, url) WHERE slug = ? AND user_id = ?"
  )
    .bind(newSlug, newUrl || null, oldSlug, user.id)
    .run();

  return Response.json({ ok: true, slug: newSlug });
}

// DELETE hapus link
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const user = await getSessionUser(request, env);
  if (!user) return Response.json({ error: "Belum login" }, { status: 401 });

  const slug = params.slug;
  const existing = await env.DB.prepare("SELECT user_id FROM links WHERE slug = ?")
    .bind(slug)
    .first();

  if (!existing || existing.user_id !== user.id) {
    return Response.json({ error: "Link tidak ditemukan" }, { status: 404 });
  }

  await env.DB.prepare("DELETE FROM links WHERE slug = ?").bind(slug).run();
  return Response.json({ ok: true });
        }
      
