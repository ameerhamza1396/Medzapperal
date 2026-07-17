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
  const auth = await authResponse.json();
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
  const result = await upload.json();
  if (!upload.ok) throw new Error(result.message || "ImageKit upload failed.");
  return { url: result.url, fileId: result.fileId, thumbnailUrl: result.thumbnailUrl };
}
