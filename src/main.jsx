import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft, ArrowRight, BarChart3, Check, ChevronDown, CircleUserRound,
  Heart, LayoutGrid, Menu, Minus, Moon, Package, Plus, Search, ShoppingBag,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Trash2, X
} from "lucide-react";
import hero from "./assets/medzapperal-hero.png";
import { AuthPage } from "./Auth";
import { getMyProfile, isSupabaseConfigured, supabase } from "./lib/supabase";
import { deleteFromImageKit, uploadToImageKit } from "./lib/imagekit";
import { createProductWithVariants, deleteProduct, fetchAdminData, fetchCatalog, slugify, updateProductWithVariants } from "./lib/store";
import "./styles.css";

const palette = {
  Navy: "#172d4f", "Ceil Blue": "#9bbbd1", Black: "#252525",
  Wine: "#722f48", Olive: "#78836a", White: "#e9e7df", Sage: "#8e9b88"
};
const pkr = value => new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(value)||0);

const categoryCards = [
  ["Scrubs", "Built for every move"],
  ["Lab Coats", "Precision, refined"],
  ["Jackets", "Your extra layer"],
  ["Accessories", "Shift essentials"]
];

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem("mz-theme") === "dark");
  const [page, setPage] = useState("home");
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("mz-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => window.scrollTo({ top: 0, behavior: "smooth" }), [page]);
  const loadCatalog = async () => {
    setCatalogLoading(true); setCatalogError("");
    try { setProducts(await fetchCatalog()); }
    catch (error) { setCatalogError(error.message); }
    finally { setCatalogLoading(false); }
  };
  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const applySession = async (session) => {
      const nextUser = session?.user || null;
      if (!active) return;
      setUser(nextUser);
      if (nextUser) {
        try { setProfile(await getMyProfile(nextUser.id)); }
        catch { setProfile(null); }
      } else setProfile(null);
      setAuthReady(true);
    };
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => applySession(session), 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const goShop = (category = "All") => { setQuery(category === "All" ? "" : category); setPage("shop"); setMenuOpen(false); };
  const openProduct = p => { setSelected(p); setPage("product"); };
  const add = (product, size = product.sizes[0], color = product.colors[0]) => {
    setCart(c => [...c, { ...product, cartId: Date.now(), size, color }]);
    setCartOpen(true);
  };

  return <div className="app">
    <div className="announcement">COMPLIMENTARY SHIPPING ON ORDERS PKR 10,000+ <span>SHOP NOW <ArrowRight size={13}/></span></div>
    <Header {...{dark,setDark,page,setPage,goShop,cart,setCartOpen,menuOpen,setMenuOpen,query,setQuery,user}} />
    {page === "home" && <Home {...{goShop,openProduct,add,products,catalogLoading}} />}
    {page === "shop" && <Shop initialQuery={query} openProduct={openProduct} add={add} products={products} loading={catalogLoading} error={catalogError}/>}
    {page === "product" && selected && <Product product={selected} add={add} openProduct={openProduct} products={products}/>}
    {page === "auth" && <AuthPage user={user} profile={profile} onDone={() => setPage("home")} onAdmin={() => setPage("admin")} onSignOut={async () => { await supabase?.auth.signOut(); setPage("home"); }}/>}
    {page === "admin" && <Admin user={user} profile={profile} authReady={authReady} onLogin={() => setPage("auth")} products={products} onCreated={loadCatalog} />}
    <Footer goShop={goShop}/>
    <Cart cart={cart} setCart={setCart} open={cartOpen} close={() => setCartOpen(false)}/>
  </div>;
}

