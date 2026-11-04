import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Lock, Mail, ShieldCheck } from "lucide-react";
import { btnPrimary, inputCls } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "पासवर्ड रीसेट — वार्ड वार मतदाता प्रबंधन" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && typeof window !== "undefined" && (window.location.hash.includes("access_token=") || new URLSearchParams(window.location.search).has("code"))) {
        setRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (resetError) {
        setError("रीसेट ईमेल नहीं भेजा जा सका। ईमेल पता जाँचें या बाद में प्रयास करें।");
        return;
      }
      setSent(true);
    } catch {
      setError("वेबसाइट की Supabase सेटिंग उपलब्ध नहीं है। एडमिन से संपर्क करें।");
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।");
      return;
    }
    if (password !== confirmPassword) {
      setError("दोनों पासवर्ड एक जैसे नहीं हैं।");
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("पासवर्ड अपडेट नहीं हुआ। ईमेल में मिले रीसेट लिंक से दोबारा खोलें।");
        return;
      }
      await supabase.auth.signOut();
      await navigate({ to: "/login" });
    } catch {
      setError("पासवर्ड अपडेट नहीं हो सका। कृपया दोबारा प्रयास करें।");
    } finally {
      setBusy(false);
    }
  };

  return <div className="bg-hero flex min-h-screen items-center justify-center p-4">
    <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-card">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <ShieldCheck className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-bold">पासवर्ड रीसेट</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ward Wise Voter Management</p>
      </div>

      {recoveryMode ? (
        <form onSubmit={updatePassword} className="space-y-3">
          <label className="block text-sm font-medium">नया पासवर्ड
            <div className="relative mt-1"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} type="password" required minLength={6} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="कम से कम 6 अक्षर" /></div>
          </label>
          <label className="block text-sm font-medium">नया पासवर्ड दोबारा डालें
            <div className="relative mt-1"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} type="password" required minLength={6} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="पासवर्ड की पुष्टि करें" /></div>
          </label>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy || !password || !confirmPassword} className={btnPrimary + " w-full"}>{busy ? "अपडेट हो रहा है..." : "नया पासवर्ड सेव करें"}</button>
        </form>
      ) : sent ? (
        <div className="space-y-4 text-center">
          <p className="rounded-lg bg-primary/10 p-4 text-sm">यदि यह ईमेल पंजीकृत है, तो पासवर्ड रीसेट लिंक भेज दिया गया है। Gmail का Inbox और Spam फ़ोल्डर जाँचें।</p>
          <p className="text-sm text-muted-foreground">ईमेल में आए लिंक को इसी फोन में खोलें और नया पासवर्ड बनाएँ।</p>
        </div>
      ) : (
        <form onSubmit={sendReset} className="space-y-3">
          <p className="text-sm text-muted-foreground">अपने एडमिन खाते का ईमेल डालें। हम उस पते पर पासवर्ड रीसेट लिंक भेजेंगे।</p>
          <label className="block text-sm font-medium">रजिस्टर्ड ईमेल
            <div className="relative mt-1"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@gmail.com" /></div>
          </label>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy || !email.trim()} className={btnPrimary + " w-full"}>{busy ? "ईमेल भेज रहे हैं..." : "रीसेट लिंक भेजें"}</button>
        </form>
      )}
      <div className="mt-5 text-center">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> लॉगिन पर वापस जाएँ</Link>
      </div>
    </div>
  </div>;
}
