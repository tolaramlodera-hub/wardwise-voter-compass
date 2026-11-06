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
  const [mode, setMode] = useState<"password" | "otp" | "signup">("otp");
  const [fullName, setFullName] = useState("");
  const [voterIds, setVoterIds] = useState("");
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
      const ensured = await ensureVoterProfile(data.session.user);
      if (ensured.pending) { await supabase.auth.signOut(); setError("रजिस्ट्रेशन एडमिन की जाँच के लिए लंबित है। स्वीकृति के बाद लॉगिन करें।"); return; }
      if (ensured.error) { await supabase.auth.signOut(); setError(ensured.error); return; }
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

  const ensureVoterProfile = async (user: { id: string; user_metadata?: Record<string, unknown> }) => {
    const supabase = getSupabaseBrowserClient();
    const { data: existing, error: readError } = await supabase.from("profiles")
      .select("role,is_active").eq("user_id", user.id).maybeSingle();
    if (readError) return { error: readError.message, pending: false };
    if (existing) return { error: "", pending: !existing.is_active };
    if (user.user_metadata?.account_type !== "voter") return { error: "यह यूजर प्रोफाइल उपलब्ध नहीं है। एडमिन से संपर्क करें।", pending: false };
    const name = String(user.user_metadata.full_name || "").trim();
    const ids = Array.isArray(user.user_metadata.voter_ids) ? user.user_metadata.voter_ids.map(String) : [];
    if (!name || !ids.length) return { error: "रजिस्ट्रेशन में नाम या मतदाता पहचान संख्या नहीं मिली।", pending: false };
    const { error: profileError } = await supabase.from("profiles").insert({ user_id: user.id, full_name: name, role: "voter", is_active: false });
    if (profileError) return { error: profileError.message, pending: false };
    const links: { user_id: string; voter_id: string; relation: string }[] = [];
    for (const id of [...new Set(ids)]) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      const query = supabase.from("voters").select("id");
      const { data: voter } = isUuid ? await query.eq("id", id).maybeSingle() : await query.eq("voter_id", id).maybeSingle();
      if (!voter) return { error: "मतदाता पहचान संख्या " + id + " सूची में नहीं मिली। सही संख्या जाँचें।", pending: false };
      links.push({ user_id: user.id, voter_id: voter.id, relation: links.length ? "family_member" : "self" });
    }
    const { error: linkError } = await supabase.from("voter_account_links").insert(links);
    if (linkError) return { error: linkError.message.includes("duplicate") ? "इस मतदाता रिकॉर्ड का अकाउंट पहले से जुड़ा है। एडमिन से संपर्क करें।" : linkError.message, pending: false };
    return { error: "", pending: true };
  };

  const submitSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const ids = voterIds.split(",").map((v) => v.trim()).filter(Boolean);
      if (!fullName.trim() || !ids.length) { setError("पूरा नाम और कम से कम एक मतदाता पहचान संख्या भरें।"); return; }
      const { data, error: signupError } = await getSupabaseBrowserClient().auth.signUp({
        email: identifier.trim().toLowerCase(), password,
        options: { data: { account_type: "voter", full_name: fullName.trim(), voter_ids: ids }, emailRedirectTo: window.location.origin + "/login" },
      });
      if (signupError) { setError(signupError.message); return; }
      if (data.session && data.user) {
        const result = await ensureVoterProfile(data.user);
        await getSupabaseBrowserClient().auth.signOut();
        if (result.error) { setError(result.error); return; }
        setNotice("रजिस्ट्रेशन सफल। एडमिन द्वारा पहचान जाँचकर अकाउंट सक्रिय करने के बाद लॉगिन कर सकेंगे।");
      } else {
        setNotice("ईमेल सत्यापन लिंक भेजा गया है। लिंक खोलने के बाद आपका अकाउंट एडमिन की जाँच के लिए लंबित रहेगा।");
      }
    } catch { setError("रजिस्ट्रेशन पूरा नहीं हो सका। ईमेल और मतदाता पहचान संख्या जाँचें।"); }
    finally { setBusy(false); }
  };

  const finishLogin = async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const ensured = await ensureVoterProfile(authData.user);
      if (ensured.pending) { await supabase.auth.signOut(); setError("आपका मतदाता अकाउंट एडमिन की जाँच के लिए लंबित है। स्वीकृति के बाद लॉगिन करें।"); return false; }
      if (ensured.error) { await supabase.auth.signOut(); setError(ensured.error); return false; }
    }
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

  const startGoogleLogin = async () => { setBusy(true); setError(""); setNotice(""); try { const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/login" } }); if (error) setError("Google लॉगिन शुरू नहीं हो सका: " + error.message); } catch { setError("Google लॉगिन सेटअप उपलब्ध नहीं है।"); } finally { setBusy(false); } };

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

      <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-muted p-1">
        <button type="button" onClick={() => { setMode("otp"); setError(""); setNotice(""); }} className={`rounded-lg px-2 py-2 text-sm font-semibold ${mode === "otp" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>बिना पासवर्ड</button>
        <button type="button" onClick={() => { setMode("password"); setError(""); setNotice(""); }} className={`rounded-lg px-2 py-2 text-sm font-semibold ${mode === "password" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>पासवर्ड</button>
        <button type="button" onClick={() => { setMode("signup"); setError(""); setNotice(""); }} className={`rounded-lg px-2 py-2 text-sm font-semibold ${mode === "signup" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>नया अकाउंट</button>
      </div>

      {mode === "signup" ? (
        <form onSubmit={submitSignup} className="space-y-3">
          <p className="text-sm text-muted-foreground">मतदाता सूची में दर्ज पहचान संख्या से व्यक्तिगत या परिवार का अकाउंट बनाएँ। एडमिन सत्यापन के बाद अकाउंट सक्रिय होगा।</p>
          <input className={inputCls} required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="पूरा नाम" autoComplete="name" />
          <input className={inputCls} type="email" required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="ईमेल पता" autoComplete="email" />
          <input className={inputCls} type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="पासवर्ड (कम से कम 8 अक्षर)" autoComplete="new-password" />
          <label className="block text-sm font-medium">मतदाता पहचान संख्या <span className="font-normal text-muted-foreground">(परिवार के लिए कॉमा लगाकर कई संख्या)</span><input className={inputCls + " mt-1"} required value={voterIds} onChange={e => setVoterIds(e.target.value)} placeholder="जैसे ABC123, ABC124" /></label>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{notice}</p>}
          <button type="submit" disabled={busy || !identifier.trim() || !password || !fullName.trim() || !voterIds.trim()} className={btnPrimary + " w-full"}>{busy ? "अकाउंट बनाया जा रहा है..." : "रजिस्ट्रेशन करें"}</button>
        </form>
      ) : mode === "otp" ? (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <p className="text-sm text-muted-foreground">फोन में पहले से लॉगिन Google अकाउंट चुनकर सुरक्षित प्रवेश करें।</p><button type="button" onClick={() => void startGoogleLogin()} disabled={busy} className={btnPrimary + " w-full"}>{busy ? "Google पर जा रहे हैं..." : "Google से जारी रखें"}</button>
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
      <p className="mt-4 text-center text-xs text-muted-foreground">नया मतदाता अकाउंट ईमेल सत्यापन और एडमिन की स्वीकृति के बाद सक्रिय होगा।</p>
    </div>
  </div>;
}
