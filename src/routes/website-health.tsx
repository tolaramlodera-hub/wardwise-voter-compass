import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, ExternalLink, Github, Globe, HardDrive, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, StatCard, btnOutline } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Check = { state: "ok" | "error" | "pending" | "unavailable"; detail: string; duration?: number };
type AuditEvent = { timestamp: string; action: string; actor: string; provider: string };
type Health = { website: Check; database: Check; auth: Check; github: Check; vercel: Check; errors: Check; storage: Check; loginAudit: Check };
const initial: Health = {
  website: { state: "pending", detail: "जाँच बाकी" }, database: { state: "pending", detail: "जाँच बाकी" },
  auth: { state: "pending", detail: "जाँच बाकी" }, github: { state: "pending", detail: "जाँच बाकी" },
  vercel: { state: "pending", detail: "जाँच बाकी" }, errors: { state: "pending", detail: "इस पेज के ब्राउज़र errors की निगरानी शुरू हो रही है" },
  storage: { state: "pending", detail: "Storage buckets की जाँच बाकी" },
  loginAudit: { state: "unavailable", detail: "Supabase Auth audit logs platform Logs में उपलब्ध हैं; ऐप से सुरक्षित API कनेक्शन अभी नहीं जोड़ा गया है" },
};
const stateLabel = { ok: "सही", error: "समस्या", pending: "जाँच जारी", unavailable: "सेटअप बाकी" };
const stateClass = { ok: "bg-emerald-100 text-emerald-800", error: "bg-red-100 text-red-800", pending: "bg-amber-100 text-amber-800", unavailable: "bg-muted text-muted-foreground" };
export const Route = createFileRoute("/website-health")({ head: () => ({ meta: [{ title: "Website Health — वार्ड वार मतदाता प्रबंधन" }] }), component: WebsiteHealth });

