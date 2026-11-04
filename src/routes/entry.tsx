import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, WardSelect, inputCls, btnPrimary } from "@/components/AppShell";
import { useStore, markVoted, wardStats, type Voter } from "@/lib/mock-data";

export const Route = createFileRoute("/entry")({
  head: () => ({
    meta: [
      { title: "वोटिंग एंट्री — मतदान उपस्थिति दर्ज करें" },
      { name: "description", content: "वार्ड चुनें, मतदाता खोजें और मतदान उपस्थिति दर्ज करें।" },
      { property: "og:title", content: "वोटिंग एंट्री" },
      { property: "og:description", content: "Record voter attendance ward wise." },
    ],
  }),
  component: Entry,
});

function Entry() {
  const { voters } = useStore();
  const [ward, setWard] = useState(1);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Voter | null>(null);
  const [verified, setVerified] = useState(false);
  const s = wardStats(voters, ward);
  const list = voters.filter((v) => v.ward === ward && (!q || v.name.includes(q) || v.voterId.toLowerCase().includes(q.toLowerCase()) || v.house.includes(q)));
  const current = sel ? voters.find((v) => v.id === sel.id)! : null;

  function save() {
    if (!current) return;
    if (markVoted(current.id)) toast.success(`${current.name} — मतदान उपस्थिति दर्ज`);
    else toast.error("इस मतदाता की एंट्री पहले ही हो चुकी है");
    setVerified(false);
  }

  return (
    <AppShell title="वोटिंग एंट्री">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <div className="space-y-3 border-b p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">1. वार्ड चुनें</span>
              <WardSelect value={ward} onChange={(n) => { setWard(n); setSel(null); }} allLabel={null} />
              <span className="ml-auto text-xs text-muted-foreground">वोटेड <b className="text-success">{s.voted}</b> · बाकी <b className="text-warning-foreground">{s.pending}</b></span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls + " pl-9"} placeholder="2. नाम, वोटर ID या मकान नंबर से खोजें" />
            </div>
          </div>
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {list.map((v) => (
              <li key={v.id}>
                <button onClick={() => { setSel(v); setVerified(false); }} className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted ${current?.id === v.id ? "bg-secondary" : ""}`}>
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">मकान {v.house} · <span className="font-mono">{v.voterId}</span></div>
                  </div>
                  {v.votedAt ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Voted</span> : <span className="rounded-full bg-warning/25 px-2 py-0.5 text-xs font-medium text-warning-foreground">Pending</span>}
                </button>
              </li>
            ))}
            {!list.length && <li className="p-6 text-center text-sm text-muted-foreground">कोई मतदाता नहीं मिला</li>}
          </ul>
        </Card>

        <Card className="h-fit p-5 lg:sticky lg:top-24">
          {!current ? (
            <div className="py-10 text-center text-sm text-muted-foreground">विवरण देखने के लिए सूची से मतदाता चुनें</div>
          ) : (
            <div>
              <h2 className="text-xl font-bold">{current.name}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                {[["पिता/पति", current.relative], ["उम्र", current.age], ["लिंग", current.gender], ["मकान नं.", current.house], ["वोटर ID", current.voterId], ["वार्ड", current.ward]].map(([k, v]) => (
                  <div key={String(k)}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
              </dl>
              {current.votedAt ? (
                <div className="mt-5 flex items-start gap-2 rounded-lg bg-success/15 p-3 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> एंट्री हो चुकी है — {current.votedBy}, {current.votedAt}. दोबारा एंट्री संभव नहीं।
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                    <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-1" />
                    मैंने अधिकृत प्रक्रिया के अनुसार मतदाता की पहचान और पात्रता सत्यापित कर ली है।
                  </label>
                  <button disabled={!verified} onClick={save} className={btnPrimary + " w-full"}><CheckCircle2 className="h-4 w-4" /> मतदान उपस्थिति दर्ज करें</button>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert className="h-3 w-3" /> गलत एंट्री केवल एडमिन सुधार सकते हैं।</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
