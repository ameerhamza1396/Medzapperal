import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft, ArrowRight, Banknote, BarChart3, Check, ChevronDown, CircleUserRound,
  CreditCard, Facebook, Heart, Instagram, LayoutGrid, Mail, MapPin, Menu, MessageCircle, Minus, Moon, Package, Phone, Plus, Ruler, Search, ShoppingBag,
  ShieldCheck, SlidersHorizontal, Sparkles, Star, Sun, Trash2, Upload, X
} from "lucide-react";
import hero from "./assets/medzapperal-hero.png";
import { AuthPage } from "./Auth";
import { getMyProfile, isSupabaseConfigured, supabase } from "./lib/supabase";
import { deleteFromImageKit, uploadCustomerLogo, uploadToImageKit } from "./lib/imagekit";
import { createProductWithVariants, deleteProduct, fetchAdminData, fetchCatalog, fetchDefaultAddress, fetchStorefrontContent, placeCodOrder, saveDefaultAddress, slugify, updateOrderStatus, updateProductWithVariants } from "./lib/store";
import "./styles.css";

const palette = {
  "Navy Blue":"#10264C", "Ciel Blue":"#169BC5", "Sky Blue":"#9DD9F3",
  Burgundy:"#6B1835", "Baby Pink":"#E8A7C1", Maroon:"#741D2E", Black:"#171717",
  Grey:"#9A9AA0", "Chocolate Brown":"#553421", "Emerald Green":"#075C3F",
  "Sage Green":"#9CAE8C", "Olive Green":"#4E5422", Beige:"#D2B78C",
  Charcoal:"#46484B", Lavender:"#9363B5"
};
const pkr = value => new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(value)||0);

function prepareOrderChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return {play:()=>{},dispose:()=>{}};
    const context = new AudioContext();
    context.resume();
    return {
      play:() => {
      const gain = context.createGain();
      gain.connect(context.destination);
      gain.gain.setValueAtTime(.0001,context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.14,context.currentTime+.03);
      gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.9);
      [[523.25,0],[659.25,.13],[783.99,.27]].forEach(([frequency,delay]) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(context.currentTime+delay);
        oscillator.stop(context.currentTime+delay+.55);
      });
      setTimeout(()=>context.close(),1300);
      },
      dispose:()=>context.close()
    };
  } catch {
    return {play:()=>{},dispose:()=>{}};
  }
}

const categoryTaglines = {
  Scrubs:"Built for every move",
  "Scrub Upper":"The essential top",
  "Lab Coats":"Precision, refined",
  Outerwear:"Your extra layer",
  Accessories:"Shift essentials"
};

