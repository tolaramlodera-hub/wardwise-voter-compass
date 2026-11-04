import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, CheckCircle2, ShieldAlert, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, WardSelect, inputCls, btnPrimary } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type VoterRow = { id: string; full_name: string; relative_name: string | null; age: number | null; gender: string | null; house_number: string | null; voter_id: string | null; wards: { ward_number: number } | null; attendance: { recorded_at: string; recorded_by: string }[] };

export const Route = createFileRoute("/entry")({
  head: () => ({ meta: [{ title: "वोटिंग एंट्री — मतदान उपस्थिति दर्ज करें" }, { name: "description", content: "वार्ड चुनें, मतदाता खोजें और मतदान उपस्थिति दर्ज करें।" }] }),
  component: Entry,
});

function Entry() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<VoterRow[]>([]);
  const [ward, setWard] = useState(1);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("voters")
        .select("id,full_name,relative_name,age,gender,house_number,voter_id,wards!inner(ward_number),attendance(recorded_at,recorded_by)")
        .eq("wards.ward_number", ward).order("serial_no", { ascending: true });
      if (error) throw error;
      const normalized = (data ?? []).map((item: any) => ({
        ...item,
        wards: Array.isArray(item.wards) ? item.wards[0] ?? null : item.wards ?? null,
        attendance: Array.isArray(item.attendance) ? item.attendance : item.attendance ? [item.attendance] : [],
      })) as VoterRow[];
      setRows(normalized);
    } catch (error) {
      console.error("Voting entry list load failed:", error);
      toast.error("मतदाता सूची लोड नहीं हुई। कृपया दोबारा प्रयास करें।");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, ward]);

  useEffect(() => { void load(); }, [load]);

  const list = rows.filter(v => !q || (v.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || (v.voter_id ?? "").toLowerCase().includes(q.toLowerCase()) || (v.house_number ?? "").toLowerCase().includes(q.toLowerCase()));
  const voted = rows.filter(v => (v.attendance ?? []).length > 0).length;
  const current = selected ? rows.find(v => v.id === selected) ?? null : null;

  const save = async () => {
    if (!current || !verified || current.attendance.length || saving) return;
    setSaving(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { toast.error("लॉगिन सत्र समाप्त है"); return; }
      const { error } = await supabase.from("attendance").insert({ voter_id: current.id, recorded_by: user.id });
      if (error) throw error;
      toast.success(current.full_name + " — उपस्थिति दर्ज");
      setVerified(false);
      await load();
    } catch (error: any) {
      console.error("Voting attendance save failed:", error);
      toast.error(error?.code === "23505" ? "इस मतदाता की एंट्री पहले हो चुकी है" : "एंट्री सेव नहीं हुई। कृपया दोबारा प्रयास करें।");
    } finally {
      setSaving(false);
    }
  };

  return <AppShell title="वोटिंग एंट्री">
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card>
        <div className="space-y-3 border-b p-4">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">वार्ड चुनें</span><WardSelect value={ward} onChange={n => { setWard(n); setSelected(null); setVerified(false); }} allLabel={null} /><span className="ml-auto text-xs text-muted-foreground">वोटेड <b className="text-success">{voted}</b> · बाकी <b className="text-warning-foreground">{rows.length-voted}</b></span></div>
          <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} className={inputCls + " pl-9"} placeholder="नाम, वोटर ID या मकान नंबर से खोजें" /></div>
        </div>
        {loading ? <div className="p-8 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div> : <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {list.map(v => <li key={v.id}><button onClick={() => { setSelected(v.id); setVerified(false); }} className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted ${current?.id===v.id ? "bg-secondary" : ""}`}><div><div className="font-medium">{v.full_name}</div><div className="text-xs text-muted-foreground">मकान {v.house_number ?? "—"} · <span className="font-mono">{v.voter_id ?? "—"}</span></div></div>{v.attendance.length ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Voted</span> : <span className="rounded-full bg-warning/25 px-2 py-0.5 text-xs">Pending</span>}</button></li>)}
          {!list.length && <li className="p-6 text-center text-sm text-muted-foreground">इस वार्ड में कोई मतदाता नहीं मिला</li>}
        </ul>}
      </Card>
      <Card className="h-fit p-5 lg:sticky lg:top-24">
        {!current ? <div className="py-10 text-center text-sm text-muted-foreground">विवरण देखने के लिए सूची से मतदाता चुनें</div> : <div>
          <h2 className="text-xl font-bold">{current.full_name}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">{[["पिता/पति",current.relative_name ?? "—"],["उम्र",current.age ?? "—"],["लिंग",current.gender ?? "—"],["मकान नं.",current.house_number ?? "—"],["वोटर ID",current.voter_id ?? "—"],["वार्ड",current.wards?.ward_number ?? ward]].map(([k,v]) => <div key={String(k)}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
          {current.attendance.length ? <div className="mt-5 rounded-lg bg-success/15 p-3 text-sm text-success"><CheckCircle2 className="mr-1 inline h-4 w-4" /> एंट्री हो चुकी है। दोबारा एंट्री संभव नहीं।</div> : <div className="mt-5 space-y-3">
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="mt-1" /> अधिकृत प्रक्रिया के अनुसार मतदाता की पहचान और पात्रता सत्यापित है।</label>
            <button disabled={!verified || saving} onClick={save} className={btnPrimary + " w-full"}><CheckCircle2 className="h-4 w-4" /> {saving ? "सेव हो रहा है..." : "मतदान उपस्थिति दर्ज करें"}</button>
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert className="h-3 w-3" /> गलत एंट्री केवल एडमिन सुधार सकते हैं।</p>
          </div>}
        </div>}
      </Card>
    </div>
  </AppShell>;
}
