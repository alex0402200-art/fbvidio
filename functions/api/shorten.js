// functions/api/shorten.js
// Route otomatis: POST /api/shorten

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
    "SELECT s.user_id, s.expires_at FROM sessions s WHERE s.token = ?"
  )
    .bind(token)
    .first();

  if (!row) return null;
  if (row.expires_at < Date.now()) return null;

  return { id: row.user_id };
}

function randomSlug(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const targetUrl = body.url;
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return Response.json(
      { error: "URL tidak valid, harus diawali http:// atau https://" },
      { status: 400 }
    );
  }

  let slug = (body.slug || "").trim();
  let autoRenamed = false;

  if (slug) {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(slug)) {
      return Response.json(
        { error: "Backhalf hanya boleh huruf, angka, - dan _" },
        { status: 400 }
      );
    }

    const baseSlug = slug;

    // Cek apakah backhalf dasar ini sudah dipakai
    const existingLink = await env.DB.prepare(
      "SELECT url FROM links WHERE slug = ?"
    )
      .bind(baseSlug)
      .first();

    if (!existingLink) {
      // Belum pernah dipakai -> langsung pakai polos
      slug = baseSlug;
    } else if (existingLink.url === targetUrl) {
      // Sudah ada, tapi URL-nya sama persis -> kembalikan link yang sudah ada
      const sameUrl = new URL(request.url);
      return Response.json({
        slug: baseSlug,
        short_url: `${sameUrl.origin}/${baseSlug}`,
      });
    } else {
      // Sudah dipakai untuk URL lain -> ambil nomor urut berikutnya dari slug_counters
      autoRenamed = true;

      let nextNumber;
      const counterRow = await env.DB.prepare(
        "SELECT next_number FROM slug_counters WHERE base = ?"
      )
        .bind(baseSlug)
        .first();

      if (counterRow) {
        nextNumber = counterRow.next_number;
      } else {
        nextNumber = 1;
      }

      // Jaga-jaga kalau slug bernomor itu ternyata sudah ada juga (edge case)
      let candidate = `${baseSlug}${nextNumber}`;
      while (
        await env.DB.prepare("SELECT 1 FROM links WHERE slug = ?")
          .bind(candidate)
          .first()
      ) {
        nextNumber += 1;
        candidate = `${baseSlug}${nextNumber}`;
      }

      slug = candidate;

      // Simpan/update posisi counter buat backhalf dasar ini
      await env.DB.prepare(
        `INSERT INTO slug_counters (base, next_number) VALUES (?, ?)
         ON CONFLICT(base) DO UPDATE SET next_number = excluded.next_number`
      )
        .bind(baseSlug, nextNumber + 1)
        .run();
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const candidate = randomSlug();
      const existing = await env.DB.prepare(
        "SELECT 1 FROM links WHERE slug = ?"
      )
        .bind(candidate)
        .first();
      if (!existing) {
        slug = candidate;
        break;
      }
    }
  }

  try {
    await env.DB.prepare(
      "INSERT INTO links (slug, url, created_at, user_id, views) VALUES (?, ?, ?, ?, 0)"
    )
      .bind(slug, targetUrl, Date.now(), user ? user.id : null)
      .run();
  } catch (e) {
    return Response.json(
      { error: "Backhalf sudah dipakai, coba yang lain" },
      { status: 409 }
    );
  }

  const url = new URL(request.url);
  return Response.json({
    slug,
    short_url: `${url.origin}/${slug}`,
    auto_renamed: autoRenamed,
  });
}
