import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Map, CheckCircle2, Clock, Vote } from "lucide-react";
import { AppShell, StatCard, Card, btnPrimary } from "@/components/AppShell";
import { useStore, wardStats, wards } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "डैशबोर्ड — वार्ड वार मतदाता प्रबंधन" },
      { name: "description", content: "कुल मतदाता, वार्ड, मतदान उपस्थिति और बाकी मतदाताओं का लाइव डैशबोर्ड।" },
      { property: "og:title", content: "वार्ड वार मतदाता प्रबंधन डैशबोर्ड" },
      { property: "og:description", content: "Ward wise voter management and voting attendance record." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { voters } = useStore();
  const s = wardStats(voters);
  return (
    <AppShell title="मुख्य डैशबोर्ड">
      <div className="bg-hero mb-6 flex flex-col gap-4 rounded-2xl p-5 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-7">
        <div>
          <div className="text-sm opacity-80">कुल मतदान उपस्थिति</div>
          <div className="font-display text-5xl font-bold">{s.pct}%</div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary-foreground/20 md:w-80">
            <div className="h-full bg-accent" style={{ width: `${s.pct}%` }} />
          </div>
        </div>
        <Link to="/entry" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 font-semibold text-accent-foreground hover:bg-accent/90">
          <Vote className="h-5 w-5" /> वोटिंग एंट्री शुरू करें
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="कुल मतदाता" value={s.total} icon={Users} />
        <StatCard label="कुल वार्ड" value={wards.length} icon={Map} tone="accent" />
        <StatCard label="वोट डाल चुके" value={s.voted} icon={CheckCircle2} tone="success" />
        <StatCard label="बाकी मतदाता" value={s.pending} icon={Clock} tone="warning" />
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold">वार्ड वार रिपोर्ट</h2>
          <Link to="/reports" className="text-sm font-medium text-primary">पूरी रिपोर्ट →</Link>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {wards.map((w) => {
            const ws = wardStats(voters, w.number);
            return (
              <div key={w.number} className="rounded-lg border p-3">
                <div className="flex justify-between text-sm"><span className="font-semibold">{w.name}</span><span className="font-bold text-primary">{ws.pct}%</span></div>
                <div className="my-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-success" style={{ width: `${ws.pct}%` }} /></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>कुल {ws.total}</span><span>वोटेड {ws.voted}</span><span>बाकी {ws.pending}</span></div>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="mt-6 md:hidden"><Link to="/voted" className={btnPrimary + " w-full"}>सभी सूचियाँ देखें</Link></div>
    </AppShell>
  );
}
