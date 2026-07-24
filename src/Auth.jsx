import React, { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, KeyRound, LogOut, Mail, MapPin, Package, Phone, RefreshCw, ShieldCheck, Truck, UserRound, XCircle } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { cancelPendingOrder, fetchCustomerAccount } from "./lib/store";

const pkr = value => new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(value)||0);
const addonLabels = { sleeves:"Black sleeves", scrub_cap:"Matching scrub cap", inner:"Black Inner" };
const describeOrderDetails = (custom,variant) => [
  custom?.gender,
  custom?.color || variant?.colors?.name,
  custom?.size || variant?.size,
  custom?.sleeve && `${custom.sleeve} sleeve`,
  custom?.trouser_style,
  custom?.addons?.length ? `Add-ons: ${custom.addons.map(item=>addonLabels[item]||item).join(", ")}` : null,
  custom?.design?.title ? `Design: ${custom.design.title}` : custom?.design && "Selected design"
].filter(Boolean).join(" · ") || "Standard";
const statusCopy = {
  pending: ["Order received","We have received your order and will begin processing it shortly."],
  paid: ["Payment confirmed","Your payment has been confirmed."],
  processing: ["Processing","Your pieces are being prepared for dispatch."],
  shipped: ["Shipped / delivering","Your order is with the delivery partner."],
  delivered: ["Delivered","Your order has been delivered."],
  cancelled: ["Cancelled","This order was cancelled."],
  refunded: ["Refunded","The refund for this order has been processed."]
};

function ProfileSkeleton() {
  return <div className="profile-skeleton" aria-label="Loading account">
    {Array.from({length:3},(_,index)=><article className="customer-order skeleton-card" key={index}>
      <div className="customer-order-head"><div><span className="skeleton skeleton-line short"/><span className="skeleton skeleton-line medium"/></div><span className="skeleton skeleton-pill"/></div>
      <div className="order-progress"><span className="skeleton skeleton-icon"/><div><span className="skeleton skeleton-line medium"/><span className="skeleton skeleton-line wide"/></div><span className="skeleton skeleton-line price"/></div>
      <div className="account-order-item"><span className="skeleton skeleton-thumb"/><div><span className="skeleton skeleton-line medium"/><span className="skeleton skeleton-line wide"/></div><span className="skeleton skeleton-line price"/></div>
    </article>)}
  </div>;
}

