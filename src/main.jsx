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
import { uploadToImageKit } from "./lib/imagekit";
import "./styles.css";

const palette = {
  Navy: "#172d4f", "Ceil Blue": "#9bbbd1", Black: "#252525",
  Wine: "#722f48", Olive: "#78836a", White: "#e9e7df", Sage: "#8e9b88"
};

const products = [
  { id: 1, name: "The Essential Scrub Set", category: "Scrubs", fabric: "4-Way Stretch", gender: "Unisex", price: 68, colors: ["Navy", "Ceil Blue", "Black"], sizes: ["XS","S","M","L","XL","2XL"], badge: "Best seller", stock: 48, image: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=900&q=85" },
  { id: 2, name: "Alta Tailored Scrub Top", category: "Scrubs", fabric: "Flexweave™", gender: "Women", price: 38, colors: ["Wine", "Navy", "Sage"], sizes: ["XS","S","M","L","XL"], badge: "New", stock: 32, image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=85" },
  { id: 3, name: "Atlas Utility Jogger", category: "Scrubs", fabric: "4-Way Stretch", gender: "Men", price: 44, colors: ["Black", "Navy", "Olive"], sizes: ["S","M","L","XL","2XL"], stock: 18, image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=900&q=85" },
  { id: 4, name: "Meridian Lab Coat", category: "Lab Coats", fabric: "Antimicrobial Twill", gender: "Unisex", price: 92, colors: ["White", "Black"], sizes: ["XS","S","M","L","XL"], badge: "New", stock: 26, image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=900&q=85" },
  { id: 5, name: "Tempo Warm-Up Jacket", category: "Jackets", fabric: "Flexweave™", gender: "Unisex", price: 64, colors: ["Navy", "Black", "Sage"], sizes: ["S","M","L","XL"], stock: 9, image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=900&q=85" },
  { id: 6, name: "Shift Compression Socks", category: "Accessories", fabric: "Cotton Blend", gender: "Unisex", price: 18, colors: ["Navy", "Black", "Wine"], sizes: ["S/M","L/XL"], stock: 64, image: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=900&q=85" },
  { id: 7, name: "Solace Straight-Leg Pant", category: "Scrubs", fabric: "Poly-Cotton", gender: "Women", price: 42, colors: ["Ceil Blue", "Navy", "Olive"], sizes: ["XS","S","M","L","XL"], stock: 21, image: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=900&q=85" },
  { id: 8, name: "Field Notes Utility Tote", category: "Accessories", fabric: "Rip-stop", gender: "Unisex", price: 36, colors: ["Olive", "Black"], sizes: ["One size"], stock: 15, image: "https://images.unsplash.com/photo-1590611936760-eeb9bc598548?auto=format&fit=crop&w=900&q=85" }
];

const categoryCards = [
  ["Scrubs", "Built for every move", products[0].image],
  ["Lab Coats", "Precision, refined", products[3].image],
  ["Jackets", "Your extra layer", products[4].image],
  ["Accessories", "Shift essentials", products[5].image]
];

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem("mz-theme") === "dark");
  const [page, setPage] = useState("home");
  const [selected, setSelected] = useState(products[0]);
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
    <div className="announcement">COMPLIMENTARY SHIPPING ON ORDERS $100+ <span>SHOP NOW <ArrowRight size={13}/></span></div>
    <Header {...{dark,setDark,page,setPage,goShop,cart,setCartOpen,menuOpen,setMenuOpen,query,setQuery,user}} />
    {page === "home" && <Home {...{goShop,openProduct,add}} />}
    {page === "shop" && <Shop initialQuery={query} openProduct={openProduct} add={add}/>}
    {page === "product" && <Product product={selected} add={add} openProduct={openProduct}/>}
    {page === "auth" && <AuthPage user={user} profile={profile} onDone={() => setPage("home")} onAdmin={() => setPage("admin")} onSignOut={async () => { await supabase?.auth.signOut(); setPage("home"); }}/>}
    {page === "admin" && <Admin user={user} profile={profile} authReady={authReady} onLogin={() => setPage("auth")} />}
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

function Home({goShop,openProduct,add}) {
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
      <div className="category-grid">{categoryCards.map(([name,tag,img],i) =>
        <button className={`category c${i+1}`} key={name} onClick={() => goShop(name)}>
          <img src={img} alt=""/><span><small>0{i+1}</small><strong>{name}</strong><em>{tag} <ArrowRight size={15}/></em></span>
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
    <div className="product-grid">{list.map(p => <ProductCard key={p.id} p={p} openProduct={openProduct} add={add}/>)}</div>
  </section>;
}

function ProductCard({p,openProduct,add}) {
  return <article className="product-card">
    <button className="product-image" onClick={() => openProduct(p)}><img src={p.image} alt={p.name}/>{p.badge && <span className="badge">{p.badge}</span>}<span className="quick" onClick={e => {e.stopPropagation(); add(p)}}><Plus size={18}/> Quick add</span></button>
    <div className="product-meta"><button onClick={() => openProduct(p)}><strong>{p.name}</strong><span>{p.gender} · {p.fabric}</span></button><b>${p.price}</b></div>
    <div className="swatches">{p.colors.map(c => <i key={c} style={{background:palette[c]}} title={c}/>)}</div>
  </article>;
}

function Shop({initialQuery,openProduct,add}) {
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
      <div className="catalog-results"><div className="result-count">{shown.length} pieces</div><div className="product-grid">{shown.map(p => <ProductCard key={p.id} p={p} {...{openProduct,add}}/>)}</div>{!shown.length && <div className="empty"><Search/><h3>No pieces found</h3><p>Try adjusting your filters.</p></div>}</div>
    </div>
  </main>;
}

function Filter({title,options,value,set,swatch}) {
  return <div className="filter"><h3>{title}<ChevronDown size={16}/></h3>{options.map(o=><label key={o}><input type="radio" checked={value===o} onChange={()=>set(o)}/>{swatch && o!=="All" && <i style={{background:palette[o]}}/>}{o}</label>)}</div>;
}

function Product({product,add,openProduct}) {
  const [color,setColor] = useState(product.colors[0]);
  const [size,setSize] = useState(product.sizes[0]);
  const [qty,setQty] = useState(1);
  useEffect(()=>{setColor(product.colors[0]);setSize(product.sizes[0]);setQty(1)},[product]);
  return <main className="product-page">
    <button className="back" onClick={()=>history.back()}><ArrowLeft size={16}/> Back to collection</button>
    <div className="product-layout">
      <div className="gallery"><img src={product.image} alt={product.name}/><div className="gallery-count">01 / 03</div></div>
      <div className="product-info">
        <p className="eyebrow">{product.category} · {product.gender}</p><h1>{product.name}</h1><p className="price">${product.price}.00</p>
        <p className="description">Polished enough for rounds, comfortable enough for the longest shift. Crafted in our signature {product.fabric.toLowerCase()} fabric with a clean, easy fit and thoughtfully placed utility.</p>
        <div className="selector"><div><b>Color</b><span>{color}</span></div><div className="color-options">{product.colors.map(c=><button key={c} className={color===c?"selected":""} onClick={()=>setColor(c)} style={{"--swatch":palette[c]}} aria-label={c}/>)}</div></div>
        <div className="selector"><div><b>Size</b><button className="underlined">Size guide</button></div><div className="size-options">{product.sizes.map(s=><button key={s} className={size===s?"selected":""} onClick={()=>setSize(s)}>{s}</button>)}</div></div>
        <div className="buy-row"><div className="quantity"><button onClick={()=>setQty(Math.max(1,qty-1))}><Minus size={15}/></button>{qty}<button onClick={()=>setQty(qty+1)}><Plus size={15}/></button></div><button className="primary" onClick={()=>Array.from({length:qty}).forEach(()=>add(product,size,color))}>Add to bag — ${product.price*qty}</button><button className="wish"><Heart/></button></div>
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
    <><div className="cart-items">{cart.map(item=><div className="cart-item" key={item.cartId}><img src={item.image}/><div><strong>{item.name}</strong><span>{item.color} / {item.size}</span><b>${item.price}.00</b></div><button onClick={()=>setCart(c=>c.filter(x=>x.cartId!==item.cartId))}><Trash2 size={16}/></button></div>)}</div><div className="cart-bottom"><p><span>Subtotal</span><b>${total}.00</b></p><small>Shipping calculated at checkout.</small><button className="primary">Checkout <ArrowRight size={17}/></button></div></>}</aside></>;
}

function Admin({ user, profile, authReady, onLogin }) {
  const [uploading,setUploading] = useState(false);
  const [uploadResult,setUploadResult] = useState(null);
  const [uploadError,setUploadError] = useState("");
  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadError(""); setUploadResult(null);
    try { setUploadResult(await uploadToImageKit(file)); }
    catch (error) { setUploadError(error.message); }
    finally { setUploading(false); event.target.value = ""; }
  };
  if (!authReady) return <main className="auth-page"><section className="account-card"><p>Checking your account…</p></section></main>;
  if (!user || !["admin","staff"].includes(profile?.role)) return <main className="auth-page"><section className="account-card"><ShieldCheck size={35}/><p className="eyebrow">RESTRICTED AREA</p><h1>Admin access required.</h1><p>Sign in with an administrator or staff account to manage the store.</p><button className="primary" onClick={onLogin}>Sign in</button></section></main>;
  const metrics=[["Revenue this week","$12,840","+18.2%"],["Orders today","36","+8.1%"],["Pending orders","14","Needs review"],["Low stock","6","Variants"]];
  return <main className="admin">
    <div className="admin-title"><div><p className="eyebrow">ADMIN / OVERVIEW</p><h1>Good morning, {profile?.full_name?.split(" ")[0] || "Admin"}.</h1><p>Here’s what’s happening with your store today.</p></div><button className="primary"><Plus size={17}/> Add product</button></div>
    <section className="imagekit-panel">
      <div><p className="eyebrow">IMAGEKIT MEDIA</p><h2>Product image pipeline</h2><p>Files upload directly to ImageKit using a short-lived signature from the protected server endpoint.</p></div>
      <label className="primary upload-button">{uploading ? "Uploading…" : "Upload test image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={uploadImage}/></label>
      {uploadResult && <div className="upload-result"><Check size={18}/><img src={uploadResult.thumbnailUrl || uploadResult.url}/><span>Upload ready<br/><small>{uploadResult.fileId}</small></span></div>}
      {uploadError && <div className="auth-error">{uploadError}</div>}
    </section>
    <div className="metrics">{metrics.map((m,i)=><div key={m[0]}><span>{i===0?<BarChart3/>:i===1?<ShoppingBag/>:i===2?<Package/>:<Sparkles/>}</span><p>{m[0]}</p><h2>{m[1]}</h2><small>{m[2]}</small></div>)}</div>
    <div className="admin-grid"><section><div className="panel-head"><h2>Recent orders</h2><button>View all <ArrowRight size={15}/></button></div><div className="order-table">{["MZ-2048|Sarah Mitchell|$156.00|Paid","MZ-2047|James Chen|$92.00|Processing","MZ-2046|Priya Sharma|$224.00|Pending","MZ-2045|Omar Wilson|$68.00|Shipped"].map(r=>{let c=r.split("|");return <div key={c[0]}><b>{c[0]}</b><span>{c[1]}</span><strong>{c[2]}</strong><em className={c[3].toLowerCase()}>{c[3]}</em></div>})}</div></section>
    <section><div className="panel-head"><h2>Inventory alerts</h2><button>Manage <ArrowRight size={15}/></button></div>{products.filter(p=>p.stock<20).map(p=><div className="stock-row" key={p.id}><img src={p.image}/><div><b>{p.name}</b><span>{p.colors[0]} · M</span></div><strong>{p.stock} left</strong></div>)}</section></div>
    <section className="admin-products"><div className="panel-head"><h2>Product performance</h2><button><SlidersHorizontal size={15}/> Filter</button></div><div className="product-table"><div className="table-header"><span>Product</span><span>Category</span><span>Stock</span><span>Price</span><span>Status</span></div>{products.slice(0,5).map(p=><div key={p.id}><span><img src={p.image}/><b>{p.name}</b></span><span>{p.category}</span><span>{p.stock}</span><span>${p.price}.00</span><span className="active"><i/> Active</span></div>)}</div></section>
  </main>;
}

function Footer({goShop}) {
  return <footer><div className="footer-brand"><span className="logo-mark"><i/><i/><i/></span><h2>MEDZAPPERAL</h2><p>Made for the shift.<br/>Designed for what matters.</p></div><div><h3>Shop</h3>{["Scrubs","Lab Coats","Jackets","Accessories"].map(x=><button key={x} onClick={()=>goShop(x)}>{x}</button>)}</div><div><h3>Help</h3><a>Size guide</a><a>Shipping & returns</a><a>Contact us</a><a>FAQ</a></div><div><h3>Follow</h3><a>Instagram</a><a>TikTok</a><a>Pinterest</a></div><div className="footer-bottom"><span>© 2026 MEDZAPPERAL</span><span>Privacy · Terms · Accessibility</span></div></footer>;
}

createRoot(document.getElementById("root")).render(<App/>);