function WebsiteHealth() {
  const [health, setHealth] = useState<Health>(initial);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [browserErrorCount, setBrowserErrorCount] = useState(0);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const runChecks = useCallback(async () => {
    setLoading(true);
    const next: Health = { ...initial };
    const started = performance.now();
    try {
      const response = await fetch("/", { method: "GET", cache: "no-store", credentials: "same-origin" });
      next.website = { state: response.ok ? "ok" : "error", detail: response.ok ? `वेबसाइट HTTP ${response.status} पर जवाब दे रही है` : `वेबसाइट ने HTTP ${response.status} लौटाया`, duration: Math.round(performance.now() - started) };
    } catch (error) { next.website = { state: "error", detail: error instanceof Error ? error.message : "वेबसाइट तक पहुँचना संभव नहीं" }; }

    const supabase = getSupabaseBrowserClient();
    try {
      const authStart = performance.now();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      next.auth = authError || !user ? { state: "error", detail: authError?.message || "लॉगिन सत्र उपलब्ध नहीं" } : { state: "ok", detail: "Admin login और Supabase Auth सही काम कर रहे हैं", duration: Math.round(performance.now() - authStart) };
      if (user) {
        const dbStart = performance.now();
        const { data, error } = await supabase.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();
        next.database = error ? { state: "error", detail: error.message } : data ? { state: "ok", detail: "Database से सुरक्षित profile query सफल", duration: Math.round(performance.now() - dbStart) } : { state: "error", detail: "लॉगिन यूजर की profile नहीं मिली" };
      } else next.database = { state: "error", detail: "Database query के लिए Admin login आवश्यक है" };
    } catch (error) { next.auth = { state: "error", detail: error instanceof Error ? error.message : "Auth जाँच विफल" }; next.database = { state: "error", detail: "Database जाँच विफल" }; }

    try {
      const gh = await fetch("https://api.github.com/repos/tolaramlodera-hub/wardwise-voter-compass/pulls/32", { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (gh.ok) {
        const pr = await gh.json() as { state?: string; merged_at?: string | null; head?: { sha?: string } };
        let detail = `PR #32: ${pr.state === "open" ? "खुला है" : pr.state || "स्थिति उपलब्ध नहीं"}`;
        if (pr.merged_at) detail += " · Merge हो चुका है";
        if (pr.head?.sha) {
          const checks = await fetch(`https://api.github.com/repos/tolaramlodera-hub/wardwise-voter-compass/commits/${pr.head.sha}/status`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
          if (checks.ok) { const status = await checks.json() as { state?: string; total_count?: number }; detail += ` · Checks: ${status.state || "pending"} (${status.total_count ?? 0})`; }
        }
        next.github = { state: "ok", detail };
      } else next.github = { state: "unavailable", detail: gh.status === 403 ? "GitHub API की अस्थायी rate limit; बाद में पुनः जाँचें" : `GitHub API HTTP ${gh.status}` };
    } catch { next.github = { state: "unavailable", detail: "GitHub API से संपर्क नहीं हो पाया" }; }

    try {
      const { data, error } = await supabase.functions.invoke("vercel-build-manager", { body: { range: "24h" } });
      if (error || data?.error || data?.configured === false) next.vercel = { state: "error", detail: data?.error || error?.message || "Vercel Token सेटअप जाँचें" };
      else next.vercel = { state: "ok", detail: `Vercel API कनेक्शन सही · पिछले 24 घंटे में ${data?.deployments?.length ?? 0} Build रिकॉर्ड मिले` };
    } catch (error) { next.vercel = { state: "error", detail: error instanceof Error ? error.message : "Vercel API जाँच विफल" }; }

    try {
      const storageStart = performance.now();
      const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
      next.storage = storageError
        ? { state: "unavailable", detail: `Storage bucket सूची नहीं पढ़ी जा सकी: ${storageError.message}` }
        : buckets?.length ? { state: "ok", detail: `${buckets.length} Storage bucket उपलब्ध: ${buckets.map((bucket) => bucket.name).join(", ")} · फ़ाइलों का कुल आकार project metrics से अलग जाँचना होगा`, duration: Math.round(performance.now() - storageStart) } : { state: "unavailable", detail: "अभी कोई Storage bucket configured नहीं है", duration: Math.round(performance.now() - storageStart) };
    } catch (error) { next.storage = { state: "unavailable", detail: error instanceof Error ? error.message : "Storage जाँच विफल" }; }

    try {
      const { data, error } = await supabase.functions.invoke("login-activity-audit", { body: {} });
      if (error || data?.error) {
        next.loginAudit = { state: "error", detail: data?.error || error?.message || "Login audit जाँच विफल" };
        setAuditEvents([]);
      } else if (data?.configured === false) {
        next.loginAudit = { state: "unavailable", detail: data?.message || "Supabase Management API token सेटअप बाकी है" };
        setAuditEvents([]);
      } else {
        const events = Array.isArray(data?.events) ? data.events as AuditEvent[] : [];
        setAuditEvents(events);
        next.loginAudit = { state: "ok", detail: `पिछले 24 घंटे में ${events.length} Auth audit events मिले` };
      }
    } catch (error) {
      next.loginAudit = { state: "unavailable", detail: error instanceof Error ? error.message : "Login audit उपलब्ध नहीं" };
      setAuditEvents([]);
    }

    setHealth((previous) => ({ ...next, errors: previous.errors }));
    setCheckedAt(new Date());
    setLoading(false);
    const failures = [next.website, next.database, next.auth, next.vercel].filter((item) => item.state === "error").length;
    if (failures) toast.error(`${failures} जाँच में समस्या मिली`); else toast.success("उपलब्ध Health Checks पूरी हुईं");
  }, []);

  useEffect(() => { void runChecks(); }, [runChecks]);

  // Session-only client error capture; no error payloads are persisted.
  useEffect(() => {
    const recordError = (message: string) => {
      const safeMessage = message.slice(0, 180);
      setBrowserErrorCount((count) => {
        const nextCount = count + 1;
        setHealth((previous) => ({ ...previous, errors: { state: "error", detail: nextCount + " browser errors मिले। नवीनतम: " + safeMessage } }));
        return nextCount;
      });
    };
    const onError = (event: ErrorEvent) => recordError(event.message || "अज्ञात browser error");
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      recordError(reason instanceof Error ? reason.message : String(reason || "Unhandled promise rejection"));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    setHealth((previous) => ({ ...previous, errors: { state: "ok", detail: "Browser error monitoring सक्रिय है · इस पेज के खुले रहने तक errors पकड़े जाएँगे" } }));
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  const cards = [
    { key: "website", title: "वेबसाइट स्थिति", icon: Globe, desc: "वर्तमान वेबसाइट का HTTP response" },
    { key: "database", title: "Supabase Database", icon: Database, desc: "लॉगिन यूजर की सुरक्षित profile query" },
    { key: "auth", title: "Login / Auth", icon: ShieldCheck, desc: "Admin session और authentication" },
    { key: "github", title: "GitHub PR / Checks", icon: Github, desc: "PR #32 और उपलब्ध commit checks" },
    { key: "vercel", title: "Vercel Build API", icon: Activity, desc: "Build Manager API connection" },
    { key: "errors", title: "Error Monitoring", icon: AlertTriangle, desc: "इस admin session के browser runtime errors" },
    { key: "storage", title: "Storage Monitoring", icon: HardDrive, desc: "फाइल storage usage और limits" },
    { key: "loginAudit", title: "Login Activity Audit", icon: Clock3, desc: "Supabase Auth के सफल/असफल login events" },
  ] as const;
  const good = [health.website, health.database, health.auth, health.github, health.vercel].filter((x) => x.state === "ok").length;
  const bad = [health.website, health.database, health.auth, health.github, health.vercel].filter((x) => x.state === "error").length;
  return <AppShell title="Website Health">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">वेबसाइट, Database, Login, GitHub और Vercel की एक जगह से जाँच</p><p className="mt-1 text-xs text-muted-foreground">यह पेज केवल read-only जाँच करता है; कोई डेटा, यूजर, Build या Production सेटिंग नहीं बदलता।</p></div><button onClick={() => void runChecks()} disabled={loading} className={btnOutline}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> अभी जाँचें</button></div>
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3"><StatCard label="सही जाँच" value={good} icon={CheckCircle2} tone="success" /><StatCard label="समस्या" value={bad} icon={XCircle} tone="warning" /><StatCard label="अतिरिक्त सेटअप" value={[health.storage, health.loginAudit].filter((x) => x.state === "unavailable").length} icon={AlertTriangle} tone="accent" /></div>
    <div className="grid gap-3 md:grid-cols-2">
      {cards.map((card) => { const item = health[card.key as keyof Health]; const Icon = card.icon; return <Card key={card.key} className="p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-muted p-2"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{card.title}</h2><span className={`rounded-full px-2 py-1 text-xs font-semibold ${stateClass[item.state]}`}>{stateLabel[item.state]}</span></div><p className="mt-1 text-xs text-muted-foreground">{card.desc}</p><p className="mt-2 break-words text-sm">{item.detail}</p>{item.duration !== undefined && <p className="mt-1 text-xs text-muted-foreground">Response: {item.duration} ms</p>}</div></div></Card>; })}
    </div>
    <Card className="mt-5 p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">हाल की Login Activity (24 घंटे)</h2><span className="text-xs text-muted-foreground">{auditEvents.length} रिकॉर्ड</span></div>{auditEvents.length ? <div className="mt-3 space-y-2">{auditEvents.map((event, index) => <div key={event.timestamp + event.action + index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm"><div><p className="font-medium">उपयोगकर्ता</p><p className="text-xs text-muted-foreground">{event.provider ? `लॉगिन माध्यम: ${event.provider === "email" ? "ईमेल" : event.provider === "phone" ? "मोबाइल" : event.provider}` : "प्रमाणीकरण गतिविधि"}</p></div><div className="text-right"><p>{({ login: "लॉगिन", logout: "लॉगआउट", token_revoked: "सत्र/टोकन रद्द", token_refreshed: "सत्र/टोकन नवीनीकृत", signup: "नया पंजीकरण", user_signedup: "नया पंजीकरण", password_recovery_requested: "पासवर्ड रीसेट अनुरोध", user_recovery_requested: "पासवर्ड रीसेट अनुरोध" } as Record<string, string>)[event.action] || event.action}</p><p className="text-xs text-muted-foreground">{event.timestamp ? new Date(event.timestamp).toLocaleString("hi-IN") : "समय उपलब्ध नहीं"}</p></div></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">लॉग उपलब्ध होने पर हाल की गतिविधि यहाँ दिखेगी।</p>}</Card>
    <Card className="mt-5 p-4"><h2 className="font-semibold">अतिरिक्त मॉनिटरिंग सक्षम करने के लिए</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground"><li>Browser error monitoring इस Health पेज के खुले रहने तक सक्रिय रहती है; स्थायी browser/server error history और alerts के लिए Sentry DSN या Vercel Log Drain चाहिए। अभी पकड़े गए browser errors: {browserErrorCount} (refresh पर reset होंगे)।</li><li>Storage bucket सूची की जाँच अब यहीं होती है; कुल bytes/usage के लिए project-level metrics permission चाहिए।</li><li>Login Activity सुरक्षित server-side function से पढ़ी जाती है। इसे सक्रिय करने के लिए Supabase में SUPABASE_ACCESS_TOKEN secret सेट करना बाकी है; token केवल server पर रहेगा।</li></ul><div className="mt-3 flex flex-wrap gap-2"><a href="https://vercel.com/tola-ram1/wardwise-voter-compass/logs" target="_blank" rel="noreferrer" className={btnOutline}>Vercel Runtime Logs <ExternalLink className="h-3.5 w-3.5" /></a><a href="https://supabase.com/dashboard/project/litdtkqtserftjlkkatg/logs/explorer" target="_blank" rel="noreferrer" className={btnOutline}>Supabase Auth Logs <ExternalLink className="h-3.5 w-3.5" /></a><a href="https://github.com/tolaramlodera-hub/wardwise-voter-compass/pull/32" target="_blank" rel="noreferrer" className={btnOutline}>GitHub PR खोलें <ExternalLink className="h-3.5 w-3.5" /></a></div></Card>
    <p className="mt-3 text-xs text-muted-foreground">{checkedAt ? `अंतिम जाँच: ${checkedAt.toLocaleString("hi-IN")}` : "जाँच की प्रतीक्षा में"} · डेटा रिफ्रेश करने के लिए “अभी जाँचें” दबाएँ।</p>
  </AppShell>;
}
