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

function randomToken(bytes = 16) {
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

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return Response.json(
      { error: "Username 3-20 karakter, hanya huruf/angka/underscore" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return Response.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT 1 FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (existing) {
    return Response.json({ error: "Username sudah dipakai" }, { status: 409 });
  }

  const salt = randomToken(16);
  const hash = await hashPassword(password, salt);

  await env.DB.prepare(
    "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(username, hash, salt, Date.now())
    .run();

  return Response.json({ ok: true });
}
