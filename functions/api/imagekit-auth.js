import { errorResponse, hmacSha1Hex, json, randomToken, requireAdmin, serverEnv } from "./_shared.js";

export async function onRequestGet(context) {
  try {
    await requireAdmin(context);
    const { imagekitPrivateKey, imagekitPublicKey, imagekitUrlEndpoint } = serverEnv(context.env);
    if (!imagekitPrivateKey || !imagekitPublicKey || !imagekitUrlEndpoint) throw new Error("ImageKit is not configured");

    const token = randomToken();
    const expire = Math.floor(Date.now() / 1000) + 20 * 60;
    const signature = await hmacSha1Hex(imagekitPrivateKey, token + expire);
    return json({ token, expire, signature, publicKey: imagekitPublicKey, urlEndpoint: imagekitUrlEndpoint });
  } catch (error) {
    return errorResponse(error);
  }
}
