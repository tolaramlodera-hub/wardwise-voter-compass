import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Upload, FileSpreadsheet, Plus, Pencil, X, Save, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, WardSelect, inputCls, btnOutline, btnPrimary } from "@/components/AppShell";
import { VoterTable } from "@/components/VoterTable";
import type { Voter } from "@/lib/mock-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type VoterRow = {
  id: string;
  voter_id: string;
  serial_no: number | null;
  full_name: string;
  relative_name: string | null;
  age: number | null;
  gender: "पुरुष" | "महिला" | "अन्य" | null;
  house_number: string | null;
  wards: { ward_number: number } | null;
};

type EditForm = {
  id: string;
  voterId: string;
  serialNo: string;
  name: string;
  relative: string;
  age: string;
  gender: string;
  house: string;
};

export const Route = createFileRoute("/voters")({
  head: () => ({
    meta: [
      { title: "मतदाता सूची — वार्ड वार" },
      { name: "description", content: "वार्ड वार मतदाता सूची देखें और रिकॉर्ड सुधारें।" },
      { property: "og:title", content: "वार्ड वार मतदाता सूची" },
      { property: "og:description", content: "Ward wise voter list with editable records." },
    ],
  }),
  component: Voters,
});

function Voters() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [ward, setWard] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const loadVoters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("voters")
      .select("id,voter_id,serial_no,full_name,relative_name,age,gender,house_number,wards!inner(ward_number)")
      .order("serial_no", { ascending: true, nullsFirst: false });
    if (error) {
      toast.error("मतदाता सूची लोड नहीं हुई: " + error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as VoterRow[];
    setVoters(rows.map((v) => ({
      id: v.id,
      serialNo: v.serial_no ?? undefined,
      name: v.full_name,
      relative: v.relative_name ?? "",
      age: v.age ?? 0,
      gender: v.gender === "महिला" || v.gender === "अन्य" ? v.gender : "पुरुष",
      house: v.house_number ?? "",
      voterId: v.voter_id,
      ward: v.wards?.ward_number ?? 0,
    })));
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("user_id", user.id).maybeSingle();
      if (active) setCanEdit(profile?.role === "admin" && profile.is_active === true);
      if (active) await loadVoters();
    };
    void init().catch((error) => toast.error(error instanceof Error ? error.message : "डेटा लोड नहीं हुआ"));
    return () => { active = false; };
  }, [supabase]);

  const list = voters.filter((v) =>
    (!ward || v.ward === ward) &&
    (!q || v.name.includes(q) || v.voterId.toLowerCase().includes(q.toLowerCase()) || v.house.includes(q) || String(v.serialNo ?? "").includes(q))
  );

  const openEdit = (v: Voter) => setEditing({
    id: v.id, voterId: v.voterId, serialNo: String(v.serialNo ?? ""),
    name: v.name, relative: v.relative, age: String(v.age || ""),
    gender: v.gender, house: v.house,
  });

  const saveEdit = async () => {
    if (!editing) return;
    const serialNo = Number(editing.serialNo);
    const age = editing.age ? Number(editing.age) : null;
    if (!editing.name.trim() || !editing.voterId.trim() || !Number.isInteger(serialNo) || serialNo < 1 ||
        (age !== null && (!Number.isInteger(age) || age < 18 || age > 120))) {
      toast.error("नाम, वोटर ID, सही सीरियल नंबर और उम्र जाँचें");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("voters").update({
      voter_id: editing.voterId.trim(),
      serial_no: serialNo,
      full_name: editing.name.trim(),
      relative_name: editing.relative.trim() || null,
      age,
      gender: editing.gender || null,
      house_number: editing.house.trim() || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("सुधार सेव नहीं हुआ: " + error.message);
      return;
    }
    toast.success("मतदाता का विवरण अपडेट हो गया");
    setEditing(null);
    await loadVoters();
  };

  return (
    <AppShell title="मतदाता सूची">
      <Card className="mb-4 border-dashed p-5">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="rounded-lg bg-secondary p-3"><FileSpreadsheet className="h-6 w-6 text-primary" /></div>
          <div className="flex-1">
            <div className="font-semibold">मतदाता सूची अपलोड करें</div>
            <div className="text-sm text-muted-foreground">Excel (.xlsx, .csv) या PDF — अधिकृत सूची के कॉलम के अनुसार</div>
          </div>
          <label className={btnOutline + " h-11 cursor-pointer"}>
            <Upload className="h-4 w-4" /> फाइल चुनें
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && toast.info("फाइल इम्पोर्ट सुविधा अभी तैयार नहीं है")} />
          </label>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2 border-b p-4">
          <WardSelect value={ward} onChange={setWard} />
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls + " pl-9"} placeholder="क्रमांक, नाम, वोटर ID या मकान नंबर" />
          </div>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground">{loading ? "सूची लोड हो रही है..." : `${list.length} मतदाता`}</div>
        {loading ? <div className="p-8 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div> :
          <VoterTable voters={list} action={canEdit ? (v) => <button type="button" className={btnOutline} onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /> एडिट</button> : undefined} />}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="मतदाता विवरण एडिट करें">
          <div className="my-auto w-full max-w-2xl rounded-xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">मतदाता विवरण एडिट करें</h2>
              <button type="button" className={btnOutline} onClick={() => setEditing(null)} aria-label="बंद करें"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">सीरियल नंबर<input className={inputCls + " mt-1"} value={editing.serialNo} onChange={(e) => setEditing({ ...editing, serialNo: e.target.value })} /></label>
              <label className="text-sm">वोटर ID<input className={inputCls + " mt-1"} value={editing.voterId} onChange={(e) => setEditing({ ...editing, voterId: e.target.value })} /></label>
              <label className="text-sm">मतदाता का नाम<input className={inputCls + " mt-1"} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
              <label className="text-sm">पिता/पति का नाम<input className={inputCls + " mt-1"} value={editing.relative} onChange={(e) => setEditing({ ...editing, relative: e.target.value })} /></label>
              <label className="text-sm">उम्र<input type="number" min="18" max="120" className={inputCls + " mt-1"} value={editing.age} onChange={(e) => setEditing({ ...editing, age: e.target.value })} /></label>
              <label className="text-sm">लिंग<select className={inputCls + " mt-1"} value={editing.gender} onChange={(e) => setEditing({ ...editing, gender: e.target.value })}><option value="पुरुष">पुरुष</option><option value="महिला">महिला</option><option value="अन्य">अन्य</option></select></label>
              <label className="text-sm sm:col-span-2">मकान नंबर<input className={inputCls + " mt-1"} value={editing.house} onChange={(e) => setEditing({ ...editing, house: e.target.value })} /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={btnOutline} onClick={() => setEditing(null)} disabled={saving}>रद्द करें</button>
              <button type="button" className={btnPrimary} onClick={saveEdit} disabled={saving}><Save className="h-4 w-4" /> {saving ? "सेव हो रहा है..." : "बदलाव सेव करें"}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