function Header({dark,setDark,page,setPage,goShop,cart,setCartOpen,menuOpen,setMenuOpen,query,setQuery,user}) {
  return <header>
    <button className="mobile-only icon-btn" onClick={() => setMenuOpen(!menuOpen)}><Menu/></button>
    <button className="logo" onClick={() => setPage("home")} aria-label="Medzapperal home">
      <span className="logo-mark"><i/><i/><i/></span>MEDZAPPERAL
    </button>
    <nav className={menuOpen ? "open" : ""}>
      <button onClick={() => goShop("Scrubs")}>Scrubs</button>
      <button onClick={() => goShop("Lab Coats")}>Lab coats</button>
      <button onClick={() => goShop("Jackets")}>Jackets</button>
      <button onClick={() => goShop("Accessories")}>Accessories</button>
      <button onClick={() => goShop("All")}>Shop all</button>
    </nav>
    <div className="header-actions">
      <button className="icon-btn desktop-only" onClick={() => { if (page !== "shop") { setPage("shop"); setQuery(""); } }}><Search size={20}/></button>
      <button className="icon-btn" onClick={() => setDark(!dark)}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
      <button className="icon-btn desktop-only account-button" aria-label={user ? "My account" : "Sign in"} onClick={() => setPage("auth")}><CircleUserRound size={20}/>{user && <i/>}</button>
      <button className="icon-btn cart-button" onClick={() => setCartOpen(true)}><ShoppingBag size={20}/>{cart.length > 0 && <b>{cart.length}</b>}</button>
    </div>
  </header>;
}

function Home({goShop,openProduct,add,products,catalogLoading}) {
  return <main>
    <section className="hero">
      <img src={hero} alt="Healthcare professionals in modern Medzapperal scrubs"/>
      <div className="hero-copy">
        <p className="eyebrow">THE NEW UNIFORM</p>
        <h1>Made for<br/>the <em>shift.</em></h1>
        <p>Elevated essentials engineered for the pace, purpose, and people behind every day of care.</p>
        <button className="primary" onClick={() => goShop("All")}>Shop the collection <ArrowRight size={17}/></button>
      </div>
      <p className="hero-note">01 — SPRING / SUMMER 2026</p>
    </section>
    <section className="values">
      <p>Designed with purpose.</p>
      <div><span>01</span><h3>All-shift comfort</h3><p>Soft, breathable fabrics that move when you do.</p></div>
      <div><span>02</span><h3>Considered details</h3><p>Purposeful pockets. Tailored lines. Nothing extra.</p></div>
      <div><span>03</span><h3>Made to last</h3><p>Durable construction, shift after shift.</p></div>
    </section>
    <section className="section">
      <div className="section-head"><div><p className="eyebrow">SHOP BY CATEGORY</p><h2>Find your uniform.</h2></div><button className="text-link" onClick={() => goShop("All")}>View all <ArrowRight size={16}/></button></div>
      <div className="category-grid">{categoryCards.map(([name,tag],i) =>
        <button className={`category c${i+1}`} key={name} onClick={() => goShop(name)}>
          <img src={hero} alt=""/><span><small>0{i+1}</small><strong>{name}</strong><em>{tag} <ArrowRight size={15}/></em></span>
        </button>)}</div>
    </section>
    <ProductRow title="The shift favorites." label="MOST LOVED" list={products.slice(0,4)} {...{openProduct,add,goShop}} />
    <section className="manifesto">
      <span className="eyebrow">WHY MEDZAPPERAL</span>
      <h2>Because what you wear<br/>should work as hard as <em>you do.</em></h2>
      <p>We design medical apparel through a more thoughtful lens—balancing technical performance with a sense of ease, so you can focus on what matters.</p>
      <button className="secondary">Our story <ArrowRight size={16}/></button>
    </section>
    <ProductRow title="Fresh off the line." label="NEW ARRIVALS" list={products.slice(4,8)} {...{openProduct,add,goShop}} />
    <section className="newsletter"><p className="eyebrow">STAY IN THE LOOP</p><h2>A better shift starts here.</h2><p>New drops, thoughtful stories, and first access—straight to your inbox.</p><form onSubmit={e => e.preventDefault()}><input placeholder="Email address" type="email"/><button><ArrowRight/></button></form></section>
  </main>;
}

