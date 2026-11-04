import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Lock, User, Mail } from "lucide-react";
import { btnPrimary, inputCls } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "लॉगिन — वार्ड वार मतदाता प्रबंधन" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"password" | "otp">("otp");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    const completeMagicLinkLogin = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      const profileResult = await supabase.from("profiles")
        .select("role,is_active").eq("user_id", data.session.user.id).maybeSingle();
      if (!active) return;
      if (profileResult.error || !profileResult.data?.is_active) {
        await supabase.auth.signOut();
        setError("यह यूजर सक्रिय नहीं है। एडमिन से संपर्क करें।");
        return;
      }
      await navigate({ to: "/" });
    };
    void completeMagicLinkLogin();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && active) {
        void completeMagicLinkLogin();
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate]);

  const finishLogin = async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    const profileResult = await supabase.from("profiles")
      .select("role,is_active").eq("user_id", userId).maybeSingle();
    if (profileResult.error || !profileResult.data?.is_active) {
      await supabase.auth.signOut();
      setError("यह यूजर सक्रिय नहीं है। एडमिन से संपर्क करें।");
      return false;
    }
    await navigate({ to: "/" });
    return true;
  };

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = identifier.trim();
      const email = value.includes("@") ? value.toLowerCase() : value.toLowerCase() + "@login.wardwise.local";
      const result = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (result.error || !result.data.user) {
        setError("लॉगिन ID / ईमेल या पासवर्ड सही नहीं है।");
        return;
      }
      await finishLogin(result.data.user.id);
    } catch {
      setError("Supabase सेटिंग उपलब्ध नहीं है। कृपया एडमिन से संपर्क करें।");
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const email = identifier.trim().toLowerCase();
      if (!email.includes("@")) {
        setError("कृपया अपना रजिस्टर्ड ईमेल पता डालें।");
        return;
      }
      const { error: linkError } = await getSupabaseBrowserClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + "/login" },
      });
      if (linkError) {
        if (linkError.message.toLowerCase().includes("rate") || linkError.message.includes("429")) {
          setError("ईमेल भेजने की सीमा पूरी हुई है। कुछ समय बाद दोबारा प्रयास करें।");
        } else {
          setError("लॉगिन लिंक नहीं भेजा जा सका। ईमेल जाँचें या कुछ समय बाद प्रयास करें।");
        }
        return;
      }
      setLinkSent(true);
      setNotice("आपके रजिस्टर्ड ईमेल पर लॉगिन लिंक भेजा गया है। ईमेल खोलकर लिंक पर क्लिक करें।");
    } catch {
      setError("लॉगिन लिंक भेजने में समस्या आई। कृपया बाद में प्रयास करें।");
    } finally {
      setBusy(false);
    }
  };

  return <div className="bg-hero flex min-h-screen items-center justify-center p-4">
    <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-card">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent"><ShieldCheck className="h-7 w-7 text-accent-foreground" /></div>
        <h1 className="text-2xl font-bold">मतदाता प्रबंधन प्रणाली</h1>
        <p className="text-sm text-muted-foreground">Ward Wise Voter Management</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        <button type="button" onClick={() => { setMode("otp"); setError(""); setNotice(""); }} className={`rounded-lg px-2 py-2 text-sm font-semibold ${mode === "otp" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>बिना पासवर्ड</button>
        <button type="button" onClick={() => { setMode("password"); setError(""); setNotice(""); }} className={`rounded-lg px-2 py-2 text-sm font-semibold ${mode === "password" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>पासवर्ड</button>
      </div>

      {mode === "otp" ? (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <p className="text-sm text-muted-foreground">रजिस्टर्ड ईमेल पर आए सुरक्षित लॉगिन लिंक से प्रवेश करें।</p>
          <label className="block text-sm font-medium">रजिस्टर्ड ईमेल
            <div className="relative mt-1"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} type="email" required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="name@gmail.com" autoComplete="email" disabled={linkSent} /></div>
          </label>

          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{notice}</p>}
          <button type="submit" disabled={busy || !identifier.trim() || linkSent} className={btnPrimary + " w-full"}>{busy ? "कृपया प्रतीक्षा करें..." : "ईमेल पर लॉगिन लिंक भेजें"}</button>
          {linkSent && <button type="button" onClick={() => { setLinkSent(false); setError(""); setNotice(""); }} className="w-full text-sm font-medium text-primary underline">दूसरा ईमेल डालें</button>}
        </form>
      ) : (
        <form onSubmit={submitPassword} className="space-y-3">
          <label className="block text-sm font-medium">ईमेल / लॉगिन ID
            <div className="relative mt-1"><User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} type="text" required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="जैसे MOHANBABAWALE" autoComplete="username" /></div>
          </label>
          <label className="block text-sm font-medium">पासवर्ड
            <div className="relative mt-1"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="पासवर्ड" autoComplete="current-password" /></div>
          </label>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy || !identifier.trim() || !password} className={btnPrimary + " w-full"}>{busy ? "लॉगिन हो रहा है..." : "सुरक्षित लॉगिन"}</button>
          <div className="text-center"><Link to="/reset-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">पासवर्ड भूल गए?</Link></div>
        </form>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground">केवल एडमिन द्वारा बनाए गए सक्रिय यूजर लॉगिन कर सकते हैं।</p>
    </div>
  </div>;
}
