import { supabase } from "./supabase";

export function imageKitUrl(url, width = 800, height) {
  if (!url) return "";
  const transform = `tr=w-${width}${height ? `,h-${height},c-at_max` : ""},f-auto,q-auto`;
  return `${url}${url.includes("?") ? "&" : "?"}${transform}`;
}

export async function uploadToImageKit(file, folder = "/medzapperal/products") {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in as an admin first.");

  const authResponse = await fetch("/api/imagekit-auth", {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  const authText = await authResponse.text();
  let auth;
  try { auth = JSON.parse(authText); }
  catch {
    throw new Error("The image authorization server returned an invalid response. Restart the local server and try again.");
  }
  if (!authResponse.ok) throw new Error(auth.error || "Image upload authorization failed.");

  const form = new FormData();
  form.append("file", file);
  form.append("fileName", file.name);
  form.append("folder", folder);
  form.append("publicKey", auth.publicKey);
  form.append("token", auth.token);
  form.append("expire", String(auth.expire));
  form.append("signature", auth.signature);
  form.append("useUniqueFileName", "true");

  const upload = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: form
  });
  const uploadText = await upload.text();
  let result;
  try { result = JSON.parse(uploadText); }
  catch { throw new Error("ImageKit returned an invalid upload response."); }
  if (!upload.ok) throw new Error(result.message || "ImageKit upload failed.");
  return { url: result.url, fileId: result.fileId, thumbnailUrl: result.thumbnailUrl };
}

export async function deleteFromImageKit(fileId) {
  if (!fileId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in as an admin first.");
  const response = await fetch("/api/imagekit-delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ fileId })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Could not delete the ImageKit file.");
  }
}
