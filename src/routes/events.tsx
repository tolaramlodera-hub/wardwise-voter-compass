import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Check, Phone, Plus, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, btnPrimary, btnOutline, inputCls } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type EventRow = { id: string; name: string; purpose: string; event_at: string; place: string; details: string; created_by: string; organizer_id: string | null; status: string };
type Household = { id: string; ward_id: string; house_number: string; household_label: string; voter_ids: string[]; status: string };
type Profile = { user_id: string; full_name: string; role: string };
type Contact = { voter_id: string; phone: string };\ntype Voter = { id: string; voter_id: string | null; full_name: string; relative_name: string | null; house_number: string | null; ward_id: string };
const eventStatusLabels: Record<string, string> = { pending: "अनुमोदन लंबित", approved: "स्वीकृत", rejected: "अस्वीकृत", closed: "बंद" };

export const Route = createFileRoute("/events")({ head: () => ({ meta: [{ title: "इवेंट एवं संपर्क प्रबंधन" }] }), component: Events });

function Events() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("staff");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState("");
  const [households, setHouseholds] = useState<Household[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberEventIds, setMemberEventIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);\n  const [voterDetails, setVoterDetails] = useState<Voter[]>([]);\n  const [allVoters, setAllVoters] = useState<Voter[]>([]);\n  const [contactSearch, setContactSearch] = useState("");\n  const [contactVoterId, setContactVoterId] = useState("");\n  const [contactPhone, setContactPhone] = useState("");\n  const [contactConsent, setContactConsent] = useState(false);\n  const [splitHouse, setSplitHouse] = useState<Household | null>(null);\n  const [splitSelected, setSplitSelected] = useState<string[]>([]);\n  const [splitLabel, setSplitLabel] = useState("");\n  const [callRecords, setCallRecords] = useState<{caller_id:string;outcome:string;created_at:string;household_id:string}[]>([]);
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState<Household | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [teamUser, setTeamUser] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("pending");

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setUserId(auth.user.id);
    const { data: p } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
    setRole(p?.role ?? "staff");
    const { data: memberships } = await supabase.from("event_members").select("event_id").eq("user_id", auth.user.id).eq("is_active", true);
    setMemberEventIds((memberships ?? []).map((m) => m.event_id));
    const { data, error } = await supabase.from("community_events").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("इवेंट सूची लोड नहीं हुई: " + error.message); return; }
    setEvents((data ?? []) as EventRow[]);
    const { data: people } = await supabase.from("profiles").select("user_id,full_name,role").eq("is_active", true).order("full_name");
    setProfiles((people ?? []) as Profile[]);\n    if (p?.role === "admin") {\n      const { data: voters } = await supabase.from("voters").select("id,voter_id,full_name,relative_name,house_number,ward_id").order("full_name").limit(2500);\n      setAllVoters((voters ?? []) as Voter[]);\n    }
  };

  const loadHouseholds = async (eventId: string) => {
    const { data, error } = await supabase.from("event_households").select("*").eq("event_id", eventId).order("house_number");
    if (error) { toast.error("घर सूची लोड नहीं हुई"); return; }
    const rows = (data ?? []) as Household[];
    setHouseholds(rows);
    const ids = [...new Set(rows.flatMap((h) => h.voter_ids))];
    if (!ids.length) { setContacts([]); setVoterDetails([]); setClaims({}); setCallRecords([]); return; }
    const [{ data: phoneRows }, { data: claimRows }, { data: voterRows }, { data: recordRows }] = await Promise.all([
      supabase.from("voter_contacts").select("voter_id,phone").in("voter_id", ids).eq("consent_to_event_contact", true),
      supabase.from("event_call_claims").select("household_id,caller_id,expires_at").in("household_id", rows.map((h) => h.id)).gt("expires_at", new Date().toISOString()),
      supabase.from("voters").select("id,voter_id,full_name,relative_name,house_number,ward_id").in("id", ids),
      supabase.from("event_calling_records").select("caller_id,outcome,created_at,household_id").in("household_id", rows.map((h) => h.id)).order("created_at", { ascending: false }),
    ]);
    setContacts((phoneRows ?? []) as Contact[]);
    setVoterDetails((voterRows ?? []) as Voter[]);
    setCallRecords((recordRows ?? []) as typeof callRecords);
    const next: Record<string, string> = {};
    for (const claim of claimRows ?? []) if (claim.caller_id !== userId) next[claim.household_id] = claim.caller_id;
    setClaims(next);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!selected) return;
    void loadHouseholds(selected);
    const channel = supabase.channel("event-live-" + selected)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_households", filter: "event_id=eq." + selected }, () => { void loadHouseholds(selected); })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_call_claims" }, () => { void loadHouseholds(selected); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selected, userId]);

  const createEvent = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.from("community_events").insert({
      name: String(f.get("name")), purpose: String(f.get("purpose")), event_at: new Date(String(f.get("event_at"))).toISOString(),
      place: String(f.get("place")), details: String(f.get("details") || ""), created_by: userId,
    });
    setBusy(false);
    if (error) toast.error("इवेंट अनुरोध नहीं बना: " + error.message);
    else { toast.success("इवेंट अनुमोदन के लिए भेज दिया गया"); setCreateOpen(false); await load(); }
  };

  const reviewEvent = async (ev: EventRow, status: "approved" | "rejected") => {
    setBusy(true);
    const { error } = await supabase.from("community_events").update({
      status, organizer_id: status === "approved" ? ev.created_by : null, reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).eq("id", ev.id);
    setBusy(false);
    if (error) toast.error("स्थिति अपडेट नहीं हुई: " + error.message);
    else {
      if (status === "approved") {
        const { error: memberError } = await supabase.from("event_members").upsert(
          { event_id: ev.id, user_id: ev.created_by, member_role: "organizer", is_active: true, appointed_by: userId },
          { onConflict: "event_id,user_id" },
        );
        if (memberError) toast.error("इवेंट स्वीकृत है, लेकिन आयोजक टीम में नहीं जुड़ पाया: " + memberError.message);
      }
      toast.success(status === "approved" ? "इवेंट स्वीकृत" : "इवेंट अस्वीकृत");
      await load();
    }
  };

  const generateHouseholds = async (ev: EventRow) => {
    setBusy(true);
    const { data: voters, error } = await supabase.from("voters").select("id,ward_id,house_number").not("house_number", "is", null).order("house_number");
    if (error) { setBusy(false); toast.error("मतदाता सूची नहीं मिली: " + error.message); return; }
    const groups = new Map<string, { ward_id: string; house_number: string; voter_ids: string[] }>();
    for (const v of voters ?? []) {
      const house = String(v.house_number ?? "").trim();
      if (!house) continue;
      const key = v.ward_id + "::" + house;
      const group = groups.get(key) ?? { ward_id: v.ward_id, house_number: house, voter_ids: [] };
      group.voter_ids.push(v.id); groups.set(key, group);
    }
    const rows = [...groups.values()].map((g) => ({ event_id: ev.id, ...g, household_label: "" }));
    const { error: saveError } = rows.length ? await supabase.from("event_households").upsert(rows, { onConflict: "event_id,ward_id,house_number,household_label", ignoreDuplicates: true }) : { error: null };
    setBusy(false);
    if (saveError) toast.error("घर सूची नहीं बनी: " + saveError.message);
    else { toast.success(rows.length + " घरों की सूची तैयार हुई। एक ही मकान में अलग परिवार हों तो सूची की जाँच/विभाजन Admin से करवाएँ।"); setSelected(ev.id); await loadHouseholds(ev.id); }
  };

  const appointMember = async () => {
    if (!selected || !teamUser) return;
    setBusy(true);
    const { error } = await supabase.from("event_members").upsert({ event_id: selected, user_id: teamUser, member_role: "caller", is_active: true, appointed_by: userId }, { onConflict: "event_id,user_id" });
    setBusy(false);
    if (error) toast.error("कॉलर नियुक्त नहीं हुआ: " + error.message);
    else { toast.success("कॉलर को इवेंट टीम में जोड़ दिया गया"); setTeamUser(""); }
  };

  const claimHouse = async (h: Household) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_event_household", { p_household_id: h.id, p_lock_minutes: 10 });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) {
      const name = profiles.find((p) => p.user_id === result?.locked_by)?.full_name ?? "दूसरा सदस्य";
      toast.error(name + " इस घर पर कॉल कर रहे हैं। 10 मिनट का लॉक सक्रिय है।");
      await loadHouseholds(selected); return;
    }
    setClaimed(h);
  };

  const submitCall = async (outcome: "contacted" | "no_answer" | "busy" | "call_later" | "invalid_number") => {
    if (!claimed) return;
    setBusy(true);
    const { error } = await supabase.rpc("submit_event_call", { p_household_id: claimed.id, p_outcome: outcome, p_notes: notes });
    setBusy(false);
    if (error) toast.error("कॉल परिणाम सेव नहीं हुआ: " + error.message);
    else { toast.success(outcome === "contacted" ? "संपर्क पूरा — सभी सदस्यों की सूची से हटाया गया" : "कॉल परिणाम सेव हुआ"); setClaimed(null); setNotes(""); await loadHouseholds(selected); }
  };

  const saveContact = async () => {
    if (!contactVoterId || !contactPhone.trim()) { toast.error("मतदाता और मोबाइल नंबर भरें"); return; }
    setBusy(true);
    const { error } = await supabase.from("voter_contacts").upsert({
      voter_id: contactVoterId, phone: contactPhone.trim(), consent_to_event_contact: contactConsent,
      consent_recorded_at: contactConsent ? new Date().toISOString() : null, updated_by: userId, updated_at: new Date().toISOString(),
    }, { onConflict: "voter_id" });
    setBusy(false);
    if (error) toast.error("मोबाइल नंबर सेव नहीं हुआ: " + error.message);
    else {
      toast.success("मोबाइल नंबर और सहमति सेव हुई");
      setContactVoterId(""); setContactPhone(""); setContactConsent(false);
      if (selected) await loadHouseholds(selected);
    }
  };

  const splitFamily = async () => {
    if (!splitHouse || !splitSelected.length || !splitLabel.trim()) { toast.error("अलग परिवार का नाम और सदस्य चुनें"); return; }
    if (splitSelected.length >= splitHouse.voter_ids.length) { toast.error("कम से कम एक सदस्य पुराने परिवार में छोड़ें"); return; }
    setBusy(true);
    const remaining = splitHouse.voter_ids.filter((id) => !splitSelected.includes(id));
    const { error: insertError } = await supabase.from("event_households").insert({
      event_id: selected, ward_id: splitHouse.ward_id, house_number: splitHouse.house_number,
      household_label: splitLabel.trim(), voter_ids: splitSelected, status: "pending",
    });
    if (!insertError) {
      const { error: updateError } = await supabase.from("event_households").update({ voter_ids: remaining }).eq("id", splitHouse.id);
      if (updateError) toast.error("नया परिवार बना, लेकिन पुराने परिवार की सूची अपडेट नहीं हुई: " + updateError.message);
    }
    setBusy(false);
    if (insertError) toast.error("परिवार अलग नहीं हुआ: " + insertError.message);
    else { toast.success("एक ही मकान के अलग परिवार बना दिए गए"); setSplitHouse(null); setSplitSelected([]); setSplitLabel(""); await loadHouseholds(selected); }
  };

  const correctHousehold = async (h: Household, status: "pending" | "completed" | "retry") => {
    const reason = window.prompt("सुधार का कारण लिखें:");
    if (!reason?.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("correct_event_household_status", { p_household_id: h.id, p_status: status, p_reason: reason.trim() });
    setBusy(false);
    if (error) toast.error("स्थिति सुधार नहीं हुई: " + error.message);
    else { toast.success("स्थिति सुधार दी गई और इतिहास सुरक्षित है"); await loadHouseholds(selected); }
  };

  const closeEvent = async (ev: EventRow) => {
    if (!window.confirm("इवेंट बंद करें? कॉलिंग बंद होगी और पुराना रिकॉर्ड सुरक्षित रहेगा।")) return;
    setBusy(true);
    const { error } = await supabase.from("community_events").update({ status: "closed" }).eq("id", ev.id);
    setBusy(false);
    if (error) toast.error("इवेंट बंद नहीं हुआ: " + error.message);
    else { toast.success("इवेंट बंद कर दिया गया"); await load(); }
  };

  const exportReport = () => {
    const rows = [["घर नंबर","परिवार","स्थिति","मतदाता संख्या","कॉल करने वाला","परिणाम","समय"]];
    for (const h of households) {
      const history = callRecords.filter((r) => r.household_id === h.id);
      if (!history.length) rows.push([h.house_number,h.household_label,h.status,String(h.voter_ids.length),"","",""]);
      else for (const r of history) rows.push([h.house_number,h.household_label,h.status,String(h.voter_ids.length),profiles.find((p) => p.user_id === r.caller_id)?.full_name ?? r.caller_id,r.outcome,new Date(r.created_at).toLocaleString("hi-IN")]);
    }
    const csv = rows.map((row) => row.map((v) => '"' + String(v ?? "").replaceAll('"','""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "event-calling-" + selected + ".csv"; a.click(); URL.revokeObjectURL(url);
  };

  const selectedEvent = events.find((e) => e.id === selected);
  const ownOrAssigned = events.filter((e) => role === "admin" || e.created_by === userId || e.organizer_id === userId);
  const callerEvents = events.filter((e) => e.status === "approved" && (e.organizer_id === userId || e.created_by === userId || memberEventIds.includes(e.id)));
  const visibleEvents = role === "admin" ? events : [...new Map([...ownOrAssigned, ...callerEvents].map((e) => [e.id, e])).values()];

  return <AppShell title="इवेंट एवं संपर्क प्रबंधन">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">इवेंट अनुमोदन, टीम नियुक्ति और साझा लाइव कॉलिंग सूची</p>
      <button className={btnPrimary} onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> नया इवेंट अनुरोध</button>
    </div>
    {role === "admin" && <Card className="mb-4 p-4"><h2 className="mb-3 font-bold">मतदाता मोबाइल नंबर और संपर्क सहमति</h2><div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"><input className={inputCls} value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="मतदाता नाम / पहचान संख्या खोजें"/><select className={inputCls} value={contactVoterId} onChange={(e) => { setContactVoterId(e.target.value); const found = contacts.find((x) => x.voter_id === e.target.value); setContactPhone(found?.phone ?? ""); setContactConsent(Boolean(found)); }}><option value="">मतदाता चुनें</option>{allVoters.filter((v) => !contactSearch || (v.full_name + " " + (v.voter_id ?? "")).toLowerCase().includes(contactSearch.toLowerCase())).slice(0,100).map((v) => <option key={v.id} value={v.id}>{v.full_name} · {v.voter_id ?? "ID नहीं"} · मकान {v.house_number ?? "-"}</option>)}</select><input className={inputCls} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="मोबाइल नंबर" type="tel"/><button className={btnPrimary} disabled={busy || !contactVoterId} onClick={() => void saveContact()}>सेव करें</button></div><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={contactConsent} onChange={(e) => setContactConsent(e.target.checked)} className="mt-1"/>मतदाता ने इवेंट के संबंध में संपर्क करने की स्पष्ट सहमति दी है। बिना सहमति नंबर कॉलर को नहीं दिखेगा।</label></Card>}\n    <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.5fr)]">
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5" /> इवेंट सूची</h2>
        <div className="space-y-2">
          {visibleEvents.length === 0 && <p className="text-sm text-muted-foreground">अभी कोई इवेंट नहीं है।</p>}
          {visibleEvents.map((ev) => <button key={ev.id} onClick={() => setSelected(ev.id)} className={"w-full rounded-lg border p-3 text-left " + (selected === ev.id ? "border-primary bg-primary/5" : "hover:bg-muted")}>
            <div className="font-semibold">{ev.name}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(ev.event_at).toLocaleString("hi-IN")} · {ev.place}</div>
            <span className="mt-2 inline-block rounded-full bg-muted px-2 py-1 text-xs">{eventStatusLabels[ev.status] ?? ev.status}</span>
          </button>)}
        </div>
      </Card>
      <div className="space-y-4">
        {selectedEvent ? <>
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{selectedEvent.name}</h2><p className="text-sm text-muted-foreground">{selectedEvent.purpose} · {selectedEvent.place}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(selectedEvent.event_at).toLocaleString("hi-IN")}</p></div>
              {role === "admin" && selectedEvent.status === "pending" && <div className="flex gap-2"><button disabled={busy} className={btnPrimary} onClick={() => void reviewEvent(selectedEvent,"approved")}><Check className="h-4 w-4"/>स्वीकृत</button><button disabled={busy} className={btnOutline} onClick={() => void reviewEvent(selectedEvent,"rejected")}>अस्वीकृत</button></div>}
            </div>
            {selectedEvent.status === "approved" && (role === "admin" || selectedEvent.organizer_id === userId) && <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
              {role === "admin" && <button disabled={busy} className={btnOutline} onClick={() => void generateHouseholds(selectedEvent)}><RefreshCw className="h-4 w-4"/>मतदाता सूची से घर तैयार करें</button>}
              <select className={inputCls + " max-w-xs"} value={teamUser} onChange={(e) => setTeamUser(e.target.value)}><option value="">कॉलर चुनें</option>{profiles.filter((p) => p.user_id !== userId).map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name} ({p.role})</option>)}</select>
              <button disabled={busy || !teamUser} className={btnPrimary} onClick={() => void appointMember()}><Users className="h-4 w-4"/>टीम में जोड़ें</button>
            </div>}
          </Card>
          {selectedEvent.status === "approved" && <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">साझा कॉलिंग सूची</h3><div className="flex gap-2"><button className={btnOutline} onClick={exportReport}>Excel के लिए CSV रिपोर्ट</button><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="pending">बाकी घर</option><option value="retry">दोबारा कॉल</option><option value="completed">पूरे</option><option value="needs_correction">नंबर सुधार</option></select><button className={btnOutline} onClick={() => void loadHouseholds(selected)}><RefreshCw className="h-4 w-4"/>रीफ्रेश</button></div></div>
            {claimed ? <div className="rounded-xl border border-primary p-4">
              <div className="mb-2 font-bold">घर नं. {claimed.house_number} {claimed.household_label && "· " + claimed.household_label} — कॉल जारी</div>
              <div className="mb-3 space-y-2">{claimed.voter_ids.map((id) => {
                const c = contacts.find((x) => x.voter_id === id);
                return <div key={id} className="flex items-center justify-between gap-2 text-sm"><span>{voterDetails.find((v) => v.id === id)?.full_name ?? "मतदाता"} · {voterDetails.find((v) => v.id === id)?.voter_id ?? ""}</span>{c ? <a className="inline-flex items-center gap-1 font-semibold text-primary" href={"tel:" + c.phone}><Phone className="h-4 w-4"/>{c.phone}</a> : <span className="text-xs text-muted-foreground">सहमति वाला नंबर उपलब्ध नहीं</span>}</div>;
              })}</div>
              <textarea className={inputCls + " min-h-20 py-2"} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="कॉल नोट (वैकल्पिक)" />
              <div className="mt-3 flex flex-wrap gap-2">{([["contacted","बात हो गई"],["no_answer","फोन नहीं उठा"],["busy","व्यस्त"],["call_later","बाद में कॉल"],["invalid_number","गलत नंबर"]] as const).map(([v,l]) => <button key={v} disabled={busy} className={v==="contacted" ? btnPrimary : btnOutline} onClick={() => void submitCall(v)}>{l}</button>)}</div>
            </div> : <div className="max-h-[560px] space-y-2 overflow-y-auto">
              {households.filter((h) => h.status === filter).map((h) => <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div><div className="font-semibold">घर नं. {h.house_number} {h.household_label && "· " + h.household_label}</div><div className="text-xs text-muted-foreground">{h.voter_ids.map((id) => voterDetails.find((v) => v.id === id)?.full_name ?? "मतदाता").join(", ")} · {h.voter_ids.length} सदस्य</div><div className="text-xs text-muted-foreground">{h.status === "retry" ? "दोबारा कॉल" : h.status === "completed" ? "संपर्क पूरा" : h.status === "needs_correction" ? "नंबर सुधार" : "लंबित"}</div></div>
                {h.status === "pending" || h.status === "retry" ? claims[h.id] ? <span className="text-xs text-warning">दूसरा सदस्य कॉल कर रहा है</span> : <button disabled={busy} className={btnPrimary} onClick={() => void claimHouse(h)}><Phone className="h-4 w-4"/>चुनें और कॉल करें</button> : null}{role === "admin" && <div className="flex flex-wrap gap-1"><button className={btnOutline} onClick={() => { setSplitHouse(h); setSplitSelected([]); }}>परिवार अलग करें</button><button className={btnOutline} onClick={() => void correctHousehold(h,"pending")}>पेंडिंग करें</button><button className={btnOutline} onClick={() => void correctHousehold(h,"completed")}>पूर्ण करें</button></div>}
              </div>)}
              {households.filter((h) => h.status === filter).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">इस श्रेणी में घर नहीं हैं।</p>}
            </div>}
          </Card>}
        </> : <Card className="p-8 text-center text-sm text-muted-foreground"><CalendarDays className="mx-auto mb-2 h-8 w-8"/>बाईं ओर से इवेंट चुनें।</Card>}
      </div>
    </div>
    {createOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3"><form onSubmit={createEvent} className="w-full max-w-lg space-y-3 rounded-xl bg-card p-5">
      <h2 className="text-lg font-bold">नया इवेंट अनुरोध</h2><input name="name" required className={inputCls} placeholder="इवेंट का नाम"/>
      <input name="purpose" required className={inputCls} placeholder="उद्देश्य"/>
      <label className="block text-sm">तारीख और समय<input name="event_at" type="datetime-local" required className={inputCls + " mt-1"}/></label>
      <input name="place" required className={inputCls} placeholder="स्थान"/>
      <textarea name="details" className={inputCls + " min-h-24 py-2"} placeholder="अतिरिक्त विवरण"/>
      <div className="flex justify-end gap-2"><button type="button" className={btnOutline} onClick={() => setCreateOpen(false)}>रद्द</button><button disabled={busy} className={btnPrimary}>{busy ? "भेज रहे हैं..." : "अनुमोदन हेतु भेजें"}</button></div>
    </form></div>}
  </AppShell>;
}
