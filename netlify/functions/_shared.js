export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function empty(statusCode = 204) {
  return {
    statusCode,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    },
    body: ""
  };
}

export function serverEnv() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    imagekitPrivateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    imagekitPublicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    imagekitUrlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
  };
}

export async function requireUser(event) {
  const authorization = event.headers.authorization || event.headers.Authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { supabaseUrl, anonKey } = serverEnv();
  if (!token || !supabaseUrl || !anonKey) throw new Error("Unauthorized");

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!authResponse.ok) throw new Error("Unauthorized");
  const user = await authResponse.json();
  return { user, token, supabaseUrl, anonKey };
}

export async function requireAdmin(event) {
  const { user, token, supabaseUrl, anonKey } = await requireUser(event);
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
  const statusCode = error.message === "Forbidden" ? 403 : error.message === "Unauthorized" ? 401 : 500;
  return json(statusCode, { error: error.message });
}
