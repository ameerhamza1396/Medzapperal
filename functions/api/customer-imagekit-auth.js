import { errorResponse, hmacSha1Hex, json, randomToken, requireUser, serverEnv } from "./_shared.js";

export async function onRequestGet(context) {
  try {
    const { user } = await requireUser(context);
    const { imagekitPrivateKey, imagekitPublicKey, imagekitUrlEndpoint } = serverEnv(context.env);
    if (!imagekitPrivateKey || !imagekitPublicKey || !imagekitUrlEndpoint) throw new Error("ImageKit is not configured");

    const token = randomToken();
    const expire = Math.floor(Date.now() / 1000) + 10 * 60;
    const signature = await hmacSha1Hex(imagekitPrivateKey, token + expire);
    return json({
      token,
      expire,
      signature,
      publicKey: imagekitPublicKey,
      urlEndpoint: imagekitUrlEndpoint,
      folder: `/medzapperal/customer-logos/${user.id}`
    });
  } catch (error) {
    return errorResponse(error);
  }
}
