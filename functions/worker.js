import { json } from "./api/_shared.js";
import { onRequestGet as customerImagekitAuth } from "./api/customer-imagekit-auth.js";
import { onRequestDelete as imagekitDelete } from "./api/imagekit-delete.js";
import { onRequestGet as imagekitAuth } from "./api/imagekit-auth.js";
import { onRequestPost as orderReceivedEmail } from "./api/order-received-email.js";

const routes = {
  "GET /api/imagekit-auth": imagekitAuth,
  "GET /api/customer-imagekit-auth": customerImagekitAuth,
  "DELETE /api/imagekit-delete": imagekitDelete,
  "POST /api/order-received-email": orderReceivedEmail
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const routeKey = `${request.method} ${url.pathname}`;
    const handler = routes[routeKey];
    if (handler) return handler({ request, env, ctx });
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, { status: 404 });
    return env.STATIC_ASSETS.fetch(request);
  }
};
