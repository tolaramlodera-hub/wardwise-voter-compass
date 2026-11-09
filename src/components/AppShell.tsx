import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, Map, Users, Vote, CheckCircle2, Clock, BarChart3, UserCog, ScrollText, LogOut, ShieldCheck, LoaderCircle, Trash2, ListChecks, Hammer, Activity, CalendarDays, Shield } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
const nav = [
  { to: "/", label: "डैशबोर्ड", icon: LayoutDashboard }, { to: "/entry", label: "वोटिंग एंट्री", icon: Vote },
  { to: "/voters", label: "मतदाता सूची", icon: Users }, { to: "/voted", label: "Voted सूची", icon: CheckCircle2 },
  { to: "/pending", label: "Pending सूची", icon: Clock }, { to: "/ward-status", label: "वार्डवार वोट स्थिति", icon: ListChecks },
  { to: "/reports", label: "वार्ड रिपोर्ट", icon: BarChart3 }, { to: "/events", label: "इवेंट मैनेजमेंट", icon: CalendarDays }, { to: "/admin", label: "Admin Panel", icon: Shield, adminOnly: true }, { to: "/build-manager", label: "Build Manager", icon: Hammer, adminOnly: true }, { to: "/website-health", label: "Website Health", icon: Activity, adminOnly: true },
  { to: "/wards", label: "वार्ड मैनेजमेंट", icon: Map, adminOnly: true }, { to: "/data-admin", label: "डेटा प्रबंधन", icon: Trash2, adminOnly: true },
  { to: "/users", label: "यूजर मैनेजमेंट", icon: UserCog, adminOnly: true }, { to: "/audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
] as const;
export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useLocation(); const navigate = useNavigate();
  const [identity, setIdentity] = useState<{ name: string; role: "admin" | "staff" } | null>(null); const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true; const supabase = getSupabaseBrowserClient();
    const verify = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) await navigate({ to: "/login", replace: true }); return; }
      const { data: profile, error } = await supabase.from("profiles").select("full_name,role,is_active").eq("user_id", user.id).maybeSingle();
      if (error || !profile?.is_active || (profile.role !== "admin" && profile.role !== "staff")) { await supabase.auth.signOut(); if (active) await navigate({ to: "/login", replace: true }); return; }
      if (profile.role === "staff" && ["/admin", "/wards", "/data-admin", "/users", "/audit", "/build-manager", "/website-health"].includes(pathname)) { if (active) await navigate({ to: "/", replace: true }); return; }
      if (active) { setIdentity({ name: profile.full_name || user.email || "यूजर", role: profile.role }); setChecking(false); }
    };
    void verify().catch(() => { if (active) void navigate({ to: "/login", replace: true }); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (!session && active) void navigate({ to: "/login", replace: true }); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate, pathname]);
  const logout = async () => { await getSupabaseBrowserClient().auth.signOut(); await navigate({ to: "/login", replace: true }); };
  if (checking || !identity) return <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" /> सुरक्षित लॉगिन जाँचा जा रहा है...</div>;
  const visibleNav = nav.filter((item) => !("adminOnly" in item && item.adminOnly) || identity.role === "admin");
  const mobileNav = visibleNav.filter((item) => ["/", "/entry", "/voters", "/ward-status", "/reports", "/events", "/admin"].includes(item.to));
  return <div className="min-h-screen md:flex">
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5"><ShieldCheck className="h-7 w-7 text-accent" /><div><div className="font-display text-lg font-bold leading-tight">मतदाता प्रबंधन</div><div className="text-xs opacity-70">Ward Wise Voter System</div></div></div>
      <nav className="flex-1 space-y-1 p-3">{visibleNav.map((n) => { const active = pathname === n.to; return <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-sidebar-accent"}`}><n.icon className="h-4 w-4" /> {n.label}</Link>; })}</nav>
      <div className="border-t border-sidebar-border p-4 text-sm"><div className="font-semibold">{identity.name}</div><div className="text-xs opacity-70">{identity.role === "admin" ? "एडमिन" : "स्टाफ"}</div><button type="button" onClick={logout} className="mt-2 flex items-center gap-2 opacity-80 hover:opacity-100"><LogOut className="h-4 w-4" /> लॉगआउट</button></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0"><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur md:px-8"><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary md:hidden" /><h1 className="text-xl font-bold md:text-2xl">{title}</h1></div><div className="flex items-center gap-2 text-sm"><span className="hidden rounded-full bg-secondary px-3 py-1 text-secondary-foreground sm:inline">{identity.role === "admin" ? "एडमिन" : "स्टाफ"}</span><button type="button" onClick={logout} className="md:hidden"><LogOut className="h-5 w-5 text-muted-foreground" /></button></div></header><main className="flex-1 p-4 md:p-8">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t bg-card md:hidden">{mobileNav.map((n) => { const active = pathname === n.to; return <Link key={n.to} to={n.to} className={`flex min-w-[68px] flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}><n.icon className="h-5 w-5" /> {n.label.split(" ")[0]}</Link>; })}</nav>
  </div>;
}
export function StatCard({ label, value, icon: Icon, tone = "primary", sub }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; tone?: "primary" | "success" | "warning" | "accent"; sub?: string }) {
  const tones = { primary: "bg-primary text-primary-foreground", success: "bg-success text-success-foreground", warning: "bg-warning text-warning-foreground", accent: "bg-accent text-accent-foreground" };
  return <div className="rounded-xl border bg-card p-4 shadow-card md:p-5"><div className="flex items-start justify-between"><div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 font-display text-3xl font-bold">{value}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div><div className={`rounded-lg p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></div></div></div>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`rounded-xl border bg-card shadow-card ${className}`}>{children}</div>; }
export function WardSelect({ value, onChange, allLabel = "सभी वार्ड" }: { value: number; onChange: (n: number) => void; allLabel?: string | null }) { return <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 rounded-lg border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">{allLabel && <option value={0}>{allLabel}</option>}{Array.from({ length: 7 }, (_, i) => <option key={i} value={i + 1}>वार्ड {i + 1}</option>)}</select>; }
export const inputCls = "h-11 w-full rounded-lg border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
export const btnPrimary = "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
export const btnOutline = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-card px-3 text-sm hover:bg-muted";