const policyContent = {
  terms: {
    eyebrow:"STORE POLICIES",
    title:"Terms and Conditions",
    intro:"These terms explain product presentation, fabric characteristics, sizing, customization, and refund or exchange expectations for purchases from Medz Apparel.",
    sections:[
      ["Product Images & Color Variation","All product images displayed on our website are real and captured using high-quality cameras. Camera processing, lighting, and screen settings may cause actual colors to appear slightly different in person."],
      ["Fabric Quality Assurance","Our fabrics have been tested and evaluated by our team for more than one year for quality and durability. Refunds or exchanges cannot be accepted solely because a buyer prefers a different fabric texture."],
      ["Fabric Texture & Comfort","Cotton and polyester fabrics may initially feel slightly stiff because of their natural composition. They generally soften and become more comfortable with regular washing."],
      ["Sizing & Customizations","Customers are responsible for selecting the correct size and reviewing customizations such as name or logo engraving. A variation of 0.5 to 1 inch is within standard manufacturing tolerance and is not considered an incorrect size for refund or exchange purposes."],
      ["Design Selection","Some product photographs are provided primarily for color reference. Select the required design from the design options shown on the relevant product listing."],
      ["Trouser Design Standardization","Regardless of styling visible in supporting images, trousers are supplied according to the standard design described on the product page."],
      ["Product Modifications","Medz Apparel may make reasonable product modifications or improvements without prior notice when they enhance quality, construction, or performance."],
      ["Refund & Exchange Request Timeline","Contact us promptly after delivery with your order reference and supporting photographs. Requests are reviewed according to the product condition, customization status, and reason supplied."],
      ["Customized Items","Products made or engraved to a customer’s instructions cannot be returned for preference, sizing selection, or change-of-mind reasons unless Medz Apparel made an eligible production error."],
      ["How to Request","Send the order reference, customer name, issue description, and clear photographs through our official support channel. Do not return an item until return instructions have been provided."],
      ["Condition of Returned Items","Approved returns must be unworn, unwashed, unaltered, and returned with their original packaging and tags. Items showing use or customer damage may be refused."],
      ["Eligible Reasons for Refund or Exchange","Requests may be considered for an incorrect item, verified manufacturing defect, or material difference from the confirmed order, subject to inspection."],
      ["Alterations Instead of Refund or Exchange","Where appropriate, Medz Apparel may offer a reasonable alteration or correction instead of a full refund or replacement."],
      ["Courier Charges","Courier costs depend on the reason for return. When an error is attributable to Medz Apparel, the approved resolution will include the applicable courier arrangement. Other approved returns may require the customer to cover delivery costs."],
      ["Engraving Errors","For missing or incorrect name/logo spelling, placement, or color caused by Medz Apparel, the applicable engraving charge will be refunded. For a major spelling error, a corrected name tag may be provided free of charge to stitch above the incorrect engraving; the original engraving charge will not also be refunded in that case."]
    ]
  },
  shipping: {
    eyebrow:"DELIVERY INFORMATION",
    title:"Shipping Policy",
    intro:"We currently deliver within Pakistan. Delivery estimates begin after the order and any customization details have been confirmed.",
    sections:[
      ["Standard Delivery","Our standard delivery estimate is 8–12 working days, excluding Saturdays and Sundays."],
      ["Urgent Delivery","Urgent delivery is typically 3–5 days and is subject to product, customization, and courier availability."],
      ["Delivery Partners","Orders may be assigned to an available courier partner based on the destination, parcel type, and service availability."],
      ["Shipment Tracking","Tracking information is shared when provided by the assigned courier. Tracking updates can take time to appear after dispatch."],
      ["Delivery Charges","The applicable delivery charge is shown in the final checkout summary before the order is confirmed."],
      ["Price Adjustments","Any approved change to the product, quantity, delivery method, or customization may change the final payable amount. Changes are confirmed before dispatch."],
      ["Unforeseen Delays","Weather, public holidays, access restrictions, service interruptions, or other events outside our reasonable control may extend delivery estimates."],
      ["Shipment Delays","If a shipment is delayed, contact us with the order reference so we can request an update from the courier. Courier timelines remain estimates rather than guaranteed delivery dates."]
    ]
  },
  privacy: {
    eyebrow:"YOUR INFORMATION",
    title:"Privacy Policy",
    intro:"Medz Apparel values your privacy and uses personal information only for legitimate store, delivery, support, and optional marketing purposes.",
    sections:[
      ["Information We Collect","We may collect your name, email address, telephone number, saved delivery address, billing details when applicable, order history, and transaction information. Card payments are currently unavailable; if introduced, payment processing will be handled through an authorized provider."],
      ["How We Use Information","Information is used to create and secure accounts, process orders, arrange delivery, provide customer support, prevent misuse, maintain transaction records, and send promotional email only when you have opted in."],
      ["Information Sharing","Relevant information may be shared with hosting, database, media, payment, communication, and courier providers that support the service. We may also disclose information when required by law or a valid legal request."],
      ["Saved Delivery Details","Saving a delivery address is optional. When selected at checkout, the address is stored against the signed-in account in Supabase and protected by account-level access controls. It can be replaced by saving a newer default address."],
      ["Security","We use reasonable technical and organizational safeguards to reduce unauthorized access, loss, or misuse. No internet-based service can guarantee absolute security."],
      ["Your Choices","You may choose not to save delivery details and may opt out of promotional communications. Required order and legal records may be retained where necessary."],
      ["Policy Updates","Material changes to this policy will be posted on this page. Continued use after an update is subject to the revised policy."]
    ]
  }
};

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
  const [categories,setCategories] = useState([]);
  const [reviews,setReviews] = useState([]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("mz-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);
  const loadCatalog = async () => {
    setCatalogLoading(true); setCatalogError("");
    try {
      const [nextProducts,content] = await Promise.all([fetchCatalog(),fetchStorefrontContent()]);
      setProducts(nextProducts); setCategories(content.categories); setReviews(content.reviews);
    }
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
  const add = (product, size = product.sizes[0], color = product.colors[0], customization = {}) => {
    const variant = product.variants?.find(v => v.size === size && v.colors?.name === color);
    if (!variant) {
      window.alert("That colour and size combination is not available yet. Please choose another option.");
      return;
    }
    const basePrice = variant.price_override == null ? product.price : Number(variant.price_override);
    const measurementFee = Object.values(customization.measurements || {}).filter(value=>String(value).trim()).length * 100;
    const price = basePrice + measurementFee;
    setCart(c => [...c, { ...product, price, basePrice, customization, cartId: `${Date.now()}-${Math.random()}`, size:variant.size, color:variant.colors?.name||color, variantId:variant.id }]);
    setCartOpen(true);
  };

  return <div className="app">
    <div className="announcement">COMPLIMENTARY SHIPPING ON ORDERS PKR 10,000+ <span>SHOP NOW <ArrowRight size={13}/></span></div>
    <Header {...{dark,setDark,page,setPage,goShop,cart,setCartOpen,menuOpen,setMenuOpen,query,setQuery,user,categories}} />
    {page === "home" && <Home {...{goShop,openProduct,add,products,catalogLoading,categories,reviews}} />}
    {page === "shop" && <Shop initialQuery={query} openProduct={openProduct} add={add} products={products} categories={categories} loading={catalogLoading} error={catalogError}/>}
    {page === "colours" && <ColourPalette products={products} onSelect={colour=>goShop(`colour:${colour}`)} />}
    {page === "product" && selected && <Product product={selected} add={add} openProduct={openProduct} products={products}/>}
    {page === "auth" && <AuthPage user={user} profile={profile} onDone={() => setPage("home")} onAdmin={() => setPage("admin")} onContact={() => setPage("contact")} onCheckout={() => setPage("checkout")} onSignOut={async () => { await supabase?.auth.signOut(); setPage("home"); }}/>}
    {page === "admin" && <Admin user={user} profile={profile} authReady={authReady} catalogLoading={catalogLoading} onLogin={() => setPage("auth")} products={products} onCreated={loadCatalog} />}
    {page === "checkout" && <Checkout user={user} profile={profile} cart={cart} setCart={setCart} onLogin={()=>setPage("auth")} onShop={()=>goShop("All")} />}
    {["terms","shipping","privacy"].includes(page) && <PolicyPage policy={policyContent[page]} />}
    {page === "contact" && <ContactPage />}
    <Footer goShop={goShop} onNavigate={setPage} categories={categories}/>
    <Cart cart={cart} setCart={setCart} open={cartOpen} close={() => setCartOpen(false)} onCheckout={()=>{setCartOpen(false);setPage("checkout")}}/>
  </div>;
}

function Header({dark,setDark,page,setPage,goShop,cart,setCartOpen,menuOpen,setMenuOpen,query,setQuery,user,categories=[]}) {
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const [openNavGroup,setOpenNavGroup] = useState("");
  useEffect(() => {
    if (!menuOpen && !openNavGroup) return;
    const closeOutside = event => {
      if (!menuRef.current?.contains(event.target) && !menuButtonRef.current?.contains(event.target)) {
        setMenuOpen(false);
        setOpenNavGroup("");
      }
    };
    const closeOnEscape = event => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setOpenNavGroup("");
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen,openNavGroup,setMenuOpen]);
  const closeNavigation = () => {
    setMenuOpen(false);
    setOpenNavGroup("");
  };
  const selectShopCategory = category => {
    goShop(category);
    closeNavigation();
  };
  return <header>
    <button ref={menuButtonRef} className="mobile-only icon-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => {setMenuOpen(!menuOpen);setOpenNavGroup("")}}><Menu/></button>
    <button className="logo" onClick={() => setPage("home")} aria-label="Medz Apparel home">
      <img className="brand-logo" src="/media/medz-logo.png" alt=""/>MEDZ APPAREL
    </button>
    <nav ref={menuRef} className={menuOpen ? "open" : ""}>
      <div className={`nav-group ${openNavGroup === "scrubs" ? "open" : ""}`}>
        <button className="nav-group-trigger" aria-expanded={openNavGroup === "scrubs"} aria-controls="scrubs-submenu" onClick={() => setOpenNavGroup(current => current === "scrubs" ? "" : "scrubs")}>Scrubs <ChevronDown size={14}/></button>
        <div className="nav-group-menu" id="scrubs-submenu">
          <button onClick={() => selectShopCategory("Scrubs")}>Signature scrubs</button>
          <button onClick={() => {setPage("colours");closeNavigation()}}>Shop by colour</button>
        </div>
      </div>
      <div className={`nav-group ${openNavGroup === "categories" ? "open" : ""}`}>
        <button className="nav-group-trigger" aria-expanded={openNavGroup === "categories"} aria-controls="categories-submenu" onClick={() => setOpenNavGroup(current => current === "categories" ? "" : "categories")}>Categories <ChevronDown size={14}/></button>
        <div className="nav-group-menu" id="categories-submenu">{categories.filter(item=>["Scrub Upper","Lab Coats","Accessories"].includes(item.name)).map(item=><button key={item.id} onClick={()=>selectShopCategory(item.name)}>{item.name}</button>)}</div>
      </div>
      <button onClick={() => selectShopCategory("Sale")}>Sale</button>
      <button onClick={() => {setPage("auth");closeNavigation()}}>Order tracking</button>
      <button onClick={() => {setPage("contact");closeNavigation()}}>Contact us</button>
    </nav>
    <div className="header-actions">
      <button className="icon-btn desktop-only" onClick={() => { if (page !== "shop") { setPage("shop"); setQuery(""); } }}><Search size={20}/></button>
      <button className="icon-btn" onClick={() => setDark(!dark)}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
      <button className="icon-btn account-button" aria-label={user ? "My account" : "Sign in"} onClick={() => setPage("auth")}><CircleUserRound size={20}/>{user && <i/>}</button>
      <button className="icon-btn cart-button" onClick={() => setCartOpen(true)}><ShoppingBag size={20}/>{cart.length > 0 && <b>{cart.length}</b>}</button>
    </div>
  </header>;
}

function Home({goShop,openProduct,add,products=[],catalogLoading,categories=[],reviews=[]}) {
  useEffect(() => {
    const root = document.querySelector(".home-page");
    if (!root) return;
    const elements = root.querySelectorAll(
      ".hero-seo > *, .values > *, .section-head, .category, .products-section .product-card, .manifesto > *, .newsletter > *"
    );
    elements.forEach((element,index) => {
      element.classList.add("scroll-reveal");
      element.style.setProperty("--reveal-delay",`${(index%4)*70}ms`);
    });
    if (!("IntersectionObserver" in window)) {
      elements.forEach(element=>element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },{threshold:.12,rootMargin:"0px 0px -7% 0px"});
    elements.forEach(element=>observer.observe(element));
    return () => observer.disconnect();
  },[products.length,catalogLoading]);
  const visibleCategories = categories.length ? categories : [...new Set(products.map(product=>product.category))].map((name,index)=>({id:name,name,sort_order:index}));
  const categoryImage = category =>
    category.image_url || products.find(product =>
      product.image && product.category?.toLowerCase() === category.name.toLowerCase()
    )?.image || hero;
  const featured = products.filter(product=>product.isFeatured).slice(0,8);
  const favorites = featured.length ? featured : products.slice(0,8);
  return <main className="home-page">
    <section className="hero">
      <video autoPlay muted loop playsInline poster="/media/medz-hero-poster.jpg" aria-label="Medz Apparel medical uniforms and outerwear collection">
        <source src="/media/medz-hero.webm" type="video/webm"/>
        <img src="/media/medz-hero.gif" alt="Medz Apparel medical uniforms and outerwear collection"/>
      </video>
    </section>
    <section className="section home-categories">
      <div className="section-head"><div><p className="eyebrow">SHOP BY CATEGORY</p><h2>Find your uniform.</h2></div><button className="text-link" onClick={() => goShop("All")}>View all <ArrowRight size={16}/></button></div>
      <div className="category-grid dynamic-category-grid">{catalogLoading ? Array.from({length:5},(_,index)=><div className="category-skeleton skeleton" key={index}/>) : visibleCategories.slice(0,5).map((category,i) =>
        <button className="category" key={category.id} onClick={() => goShop(category.name)}>
          <img src={categoryImage(category)} alt={`${category.name} from the Medz Apparel collection`}/><span><small>{String(i+1).padStart(2,"0")}</small><strong>{category.name}</strong><em>{categoryTaglines[category.name] || "Explore the collection"} <ArrowRight size={15}/></em></span>
        </button>)}</div>
    </section>
    <ProductRow title="The shift favorites." label="FEATURED / FAVORITES" list={favorites} loading={catalogLoading} carousel {...{openProduct,add,goShop}} />
    <section className="hero-seo">
      <p className="eyebrow">MEDICAL APPAREL / PAKISTAN</p>
      <h1>Premium Medical Scrubs and Healthcare Apparel in Pakistan</h1>
      <h2>Comfortable uniforms designed for doctors, nurses, and healthcare professionals.</h2>
    </section>
    <section className="values">
      <p>Designed with purpose.</p>
      <div><span>01</span><h3>All-shift comfort</h3><p>Soft, breathable fabrics that move when you do.</p></div>
      <div><span>02</span><h3>Considered details</h3><p>Purposeful pockets. Tailored lines. Nothing extra.</p></div>
      <div><span>03</span><h3>Made to last</h3><p>Durable construction, shift after shift.</p></div>
    </section>
    <ProductRow title="Fresh off the line." label="NEW ARRIVALS" list={products.slice(0,8)} loading={catalogLoading} carousel {...{openProduct,add,goShop}} />
    <Reviews reviews={reviews}/>
    <section className="manifesto">
      <span className="eyebrow">WHY MEDZ APPAREL</span>
      <h2>Because what you wear<br/>should work as hard as <em>you do.</em></h2>
      <p>We design medical apparel through a more thoughtful lens—balancing technical performance with a sense of ease, so you can focus on what matters.</p>
      <button className="secondary">Our story <ArrowRight size={16}/></button>
    </section>
    <section className="newsletter"><p className="eyebrow">STAY IN THE LOOP</p><h2>A better shift starts here.</h2><p>New drops, thoughtful stories, and first access—straight to your inbox.</p><form onSubmit={e => e.preventDefault()}><input placeholder="Email address" type="email"/><button><ArrowRight/></button></form></section>
  </main>;
}

function ProductSkeletons({count=4,carousel=false}) {
  return <div className={`product-grid ${carousel?"product-carousel":""}`}>{Array.from({length:count},(_,index)=><article className="product-card product-skeleton" key={index}><div className="skeleton"/><span className="skeleton"/><small className="skeleton"/></article>)}</div>;
}

function ProductRow({title,label,list,openProduct,add,goShop,carousel=false,loading=false}) {
  return <section className="section products-section">
    <div className="section-head"><div><p className="eyebrow">{label}</p><h2>{title}</h2></div><button className="text-link" onClick={() => goShop("All")}>Shop all <ArrowRight size={16}/></button></div>
    {loading ? <ProductSkeletons count={carousel?8:4} carousel={carousel}/> : list.length ? <div className={`product-grid ${carousel?"product-carousel":""}`}>{list.map(p => <ProductCard key={p.id} p={p} openProduct={openProduct} add={add}/>)}</div> :
    <div className="catalog-empty"><Package/><h3>The first collection is coming soon.</h3><p>New pieces added in the admin panel will appear here automatically.</p></div>}
  </section>;
}

const colourDescriptions = {
  "Ceil Blue":"Fresh · Clean · Calming", Navy:"Classic · Professional · Confident",
  "Sky Blue":"Soft · Soothing · Serene", Burgundy:"Rich · Elegant · Powerful",
  "Baby Pink":"Gentle · Soft · Nurturing", Maroon:"Bold · Strong · Timeless",
  Black:"Sleek · Sharp · Sophisticated", Grey:"Balanced · Neutral · Modern",
  "Chocolate Brown":"Warm · Earthy · Reliable", "Emerald Green":"Vibrant · Rich · Refreshing",
  "Sage Green":"Calm · Natural · Grounded", "Olive Green":"Strong · Natural · Balanced",
  Beige:"Warm · Soft · Minimal", Charcoal:"Strong · Modern · Versatile",
  Lavender:"Calm · Elegant · Creative"
};

function ColourPalette({products=[],onSelect}) {
  const colours=[...new Map(products.flatMap(product=>product.variants||[]).filter(variant=>variant.colors?.name).map(variant=>[variant.colors.name,{name:variant.colors.name,hex:variant.colors.hex}])).values()];
  return <main className="colour-page"><section className="colour-hero"><img className="brand-logo" src="/media/medz-logo.png" alt=""/><p className="eyebrow">MEDZ APPAREL · THE DOCTOR&apos;S THREAD</p><h1><span>Colour</span> <em>Palette</em></h1><p>Carefully curated shades for every style and every shift.</p></section><section className="colour-grid">{colours.map(colour=><button key={colour.name} onClick={()=>onSelect(colour.name)}><span className="colour-fabric" style={{"--colour":colour.hex||palette[colour.name]||"#777"}}/><strong>{colour.name}</strong><i>✦</i><small>{colourDescriptions[colour.name]||"Premium colour · Everyday comfort"}</small></button>)}</section>{!colours.length&&<div className="reviews-empty"><Sparkles/><p>Colours added to active Supabase product variants will appear here automatically.</p></div>}<section className="colour-signoff"><p>Because colour is more than a choice.</p><h2>It&apos;s an expression.</h2><span>Premium colours · Premium comfort · Premium you.</span></section></main>;
}

function Reviews({reviews}) {
  return <section className="section reviews-section"><div className="section-head"><div><p className="eyebrow">CUSTOMER REVIEWS</p><h2>Worn and loved.</h2></div><span><Star size={15} fill="currentColor"/> Real customer feedback</span></div>
    {reviews.length?<div className="review-posters">{reviews.map(review=><figure key={review.id}><img src={review.image_url} alt={review.title || "Medz Apparel customer review"}/>{review.title&&<figcaption>{review.title}</figcaption>}</figure>)}</div>:<div className="reviews-empty"><MessageCircle/><p>Customer review stories will appear here when review images are added in Supabase.</p></div>}
  </section>;
}

function ProductCard({p,openProduct,add}) {
  return <article className="product-card">
    <button className="product-image" onClick={() => openProduct(p)}>{p.image ? <img src={p.image} alt={p.name}/> : <span className="image-placeholder"><Package/></span>}{p.badge && <span className="badge">{p.badge}</span>}<span className="quick" onClick={e => {e.stopPropagation(); add(p)}}><Plus size={18}/> Quick add</span></button>
    <div className="product-meta"><button onClick={() => openProduct(p)}><strong>{p.name}</strong><span>{p.gender} · {p.fabric}</span></button><b>{pkr(p.price)}</b></div>
    <div className="swatches">{p.colors.map(c => <i key={c} style={{background:p.variants.find(variant=>variant.colors?.name===c)?.colors?.hex||palette[c]||"#777"}} title={c}/>)}</div>
  </article>;
}

function Shop({initialQuery,openProduct,add,products=[],categories=[],loading,error}) {
  const categoryOptions = ["All",...categories.map(item=>item.name)];
  const requestedColour = initialQuery?.startsWith("colour:") ? initialQuery.slice(7) : "All";
  const normalizedInitial = initialQuery === "Sale" || categoryOptions.includes(initialQuery) ? initialQuery : "All";
  const [category,setCategory] = useState(normalizedInitial);
  const [search,setSearch] = useState("");
  const [color,setColor] = useState(requestedColour);
  const [fabric,setFabric] = useState("All");
  const [sort,setSort] = useState("Featured");
  const [filters,setFilters] = useState(false);
  const colorOptions = ["All",...new Set(products.flatMap(product=>product.colors))];
  const fabricOptions = ["All",...new Set(products.map(product=>product.fabric).filter(Boolean))];
  useEffect(() => {
    setCategory(initialQuery === "Sale" || categoryOptions.includes(initialQuery) ? initialQuery : "All");
    setColor(initialQuery?.startsWith("colour:") ? initialQuery.slice(7) : "All");
  }, [initialQuery,categories.length]);
  let shown = useMemo(() => products.filter(p =>
    (category === "All" || category === "Sale" ? category !== "Sale" || p.isFeatured : p.category === category) &&
    (color === "All" || p.colors.includes(color)) &&
    (fabric === "All" || p.fabric === fabric) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a,b) => sort === "Price: Low" ? a.price-b.price : sort === "Price: High" ? b.price-a.price : Number(b.isFeatured)-Number(a.isFeatured)||new Date(b.createdAt)-new Date(a.createdAt)),[products,category,color,fabric,search,sort]);
  return <main className="shop">
    <div className="shop-title"><p className="eyebrow">THE COLLECTION</p><h1>{category === "All" ? "Shop all" : category}</h1><p>Considered essentials for every kind of shift.</p></div>
    <div className="shop-toolbar">
      <div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search the collection"/></div>
      <button className="filter-toggle" onClick={()=>setFilters(!filters)}><SlidersHorizontal size={17}/> Filters</button>
      <label>Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option>Featured</option><option>Price: Low</option><option>Price: High</option></select></label>
    </div>
    <div className="catalog">
      <aside className={filters ? "visible" : ""}>
        <Filter title="Category" options={[...categoryOptions,"Sale"]} value={category} set={setCategory}/>
        <Filter title="Colour" options={colorOptions} value={color} set={setColor} swatch/>
        <Filter title="Fabric" options={fabricOptions} value={fabric} set={setFabric}/>
      </aside>
      <div className="catalog-results"><div className="result-count">{loading?"Loading products…":`${shown.length} pieces`}</div>{loading ? <ProductSkeletons count={8}/> : error ? <div className="empty"><X/><h3>Could not load products</h3><p>{error}</p></div> : <><div className="product-grid">{shown.map(p => <ProductCard key={p.id} p={p} {...{openProduct,add}}/>)}</div>{!shown.length && <div className="empty"><Search/><h3>No pieces found</h3><p>{products.length ? "Try adjusting your filters." : "Products added in admin will appear here."}</p></div>}</>}</div>
    </div>
  </main>;
}

function Filter({title,options,value,set,swatch}) {
  return <div className="filter"><h3>{title}<ChevronDown size={16}/></h3>{options.map(o=><label key={o}><input type="radio" checked={value===o} onChange={()=>set(o)}/>{swatch && o!=="All" && <i style={{background:palette[o]}}/>}{o}</label>)}</div>;
}

function Product({product,add,openProduct,products}) {
  const [color,setColor] = useState(product.colors[0]);
  const [size,setSize] = useState(product.sizes[0]);
  const [gender,setGender] = useState(product.gender);
  const [qty,setQty] = useState(1);
  const [customize,setCustomize] = useState(false);
  const [sleeve,setSleeve] = useState("Half");
  const [nameEngraving,setNameEngraving] = useState(false);
  const [engravingName,setEngravingName] = useState("");
  const [logoEngraving,setLogoEngraving] = useState(false);
  const [logo,setLogo] = useState(null);
  const [logoUploading,setLogoUploading] = useState(false);
  const [customSizing,setCustomSizing] = useState(false);
  const [measurements,setMeasurements] = useState({chest:"",waist:"",shirt_length:"",sleeve_length:"",trouser_length:""});
  const [trouserStyle,setTrouserStyle] = useState("Straight");
  const [design,setDesign] = useState(product.images?.[0]?.url || product.image);
  const [sizeChart,setSizeChart] = useState(false);
  const galleryImages = product.images?.length ? product.images : [{id:"primary",url:product.image}];
  const colourBased = product.productMode === "colour";
  const measurementFee = customize&&customSizing ? Object.values(measurements).filter(value=>String(value).trim()).length*100 : 0;
  useEffect(()=>{setColor(product.colors[0]);setSize(product.sizes[0]);setGender(product.gender);setQty(1);setDesign(product.images?.[0]?.url||product.image);setCustomize(false)},[product]);
  const customization = customize ? {
    gender,sleeve,
    name_engraving:nameEngraving ? engravingName.trim() : null,
    logo_engraving:logoEngraving ? logo : null,
    measurements:customSizing ? measurements : {},
    trouser_style:trouserStyle,
    design:colourBased ? design : null
  } : {gender,design:colourBased ? design : null};
  const uploadLogo = async event => {
    const file=event.target.files?.[0]; if(!file)return;
    setLogoUploading(true);
    try { const result=await uploadCustomerLogo(file); setLogo({url:result.url,file_id:result.fileId,name:file.name}); }
    catch(error){window.alert(error.message)}
    finally{setLogoUploading(false);event.target.value=""}
  };
  return <main className="product-page">
    <button className="back" onClick={()=>history.back()}><ArrowLeft size={16}/> Back to collection</button>
    <div className="product-layout">
      <div className="product-gallery-wrap"><div className="gallery"><img src={design||product.image} alt={product.name}/><div className="gallery-count">{String(Math.max(1,galleryImages.findIndex(item=>item.url===design)+1)).padStart(2,"0")} / {String(galleryImages.length).padStart(2,"0")}</div></div>{galleryImages.length>1&&<div className="design-gallery" aria-label={colourBased?"Choose a design":"Product gallery"}>{galleryImages.slice(0,8).map((image,index)=><button className={design===image.url?"selected":""} key={image.id} onClick={()=>setDesign(image.url)}><img src={image.url} alt={`${product.name} view ${index+1}`}/><span>{index+1}</span></button>)}</div>}</div>
      <div className="product-info">
        <p className="eyebrow">{product.category} · {product.gender}</p><h1>{product.name}</h1><p className="price">{pkr(product.price)}</p>
        <p className="description">Polished enough for rounds, comfortable enough for the longest shift. Crafted in our signature {product.fabric.toLowerCase()} fabric with a clean, easy fit and thoughtfully placed utility.</p>
        <div className="selector"><div><b>Gender</b><span>{gender}</span></div><div className="size-options">{["Women","Men","Unisex"].map(option=><button key={option} className={gender===option?"selected":""} onClick={()=>setGender(option)}>{option}</button>)}</div></div>
        {!colourBased&&<div className="selector"><div><b>Colour</b><span>{color}</span></div><div className="color-options">{product.colors.map(c=><button key={c} className={color===c?"selected":""} onClick={()=>setColor(c)} style={{"--swatch":product.variants.find(variant=>variant.colors?.name===c)?.colors?.hex||palette[c]||"#888"}} aria-label={c}/>)}</div></div>}
        <div className="selector"><div><b>Size</b><button className="underlined" onClick={()=>setSizeChart(true)}>Size chart</button></div><div className="size-options">{product.sizes.map(s=><button key={s} className={size===s?"selected":""} onClick={()=>setSize(s)}>{s}</button>)}</div></div>
        <section className="customization-panel"><div className="customization-head"><div><b>Customize this item</b><span>Optional sleeves, engraving, measurements and trouser style</span></div><div className="yes-no"><button className={!customize?"selected":""} onClick={()=>setCustomize(false)}>No</button><button className={customize?"selected":""} onClick={()=>setCustomize(true)}>Yes</button></div></div>{customize&&<div className="customization-fields">
          <OptionButtons label="Sleeve" options={["Half","Quarter","Full"]} value={sleeve} setValue={setSleeve}/>
          <ToggleField label="Name engraving" enabled={nameEngraving} setEnabled={setNameEngraving}>{nameEngraving&&<input maxLength="12" value={engravingName} onChange={event=>setEngravingName(event.target.value)} placeholder="Name, up to 12 letters"/>}</ToggleField>
          <ToggleField label="Logo engraving" enabled={logoEngraving} setEnabled={setLogoEngraving}>{logoEngraving&&<label className="customer-logo-upload"><Upload size={16}/>{logoUploading?"Uploading…":logo?logo.name:"Upload your logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={logoUploading}/><small>PNG, JPEG or WebP · maximum 2 MB</small></label>}</ToggleField>
          <ToggleField label="Size customization" enabled={customSizing} setEnabled={setCustomSizing}>{customSizing&&<div className="measurements-grid">{Object.entries(measurements).map(([key,value])=><label key={key}>{key.replaceAll("_"," ")}<input type="number" min="0" step=".1" value={value} onChange={event=>setMeasurements(current=>({...current,[key]:event.target.value}))} placeholder="inches"/></label>)}<p><Ruler size={14}/> Rs 100 per completed measurement · {pkr(measurementFee)}</p></div>}</ToggleField>
          <OptionButtons label="Trouser style" options={["Straight","Bottom/Cargo"]} value={trouserStyle} setValue={setTrouserStyle}/>
        </div>}</section>
        <div className="buy-row"><div className="quantity"><button onClick={()=>setQty(Math.max(1,qty-1))}><Minus size={15}/></button>{qty}<button onClick={()=>setQty(qty+1)}><Plus size={15}/></button></div><button className="primary" disabled={customize&&logoEngraving&&!logo} onClick={()=>Array.from({length:qty}).forEach(()=>add(product,size,color,customization))}>Add to bag — {pkr((product.price+measurementFee)*qty)}</button><button className="wish"><Heart/></button></div>
        <p className="stock"><i/> In stock — ready to ship</p>
        {["Details & fit","Fabric & care","Shipping & returns"].map(x=><button className="accordion" key={x}>{x}<Plus size={18}/></button>)}
      </div>
    </div>
    <ProductRow title="Complete the rotation." label="YOU MAY ALSO LIKE" list={products.filter(p=>p.id!==product.id).slice(0,4)} {...{openProduct,add}} goShop={()=>{}}/>
    {sizeChart&&<div className="modal-backdrop" onClick={()=>setSizeChart(false)}><section className="size-chart-modal" onClick={event=>event.stopPropagation()}><button className="modal-close" onClick={()=>setSizeChart(false)}><X/></button><p className="eyebrow">MEDZ APPAREL SIZE GUIDE</p><h2>Find your fit.</h2><table><thead><tr><th>Size</th><th>Chest</th><th>Waist</th><th>Hip</th></tr></thead><tbody>{[["XS","32–34","26–28","34–36"],["S","34–36","28–30","36–38"],["M","38–40","32–34","40–42"],["L","42–44","36–38","44–46"],["XL","46–48","40–42","48–50"],["2XL","50–52","44–46","52–54"]].map(row=><tr key={row[0]}>{row.map(cell=><td key={cell}>{cell}</td>)}</tr>)}</tbody></table><small>Measurements are in inches. For a custom fit, complete only the measurements you need.</small></section></div>}
  </main>;
}

function OptionButtons({label,options,value,setValue}) {
  return <div className="custom-option"><b>{label}</b><div>{options.map(option=><button key={option} className={value===option?"selected":""} onClick={()=>setValue(option)}>{option}</button>)}</div></div>;
}

function ToggleField({label,enabled,setEnabled,children}) {
  return <div className="custom-option toggle-option"><div><b>{label}</b><div className="yes-no"><button className={!enabled?"selected":""} onClick={()=>setEnabled(false)}>No</button><button className={enabled?"selected":""} onClick={()=>setEnabled(true)}>Yes</button></div></div>{children}</div>;
}

function Cart({cart,setCart,open,close,onCheckout}) {
  const total=cart.reduce((s,p)=>s+p.price,0);
  return <><div className={`overlay ${open?"show":""}`} onClick={close}/><aside className={`cart-drawer ${open?"open":""}`}><div className="cart-head"><h2>Your bag <span>{cart.length}</span></h2><button onClick={close}><X/></button></div>
    {!cart.length ? <div className="empty"><ShoppingBag/><h3>Your bag is taking a break.</h3><p>Fill it with something made for the shift.</p><button className="primary" onClick={close}>Continue shopping</button></div> :
    <><div className="cart-items">{cart.map(item=><div className="cart-item" key={item.cartId}><img src={item.customization?.design||item.image}/><div><strong>{item.name}</strong><span>{item.color} / {item.size}{item.customization?.sleeve&&` · ${item.customization.sleeve} sleeve`}</span>{item.customization?.name_engraving&&<small>Engraving: {item.customization.name_engraving}</small>}<b>{pkr(item.price)}</b></div><button onClick={()=>setCart(c=>c.filter(x=>x.cartId!==item.cartId))}><Trash2 size={16}/></button></div>)}</div><div className="cart-bottom"><p><span>Subtotal</span><b>{pkr(total)}</b></p><small>Shipping calculated at checkout.</small><button className="primary" onClick={onCheckout}>Checkout <ArrowRight size={17}/></button></div></>}</aside></>;
}

const pakistanCities = ["Abbottabad","Bahawalpur","Bannu","Chiniot","Dera Ghazi Khan","Faisalabad","Gilgit","Gujranwala","Gujrat","Hyderabad","Islamabad","Jacobabad","Jhelum","Karachi","Kasur","Khanewal","Khuzdar","Kohat","Lahore","Larkana","Mardan","Mirpur","Multan","Muzaffarabad","Nawabshah","Nowshera","Okara","Peshawar","Quetta","Rahim Yar Khan","Rawalpindi","Sahiwal","Sargodha","Sheikhupura","Sialkot","Sukkur","Swabi","Thatta","Turbat","Wah Cantt"];

function Checkout({user,profile,cart,setCart,onLogin,onShop}) {
  const [step,setStep]=useState("details");
  const [placing,setPlacing]=useState(false);
  const [error,setError]=useState("");
  const [order,setOrder]=useState(null);
  const [saveDetails,setSaveDetails]=useState(false);
  const [savedAddressId,setSavedAddressId]=useState(null);
  const [address,setAddress]=useState({country:"Pakistan",city:"",recipient_name:profile?.full_name||user?.user_metadata?.full_name||"",complete_address:"",mobile:profile?.phone||"",secondary_mobile:""});
  useEffect(()=>{if(!address.recipient_name&&(profile?.full_name||user?.user_metadata?.full_name))setAddress(a=>({...a,recipient_name:profile?.full_name||user?.user_metadata?.full_name}))},[profile,user]);
  useEffect(()=>{
    if(!user?.id)return;
    let active=true;
    fetchDefaultAddress(user.id).then(saved=>{
      if(!active||!saved)return;
      setSavedAddressId(saved.id);
      setAddress(current=>({
        country:"Pakistan",
        city:current.city||saved.city||"",
        recipient_name:current.recipient_name||saved.recipient_name||"",
        complete_address:current.complete_address||saved.complete_address||"",
        mobile:current.mobile||saved.mobile||"",
        secondary_mobile:current.secondary_mobile||saved.secondary_mobile||""
      }));
    }).catch(()=>{});
    return()=>{active=false};
  },[user?.id]);
  const grouped=useMemo(()=>Object.values(cart.reduce((acc,item)=>{const key=`${item.variantId}:${JSON.stringify(item.customization||{})}`;if(!acc[key])acc[key]={...item,groupKey:key,quantity:0};acc[key].quantity++;return acc},{})),[cart]);
  const subtotal=grouped.reduce((sum,item)=>sum+item.price*item.quantity,0);
  const delivery=200+(50*cart.length);
  const total=subtotal+delivery;
  const validCity=pakistanCities.includes(address.city);
  const review=e=>{e.preventDefault();setError("");if(!validCity)return setError("Please select a city from the list.");setStep("review")};
  const confirm=async()=>{
    const chime=prepareOrderChime();
    setPlacing(true);setError("");
    try{
      if(saveDetails)await saveDefaultAddress({userId:user.id,address,addressId:savedAddressId});
      const result=await placeCodOrder({shippingAddress:address,items:grouped});
      setOrder(result);setCart([]);setStep("success");chime.play();
    }catch(e){chime.dispose();setError(e.message)}finally{setPlacing(false)}
  };
  if(!user)return <main className="auth-page"><section className="account-card"><ShoppingBag/><p className="eyebrow">CHECKOUT</p><h1>Sign in to continue.</h1><p>Your account keeps your delivery details and order history secure.</p><button className="primary" onClick={onLogin}>Sign in</button></section></main>;
  if(!cart.length&&step!=="success")return <main className="auth-page"><section className="account-card"><ShoppingBag/><p className="eyebrow">YOUR BAG</p><h1>Your bag is empty.</h1><button className="primary" onClick={onShop}>Browse the collection</button></section></main>;
  if(step==="success")return <main className="checkout-page success-page"><div className="success-modal-backdrop"><section className="order-success order-success-modal" role="dialog" aria-modal="true" aria-labelledby="order-success-title">
    <div className="success-confetti" aria-hidden="true">{Array.from({length:14},(_,index)=><i key={index} style={{"--x":`${7+(index*7)%90}%`,"--delay":`${(index%7)*.08}s`,"--spin":`${index%2?180:-180}deg`}}/>)}</div>
    <span className="success-check"><Check/></span><p className="eyebrow">ORDER RECEIVED</p><h1 id="order-success-title">Thank you for your order.</h1><p>Your cash-on-delivery order has been placed. We’ll contact you before dispatch.</p><div><span>Order reference</span><b>#{order?.order_id?.slice(0,8).toUpperCase()}</b></div><div><span>Total payable</span><b>{pkr(order?.order_total)}</b></div><button className="primary" onClick={onShop}>Continue shopping <ArrowRight size={16}/></button>
  </section></div></main>;
  return <main className="checkout-page">
    <div className="checkout-title"><p className="eyebrow">SECURE CHECKOUT</p><h1>{step==="details"?"Delivery details":"Review your order"}</h1><div className="checkout-steps"><span className="active">1 Delivery</span><i/><span className={step==="review"?"active":""}>2 Review</span><i/><span>3 Confirmation</span></div></div>
    <div className="checkout-layout">
      <section className="checkout-main">
        {step==="details"?<form className="checkout-form" onSubmit={review}>
          <div className="form-section-title"><MapPin/><div><h2>Shipping address</h2><p>We currently deliver throughout Pakistan.</p></div></div>
          <div className="checkout-fields">
            <label>Country<input value="Pakistan" disabled/></label>
            <label>City *<input list="pakistan-cities" value={address.city} onChange={e=>setAddress({...address,city:e.target.value})} placeholder="Search and select city" required/><datalist id="pakistan-cities">{pakistanCities.map(city=><option key={city} value={city}/>)}</datalist></label>
            <label className="wide">Recipient name *<input value={address.recipient_name} onChange={e=>setAddress({...address,recipient_name:e.target.value})} required/></label>
            <label>Mobile number *<input type="tel" value={address.mobile} onChange={e=>setAddress({...address,mobile:e.target.value})} placeholder="03XX XXXXXXX" pattern="(?:\\+92|0)3[0-9]{9}" required/></label>
            <label>Secondary mobile number <small>Optional</small><input type="tel" value={address.secondary_mobile} onChange={e=>setAddress({...address,secondary_mobile:e.target.value})} placeholder="03XX XXXXXXX" pattern="(?:\\+92|0)3[0-9]{9}|^$"/></label>
            <label className="wide">Complete address *<textarea rows="4" value={address.complete_address} onChange={e=>setAddress({...address,complete_address:e.target.value})} placeholder="House or apartment, street, area and nearby landmark" required/></label>
          </div>
          <label className="save-address-option"><input type="checkbox" checked={saveDetails} onChange={event=>setSaveDetails(event.target.checked)}/><span><b>Save these delivery details</b><small>Securely prefill this address the next time you check out.</small></span></label>
          <div className="payment-title"><h2>Payment method</h2></div>
          <div className="payment-options"><button type="button" className="payment-option disabled" disabled><CreditCard/><span><b>Bank cards</b><small>Coming soon</small></span></button><button type="button" className="payment-option selected"><Banknote/><span><b>Cash on delivery</b><small>Pay when your order arrives</small></span><Check/></button></div>
          {error&&<div className="auth-error">{error}</div>}<button className="primary checkout-next">Review order <ArrowRight size={17}/></button>
        </form>:<div className="review">
          <div className="review-block"><div className="review-head"><h2>Delivery address</h2><button onClick={()=>setStep("details")}>Edit</button></div><b>{address.recipient_name}</b><p>{address.complete_address}<br/>{address.city}, Pakistan<br/>{address.mobile}{address.secondary_mobile&&` · ${address.secondary_mobile}`}</p>{saveDetails&&<small className="save-address-note"><Check size={13}/> These details will be saved to your account.</small>}</div>
          <div className="review-block"><h2>Payment</h2><p><Banknote size={17}/> Cash on delivery</p></div>
          <div className="review-block"><h2>Items</h2>{grouped.map(item=><div className="review-item" key={item.groupKey}><img src={item.customization?.design||item.image}/><div><b>{item.name}</b><span>{item.color} / {item.size} · Qty {item.quantity}{item.customization?.sleeve&&` · ${item.customization.sleeve} sleeve`}</span>{item.customization?.name_engraving&&<small>Engraving: {item.customization.name_engraving}</small>}</div><strong>{pkr(item.price*item.quantity)}</strong></div>)}</div>
          {error&&<div className="auth-error">{error}</div>}<button className="primary confirm-order" disabled={placing} onClick={confirm}>{placing?"Placing order…":"Confirm cash on delivery order"} <ArrowRight size={17}/></button>
        </div>}
      </section>
      <aside className="checkout-summary"><h2>Order summary</h2>{grouped.map(item=><div className="summary-item" key={item.groupKey}><span>{item.name} <small>× {item.quantity}</small></span><b>{pkr(item.price*item.quantity)}</b></div>)}<div className="summary-line"><span>Subtotal</span><b>{pkr(subtotal)}</b></div><div className="summary-line"><span>Delivery</span><b>{pkr(delivery)}</b></div><div className="summary-total"><span>Total</span><b>{pkr(total)}</b></div><p>Taxes, if applicable, are included.</p></aside>
    </div>
  </main>;
}

const adminOrderStatuses = [
  ["pending","Received"],
  ["processing","Processing"],
  ["shipped","Shipping"],
  ["cancelled","Declined"]
];

function AdminOrderEditor({order,onUpdated}) {
  const [status,setStatus] = useState(order.status);
  const [message,setMessage] = useState(order.customer_message || "");
  const [saving,setSaving] = useState(false);
  const [feedback,setFeedback] = useState("");
  const save = async () => {
    setSaving(true); setFeedback("");
    try {
      await updateOrderStatus({orderId:order.id,status,customerMessage:message});
      setFeedback("Updated");
      await onUpdated();
    } catch (error) { setFeedback(error.message); }
    finally { setSaving(false); }
  };
  return <article className="admin-order-card">
    <div className="admin-order-summary"><div><small>ORDER</small><b>#{order.id.slice(0,8).toUpperCase()}</b></div><div><small>RECEIVED</small><span>{new Date(order.created_at).toLocaleDateString("en-PK")}</span></div><strong>{pkr(order.total_amount)}</strong></div>
    <div className="admin-order-items">{(order.order_items||[]).map(item=>{const custom=item.customization||{};return <div key={item.id}><b>{item.product_variants?.products?.name||"Product"} × {item.quantity}</b><span>{[custom.gender,item.product_variants?.size,item.product_variants?.colors?.name,custom.sleeve&&`${custom.sleeve} sleeve`,custom.trouser_style].filter(Boolean).join(" · ")}</span>{custom.name_engraving&&<small>Name engraving: {custom.name_engraving}</small>}{custom.logo_engraving?.url&&<a href={custom.logo_engraving.url} target="_blank" rel="noreferrer">View customer logo</a>}{Object.keys(custom.measurements||{}).length>0&&<small>Custom measurements: {Object.entries(custom.measurements).filter(([,value])=>value).map(([key,value])=>`${key.replaceAll("_"," ")} ${value}″`).join(", ")}</small>}</div>})}</div>
    <div className="admin-order-controls">
      <label>Status<select value={status} disabled={["cancelled","refunded"].includes(order.status)} onChange={event=>setStatus(event.target.value)}>{!adminOrderStatuses.some(([value])=>value===status)&&<option value={status}>{status}</option>}{adminOrderStatuses.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label className="admin-order-message">Custom message <small>{message.length}/500</small><textarea rows="2" maxLength="500" value={message} onChange={event=>setMessage(event.target.value)} placeholder="Optional update visible to the customer"/></label>
      <button className="primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save update"}</button>
    </div>
    {feedback && <p className={feedback==="Updated"?"admin-order-success":"admin-order-error"}>{feedback}</p>}
  </article>;
}

function Admin({ user, profile, authReady, catalogLoading, onLogin, products, onCreated }) {
  const [uploading,setUploading] = useState(false);
  const [productImages,setProductImages] = useState([]);
  const [removedImageFileIds,setRemovedImageFileIds] = useState([]);
  const [uploadError,setUploadError] = useState("");
  const [adminData,setAdminData] = useState({categories:[],colors:[],clothTypes:[],orders:[]});
  const [showForm,setShowForm] = useState(false);
  const [editingId,setEditingId] = useState(null);
  const [saving,setSaving] = useState(false);
  const [formError,setFormError] = useState("");
  const [formSuccess,setFormSuccess] = useState("");
  const [form,setForm] = useState({name:"",description:"",category_id:"",cloth_type_id:"",gender:"unisex",product_mode:"style",base_price:"",is_featured:false});
  const [selectedColors,setSelectedColors] = useState([]);
  const [sizes,setSizes] = useState("XS, S, M, L, XL");
  const [variantDefaults,setVariantDefaults] = useState({stock_quantity:"0",price_override:""});
  const [existingVariants,setExistingVariants] = useState([]);
  const loadAdminData = () => fetchAdminData().then(setAdminData).catch(error=>setFormError(error.message));
  useEffect(() => {
    if (user && ["admin","staff"].includes(profile?.role)) {
      loadAdminData();
    }
  }, [user,profile]);
  const uploadImage = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    if (productImages.length + files.length > 8) { setUploadError("A product can have up to 8 images."); event.target.value=""; return; }
    setUploading(true); setUploadError("");
    try {
      const uploaded=[];
      for (const file of files) uploaded.push({...await uploadToImageKit(file),isNew:true});
      setProductImages(current=>[...current,...uploaded]);
    }
    catch (error) { setUploadError(error.message); }
    finally { setUploading(false); event.target.value = ""; }
  };
  const makeMainImage = index => setProductImages(current=>[current[index],...current.filter((_,itemIndex)=>itemIndex!==index)]);
  const removeEditorImage = index => setProductImages(current=>{
    const removed=current[index];
    if (removed?.fileId) setRemovedImageFileIds(ids=>[...ids,removed.fileId]);
    return current.filter((_,itemIndex)=>itemIndex!==index);
  });
  const resetEditor = () => {
    setEditingId(null); setProductImages([]); setRemovedImageFileIds([]); setUploadError(""); setFormError(""); setFormSuccess("");
    setForm({name:"",description:"",category_id:"",cloth_type_id:"",gender:"unisex",product_mode:"style",base_price:"",is_featured:false});
    setSelectedColors([]); setSizes("XS, S, M, L, XL"); setVariantDefaults({stock_quantity:"0",price_override:""}); setExistingVariants([]);
  };
  const openNew = () => { resetEditor(); setShowForm(true); };
  const openEdit = product => {
    setEditingId(product.id);
    setProductImages(product.images.map(image=>({url:image.originalUrl||image.url,fileId:image.fileId,thumbnailUrl:image.url,isNew:false})));
    setRemovedImageFileIds([]);
    setForm({name:product.name,description:product.description||"",category_id:product.categoryId||"",cloth_type_id:product.clothTypeId||"",gender:product.gender.toLowerCase(),product_mode:product.productMode||"style",base_price:String(product.price),is_featured:product.isFeatured});
    setExistingVariants(product.variants);
    setSelectedColors([...new Set(product.variants.map(v=>v.colors?.id).filter(Boolean))]);
    setSizes([...new Set(product.variants.map(v=>v.size).filter(Boolean))].join(", "));
    setVariantDefaults({stock_quantity:String(product.variants[0]?.stock_quantity??0),price_override:product.variants[0]?.price_override==null?"":String(product.variants[0].price_override)});
    setFormError(""); setFormSuccess(""); setShowForm(true); window.scrollTo({top:0,behavior:"smooth"});
  };
  const removeProduct = async product => {
    if (!window.confirm(`Remove “${product.name}” from the store? Existing orders will be preserved.`)) return;
    setFormError("");
    try {
      await deleteProduct(product.id);
      await onCreated();
    } catch (error) { setFormError(error.message); }
  };
  const submitProduct = async (event) => {
    event.preventDefault(); setSaving(true); setFormError(""); setFormSuccess("");
    try {
      if (!productImages.length) throw new Error("Upload at least one product image.");
      const sizeOptions = [...new Set(sizes.split(",").map(value=>value.trim()).filter(Boolean))];
      if (!selectedColors.length) throw new Error("Select at least one colour.");
      if (!sizeOptions.length) throw new Error("Enter at least one size.");
      const skuRoot = `${slugify(form.name)}-${editingId?.slice(0,6)||Date.now().toString().slice(-6)}`;
      const generatedVariants = selectedColors.flatMap(colorId=>sizeOptions.map(size=>{
        const previous = existingVariants.find(v=>v.colors?.id===colorId&&v.size===size);
        return {
          color_id:colorId,size,
          sku:previous?.sku||`${skuRoot}-${colorId.slice(0,4)}-${slugify(size)}`,
          stock_quantity:previous?.stock_quantity??Number(variantDefaults.stock_quantity),
          price_override:previous?.price_override??(variantDefaults.price_override?Number(variantDefaults.price_override):null),is_active:true
        };
      }));
      const payload = {
        product: {
          name: form.name.trim(), slug: `${slugify(form.name)}-${Date.now().toString().slice(-6)}`,
          description: form.description.trim(), category_id: form.category_id,
          cloth_type_id: form.cloth_type_id || null, gender: form.gender, product_mode:form.product_mode,
          base_price: Number(form.base_price), is_active: true, is_featured: form.is_featured
        },
        variants: generatedVariants,
        images: productImages.map(image=>({url:image.url,fileId:image.fileId}))
      };
      if (editingId) {
        await updateProductWithVariants({id:editingId,...payload});
      } else await createProductWithVariants(payload);
      removedImageFileIds.forEach(fileId=>deleteFromImageKit(fileId).catch(()=>{}));
      setFormSuccess(editingId ? "Product updated successfully." : "Product published successfully.");
      setSaving(false);
      onCreated();
      if (editingId) setTimeout(()=>{resetEditor();setShowForm(false)},700);
    } catch (error) { setFormError(error.message); }
    finally { setSaving(false); }
  };
  if (!authReady) return <main className="auth-page"><section className="account-card"><p>Checking your account…</p></section></main>;
  if (!user || !["admin","staff"].includes(profile?.role)) return <main className="auth-page"><section className="account-card"><ShieldCheck size={35}/><p className="eyebrow">RESTRICTED AREA</p><h1>Admin access required.</h1><p>Sign in with an administrator or staff account to manage the store.</p><button className="primary" onClick={onLogin}>Sign in</button></section></main>;
  const revenue=adminData.orders.reduce((sum,o)=>["paid","processing","shipped","delivered"].includes(o.status)?sum+Number(o.total_amount):sum,0);
  const metrics=[["Catalog products",catalogLoading?"—":String(products.length),catalogLoading?"Loading":"Live"],["Recorded revenue",pkr(revenue),"From orders"],["Pending orders",String(adminData.orders.filter(o=>o.status==="pending").length),"Needs review"],["Low stock",catalogLoading?"—":String(products.filter(p=>p.stock<10).length),"Products"]];
  return <main className="admin">
    <div className="admin-title"><div><p className="eyebrow">ADMIN / OVERVIEW</p><h1>Good morning, {profile?.full_name?.split(" ")[0] || "Admin"}.</h1><p>Manage the live Supabase catalog and ImageKit media.</p></div><button className="primary" onClick={()=>showForm?(resetEditor(),setShowForm(false)):openNew()}>{showForm?<X size={17}/>:<Plus size={17}/>} {showForm?"Close form":"Add product"}</button></div>
    {formError && !showForm && <div className="auth-error admin-page-error">{formError}</div>}
    {showForm && <form className="product-editor" onSubmit={submitProduct}>
      <div className="editor-heading"><div><p className="eyebrow">{editingId?"EDIT CATALOG ITEM":"NEW CATALOG ITEM"}</p><h2>{editingId?"Update product":"Product details"}</h2></div><span>All fields marked * are required</span></div>
      <div className="editor-grid">
        <label>Product name *<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
        <label>Base price *<input type="number" min="0" step=".01" value={form.base_price} onChange={e=>setForm({...form,base_price:e.target.value})} required/></label>
        <label>Category *<select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} required><option value="">Choose category</option>{adminData.categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Cloth type<select value={form.cloth_type_id} onChange={e=>setForm({...form,cloth_type_id:e.target.value})}><option value="">Choose fabric</option>{adminData.clothTypes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Gender fit<select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="unisex">Unisex</option><option value="women">Women</option><option value="men">Men</option></select></label>
        <label>Product page type<select value={form.product_mode} onChange={e=>setForm({...form,product_mode:e.target.value})}><option value="style">Style-based (choose colour)</option><option value="colour">Colour-based (choose design)</option></select></label>
        <label className="check-label"><input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form,is_featured:e.target.checked})}/> Feature on homepage</label>
        <label className="editor-wide">Description<textarea rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      </div>
      <div className="editor-section product-images-editor"><div><h3>Product images *</h3><p>Add up to 8 images. The image marked Main appears on product cards.</p></div><label className="primary upload-button">{uploading?"Uploading…":"Add images"}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading||productImages.length>=8} onChange={uploadImage}/></label></div>
      {!!productImages.length&&<div className="admin-image-grid">{productImages.map((image,index)=><article className={index===0?"main":""} key={`${image.fileId}-${index}`}><img src={image.thumbnailUrl||image.url} alt={`Product image ${index+1}`}/><span>{index===0?"Main image":`Image ${index+1}`}</span><div>{index!==0&&<button type="button" onClick={()=>makeMainImage(index)}><Check size={14}/> Make main</button>}<button type="button" aria-label={`Remove image ${index+1}`} onClick={()=>removeEditorImage(index)}><Trash2 size={14}/></button></div></article>)}</div>}
      {uploadError&&<div className="auth-error">{uploadError}</div>}
      <div className="variants-head"><div><h3>Colours and sizes *</h3><p>Select colours and enter sizes independently. The store creates all available combinations automatically.</p></div></div>
      <div className="independent-options">
        <fieldset><legend>Available colours</legend><div className="admin-color-grid">{adminData.colors.map(color=><label key={color.id}><input type="checkbox" checked={selectedColors.includes(color.id)} onChange={()=>setSelectedColors(current=>current.includes(color.id)?current.filter(id=>id!==color.id):[...current,color.id])}/><i style={{background:color.hex}}/>{color.name}</label>)}</div></fieldset>
        <label>Available sizes <small>Separate sizes with commas</small><input value={sizes} onChange={event=>setSizes(event.target.value)} placeholder="XS, S, M, L, XL"/></label>
        <label>Initial stock per new combination<input type="number" min="0" value={variantDefaults.stock_quantity} onChange={event=>setVariantDefaults(current=>({...current,stock_quantity:event.target.value}))}/></label>
        <label>Price override for new combinations <small>Optional</small><input type="number" min="0" step=".01" value={variantDefaults.price_override} onChange={event=>setVariantDefaults(current=>({...current,price_override:event.target.value}))}/></label>
      </div>
      {formError&&<div className="auth-error">{formError}</div>}{formSuccess&&<div className="auth-message">{formSuccess}</div>}
      <div className="editor-actions"><button type="button" onClick={()=>{resetEditor();setShowForm(false)}}>Cancel</button><button className="primary" disabled={saving||uploading}>{saving?"Saving…":editingId?"Save changes":"Publish product"} <ArrowRight size={16}/></button></div>
    </form>}
    <div className="metrics">{metrics.map((m,i)=><div key={m[0]}><span>{i===0?<BarChart3/>:i===1?<ShoppingBag/>:i===2?<Package/>:<Sparkles/>}</span><p>{m[0]}</p><h2>{m[1]}</h2><small>{m[2]}</small></div>)}</div>
    <section className="admin-orders-panel"><div className="panel-head"><div><p className="eyebrow">FULFILMENT</p><h2>Manage received orders</h2></div><span>{adminData.orders.length} recent</span></div>{adminData.orders.length?<div className="admin-order-list">{adminData.orders.map(order=><AdminOrderEditor key={order.id} order={order} onUpdated={loadAdminData}/>)}</div>:<div className="admin-empty">No orders yet.</div>}</section>
    <section className="inventory-panel"><div className="panel-head"><h2>Inventory alerts</h2></div>{products.filter(p=>p.stock<10).length?products.filter(p=>p.stock<10).map(p=><div className="stock-row" key={p.id}>{p.image&&<img src={p.image}/>}<div><b>{p.name}</b><span>{p.colors.join(", ")}</span></div><strong>{p.stock} left</strong></div>):<div className="admin-empty">No low-stock products.</div>}</section>
    <section className="admin-products"><div className="panel-head"><h2>Live products</h2><span>{catalogLoading?"Loading…":`${products.length} total`}</span></div>{catalogLoading?<ProductSkeletons count={4}/>:products.length?<div className="product-table product-actions-table"><div className="table-header"><span>Product</span><span>Category</span><span>Stock</span><span>Price</span><span>Status</span><span>Actions</span></div>{products.map(p=><div key={p.id}><span>{p.image&&<img src={p.image}/>}<b>{p.name}</b></span><span>{p.category}</span><span>{p.stock}</span><span>{pkr(p.price)}</span><span className="active"><i/> Active</span><span className="row-actions"><button onClick={()=>openEdit(p)}>Edit</button><button onClick={()=>removeProduct(p)}><Trash2 size={14}/> Archive</button></span></div>)}</div>:<div className="admin-empty large">No products yet. Use “Add product” to publish your first item.</div>}</section>
  </main>;
}

