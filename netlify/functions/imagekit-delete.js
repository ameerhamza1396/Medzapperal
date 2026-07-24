import { empty, errorResponse, json, requireAdmin, serverEnv } from "./_shared.js";

export async function handler(event) {
  if (event.httpMethod !== "DELETE") return json(405, { error: "Method not allowed" });
  try {
    await requireAdmin(event);
    const { fileId } = event.body ? JSON.parse(event.body) : {};
    if (!fileId) return json(400, { error: "fileId is required" });

    const { imagekitPrivateKey } = serverEnv();
    if (!imagekitPrivateKey) throw new Error("ImageKit is not configured");

    const result = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${Buffer.from(`${imagekitPrivateKey}:`).toString("base64")}` }
    });
    if (!result.ok) throw new Error("ImageKit deletion failed");
    return empty(204);
  } catch (error) {
    return errorResponse(error);
  }
}
