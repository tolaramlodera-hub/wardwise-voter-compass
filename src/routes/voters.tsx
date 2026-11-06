import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Pencil, X, Save, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, inputCls, btnOutline, btnPrimary } from "@/components/AppShell";
import { VoterCsvImport } from "@/components/VoterCsvImport";
import type { Voter } from "@/lib/mock-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type WardOption = { id: string; ward_number: number; name: string; is_active: boolean };

type VoterRow = {
  id: string;
  ward_id: string;
  family_group: string | null;
  family_label: string | null;
  voter_id: string | null;
  serial_no: number | null;
  full_name: string;
  relative_name: string | null;
  age: number | null;
  gender: "पुरुष" | "महिला" | "अन्य" | null;
  house_number: string | null;
  wards: { ward_number: number } | null;
};

type HouseholdGroup = { key: string; ward: number; house: string; familyLabel: string; members: Voter[] };

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
  const [wards, setWards] = useState<WardOption[]>([]);
  const [wardsLoading, setWardsLoading] = useState(true);
  const [groups, setGroups] = useState<HouseholdGroup[]>([]);
  const [familyOpen, setFamilyOpen] = useState<HouseholdGroup | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [newFamilyLabel, setNewFamilyLabel] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [ward, setWard] = useState(0);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const pageSize = 100;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isVoter, setIsVoter] = useState(false);
  const [myMobile, setMyMobile] = useState("");
  const [myContactConsent, setMyContactConsent] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const loadVoters = useCallback(async () => {
    setLoading(true);
    const allRows: VoterRow[] = [];
    let from = 0;
    const chunkSize = 1000;
    while (true) {
      let query = supabase.from("voters")
        .select("id,ward_id,voter_id,serial_no,full_name,relative_name,age,gender,house_number,family_group,family_label,wards!inner(ward_number)")
        .order("serial_no", { ascending: true, nullsFirst: false })
        .range(from, from + chunkSize - 1);
      if (ward) query = query.eq("wards.ward_number", ward);
      const { data, error } = await query;
      if (error) {
        toast.error("मतदाता सूची लोड नहीं हुई: " + error.message);
        setLoading(false);
        return;
      }
      const chunk = (data ?? []) as unknown as VoterRow[];
      allRows.push(...chunk);
      if (chunk.length < chunkSize) break;
      from += chunkSize;
    }
    const mapped = allRows.map((v) => ({
      id: v.id, serialNo: v.serial_no ?? undefined, name: v.full_name,
      relative: v.relative_name ?? "", age: v.age ?? 0,
      gender: v.gender === "महिला" || v.gender === "अन्य" ? v.gender : "पुरुष" as const,
      house: v.house_number ?? "", voterId: v.voter_id ?? "", ward: v.wards?.ward_number ?? 0,
    }));
    const buckets = new Map<string, HouseholdGroup>();
    allRows.forEach((row, index) => {
      const house = (row.house_number ?? "").trim();
      const key = house ? row.ward_id + "|" + house + "|" + (row.family_group ?? "main") : "individual|" + row.id;
      const person = mapped[index];
      const existing = buckets.get(key);
      if (existing) existing.members.push(person);
      else buckets.set(key, { key, ward: row.wards?.ward_number ?? 0, house, familyLabel: row.family_label || "मुख्य परिवार", members: [person] });
    });
    let householdList = Array.from(buckets.values()).map((g) => ({
      ...g, members: [...g.members].sort((a, b) => (a.serialNo ?? 999999) - (b.serialNo ?? 999999)),
    }));
    const term = search.trim().toLocaleLowerCase("hi-IN");
    if (term) householdList = householdList.filter((g) =>
      g.house.toLocaleLowerCase("hi-IN").includes(term) ||
      g.familyLabel.toLocaleLowerCase("hi-IN").includes(term) ||
      g.members.some((m) => [m.name, m.relative, m.voterId, String(m.serialNo ?? "")].some((x) => x.toLocaleLowerCase("hi-IN").includes(term)))
    );
    householdList.sort((a, b) => a.ward - b.ward || (a.members[0]?.serialNo ?? 999999) - (b.members[0]?.serialNo ?? 999999));
    setGroups(householdList);
    setTotalRows(householdList.length);
    setVoters(householdList.slice(page * pageSize, (page + 1) * pageSize).map((g) => g.members[0]));
    setLoading(false);
  }, [supabase, ward, search, page]);

  useEffect(() => {
    let active = true;
    const requestedWard = Number(new URLSearchParams(window.location.search).get("ward"));
    const init = async () => {
      setWards(Array.from({ length: 7 }, (_, i) => ({ id: "fallback-" + (i + 1), ward_number: i + 1, name: "वार्ड " + (i + 1), is_active: true })));
      const { data: wardRows, error: wardError } = await supabase.from("wards").select("id,ward_number,name,is_active").eq("is_active", true).order("ward_number");
      if (wardError) toast.error("वार्ड सूची लोड नहीं हुई: " + wardError.message);
      if (active) {
        const availableWards = (wardRows ?? []) as WardOption[];
        setWards(availableWards.length ? availableWards : Array.from({ length: 7 }, (_, i) => ({ id: "fallback-" + (i + 1), ward_number: i + 1, name: "वार्ड " + (i + 1), is_active: true })));
        if (Number.isInteger(requestedWard) && availableWards.some((w) => w.ward_number === requestedWard)) setWard(requestedWard);
      }
      setWardsLoading(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("user_id", user.id).maybeSingle();
      if (active) {
        setCanEdit(profile?.role === "admin" && profile.is_active === true);
        setIsVoter(profile?.role === "voter" && profile.is_active === true);
      }
      if (profile?.role === "voter" && profile.is_active === true) {
        const { data: contact, error: contactError } = await supabase.rpc("get_my_voter_contact");
        if (contactError) toast.error("मोबाइल विवरण लोड नहीं हुआ: " + contactError.message);
        const row = Array.isArray(contact) ? contact[0] : contact;
        if (active && row) {
          setMyMobile(row.phone ?? "");
          setMyContactConsent(Boolean(row.consent_to_event_contact));
        }
      }
    };
    void init().catch((error) => toast.error(error instanceof Error ? error.message : "यूजर जाँच नहीं हुई"));
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(q); setPage(0); }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => { void loadVoters(); }, [loadVoters]);

  const list = voters;

  const saveMyContact = async (consent = myContactConsent) => {
    const phone = myMobile.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(phone)) { toast.error("सही 10 अंकों का मोबाइल नंबर भरें"); return; }
    setContactSaving(true);
    const { error } = await supabase.rpc("update_my_voter_contact", { p_phone: phone, p_consent_to_event_contact: consent });
    setContactSaving(false);
    if (error) toast.error("मोबाइल नंबर/सहमति सेव नहीं हुई: " + error.message);
    else {
      setMyContactConsent(consent);
      toast.success(consent ? "संपर्क सहमति सेव हो गई" : "संपर्क सहमति वापस ले ली गई। अब कॉलर को नंबर नहीं दिखेगा।");
    }
  };

  const openFamily = (group: HouseholdGroup) => {
    setFamilyOpen(group);
    setSelectedMembers([]);
    setNewFamilyLabel("");
  };

  const splitFamily = async () => {
    if (!familyOpen || selectedMembers.length < 1 || !newFamilyLabel.trim()) {
      toast.error("सदस्य चुनें और नए परिवार का नाम लिखें");
      return;
    }
    if (selectedMembers.length >= familyOpen.members.length) {
      toast.error("मूल परिवार में कम-से-कम एक सदस्य रहना चाहिए");
      return;
    }
    setSplitting(true);
    const { error } = await supabase.rpc("split_voter_household", {
      p_voter_ids: selectedMembers,
      p_family_label: newFamilyLabel.trim(),
    });
    setSplitting(false);
    if (error) {
      toast.error("अलग परिवार नहीं बन पाया: " + error.message);
      return;
    }
    toast.success("चुने हुए सदस्यों का अलग परिवार बन गया");
    setFamilyOpen(null);
    setSelectedMembers([]);
    await loadVoters();
  };

  const openEdit = (v: Voter) => setEditing({
    id: v.id, voterId: v.voterId, serialNo: String(v.serialNo ?? ""),
    name: v.name, relative: v.relative, age: String(v.age || ""),
    gender: v.gender, house: v.house,
  });

  const saveEdit = async () => {
    if (!editing) return;
    const serialNo = Number(editing.serialNo);
    const age = editing.age ? Number(editing.age) : null;
    if (!editing.name.trim() || !Number.isInteger(serialNo) || serialNo < 1 ||
        (age !== null && (!Number.isInteger(age) || age < 18 || age > 120))) {
      toast.error("नाम, सही सीरियल नंबर और उम्र जाँचें");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("voters").update({
      voter_id: editing.voterId.trim() || null,
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
      {isVoter && <Card className="mb-4 p-4"><h2 className="mb-3 text-lg font-bold">मेरा मोबाइल नंबर और संपर्क सहमति</h2><p className="mb-3 text-sm text-muted-foreground">अपना मोबाइल नंबर और इवेंट/कार्यक्रम के संबंध में संपर्क की सहमति स्वयं अपडेट करें। सहमति हटाने पर आपका नंबर कॉलर को नहीं दिखेगा।</p><label className="mb-3 block text-sm font-medium">मोबाइल नंबर<input className={inputCls + " mt-1"} type="tel" inputMode="numeric" maxLength={10} value={myMobile} onChange={(e) => setMyMobile(e.target.value.replace(/\D/g, "").slice(0,10))} placeholder="10 अंकों का मोबाइल नंबर"/></label><label className="mb-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={myContactConsent} onChange={(e) => setMyContactConsent(e.target.checked)}/><span>मैं इवेंट/कार्यक्रम के संबंध में इस मोबाइल नंबर पर संपर्क करने की स्पष्ट सहमति देता/देती हूँ। सहमति न देने या वापस लेने पर कॉलर को नंबर नहीं दिखेगा।</span></label><div className="flex flex-wrap gap-2"><button type="button" className={btnPrimary} disabled={contactSaving || !/^[6-9]\d{9}$/.test(myMobile.replace(/\D/g, ""))} onClick={() => void saveMyContact(true)}>{contactSaving ? "सेव हो रहा है..." : "सहमति दें और सेव करें"}</button><button type="button" className={btnOutline} disabled={contactSaving || !/^[6-9]\d{9}$/.test(myMobile.replace(/\D/g, "")) || !myContactConsent} onClick={() => void saveMyContact(false)}>सहमति वापस लें</button></div></Card>}
      {canEdit && (ward > 0 ? <VoterCsvImport wardNumber={ward} onComplete={() => { setPage(0); void loadVoters(); }} /> : <Card className="mb-4 border-dashed p-5"><p className="text-sm text-muted-foreground">CSV अपलोड करने के लिए पहले ऊपर से एक वार्ड चुनें।</p></Card>)}

      <Card>
        <div className="border-b p-4">
          <div className="mb-3 flex flex-wrap gap-2" aria-label="वार्ड चुनें">
            <button type="button" onClick={() => { setWard(0); setPage(0); }} className={"rounded-lg border px-4 py-2 text-sm font-semibold " + (ward === 0 ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>सभी वार्ड</button>
            {wards.map((w) => <button key={w.id} type="button" onClick={() => { setWard(w.ward_number); setPage(0); }} className={"rounded-lg border px-4 py-2 text-sm font-semibold " + (ward === w.ward_number ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{"वार्ड " + w.ward_number + (w.name ? " · " + w.name : "")}</button>)}
          </div>
          {wardsLoading && <p className="mb-2 text-xs text-muted-foreground">वार्ड लोड हो रहे हैं...</p>}
          <div className="relative min-w-48">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className={inputCls + " pl-9"} placeholder="नाम, पिता/पति का नाम, वोटर ID या मकान नंबर खोजें" />
          </div>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground">{loading ? "सूची लोड हो रही है..." : `कुल ${totalRows} मकान/परिवार · ${Math.min(totalRows, page * pageSize + 1)}–${Math.min(totalRows, (page + 1) * pageSize)} दिख रहे हैं`}</div>
        {loading ? <div className="p-8 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div> : !list.length ? <div className="p-8 text-center text-sm text-muted-foreground">कोई मकान/परिवार नहीं मिला</div> :
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground"><tr>{["क्रमांक","मकान नंबर","मुख्य मतदाता","परिवार","कुल सदस्य","वार्ड","विवरण"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>{groups.slice(page * pageSize, (page + 1) * pageSize).map((g) => {
                const head = g.members[0];
                return <tr key={g.key} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-3">{head.serialNo ?? "—"}</td>
                  <td className="px-3 py-3 font-semibold">{g.house || "—"}</td>
                  <td className="px-3 py-3"><div className="font-semibold">{head.name}</div><div className="text-xs text-muted-foreground">{head.relative}</div></td>
                  <td className="px-3 py-3">{g.familyLabel}</td>
                  <td className="px-3 py-3">{g.members.length}</td>
                  <td className="px-3 py-3">{g.ward}</td>
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" className={btnOutline} onClick={() => openFamily(g)}>परिवार देखें</button>{canEdit && <button type="button" className={btnOutline} onClick={() => openEdit(head)}><Pencil className="h-4 w-4" /> एडिट</button>}</div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
        <div className="flex items-center justify-between border-t p-3">
          <button type="button" className={btnOutline} disabled={loading || page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← पिछला</button>
          <span className="text-sm text-muted-foreground">पेज {page + 1} / {Math.max(1, Math.ceil(totalRows / pageSize))}</span>
          <button type="button" className={btnOutline} disabled={loading || (page + 1) * pageSize >= totalRows} onClick={() => setPage((p) => p + 1)}>अगला →</button>
        </div>
      </Card>

      {familyOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="परिवार के सदस्य">
          <div className="my-auto w-full max-w-3xl rounded-xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">मकान {familyOpen.house} — परिवार के सदस्य</h2><p className="text-sm text-muted-foreground">वार्ड {familyOpen.ward} · {familyOpen.familyLabel} · {familyOpen.members.length} सदस्य</p></div>
              <button type="button" className={btnOutline} onClick={() => setFamilyOpen(null)}>बंद करें</button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {familyOpen.members.map((m) => <div key={m.id} className="flex items-center justify-between gap-3 border-b p-3 last:border-0">
                <div className="flex min-w-0 items-center gap-3">
                  {canEdit && <input aria-label={m.name + " चुनें"} type="checkbox" checked={selectedMembers.includes(m.id)} onChange={(e) => setSelectedMembers((old) => e.target.checked ? [...old, m.id] : old.filter((id) => id !== m.id))} />}
                  <div className="min-w-0"><div className="font-semibold">{m.serialNo ?? "—"}. {m.name}</div><div className="text-xs text-muted-foreground">पिता/पति: {m.relative || "—"} · उम्र: {m.age || "—"} · वोटर ID: {m.voterId || "—"}</div></div>
                </div>
                {canEdit && <button type="button" className={btnOutline} onClick={() => openEdit(m)}>एडिट</button>}
              </div>)}
            </div>
            {canEdit && <div className="mt-4 rounded-lg border border-dashed p-3">
              <p className="mb-2 text-sm font-semibold">चुने हुए सदस्यों का अलग परिवार बनाएँ</p>
              <p className="mb-2 text-xs text-muted-foreground">मकान नंबर वही रहेगा; केवल परिवार अलग होगा। मूल परिवार में कम-से-कम एक सदस्य बचना जरूरी है।</p>
              <input className={inputCls} value={newFamilyLabel} onChange={(e) => setNewFamilyLabel(e.target.value)} placeholder="नए परिवार का नाम, जैसे रामलाल परिवार" />
              <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{selectedMembers.length} सदस्य चुने</span><button type="button" className={btnPrimary} disabled={splitting || !selectedMembers.length || !newFamilyLabel.trim()} onClick={() => void splitFamily()}>{splitting ? "बन रहा है..." : "अलग परिवार बनाएँ"}</button></div>
            </div>}
          </div>
        </div>
      )}

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