function ProductRow({title,label,list,openProduct,add,goShop}) {
  return <section className="section products-section">
    <div className="section-head"><div><p className="eyebrow">{label}</p><h2>{title}</h2></div><button className="text-link" onClick={() => goShop("All")}>Shop all <ArrowRight size={16}/></button></div>
    {list.length ? <div className="product-grid">{list.map(p => <ProductCard key={p.id} p={p} openProduct={openProduct} add={add}/>)}</div> :
    <div className="catalog-empty"><Package/><h3>The first collection is coming soon.</h3><p>New pieces added in the admin panel will appear here automatically.</p></div>}
  </section>;
}

function ProductCard({p,openProduct,add}) {
  return <article className="product-card">
    <button className="product-image" onClick={() => openProduct(p)}>{p.image ? <img src={p.image} alt={p.name}/> : <span className="image-placeholder"><Package/></span>}{p.badge && <span className="badge">{p.badge}</span>}<span className="quick" onClick={e => {e.stopPropagation(); add(p)}}><Plus size={18}/> Quick add</span></button>
    <div className="product-meta"><button onClick={() => openProduct(p)}><strong>{p.name}</strong><span>{p.gender} · {p.fabric}</span></button><b>{pkr(p.price)}</b></div>
    <div className="swatches">{p.colors.map(c => <i key={c} style={{background:palette[c]}} title={c}/>)}</div>
  </article>;
}

function Shop({initialQuery,openProduct,add,products,loading,error}) {
  const [category,setCategory] = useState(["Scrubs","Lab Coats","Jackets","Accessories"].includes(initialQuery) ? initialQuery : "All");
  const [search,setSearch] = useState("");
  const [color,setColor] = useState("All");
  const [fabric,setFabric] = useState("All");
  const [sort,setSort] = useState("Featured");
  const [filters,setFilters] = useState(false);
  useEffect(() => setCategory(["Scrubs","Lab Coats","Jackets","Accessories"].includes(initialQuery) ? initialQuery : "All"), [initialQuery]);
  let shown = useMemo(() => products.filter(p =>
    (category === "All" || p.category === category) &&
    (color === "All" || p.colors.includes(color)) &&
    (fabric === "All" || p.fabric === fabric) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a,b) => sort === "Price: Low" ? a.price-b.price : sort === "Price: High" ? b.price-a.price : b.stock-a.stock),[category,color,fabric,search,sort]);
  return <main className="shop">
    <div className="shop-title"><p className="eyebrow">THE COLLECTION</p><h1>{category === "All" ? "Shop all" : category}</h1><p>Considered essentials for every kind of shift.</p></div>
    <div className="shop-toolbar">
      <div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search the collection"/></div>
      <button className="filter-toggle" onClick={()=>setFilters(!filters)}><SlidersHorizontal size={17}/> Filters</button>
      <label>Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option>Featured</option><option>Price: Low</option><option>Price: High</option></select></label>
    </div>
    <div className="catalog">
      <aside className={filters ? "visible" : ""}>
        <Filter title="Category" options={["All","Scrubs","Lab Coats","Jackets","Accessories"]} value={category} set={setCategory}/>
        <Filter title="Color" options={["All",...Object.keys(palette)]} value={color} set={setColor} swatch/>
        <Filter title="Fabric" options={["All","4-Way Stretch","Flexweave™","Antimicrobial Twill","Poly-Cotton","Rip-stop","Cotton Blend"]} value={fabric} set={setFabric}/>
      </aside>
      <div className="catalog-results"><div className="result-count">{shown.length} pieces</div>{loading ? <div className="empty"><Sparkles/><h3>Loading the collection…</h3></div> : error ? <div className="empty"><X/><h3>Could not load products</h3><p>{error}</p></div> : <><div className="product-grid">{shown.map(p => <ProductCard key={p.id} p={p} {...{openProduct,add}}/>)}</div>{!shown.length && <div className="empty"><Search/><h3>No pieces found</h3><p>{products.length ? "Try adjusting your filters." : "Products added in admin will appear here."}</p></div>}</>}</div>
    </div>
  </main>;
}