function PolicyPage({policy}) {
  return <main className="policy-page">
    <section className="policy-hero"><p className="eyebrow">{policy.eyebrow}</p><h1>{policy.title}</h1><p>{policy.intro}</p><small>Last updated: July 19, 2026</small></section>
    <div className="policy-layout"><aside><p>On this page</p>{policy.sections.map(([title],index)=><a key={title} href={`#policy-${index+1}`}>{String(index+1).padStart(2,"0")} {title}</a>)}</aside>
    <article>{policy.sections.map(([title,content],index)=><section id={`policy-${index+1}`} key={title}><span>{String(index+1).padStart(2,"0")}</span><div><h2>{title}</h2><p>{content}</p></div></section>)}</article></div>
  </main>;
}

function ContactPage() {
  return <main className="contact-page">
    <div className="contact-shell">
      <section className="contact-intro"><p className="eyebrow">CONTACT MEDZ APPAREL</p><h1>We’re here to help.</h1><p>Questions about an order, sizing, customization, or delivery? Reach our team through any of the channels below.</p></section>
      <section className="contact-grid">
        <a className="contact-card" href="tel:+923410875629"><Phone/><span><small>Call us</small><strong>+92 341 0875629</strong></span></a>
        <a className="contact-card" href="mailto:medzapparel7@gmail.com"><Mail/><span><small>Email us</small><strong>medzapparel7@gmail.com</strong></span></a>
        <div className="contact-card"><MapPin/><span><small>Based in</small><strong>Hyderabad, Sindh, Pakistan</strong></span></div>
      </section>
      <section className="contact-social-panel"><div><p className="eyebrow">SOCIAL & MESSAGING</p><h2>Follow the collection or message us directly.</h2></div><div className="contact-socials">
        <a className="contact-social" href="https://www.facebook.com/profile.php?id=100093355088786" target="_blank" rel="noreferrer"><Facebook/> Facebook</a>
        <a className="contact-social" href="https://www.instagram.com/medz_apparel/" target="_blank" rel="noreferrer"><Instagram/> Instagram</a>
        <a className="contact-social" href="https://wa.me/message/AMSQ2CXELSP5C1" target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a>
      </div></section>
    </div>
  </main>;
}

