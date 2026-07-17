import React, { useState } from "react";
import { ArrowRight, Check, KeyRound, LoaderCircle, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

export function AuthPage({ user, profile, onDone, onSignOut, onAdmin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  if (user) return <main className="auth-page">
    <section className="account-card">
      <div className="account-avatar"><UserRound /></div>
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h1>{profile?.full_name || user.user_metadata?.full_name || "Welcome back"}</h1>
      <p>{user.email}</p>
      <div className="account-status"><ShieldCheck size={18}/><span>Email verified</span><Check size={15}/></div>
      <div className="account-status"><KeyRound size={18}/><span>Account role</span><b>{profile?.role || "customer"}</b></div>
      <button className="primary" onClick={onDone}>Continue shopping <ArrowRight size={17}/></button>
      {["admin","staff"].includes(profile?.role) && <button className="primary admin-account-button" onClick={onAdmin}>Open store admin <ShieldCheck size={17}/></button>}
      <button className="auth-link" onClick={onSignOut}><LogOut size={15}/> Sign out</button>
    </section>
  </main>;

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
          <button className="primary" disabled={loading || otp.length !== 6}>{loading ? <LoaderCircle className="spin"/> : "Verify account"} <ArrowRight size={17}/></button>
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
          <button className="primary" disabled={loading}>{loading ? <LoaderCircle className="spin"/> : mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={17}/></button>
        </form>
        <button className="auth-link" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </>}
    </section>
  </main>;
}