export function AuthPage({ user, profile, onDone, onSignOut, onAdmin, onContact, onCheckout }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountData, setAccountData] = useState({ orders: [], addresses: [] });
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [cancelling, setCancelling] = useState("");

  const loadAccount = async () => {
    if (!user) return;
    setAccountLoading(true); setAccountError("");
    try { setAccountData(await fetchCustomerAccount(user.id)); }
    catch (e) { setAccountError(e.message); }
    finally { setAccountLoading(false); }
  };

  useEffect(() => { loadAccount(); }, [user?.id]);

  const run = async (action) => {
    setLoading(true); setError(""); setMessage("");
    try { await action(); } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const submit = (event) => {
    event.preventDefault();
    run(async () => {
      if (!isSupabaseConfigured) throw new Error("Supabase environment variables are not configured yet.");
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onDone();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
        if (authError) throw authError;
        if (data.session) {
          onDone();
        } else {
          setPendingEmail(email);
          setMode("otp");
          setMessage("We sent a six-digit verification code to your email.");
        }
      }
    });
  };

  const verifyOtp = (event) => {
    event.preventDefault();
    run(async () => {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otp.trim(),
        type: "signup"
      });
      if (otpError) throw otpError;
      setMessage("Email verified. Welcome to Medzapperal.");
      onDone();
    });
  };

  const resend = () => run(async () => {
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
    if (resendError) throw resendError;
    setMessage("A new verification code has been sent.");
  });

  const cancelOrder = async orderId => {
    if (!window.confirm("Cancel this order? This cannot be undone.")) return;
    setCancelling(orderId); setAccountError("");
    try { await cancelPendingOrder(orderId); await loadAccount(); }
    catch (e) { setAccountError(e.message); }
    finally { setCancelling(""); }
  };

  if (user) {
    const joined = new Date(user.created_at).toLocaleDateString("en-PK",{day:"numeric",month:"long",year:"numeric"});
    const address = accountData.addresses.find(item=>item.is_default) || accountData.addresses[0];
    return <main className="profile-page">
      <section className="profile-hero">
        <div className="account-avatar"><UserRound /></div>
        <div><p className="eyebrow">YOUR MEDZ ACCOUNT</p><h1>{profile?.full_name || user.user_metadata?.full_name || "Welcome back"}</h1><p>{user.email}</p></div>
        <button className="secondary" onClick={onDone}>Continue shopping <ArrowRight size={16}/></button>
      </section>

      <div className="profile-layout">
        <section className="profile-main">
          <div className="profile-section-head"><div><p className="eyebrow">ORDER HISTORY</p><h2>Your orders</h2></div><button className="icon-btn" aria-label="Refresh orders" onClick={loadAccount}><RefreshCw size={17}/></button></div>
          {accountLoading ? <ProfileSkeleton/>
          : accountData.orders.length ? <div className="customer-orders">{accountData.orders.map(order => {
            const [label,description] = statusCopy[order.status] || [order.status,"Your order status was updated."];
            return <article className="customer-order" key={order.id}>
              <div className="customer-order-head"><div><small>ORDER #{order.id.slice(0,8).toUpperCase()}</small><strong>{new Date(order.created_at).toLocaleDateString("en-PK",{day:"numeric",month:"short",year:"numeric"})}</strong></div><span className={`order-status ${order.status}`}>{label}</span></div>
              <div className="order-progress"><Package size={18}/><div><b>{label}</b><p>{description}</p>{order.customer_message&&<p className="customer-order-message">“{order.customer_message}”</p>}</div><strong>{pkr(order.total_amount)}</strong></div>
              {(order.order_items || []).map(item => {
                const variant=item.product_variants; const product=variant?.products; const image=[...(product?.product_images||[])].sort((a,b)=>a.sort_order-b.sort_order)[0]?.url; const custom=item.customization||{};
                return <div className="account-order-item" key={item.id}>{image&&<img src={image} alt=""/>}<div><b>{product?.name || "Medz Apparel item"}</b><span>{describeOrderDetails(custom,variant)} · Qty {item.quantity}</span>{custom.name_engraving&&<small>Engraving: {custom.name_engraving}</small>}{custom.logo_engraving?.url&&<small>Logo uploaded</small>}</div><strong>{pkr(Number(item.unit_price)*item.quantity)}</strong></div>;
              })}
              <div className="order-actions">{order.status === "pending"
                ? <button className="danger-link" disabled={cancelling===order.id} onClick={()=>cancelOrder(order.id)}>{cancelling===order.id?"Cancelling…":<><XCircle size={15}/> Cancel order</>}</button>
                : !["cancelled","refunded","delivered"].includes(order.status) && <button onClick={onContact}><Phone size={15}/> Contact us to request cancellation</button>}
                <span>Last updated {new Date(order.updated_at).toLocaleDateString("en-PK")}</span>
              </div>
            </article>;
          })}</div>
          : <div className="profile-empty"><Package/><h3>No orders yet</h3><p>Your order history will appear here after checkout.</p><button className="primary" onClick={onDone}>Start shopping</button></div>}
        </section>

        <aside className="profile-sidebar">
          {accountError && <div className="auth-error">{accountError}</div>}
          <section><p className="eyebrow">SAVED SHIPPING</p><h2>Delivery details</h2>{address ? <div className="saved-address"><MapPin/><div><b>{address.full_address?.recipient_name}</b><p>{address.full_address?.complete_address}, {address.full_address?.city}, Pakistan</p><span>{address.full_address?.mobile}{address.full_address?.secondary_mobile ? ` · ${address.full_address.secondary_mobile}` : ""}</span></div></div> : <p className="sidebar-muted">No saved delivery address yet.</p>}<button className="text-link" onClick={onCheckout}>{address ? "Review at checkout" : "Add at checkout"} <ArrowRight size={14}/></button></section>
          <section><p className="eyebrow">ACCOUNT DETAILS</p><h2>Membership</h2><div className="detail-row"><CalendarDays/><span>Joined on</span><b>{joined}</b></div><div className="detail-row"><ShieldCheck/><span>Email</span><b>Verified <Check size={13}/></b></div><div className="detail-row"><KeyRound/><span>Account type</span><b>{profile?.role || "Customer"}</b></div>{["admin","staff"].includes(profile?.role) && <button className="primary admin-account-button" onClick={onAdmin}>Open store admin</button>}</section>
          <section className="profile-help"><p className="eyebrow">NEED HELP?</p><h2>We’re here for you.</h2><button className="secondary" onClick={onContact}><Phone size={15}/> Contact Medz Apparel</button><button className="auth-link" onClick={onSignOut}><LogOut size={15}/> Log out</button></section>
        </aside>
      </div>
    </main>;
  }

  return <main className="auth-page">
    <section className="auth-card">
      <span className="logo-mark"><i/><i/><i/></span>
      {mode === "otp" ? <>
        <p className="eyebrow">VERIFY YOUR EMAIL</p>
        <h1>Enter your code.</h1>
        <p>We sent a six-digit OTP to <strong>{pendingEmail}</strong>. It expires shortly.</p>
        <form onSubmit={verifyOtp}>
          <label>Verification code<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" required /></label>
          {message && <div className="auth-message">{message}</div>}
          {error && <div className="auth-error">{error}</div>}
          <button className="primary" disabled={loading || otp.length !== 6}>{loading ? "Verifying…" : "Verify account"} <ArrowRight size={17}/></button>
        </form>
        <button className="auth-link" onClick={resend}>Resend code</button>
      </> : <>
        <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "JOIN MEDZAPPERAL"}</p>
        <h1>{mode === "login" ? "Sign in." : "Create an account."}</h1>
        <p>{mode === "login" ? "Access your orders, addresses, and saved pieces." : "One account for a more considered shopping experience."}</p>
        <form onSubmit={submit}>
          {mode === "signup" && <label>Full name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required /></label>}
          <label>Email address<div className="input-icon"><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required /></div></label>
          <label>Password<div className="input-icon"><KeyRound size={16}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></div></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary" disabled={loading}>{loading ? mode === "login" ? "Signing in…" : "Creating…" : mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={17}/></button>
        </form>
        <button className="auth-link" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </>}
    </section>
  </main>;
}
