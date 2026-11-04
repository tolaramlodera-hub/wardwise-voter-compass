import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Lock, User } from "lucide-react";
import { btnPrimary, inputCls } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "लॉगिन — वार्ड वार मतदाता प्रबंधन" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const value = identifier.trim();
      const email = value.includes("@") ? value.toLowerCase() : value.toLowerCase() + "@login.wardwise.local";
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.user) {
        setError("लॉगिन ID / ईमेल या पासवर्ड सही नहीं है।");
        return;
      }
      const profileResult = await supabase.from("profiles")
        .select("role,is_active").eq("user_id", result.data.user.id).maybeSingle();
      if (profileResult.error || !profileResult.data?.is_active) {
        await supabase.auth.signOut();
        setError("यह यूजर सक्रिय नहीं है। एडमिन से संपर्क करें।");
        return;
      }
      await navigate({ to: "/" });
    } catch {
      setError("Supabase सेटिंग उपलब्ध नहीं है। कृपया एडमिन से संपर्क करें।");
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
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium">ईमेल / लॉगिन ID
          <div className="relative mt-1"><User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} type="text" required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="जैसे MOHANBABAWALE" autoComplete="username" /></div>
        </label>
        <label className="block text-sm font-medium">पासवर्ड
          <div className="relative mt-1"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="पासवर्ड" autoComplete="current-password" /></div>
        </label>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy || !identifier.trim() || !password} className={btnPrimary + " w-full"}>{busy ? "लॉगिन हो रहा है..." : "सुरक्षित लॉगिन"}</button>
      </form>
      <div className="mt-3 text-center"><Link to="/reset-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">पासवर्ड भूल गए?</Link></div>
      <p className="mt-4 text-center text-xs text-muted-foreground">केवल एडमिन द्वारा बनाए गए सक्रिय यूजर लॉगिन कर सकते हैं।</p>
    </div>
  </div>;
}
