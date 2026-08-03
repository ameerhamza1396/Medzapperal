import { supabase } from "./supabase";
import { imageKitUrl } from "./imagekit";

export async function fetchCatalog() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, description, gender, product_mode, base_price, sale_price, is_featured, is_new_arrival, created_at, category_id, cloth_type_id,
      categories(name,slug,image_url),
      cloth_types(name),
      product_images(id, url, file_id, sort_order, variant_id),
      product_variants(id, size, sku, stock_quantity, price_override, is_active, colors(id, name, hex))
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(product => {
    const variants = (product.product_variants || []).filter(v => v.is_active);
    const unique = key => [...new Set(variants.map(v => v[key]).filter(Boolean))];
    const colors = [...new Set(variants.map(v => v.colors?.name).filter(Boolean))];
    const primaryImage = [...(product.product_images || [])].sort((a,b) => a.sort_order-b.sort_order)[0]?.url;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.categories?.name || "Uncategorized",
      categorySlug: product.categories?.slug || "",
      categoryId: product.category_id,
      fabric: product.cloth_types?.name || "Not specified",
      clothTypeId: product.cloth_type_id,
      genderValue: product.gender,
      gender: product.gender === "men" ? "Men" : product.gender === "women" ? "Women" : "Unisex",
      productMode: product.product_mode || "style",
      price: Number(product.sale_price || product.base_price),
      regularPrice: Number(product.base_price),
      salePrice: product.sale_price == null ? null : Number(product.sale_price),
      isOnSale: product.sale_price != null && Number(product.sale_price) < Number(product.base_price),
      colors,
      sizes: unique("size"),
      stock: variants.reduce((sum,v) => sum + v.stock_quantity, 0),
      image: imageKitUrl(primaryImage, 900, 1100),
      images: [...(product.product_images || [])].sort((a,b) => a.sort_order-b.sort_order).map(item => ({
        id:item.id, url:imageKitUrl(item.url,900,1125), originalUrl:item.url, fileId:item.file_id
      })),
      originalImage: primaryImage,
      imageFileId: [...(product.product_images || [])].sort((a,b) => a.sort_order-b.sort_order)[0]?.file_id,
      variants,
      badge: product.sale_price != null && Number(product.sale_price) < Number(product.base_price) ? "Sale" : product.is_featured ? "Featured" : null,
      isFeatured: product.is_featured,
      isNewArrival: product.is_new_arrival,
      createdAt: product.created_at
    };
  });
}

export async function fetchStorefrontContent() {
  if (!supabase) return { categories: [], reviews: [] };
  const [categoryResult, reviewResult] = await Promise.all([
    supabase.from("categories").select("id,name,slug,parent_id,image_url,sort_order,is_active").eq("is_active",true).order("sort_order"),
    supabase.from("customer_reviews").select("id,title,image_url,sort_order").eq("is_active",true).order("sort_order").limit(24)
  ]);
  if (categoryResult.error) throw categoryResult.error;
  return {
    categories: categoryResult.data || [],
    reviews: reviewResult.error ? [] : reviewResult.data || []
  };
}

async function replaceProductImages(productId, images) {
  const { error: deleteError } = await supabase.from("product_images").delete().eq("product_id", productId);
  if (deleteError) throw deleteError;
  if (!images?.length) return;
  const { error } = await supabase.from("product_images").insert(images.map((image,index)=>({
    product_id:productId,url:image.url,file_id:image.fileId,sort_order:index
  })));
  if (error) throw error;
}

export async function updateProductWithVariants({ id, product, variants, images }) {
  const { error: productError } = await supabase.from("products").update(product).eq("id", id);
  if (productError) throw productError;
  const { data: existing, error: existingError } = await supabase
    .from("product_variants").select("id,color_id,size,sku").eq("product_id", id);
  if (existingError) throw existingError;
  const key = row => `${row.color_id}:${row.size}`;
  const existingByOption = new Map((existing || []).map(row=>[key(row),row]));
  const rows = variants.map(variant=>({
    ...variant,product_id:id,sku:existingByOption.get(key(variant))?.sku || variant.sku,is_active:true
  }));
  const { error: upsertError } = await supabase.from("product_variants")
    .upsert(rows,{onConflict:"product_id,color_id,size"});
  if (upsertError) throw upsertError;
  const retainedOptions = new Set(rows.map(key));
  const retiredIds = (existing || []).filter(row=>!retainedOptions.has(key(row))).map(row=>row.id);
  if (retiredIds.length) {
    const { error } = await supabase.from("product_variants").update({is_active:false,stock_quantity:0}).in("id",retiredIds);
    if (error) throw error;
  }
  await replaceProductImages(id,images);
}

