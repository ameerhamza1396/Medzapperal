import crypto from "node:crypto";
import { errorResponse, json, requireAdmin, serverEnv } from "./_shared.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  try {
    await requireAdmin(event);
    const { imagekitPrivateKey, imagekitPublicKey, imagekitUrlEndpoint } = serverEnv();
    if (!imagekitPrivateKey || !imagekitPublicKey || !imagekitUrlEndpoint) throw new Error("ImageKit is not configured");

    const token = crypto.randomBytes(32).toString("hex");
    const expire = Math.floor(Date.now() / 1000) + 20 * 60;
    const signature = crypto.createHmac("sha1", imagekitPrivateKey).update(token + expire).digest("hex");
    return json(200, { token, expire, signature, publicKey: imagekitPublicKey, urlEndpoint: imagekitUrlEndpoint });
  } catch (error) {
    return errorResponse(error);
  }
}
