import { basicAuth, empty, errorResponse, json, requireAdmin, serverEnv } from "./_shared.js";

export async function onRequestDelete(context) {
  try {
    await requireAdmin(context);
    const { fileId } = await context.request.json().catch(() => ({}));
    if (!fileId) return json({ error: "fileId is required" }, { status: 400 });

    const { imagekitPrivateKey } = serverEnv(context.env);
    if (!imagekitPrivateKey) throw new Error("ImageKit is not configured");

    const result = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${basicAuth(`${imagekitPrivateKey}:`)}` }
    });
    if (!result.ok) throw new Error("ImageKit deletion failed");
    return empty(204);
  } catch (error) {
    return errorResponse(error);
  }
}