export async function deleteProduct(id) {
  const { error } = await supabase.from("products").update({is_active:false}).eq("id", id);
  if (error) throw error;
}

export async function archiveProduct(id) {
  const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function validatePromoCode({ code, subtotal }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) throw new Error("Enter a promo code.");
  const { data, error } = await supabase.rpc("validate_promo_code", {
    p_code: normalizedCode,
    p_subtotal: Number(subtotal) || 0
  });
  if (error) throw error;
  const promo = Array.isArray(data) ? data[0] : data;
  if (!promo) throw new Error("Promo code is invalid.");
  return {
    ...promo,
    code: promo.code || normalizedCode,
    value: Number(promo.value) || 0,
    discount_amount: Number(promo.discount_amount) || 0,
    subtotal: Number(subtotal) || 0
  };
}

export async function placeCodOrder({ shippingAddress, items, promoCode }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const payload = items.map(item => ({
    variant_id: item.variantId,
    quantity: item.quantity,
    customization: item.customization || {}
  }));
  const params = {
    p_shipping_address: shippingAddress,
    p_items: payload,
    p_promo_code: promoCode?.trim().toUpperCase() || null
  };
  let { data, error } = await supabase.rpc("place_cod_order", params);
  if (error && !promoCode && ["PGRST202","42883"].includes(error.code)) {
    ({ data, error } = await supabase.rpc("place_cod_order", {
      p_shipping_address: shippingAddress,
      p_items: payload
    }));
  }
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function sendOrderReceivedEmail({ order, shippingAddress, items, total, promo }) {
  const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  await fetch("/api/order-received-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    },
    body: JSON.stringify({ order, shippingAddress, items, total, promo })
  });
}

export async function claimGuestOrdersByEmail(email) {
  if (!supabase || !email) return 0;
  const { data, error } = await supabase.rpc("claim_guest_orders_by_email", { p_email: email });
  if (error) throw error;
  return data || 0;
}

export async function fetchDefaultAddress(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("addresses")
    .select("id,full_address")
    .eq("user_id", userId)
    .eq("is_default", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, ...data.full_address } : null;
}

export async function saveDefaultAddress({ userId, address, addressId }) {
  if (!supabase || !userId) throw new Error("Please sign in to save an address.");
  const { error: clearError } = await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", userId);
  if (clearError) throw clearError;
  const row = { user_id: userId, label: "Default delivery address", full_address: address, is_default: true };
  const result = addressId
    ? await supabase.from("addresses").update(row).eq("id", addressId).eq("user_id", userId)
    : await supabase.from("addresses").insert(row);
  if (result.error) throw result.error;
}

export async function fetchCustomerAccount(userId) {
  if (!supabase || !userId) return { orders: [], addresses: [] };
  const [orders, addresses] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,status,total_amount,shipping_address,internal_notes,created_at,updated_at,
        order_items(id,quantity,unit_price,customization,product_variants(size,colors(name),products(name,product_images(url,sort_order))))
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("addresses")
      .select("id,label,full_address,is_default,created_at")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
  ]);
  if (orders.error) throw orders.error;
  if (addresses.error) throw addresses.error;
  return {
    orders: (orders.data || []).map(order => ({ ...order, customer_message: order.internal_notes })),
    addresses: addresses.data || []
  };
}

export async function cancelPendingOrder(orderId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("cancel_pending_order", { p_order_id: orderId });
  if (error) throw error;
}

export async function updateOrderStatus({ orderId, status, customerMessage }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("admin_update_order", {
    p_order_id: orderId,
    p_status: status,
    p_customer_message: customerMessage?.trim() || null
  });
  if (error) throw error;
}

