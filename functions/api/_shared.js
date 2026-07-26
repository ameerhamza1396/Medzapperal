export function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(init.headers || {})
    }
  });
}

export function empty(status = 204) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function serverEnv(env) {
  return {
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
    imagekitPrivateKey: env.IMAGEKIT_PRIVATE_KEY,
    imagekitPublicKey: env.IMAGEKIT_PUBLIC_KEY,
    imagekitUrlEndpoint: env.IMAGEKIT_URL_ENDPOINT
  };
}

export async function requireUser({ request, env }) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { supabaseUrl, anonKey } = serverEnv(env);
  if (!token || !supabaseUrl || !anonKey) throw new Error("Unauthorized");

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!authResponse.ok) throw new Error("Unauthorized");
  const user = await authResponse.json();
  return { user, token, supabaseUrl, anonKey };
}

export async function requireAdmin(context) {
  const { user, token, supabaseUrl, anonKey } = await requireUser(context);
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.pgrst.object+json"
    }
  });
  if (!profileResponse.ok) throw new Error("Unable to verify role");
  const profile = await profileResponse.json();
  if (!["admin", "staff"].includes(profile.role)) throw new Error("Forbidden");
  return { user, profile };
}

export function errorResponse(error) {
  const status = error.message === "Forbidden" ? 403 : error.message === "Unauthorized" ? 401 : 500;
  return json({ error: error.message }, { status });
}

export function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return [...values].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha1Hex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function basicAuth(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}
