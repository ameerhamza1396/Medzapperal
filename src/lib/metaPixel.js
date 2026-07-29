const getRuntimePixelId = () => {
  if (typeof window === "undefined") return "";
  return String(window.MEDZ_META_PIXEL_ID || import.meta.env.VITE_META_PIXEL_ID || "").trim();
};

let initializedPixelId = "";
let initializedAdvancedKey = "";
let advancedMatching = {};

const cleanPayload = payload => Object.fromEntries(
  Object.entries(payload || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
);

const normalizePhone = value => {
  const digits = String(value || "").replace(/\D/g,"");
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
};

const normalizeAdvancedMatching = data => cleanPayload({
  em: String(data?.em || data?.email || "").trim().toLowerCase(),
  ph: normalizePhone(data?.ph || data?.phone || data?.mobile)
});

const advancedKey = data => JSON.stringify(data || {});

export const metaPixelReady = () => Boolean(getRuntimePixelId());

export const loadMetaPixel = (matching = {}) => {
  if (typeof window === "undefined") return false;
  const pixelId = getRuntimePixelId();
  if (!pixelId) return false;
  const nextAdvanced = cleanPayload({...advancedMatching,...normalizeAdvancedMatching(matching)});
  const nextAdvancedKey = advancedKey(nextAdvanced);

  if (!initializedPixelId && window.MEDZ_PIXEL_INITIALIZED_ID === pixelId) {
    initializedPixelId = pixelId;
    initializedAdvancedKey = advancedKey({});
  }

  if (!window.fbq) {
    const fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    window.fbq = fbq;
    window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  if (initializedPixelId !== pixelId || initializedAdvancedKey !== nextAdvancedKey) {
    window.fbq("init", pixelId, nextAdvanced);
    initializedPixelId = pixelId;
    initializedAdvancedKey = nextAdvancedKey;
  }

  return true;
};

export const setMetaAdvancedMatching = data => {
  advancedMatching = cleanPayload({...advancedMatching,...normalizeAdvancedMatching(data)});
  return loadMetaPixel();
};

export const trackMetaEvent = (eventName, payload = {}) => {
  if (!loadMetaPixel()) return;
  window.fbq("track", eventName, cleanPayload(payload));
};

export const trackMetaCustomEvent = (eventName, payload = {}) => {
  if (!loadMetaPixel()) return;
  window.fbq("trackCustom", eventName, cleanPayload(payload));
};

export const productMetaPayload = product => ({
  content_ids: [String(product?.variantId || product?.id || product?.slug || product?.name || "")],
  content_name: product?.name,
  content_type: "product",
  content_category: product?.category,
  value: Number(product?.price || 0),
  currency: "PKR"
});

export const cartMetaPayload = cart => {
  const items = cart || [];
  const total = items.reduce((sum, item) => sum + Number(item?.price || 0), 0);
  return {
    currency: "PKR",
    value: Number(total.toFixed(0)),
    content_type: "product",
    content_ids: [...new Set(items.map(item => String(item?.variantId || item?.id || item?.slug || item?.name || "")))],
    contents: items.map(item => ({
      id: String(item?.variantId || item?.id || item?.slug || item?.name || ""),
      quantity: 1,
      item_price: Number(item?.price || 0)
    })),
    num_items: items.length
  };
};

export const orderMetaPayload = ({ order, items = [], total = 0 }) => ({
  currency: "PKR",
  value: Number(total || order?.order_total || 0),
  order_id: order?.order_id,
  content_type: "product",
  content_ids: [...new Set(items.map(item => String(item?.variantId || item?.id || item?.slug || item?.name || "")))],
  contents: items.map(item => ({
    id: String(item?.variantId || item?.id || item?.slug || item?.name || ""),
    quantity: Number(item?.quantity || 1),
    item_price: Number(item?.price || item?.unit_price || 0)
  })),
  num_items: items.reduce((sum, item) => sum + Number(item?.quantity || 1), 0)
});