export async function fetchAdminData() {
  if (!supabase) return { categories: [], colors: [], clothTypes: [], orders: [], reviews: [], promoCodes: [] };
  const [categories, colors, clothTypes, orders, reviews, promoCodes] = await Promise.all([
    supabase.from("categories").select("id,name,slug").eq("is_active",true).order("sort_order"),
    supabase.from("colors").select("id,name,hex").order("name"),
    supabase.from("cloth_types").select("id,name").order("name"),
    supabase.from("orders").select("id,status,total_amount,shipping_address,internal_notes,created_at,updated_at,order_items(id,quantity,unit_price,customization,product_variants(size,colors(name),products(name)))").order("created_at",{ascending:false}).limit(10),
    supabase.from("customer_reviews").select("id,title,image_url,image_file_id,sort_order,is_active,created_at").order("sort_order").order("created_at",{ascending:false}),
    supabase.from("promo_codes").select("id,code,discount_type,value,min_order_amount,max_discount_amount,usage_limit,used_count,starts_at,expires_at,is_active,created_at,updated_at").order("created_at",{ascending:false})
  ]);
  for (const result of [categories, colors, clothTypes, orders, reviews]) if (result.error) throw result.error;
  return {
    categories: categories.data,
    colors: colors.data,
    clothTypes: clothTypes.data,
    orders: orders.data.map(order => ({ ...order, customer_message: order.internal_notes })),
    reviews: reviews.data || [],
    promoCodes: promoCodes.error ? [] : promoCodes.data || [],
    promoSetupError: promoCodes.error ? "Run the promo-code SQL migration in Supabase to enable this section." : ""
  };
}

export async function fetchAdminOrders({ pageSize = 1000 } = {}) {
  if (!supabase) return [];
  const select = `
    id,user_id,status,total_amount,shipping_address,internal_notes,created_at,updated_at,
    order_items(
      id,quantity,unit_price,customization,
      product_variants(
        id,size,sku,
        colors(id,name,hex),
        products(id,name,slug,product_images(url,sort_order))
      )
    )
  `;
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("orders")
      .select(select)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows.map(order => ({ ...order, customer_message: order.internal_notes }));
}

export async function saveCustomerReview(review) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const row = {
    title: review.title?.trim() || null,
    image_url: review.image_url,
    image_file_id: review.image_file_id || null,
    sort_order: Number(review.sort_order) || 0,
    is_active: review.is_active !== false
  };
  const result = review.id
    ? await supabase.from("customer_reviews").update(row).eq("id", review.id)
    : await supabase.from("customer_reviews").insert(row);
  if (result.error) throw result.error;
}

export async function archiveCustomerReview(reviewId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("customer_reviews").update({ is_active: false }).eq("id", reviewId);
  if (error) throw error;
}

export async function saveColor(color) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const row = {
    name: color.name.trim(),
    hex: color.hex.trim(),
    slug: color.slug?.trim() || slugify(color.name)
  };
  const result = color.id
    ? await supabase.from("colors").update(row).eq("id", color.id)
    : await supabase.from("colors").insert(row);
  if (result.error) throw result.error;
}

export async function archiveColor(colorId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: used, error: usedError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("color_id", colorId)
    .limit(1);
  if (usedError) throw usedError;
  if (used?.length) throw new Error("This colour is used by product variants. Remove it from products before deleting.");
  const { error } = await supabase.from("colors").delete().eq("id", colorId);
  if (error) throw error;
}

export async function savePromoCode(promo) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const row = {
    code: String(promo.code || "").trim().toUpperCase(),
    discount_type: promo.discount_type,
    value: Number(promo.value),
    min_order_amount: Number(promo.min_order_amount) || 0,
    max_discount_amount: promo.discount_type === "percentage" && promo.max_discount_amount !== "" && promo.max_discount_amount != null
      ? Number(promo.max_discount_amount)
      : null,
    usage_limit: promo.usage_limit !== "" && promo.usage_limit != null ? Number(promo.usage_limit) : null,
    starts_at: promo.starts_at ? new Date(promo.starts_at).toISOString() : null,
    expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString() : null,
    is_active: promo.is_active !== false
  };
  const result = promo.id
    ? await supabase.from("promo_codes").update(row).eq("id", promo.id)
    : await supabase.from("promo_codes").insert(row);
  if (result.error) throw result.error;
}

export async function setPromoCodeActive(promoId, isActive) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("promo_codes").update({ is_active: isActive }).eq("id", promoId);
  if (error) throw error;
}

export function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createProductWithVariants({ product, variants, images }) {
  const { data: created, error: productError } = await supabase
    .from("products")
    .insert(product)
    .select("id")
    .single();
  if (productError) throw productError;

  const productId = created.id;
  try {
    const rows = variants.map(v => ({ ...v, product_id: productId }));
    const { error: variantsError } = await supabase.from("product_variants").insert(rows);
    if (variantsError) throw variantsError;
    await replaceProductImages(productId,images);
    return productId;
  } catch (error) {
    await supabase.from("products").delete().eq("id", productId);
    throw error;
  }
}
