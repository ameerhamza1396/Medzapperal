import { requireAdmin } from "./_auth.js";

export default async function handler(request, response) {
  if (request.method !== "DELETE") return response.status(405).json({ error: "Method not allowed" });
  try {
    await requireAdmin(request);
    const { fileId } = request.body || {};
    if (!fileId) return response.status(400).json({ error: "fileId is required" });
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) throw new Error("ImageKit is not configured");
    const result = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` }
    });
    if (!result.ok) throw new Error("ImageKit deletion failed");
    return response.status(204).end();
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : error.message === "Unauthorized" ? 401 : 500;
    return response.status(status).json({ error: error.message });
  }
}