function Filter({title,options,value,set,swatch}) {
  return <div className="filter"><h3>{title}<ChevronDown size={16}/></h3>{options.map(o=><label key={o}><input type="radio" checked={value===o} onChange={()=>set(o)}/>{swatch && o!=="All" && <i style={{background:palette[o]}}/>}{o}</label>)}</div>;
}

function Product({product,add,openProduct,products}) {
  const [color,setColor] = useState(product.colors[0]);
  const [size,setSize] = useState(product.sizes[0]);
  const [qty,setQty] = useState(1);
  useEffect(()=>{setColor(product.colors[0]);setSize(product.sizes[0]);setQty(1)},[product]);
  return <main className="product-page">
    <button className="back" onClick={()=>history.back()}><ArrowLeft size={16}/> Back to collection</button>
    <div className="product-layout">
      <div className="gallery"><img src={product.image} alt={product.name}/><div className="gallery-count">01 / 03</div></div>
      <div className="product-info">
        <p className="eyebrow">{product.category} · {product.gender}</p><h1>{product.name}</h1><p className="price">{pkr(product.price)}</p>
        <p className="description">Polished enough for rounds, comfortable enough for the longest shift. Crafted in our signature {product.fabric.toLowerCase()} fabric with a clean, easy fit and thoughtfully placed utility.</p>
        <div className="selector"><div><b>Color</b><span>{color}</span></div><div className="color-options">{product.colors.map(c=><button key={c} className={color===c?"selected":""} onClick={()=>setColor(c)} style={{"--swatch":palette[c]}} aria-label={c}/>)}</div></div>
        <div className="selector"><div><b>Size</b><button className="underlined">Size guide</button></div><div className="size-options">{product.sizes.map(s=><button key={s} className={size===s?"selected":""} onClick={()=>setSize(s)}>{s}</button>)}</div></div>
        <div className="buy-row"><div className="quantity"><button onClick={()=>setQty(Math.max(1,qty-1))}><Minus size={15}/></button>{qty}<button onClick={()=>setQty(qty+1)}><Plus size={15}/></button></div><button className="primary" onClick={()=>Array.from({length:qty}).forEach(()=>add(product,size,color))}>Add to bag — {pkr(product.price*qty)}</button><button className="wish"><Heart/></button></div>
        <p className="stock"><i/> In stock — ready to ship</p>
        {["Details & fit","Fabric & care","Shipping & returns"].map(x=><button className="accordion" key={x}>{x}<Plus size={18}/></button>)}
      </div>
    </div>
    <ProductRow title="Complete the rotation." label="YOU MAY ALSO LIKE" list={products.filter(p=>p.id!==product.id).slice(0,4)} {...{openProduct,add}} goShop={()=>{}}/>
  </main>;
}

function Cart({cart,setCart,open,close}) {
  const total=cart.reduce((s,p)=>s+p.price,0);
  return <><div className={`overlay ${open?"show":""}`} onClick={close}/><aside className={`cart-drawer ${open?"open":""}`}><div className="cart-head"><h2>Your bag <span>{cart.length}</span></h2><button onClick={close}><X/></button></div>
    {!cart.length ? <div className="empty"><ShoppingBag/><h3>Your bag is taking a break.</h3><p>Fill it with something made for the shift.</p><button className="primary" onClick={close}>Continue shopping</button></div> :
    <><div className="cart-items">{cart.map(item=><div className="cart-item" key={item.cartId}><img src={item.image}/><div><strong>{item.name}</strong><span>{item.color} / {item.size}</span><b>{pkr(item.price)}</b></div><button onClick={()=>setCart(c=>c.filter(x=>x.cartId!==item.cartId))}><Trash2 size={16}/></button></div>)}</div><div className="cart-bottom"><p><span>Subtotal</span><b>{pkr(total)}</b></p><small>Shipping calculated at checkout.</small><button className="primary">Checkout <ArrowRight size={17}/></button></div></>}</aside></>;
}

