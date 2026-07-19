import { supabase } from "./supabase";
import { imageKitUrl } from "./imagekit";

export async function fetchCatalog() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, description, gender, base_price, is_featured, created_at, category_id, cloth_type_id,
      categories(name),
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
      categoryId: product.category_id,
      fabric: product.cloth_types?.name || "Not specified",
      clothTypeId: product.cloth_type_id,
      gender: product.gender === "men" ? "Men" : product.gender === "women" ? "Women" : "Unisex",
      price: Number(product.base_price),
      colors,
      sizes: unique("size"),
      stock: variants.reduce((sum,v) => sum + v.stock_quantity, 0),
      image: imageKitUrl(primaryImage, 900, 1100),
      originalImage: primaryImage,
      imageFileId: [...(product.product_images || [])].sort((a,b) => a.sort_order-b.sort_order)[0]?.file_id,
      variants,
      badge: product.is_featured ? "Featured" : null,
      isFeatured: product.is_featured,
      createdAt: product.created_at
    };
  });
}

export async function updateProductWithVariants({ id, product, variants, image }) {
  const { error: productError } = await supabase.from("products").update(product).eq("id", id);
  if (productError) throw productError;
  const { error: deleteError } = await supabase.from("product_variants").delete().eq("product_id", id);
  if (deleteError) throw deleteError;
  const { error: variantError } = await supabase.from("product_variants").insert(
    variants.map(v => ({ ...v, product_id: id }))
  );
  if (variantError) throw variantError;
  if (image) {
    const { error: imageDeleteError } = await supabase.from("product_images").delete().eq("product_id", id);
    if (imageDeleteError) throw imageDeleteError;
    const { error: imageError } = await supabase.from("product_images").insert({
      product_id: id, url: image.url, file_id: image.fileId, sort_order: 0
    });
    if (imageError) throw imageError;
  }
}

export async function deleteProduct(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function archiveProduct(id) {
  const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function placeCodOrder({ shippingAddress, items }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const payload = items.map(item => ({ variant_id: item.variantId, quantity: item.quantity }));
  const { data, error } = await supabase.rpc("place_cod_order", {
    p_shipping_address: shippingAddress,
    p_items: payload
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
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

export async function fetchAdminData() {
  if (!supabase) return { categories: [], colors: [], clothTypes: [], orders: [] };
  const [categories, colors, clothTypes, orders] = await Promise.all([
    supabase.from("categories").select("id,name,slug").order("sort_order"),
    supabase.from("colors").select("id,name,hex").order("name"),
    supabase.from("cloth_types").select("id,name").order("name"),
    supabase.from("orders").select("id,status,total_amount,created_at").order("created_at",{ascending:false}).limit(10)
  ]);
  for (const result of [categories, colors, clothTypes, orders]) if (result.error) throw result.error;
  return { categories: categories.data, colors: colors.data, clothTypes: clothTypes.data, orders: orders.data };
}

export function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createProductWithVariants({ product, variants, image }) {
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
    if (image) {
      const { error: imageError } = await supabase.from("product_images").insert({
        product_id: productId,
        url: image.url,
        file_id: image.fileId,
        sort_order: 0
      });
      if (imageError) throw imageError;
    }
    return productId;
  } catch (error) {
    await supabase.from("products").delete().eq("id", productId);
    throw error;
  }
}
