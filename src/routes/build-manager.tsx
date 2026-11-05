import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, ExternalLink, RefreshCw, XCircle, Hammer, AlertTriangle, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, StatCard, btnOutline } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
type Deployment = { uid: string; name: string; url: string | null; state: string; target: string | null; createdAt: number; ready: number | null; meta?: { githubCommitRef?: string; githubCommitMessage?: string } };
type Payload = { deployments: Deployment[]; configured: boolean; error?: string };
const ranges = [{ value: "24h", label: "24 घंटे" }, { value: "7d", label: "7 दिन" }, { value: "30d", label: "30 दिन" }] as const;
const labels: Record<string, string> = { READY: "सफल", BUILDING: "बिल्ड हो रहा है", INITIALIZING: "शुरू हो रहा है", QUEUED: "कतार में", ERROR: "एरर", CANCELED: "रद्द", BLOCKED: "रुका हुआ" };
const styles: Record<string, string> = { READY: "bg-emerald-100 text-emerald-800", BUILDING: "bg-blue-100 text-blue-800", INITIALIZING: "bg-blue-100 text-blue-800", QUEUED: "bg-amber-100 text-amber-800", ERROR: "bg-red-100 text-red-800", CANCELED: "bg-muted text-muted-foreground", BLOCKED: "bg-amber-100 text-amber-800" };
export const Route = createFileRoute("/build-manager")({ head: () => ({ meta: [{ title: "Build Manager — वार्ड वार मतदाता प्रबंधन" }] }), component: BuildManager });
function BuildManager() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h"); const [filter, setFilter] = useState("ALL");
  const [rows, setRows] = useState<Deployment[]>([]); const [configured, setConfigured] = useState(true); const [loading, setLoading] = useState(true); const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const load = useCallback(async () => {
    setLoading(true); const { data, error } = await supabase.functions.invoke("vercel-build-manager", { body: { range } });
    if (error) { const context = (error as { context?: unknown }).context; const detail = context instanceof Response ? await context.clone().json().catch(() => null) as { error?: string } | null : null; toast.error(detail?.error || error.message || "Build History लोड नहीं हुई"); setLoading(false); return; }
    const payload = data as Payload; setConfigured(payload.configured); if (payload.error) toast.error(payload.error); setRows(payload.deployments ?? []); setLastUpdated(new Date()); setLoading(false);
  }, [range, supabase]);
  useEffect(() => { void load(); }, [load]);
  const visible = rows.filter((item) => filter === "ALL" || item.state === filter);
  const count = (state: string) => rows.filter((item) => item.state === state).length;
  const formatDate = (value: number) => new Intl.DateTimeFormat("hi-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <AppShell title="Build Manager">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Vercel पर वेबसाइट की Build History और Preview स्थिति</p><p className="mt-1 text-xs text-muted-foreground">यह पैनल केवल Build की निगरानी करता है; कोई Build अपने-आप Cancel या Production में Deploy नहीं करता।</p></div><button onClick={() => void load()} disabled={loading} className={btnOutline}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> रिफ्रेश करें</button></div>
    <div className="mb-4 flex flex-wrap gap-2">{ranges.map((item) => <button key={item.value} onClick={() => setRange(item.value)} className={`rounded-lg border px-4 py-2 text-sm font-medium ${range === item.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>{item.label}</button>)}</div>
    {!configured && <Card className="mb-5 border-amber-300 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><h2 className="font-semibold">Vercel API Token सेट करना बाकी है</h2><p className="mt-1 text-sm text-muted-foreground">Supabase Dashboard → Edge Functions → Secrets में <b>VERCEL_API_TOKEN</b> नाम से Vercel Token जोड़ें। Token को वेबसाइट या चैट में न डालें। फिर यहाँ रिफ्रेश करें।</p></div></div></Card>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="कुल Builds" value={rows.length} icon={Hammer} /><StatCard label="सफल" value={count("READY")} icon={CheckCircle2} tone="success" /><StatCard label="चल रही" value={count("BUILDING") + count("INITIALIZING") + count("QUEUED")} icon={Activity} tone="accent" /><StatCard label="Error" value={count("ERROR")} icon={XCircle} tone="warning" /></div>
    <Card className="mt-5 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><h2 className="font-bold">Build History</h2><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">स्थिति:</span><select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-lg border bg-card px-2 text-sm"><option value="ALL">सभी</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
    {loading ? <div className="p-10 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-2 h-6 w-6 animate-pulse" />Build History लोड हो रही है...</div> : visible.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">इस अवधि में कोई Build रिकॉर्ड नहीं मिला।</div> : <div className="divide-y">{visible.map((item) => <div key={item.uid} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="truncate">{item.name}</b><span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[item.state] || "bg-muted"}`}>{labels[item.state] || item.state}</span><span className="rounded-full bg-muted px-2 py-1 text-xs">{item.target === "production" ? "Production" : "Preview"}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.meta?.githubCommitRef || "Branch जानकारी उपलब्ध नहीं"} · {formatDate(item.createdAt)}</p>{item.meta?.githubCommitMessage && <p className="mt-1 truncate text-sm text-muted-foreground">{item.meta.githubCommitMessage}</p>}</div>{item.url && <a href={`https://${item.url}`} target="_blank" rel="noreferrer" className={btnOutline}>Preview खोलें <ExternalLink className="h-3.5 w-3.5" /></a>}</div>)}</div>}
    <div className="border-t px-4 py-3 text-xs text-muted-foreground">{lastUpdated ? `अंतिम अपडेट: ${lastUpdated.toLocaleTimeString("hi-IN")}` : "अपडेट की प्रतीक्षा में"}</div></Card>
  </AppShell>;
}