function Footer({goShop,onNavigate,categories=[]}) {
  return <footer><div className="footer-brand"><img className="brand-logo footer-logo" src="/media/medz-logo.png" alt="Medz Apparel"/><h2>MEDZ APPAREL</h2><p>The Doctor&apos;s Thread</p></div><div><h3>Shop</h3>{categories.slice(0,5).map(item=><button key={item.id} onClick={()=>goShop(item.name)}>{item.name}</button>)}</div><div><h3>Help</h3><button onClick={()=>onNavigate("terms")}>Terms & exchanges</button><button onClick={()=>onNavigate("shipping")}>Shipping policy</button><button onClick={()=>onNavigate("privacy")}>Privacy policy</button><button onClick={()=>onNavigate("contact")}>Contact us</button></div><div><h3>Follow</h3><a href="https://www.facebook.com/profile.php?id=100093355088786" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.instagram.com/medz_apparel/" target="_blank" rel="noreferrer">Instagram</a><a href="https://wa.me/message/AMSQ2CXELSP5C1" target="_blank" rel="noreferrer">WhatsApp</a></div><div className="footer-bottom"><span>© 2026 MEDZ APPAREL</span><span><button onClick={()=>onNavigate("privacy")}>Privacy</button> · <button onClick={()=>onNavigate("terms")}>Terms</button> · Accessibility</span></div></footer>;
}

createRoot(document.getElementById("root")).render(<App/>);
