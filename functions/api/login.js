async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";

  const user = await env.DB.prepare(
    "SELECT id, password_hash, salt FROM users WHERE username = ?"
  )
    .bind(username)
    .first();

  if (!user) {
    return Response.json({ error: "Username atau password salah" }, { status: 401 });
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) {
    return Response.json({ error: "Username atau password salah" }, { status: 401 });
  }

  const token = randomToken(32);
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 hari

  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  )
    .bind(token, user.id, expiresAt)
    .run();

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
  );

  return new Response(JSON.stringify({ ok: true }), { headers });
}
