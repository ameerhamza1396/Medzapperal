export async function requireAdmin(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) throw new Error("Unauthorized");

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!authResponse.ok) throw new Error("Unauthorized");
  const user = await authResponse.json();

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, Accept: "application/vnd.pgrst.object+json" }
  });
  if (!profileResponse.ok) throw new Error("Unable to verify role");
  const profile = await profileResponse.json();
  if (!["admin", "staff"].includes(profile.role)) throw new Error("Forbidden");
  return { user, profile };
}