function Admin({ user, profile, authReady, onLogin, products, onCreated }) {
  const [uploading,setUploading] = useState(false);
  const [uploadResult,setUploadResult] = useState(null);
  const [uploadError,setUploadError] = useState("");
  const [adminData,setAdminData] = useState({categories:[],colors:[],clothTypes:[],orders:[]});
  const [showForm,setShowForm] = useState(false);
  const [editingId,setEditingId] = useState(null);
  const [existingImage,setExistingImage] = useState(null);
  const [saving,setSaving] = useState(false);
  const [formError,setFormError] = useState("");
  const [formSuccess,setFormSuccess] = useState("");
  const [form,setForm] = useState({name:"",description:"",category_id:"",cloth_type_id:"",gender:"unisex",base_price:"",is_featured:false});
  const [variants,setVariants] = useState([{color_id:"",size:"M",sku:"",stock_quantity:"0",price_override:""}]);
  useEffect(() => {
    if (user && ["admin","staff"].includes(profile?.role)) {
      fetchAdminData().then(setAdminData).catch(error=>setFormError(error.message));
    }
  }, [user,profile]);
  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadError(""); setUploadResult(null);
    try { setUploadResult(await uploadToImageKit(file)); }
    catch (error) { setUploadError(error.message); }
    finally { setUploading(false); event.target.value = ""; }
  };
  const updateVariant = (index,key,value) => setVariants(rows => rows.map((row,i)=>i===index?{...row,[key]:value}:row));
  const resetEditor = () => {
    setEditingId(null); setExistingImage(null); setUploadResult(null); setUploadError(""); setFormError(""); setFormSuccess("");
    setForm({name:"",description:"",category_id:"",cloth_type_id:"",gender:"unisex",base_price:"",is_featured:false});
    setVariants([{color_id:"",size:"M",sku:"",stock_quantity:"0",price_override:""}]);
  };
  const openNew = () => { resetEditor(); setShowForm(true); };
  const openEdit = product => {
    setEditingId(product.id); setExistingImage({url:product.originalImage,fileId:product.imageFileId});
    setForm({name:product.name,description:product.description||"",category_id:product.categoryId||"",cloth_type_id:product.clothTypeId||"",gender:product.gender.toLowerCase(),base_price:String(product.price),is_featured:product.isFeatured});
    setVariants(product.variants.map(v=>({color_id:v.colors?.id||"",size:v.size,sku:v.sku,stock_quantity:String(v.stock_quantity),price_override:v.price_override==null?"":String(v.price_override)})));
    setUploadResult(null); setFormError(""); setFormSuccess(""); setShowForm(true); window.scrollTo({top:0,behavior:"smooth"});
  };
  const removeProduct = async product => {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    setFormError("");
    try {
      if (product.imageFileId) await deleteFromImageKit(product.imageFileId);
      await deleteProduct(product.id);
      await onCreated();
    } catch (error) { setFormError(error.message); }
  };
  const submitProduct = async (event) => {
    event.preventDefault(); setSaving(true); setFormError(""); setFormSuccess("");
    try {
      if (!uploadResult && !existingImage?.url) throw new Error("Upload at least one product image.");
      if (!variants.length || variants.some(v=>!v.color_id||!v.size||!v.sku)) throw new Error("Complete every variant row.");
      const payload = {
        product: {
          name: form.name.trim(), slug: `${slugify(form.name)}-${Date.now().toString().slice(-6)}`,
          description: form.description.trim(), category_id: form.category_id,
          cloth_type_id: form.cloth_type_id || null, gender: form.gender,
          base_price: Number(form.base_price), is_active: true, is_featured: form.is_featured
        },
        variants: variants.map(v=>({
          color_id:v.color_id,size:v.size.trim(),sku:v.sku.trim(),
          stock_quantity:Number(v.stock_quantity),price_override:v.price_override?Number(v.price_override):null,is_active:true
        })),
        image: uploadResult
      };
      if (editingId) {
        await updateProductWithVariants({id:editingId,...payload});
        if (uploadResult && existingImage?.fileId) deleteFromImageKit(existingImage.fileId).catch(()=>{});
      } else await createProductWithVariants(payload);
      setFormSuccess(editingId ? "Product updated successfully." : "Product published successfully.");
      await onCreated();
      if (editingId) setTimeout(()=>{resetEditor();setShowForm(false)},700);
    } catch (error) { setFormError(error.message); }
    finally { setSaving(false); }
  };
  if (!authReady) return <main className="auth-page"><section className="account-card"><p>Checking your account…</p></section></main>;
  if (!user || !["admin","staff"].includes(profile?.role)) return <main className="auth-page"><section className="account-card"><ShieldCheck size={35}/><p className="eyebrow">RESTRICTED AREA</p><h1>Admin access required.</h1><p>Sign in with an administrator or staff account to manage the store.</p><button className="primary" onClick={onLogin}>Sign in</button></section></main>;
  const revenue=adminData.orders.reduce((sum,o)=>["paid","processing","shipped","delivered"].includes(o.status)?sum+Number(o.total_amount):sum,0);
  const metrics=[["Catalog products",String(products.length),"Live"],["Recorded revenue",pkr(revenue),"From orders"],["Pending orders",String(adminData.orders.filter(o=>o.status==="pending").length),"Needs review"],["Low stock",String(products.filter(p=>p.stock<10).length),"Products"]];
  return <main className="admin">
    <div className="admin-title"><div><p className="eyebrow">ADMIN / OVERVIEW</p><h1>Good morning, {profile?.full_name?.split(" ")[0] || "Admin"}.</h1><p>Manage the live Supabase catalog and ImageKit media.</p></div><button className="primary" onClick={()=>showForm?(resetEditor(),setShowForm(false)):openNew()}>{showForm?<X size={17}/>:<Plus size={17}/>} {showForm?"Close form":"Add product"}</button></div>
    {showForm && <form className="product-editor" onSubmit={submitProduct}>
      <div className="editor-heading"><div><p className="eyebrow">{editingId?"EDIT CATALOG ITEM":"NEW CATALOG ITEM"}</p><h2>{editingId?"Update product":"Product details"}</h2></div><span>All fields marked * are required</span></div>
      <div className="editor-grid">
        <label>Product name *<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
        <label>Base price *<input type="number" min="0" step=".01" value={form.base_price} onChange={e=>setForm({...form,base_price:e.target.value})} required/></label>
        <label>Category *<select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} required><option value="">Choose category</option>{adminData.categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Cloth type<select value={form.cloth_type_id} onChange={e=>setForm({...form,cloth_type_id:e.target.value})}><option value="">Choose fabric</option>{adminData.clothTypes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Gender fit<select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="unisex">Unisex</option><option value="women">Women</option><option value="men">Men</option></select></label>
        <label className="check-label"><input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form,is_featured:e.target.checked})}/> Feature on homepage</label>
        <label className="editor-wide">Description<textarea rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      </div>
      <div className="editor-section"><div><h3>Product image *</h3><p>JPEG, PNG, WebP, or AVIF. Uploaded securely to ImageKit.</p></div><label className="primary upload-button">{uploading?"Uploading…":uploadResult||existingImage?.url?"Replace image":"Choose image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={uploadImage}/></label>{(uploadResult||existingImage?.url)&&<div className="upload-result"><Check/><img src={uploadResult?.thumbnailUrl||uploadResult?.url||existingImage.url}/><span>{uploadResult?"New image ready":"Current image"}</span></div>}</div>
      {uploadError&&<div className="auth-error">{uploadError}</div>}
      <div className="variants-head"><div><h3>Variants *</h3><p>Add each color and size combination with its own SKU and stock.</p></div><button type="button" onClick={()=>setVariants(v=>[...v,{color_id:"",size:"M",sku:"",stock_quantity:"0",price_override:""}])}><Plus size={15}/> Add variant</button></div>
      <div className="variant-table">{variants.map((v,i)=><div className="variant-row" key={i}>
        <select value={v.color_id} onChange={e=>updateVariant(i,"color_id",e.target.value)} required><option value="">Color</option>{adminData.colors.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <input placeholder="Size" value={v.size} onChange={e=>updateVariant(i,"size",e.target.value)} required/>
        <input placeholder="SKU" value={v.sku} onChange={e=>updateVariant(i,"sku",e.target.value)} required/>
        <input type="number" min="0" placeholder="Stock" value={v.stock_quantity} onChange={e=>updateVariant(i,"stock_quantity",e.target.value)} required/>
        <input type="number" min="0" step=".01" placeholder="Price override" value={v.price_override} onChange={e=>updateVariant(i,"price_override",e.target.value)}/>
        <button type="button" aria-label="Remove variant" disabled={variants.length===1} onClick={()=>setVariants(rows=>rows.filter((_,x)=>x!==i))}><Trash2 size={16}/></button>
      </div>)}</div>
      {formError&&<div className="auth-error">{formError}</div>}{formSuccess&&<div className="auth-message">{formSuccess}</div>}
      <div className="editor-actions"><button type="button" onClick={()=>{resetEditor();setShowForm(false)}}>Cancel</button><button className="primary" disabled={saving||uploading}>{saving?"Saving…":editingId?"Save changes":"Publish product"} <ArrowRight size={16}/></button></div>
    </form>}
    <div className="metrics">{metrics.map((m,i)=><div key={m[0]}><span>{i===0?<BarChart3/>:i===1?<ShoppingBag/>:i===2?<Package/>:<Sparkles/>}</span><p>{m[0]}</p><h2>{m[1]}</h2><small>{m[2]}</small></div>)}</div>
    <div className="admin-grid"><section><div className="panel-head"><h2>Recent orders</h2></div>{adminData.orders.length?<div className="order-table">{adminData.orders.map(o=><div key={o.id}><b>#{o.id.slice(0,8)}</b><span>{new Date(o.created_at).toLocaleDateString()}</span><strong>{pkr(o.total_amount)}</strong><em className={o.status}>{o.status}</em></div>)}</div>:<div className="admin-empty">No orders yet.</div>}</section>
    <section><div className="panel-head"><h2>Inventory alerts</h2></div>{products.filter(p=>p.stock<10).length?products.filter(p=>p.stock<10).map(p=><div className="stock-row" key={p.id}>{p.image&&<img src={p.image}/>}<div><b>{p.name}</b><span>{p.colors.join(", ")}</span></div><strong>{p.stock} left</strong></div>):<div className="admin-empty">No low-stock products.</div>}</section></div>
    <section className="admin-products"><div className="panel-head"><h2>Live products</h2><span>{products.length} total</span></div>{products.length?<div className="product-table product-actions-table"><div className="table-header"><span>Product</span><span>Category</span><span>Stock</span><span>Price</span><span>Status</span><span>Actions</span></div>{products.map(p=><div key={p.id}><span>{p.image&&<img src={p.image}/>}<b>{p.name}</b></span><span>{p.category}</span><span>{p.stock}</span><span>{pkr(p.price)}</span><span className="active"><i/> Active</span><span className="row-actions"><button onClick={()=>openEdit(p)}>Edit</button><button onClick={()=>removeProduct(p)}><Trash2 size={14}/> Delete</button></span></div>)}</div>:<div className="admin-empty large">No products yet. Use “Add product” to publish your first item.</div>}</section>
  </main>;
}

function Footer({goShop}) {
  return <footer><div className="footer-brand"><span className="logo-mark"><i/><i/><i/></span><h2>MEDZAPPERAL</h2><p>Made for the shift.<br/>Designed for what matters.</p></div><div><h3>Shop</h3>{["Scrubs","Lab Coats","Jackets","Accessories"].map(x=><button key={x} onClick={()=>goShop(x)}>{x}</button>)}</div><div><h3>Help</h3><a>Size guide</a><a>Shipping & returns</a><a>Contact us</a><a>FAQ</a></div><div><h3>Follow</h3><a>Instagram</a><a>TikTok</a><a>Pinterest</a></div><div className="footer-bottom"><span>© 2026 MEDZAPPERAL</span><span>Privacy · Terms · Accessibility</span></div></footer>;
}

createRoot(document.getElementById("root")).render(<App/>);
