import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Map, Users, Vote, CheckCircle2, Clock, BarChart3, UserCog, ScrollText, LogOut, ShieldCheck } from "lucide-react";

const nav = [
  { to: "/", label: "डैशबोर्ड", icon: LayoutDashboard },
  { to: "/entry", label: "वोटिंग एंट्री", icon: Vote },
  { to: "/voters", label: "मतदाता सूची", icon: Users },
  { to: "/voted", label: "Voted सूची", icon: CheckCircle2 },
  { to: "/pending", label: "Pending सूची", icon: Clock },
  { to: "/reports", label: "वार्ड रिपोर्ट", icon: BarChart3 },
  { to: "/wards", label: "वार्ड मैनेजमेंट", icon: Map },
  { to: "/users", label: "यूजर मैनेजमेंट", icon: UserCog },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
] as const;

const mobileNav = [nav[0], nav[1], nav[2], nav[5], nav[7]];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
          <ShieldCheck className="h-7 w-7 text-accent" />
          <div>
            <div className="font-display text-lg font-bold leading-tight">मतदाता प्रबंधन</div>
            <div className="text-xs opacity-70">Ward Wise Voter System</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => {
            const active = pathname === n.to;
            return (
              <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-sidebar-accent"}`}>
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-sm">
          <div className="font-semibold">मुख्य एडमिन</div>
          <Link to="/login" className="mt-2 flex items-center gap-2 opacity-80 hover:opacity-100"><LogOut className="h-4 w-4" /> लॉगआउट</Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary md:hidden" />
            <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden rounded-full bg-secondary px-3 py-1 text-secondary-foreground sm:inline">डिज़ाइन प्रीव्यू</span>
            <Link to="/login" className="md:hidden"><LogOut className="h-5 w-5 text-muted-foreground" /></Link>
          </div>
        </header>
        <div className="bg-warning/20 px-4 py-1.5 text-center text-xs text-warning-foreground md:px-8">
          डिज़ाइन प्रीव्यू — अधिकृत मतदाता सूची अपलोड होने तक मतदाता डेटा खाली रहेगा। केवल मतदान उपस्थिति दर्ज होगी; किसे वोट दिया इसकी जानकारी नहीं रखी जाएगी।
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card md:hidden">
        {mobileNav.map((n) => {
          const active = pathname === n.to;
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>
              <n.icon className="h-5 w-5" /> {n.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "primary", sub }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; tone?: "primary" | "success" | "warning" | "accent"; sub?: string }) {
  const tones = { primary: "bg-primary text-primary-foreground", success: "bg-success text-success-foreground", warning: "bg-warning text-warning-foreground", accent: "bg-accent text-accent-foreground" };
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card md:p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-3xl font-bold">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className={`rounded-lg p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card shadow-card ${className}`}>{children}</div>;
}

export function WardSelect({ value, onChange, allLabel = "सभी वार्ड" }: { value: number; onChange: (n: number) => void; allLabel?: string | null }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 rounded-lg border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
      {allLabel && <option value={0}>{allLabel}</option>}
      {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>वार्ड {i + 1}</option>)}
    </select>
  );
}

export const inputCls = "h-11 w-full rounded-lg border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
export const btnPrimary = "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
export const btnOutline = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-card px-3 text-sm hover:bg-muted";
