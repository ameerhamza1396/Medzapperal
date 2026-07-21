import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import crypto from "node:crypto";

async function verifyStaff(request, env) {
  const {user,token,supabaseUrl,anonKey}=await verifyUser(request,env);
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, Accept: "application/vnd.pgrst.object+json" }
  });
  if (!profileResponse.ok) throw new Error("Unable to verify account role");
  const profile = await profileResponse.json();
  if (!["admin", "staff"].includes(profile.role)) throw new Error("Forbidden");
  return {user};
}

async function verifyUser(request,env) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) throw new Error("Unauthorized");
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) throw new Error("Unauthorized");
  const user = await userResponse.json();
  return {user,token,supabaseUrl,anonKey};
}

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => body += chunk);
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

function localImageKitApi(env) {
  return {
    name: "medzapperal-local-imagekit-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split("?")[0];
        if (!["/api/imagekit-auth", "/api/customer-imagekit-auth", "/api/imagekit-delete"].includes(path)) return next();
        try {
          const verified = path === "/api/customer-imagekit-auth" ? await verifyUser(request,env) : await verifyStaff(request, env);
          const privateKey = env.IMAGEKIT_PRIVATE_KEY;
          const publicKey = env.IMAGEKIT_PUBLIC_KEY;
          const urlEndpoint = env.IMAGEKIT_URL_ENDPOINT;
          if (!privateKey || !publicKey || !urlEndpoint) {
            return json(response, 500, { error: "ImageKit environment variables are missing from .env.local." });
          }
          if (path === "/api/imagekit-auth" || path === "/api/customer-imagekit-auth") {
            if (request.method !== "GET") return json(response, 405, { error: "Method not allowed" });
            const token = crypto.randomBytes(32).toString("hex");
            const expire = Math.floor(Date.now() / 1000) + 20 * 60;
            const signature = crypto.createHmac("sha1", privateKey).update(token + expire).digest("hex");
            return json(response, 200, { token, expire, signature, publicKey, urlEndpoint, ...(path === "/api/customer-imagekit-auth" ? {folder:`/medzapperal/customer-logos/${verified.user.id}`} : {}) });
          }
          if (request.method !== "DELETE") return json(response, 405, { error: "Method not allowed" });
          const { fileId } = await readBody(request);
          if (!fileId) return json(response, 400, { error: "fileId is required" });
          const deletion = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
            method: "DELETE",
            headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` }
          });
          if (!deletion.ok) return json(response, deletion.status, { error: "ImageKit deletion failed" });
          response.statusCode = 204;
          return response.end();
        } catch (error) {
          const status = error.message === "Forbidden" ? 403 : error.message === "Unauthorized" ? 401 : 500;
          return json(response, status, { error: error.message });
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), localImageKitApi(env)]
  };
});
