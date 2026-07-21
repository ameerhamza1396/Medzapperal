import crypto from "node:crypto";
import { requireUser } from "./_auth.js";

export default async function handler(request,response) {
  if (request.method !== "GET") return response.status(405).json({error:"Method not allowed"});
  try {
    const {user}=await requireUser(request);
    const privateKey=process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey=process.env.IMAGEKIT_PUBLIC_KEY;
    const urlEndpoint=process.env.IMAGEKIT_URL_ENDPOINT;
    if(!privateKey||!publicKey||!urlEndpoint) throw new Error("ImageKit is not configured");
    const token=crypto.randomBytes(32).toString("hex");
    const expire=Math.floor(Date.now()/1000)+10*60;
    const signature=crypto.createHmac("sha1",privateKey).update(token+expire).digest("hex");
    response.setHeader("Cache-Control","no-store");
    return response.status(200).json({token,expire,signature,publicKey,urlEndpoint,folder:`/medzapperal/customer-logos/${user.id}`});
  } catch(error) {
    return response.status(error.message==="Unauthorized"?401:500).json({error:error.message});
  }
}
