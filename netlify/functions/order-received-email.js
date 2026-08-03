import { json } from "./_shared.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[character]));

const itemDetails = customization => [
  customization?.gender,
  customization?.color,
  customization?.size,
  customization?.name_engraving && `Name: ${customization.name_engraving}`,
  customization?.logo_engraving?.url && "Logo uploaded",
  customization?.design?.title && `Design: ${customization.design.title}`,
  customization?.addons?.length && `Add-ons: ${customization.addons.join(", ")}`
].filter(Boolean).join(" · ");

function orderHtml({ user = {}, order, shippingAddress, items, total, promo }) {
  const rows = (items || []).map(item => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #e6e3dc"><strong>${escapeHtml(item.name)}</strong><br><span style="color:#667">${escapeHtml(itemDetails(item.customization) || "Standard")}</span></td>
    <td style="padding:10px 0;border-bottom:1px solid #e6e3dc;text-align:center">${escapeHtml(item.quantity)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #e6e3dc;text-align:right">Rs ${Number(item.unit_price || 0).toLocaleString("en-PK")}</td>
  </tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f3ed;color:#17201e;font-family:Arial,sans-serif">
    <div style="max-width:620px;margin:auto;padding:28px">
      <div style="background:#fffefa;border:1px solid #ddd8cf;padding:26px">
        <p style="letter-spacing:2px;font-size:11px;color:#0a665d;margin:0 0 12px">MEDZ APPAREL</p>
        <h1 style="font-size:28px;margin:0 0 10px">Order received</h1>
        <p>Hi ${escapeHtml(user.user_metadata?.full_name || shippingAddress?.recipient_name || "there")}, we have received your cash-on-delivery order.</p>
        <p><strong>Order reference:</strong> #${escapeHtml(order?.order_id?.slice(0,8)?.toUpperCase() || "PENDING")}</p>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;margin:20px 0">
          <thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Price</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${promo?.code ? `<p style="color:#0a665d"><strong>Promo ${escapeHtml(promo.code)}:</strong> −Rs ${Number(promo.discount_amount || 0).toLocaleString("en-PK")}</p>` : ""}
        <p style="font-size:18px"><strong>Total payable:</strong> Rs ${Number(total || order?.order_total || 0).toLocaleString("en-PK")}</p>
        <p><strong>Delivery address:</strong><br>${escapeHtml(shippingAddress?.complete_address)}, ${escapeHtml(shippingAddress?.city)}, Pakistan<br>${escapeHtml(shippingAddress?.mobile || "")}</p>
        <p style="color:#667;line-height:1.6">Our team will contact you before dispatch. Standard delivery time is 8–12 working days.</p>
      </div>
    </div>
  </body></html>`;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || "MEDZ APPAREL <onboarding@resend.dev>";
    const replyTo = process.env.RESEND_REPLY_TO || "medzapparel7@gmail.com";
    if (!apiKey) throw new Error("Resend is not configured");
    const body = event.body ? JSON.parse(event.body) : {};
    const to = body.shippingAddress?.email;
    if (!to) return json(400, { error: "Customer email is required" });
    const email = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        bcc: ["medzapparel7@gmail.com"],
        reply_to: replyTo,
        subject: "Your MEDZ APPAREL order has been received",
        html: orderHtml(body)
      })
    });
    const result = await email.json().catch(() => ({}));
    if (!email.ok) return json(email.status, { error: result.message || "Resend email failed" });
    return json(200, { ok: true, id: result.id });
  } catch (error) {
    return json(500, { error: error.message });
  }
}
