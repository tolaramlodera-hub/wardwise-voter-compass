import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Check, Phone, Plus, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, btnPrimary, btnOutline, inputCls } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type EventRow = { id: string; name: string; purpose: string; event_at: string; place: string; details: string; created_by: string; organizer_id: string | null; status: string };
type Household = { id: string; ward_id: string; house_number: string; household_label: string; voter_ids: string[]; status: string };
type Profile = { user_id: string; full_name: string; role: string };
type Contact = { voter_id: string; phone: string };
type Voter = { id: string; voter_id: string | null; full_name: string; relative_name: string | null; house_number: string | null; ward_id: string };
type WardOption = { id: string; ward_number: number; name: string; is_active: boolean };
type PendingVoterAccount = { user_id: string; full_name: string; voter_account_links: { voters: { id: string; full_name: string; voter_id: string | null; house_number: string | null } | null }[] };
type PendingContactSubmission = { user_id: string; phone: string; consent_to_event_contact: boolean; submitted_at: string };
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [voterDetails, setVoterDetails] = useState<Voter[]>([]);
  const [allVoters, setAllVoters] = useState<Voter[]>([]);
  const [accountWards, setAccountWards] = useState<WardOption[]>([]);
  const [callingWardId, setCallingWardId] = useState("all");
  const [callingWardSelection, setCallingWardSelection] = useState<string[]>([]);
  const [pendingLinkWard, setPendingLinkWard] = useState<Record<string, string>>({});
  const [pendingVoterAccounts, setPendingVoterAccounts] = useState<PendingVoterAccount[]>([]);
  const [pendingContactSubmissions, setPendingContactSubmissions] = useState<PendingContactSubmission[]>([]);
  const [pendingLinkSearch, setPendingLinkSearch] = useState<Record<string, string>>({});
  const [pendingLinkSelection, setPendingLinkSelection] = useState<Record<string, string>>({});
  const [splitHouse, setSplitHouse] = useState<Household | null>(null);
  const [splitSelected, setSplitSelected] = useState<string[]>([]);
  const [splitLabel, setSplitLabel] = useState("");
  const [callRecords, setCallRecords] = useState<{caller_id:string;outcome:string;created_at:string;household_id:string}[]>([]);
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
    const { data: people, error: peopleError } = await supabase.rpc("list_event_callers");
    if (peopleError) toast.error("कॉलर सूची लोड नहीं हुई: " + peopleError.message);
    setProfiles((people ?? []) as Profile[]);
    const { data: visibleWardRows, error: wardLoadError } = await supabase.from("wards").select("id,ward_number,name,is_active").eq("is_active", true).order("ward_number");
    if (wardLoadError) toast.error("वार्ड सूची लोड नहीं हुई: " + wardLoadError.message);
    setAccountWards((visibleWardRows ?? []) as WardOption[]);
    if (p?.role === "admin") {
      const [{ data: voters }, { data: pendingAccounts }, { data: pendingContacts }] = await Promise.all([
        supabase.from("voters").select("id,voter_id,full_name,relative_name,house_number,ward_id").order("full_name").limit(2500),
        supabase.from("profiles").select("user_id,full_name,voter_account_links(voters(id,full_name,voter_id,house_number))").eq("role", "voter").eq("is_active", false),
        supabase.from("pending_voter_contact_submissions").select("user_id,phone,consent_to_event_contact,submitted_at"),
      ]);
      setAllVoters((voters ?? []) as Voter[]);
      setPendingVoterAccounts((pendingAccounts ?? []) as unknown as PendingVoterAccount[]);
      setPendingContactSubmissions((pendingContacts ?? []) as PendingContactSubmission[]);
    }
  };

  const loadHouseholds = async (eventId: string) => {
    const { data, error } = await supabase.from("event_households").select("*").eq("event_id", eventId).order("house_number");
    if (error) { toast.error("घर सूची लोड नहीं हुई"); return; }
    const rows = (data ?? []) as Household[];
    setHouseholds(rows);
    const ids = [...new Set(rows.flatMap((h) => h.voter_ids))];
    if (!ids.length) { setContacts([]); setVoterDetails([]); setClaims({}); setCallRecords([]); return; }
    const [{ data: phoneRows, error: phoneError }, { data: claimRows, error: claimError }, { data: voterRows, error: voterError }, { data: recordRows, error: recordError }] = await Promise.all([
      supabase.rpc("get_event_consented_contacts", { p_event_id: eventId }),
      supabase.from("event_call_claims").select("household_id,caller_id,expires_at").in("household_id", rows.map((h) => h.id)).gt("expires_at", new Date().toISOString()),
      supabase.rpc("get_event_voter_details", { p_event_id: eventId }),
      supabase.from("event_calling_records").select("caller_id,outcome,created_at,household_id").in("household_id", rows.map((h) => h.id)).order("created_at", { ascending: false }),
    ]);
    if (voterError) toast.error("मतदाता विवरण लोड नहीं हुआ: " + voterError.message);
    if (phoneError) toast.error("सहमति वाले मोबाइल नंबर लोड नहीं हुए: " + phoneError.message);
    if (claimError) toast.error("कॉल स्थिति लोड नहीं हुई: " + claimError.message);
    if (recordError) toast.error("कॉल इतिहास लोड नहीं हुआ: " + recordError.message);
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
    const poll = window.setInterval(() => { void loadHouseholds(selected); }, 10000);
    const channel = supabase.channel("event-live-" + selected)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_households", filter: "event_id=eq." + selected }, () => { void loadHouseholds(selected); })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_call_claims" }, () => { void loadHouseholds(selected); })
      .subscribe();
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [selected, userId]);

  const createEvent = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data: createdEvent, error } = await supabase.from("community_events").insert({
      name: String(f.get("name")), purpose: String(f.get("purpose")), event_at: new Date(String(f.get("event_at"))).toISOString(),
      place: String(f.get("place")), details: String(f.get("details") || ""), created_by: userId,
      organizer_id: userId, status: "approved",
    }).select("id").single();
    if (error || !createdEvent) {
      setBusy(false);
      toast.error("इवेंट नहीं बना: " + (error?.message ?? "इवेंट आईडी नहीं मिली"));
      return;
    }
    const { error: memberError } = await supabase.from("event_members").upsert(
      { event_id: createdEvent.id, user_id: userId, member_role: "organizer", is_active: true, appointed_by: userId },
      { onConflict: "event_id,user_id" },
    );
    const { data: preparedCount, error: prepareError } = await supabase.rpc("prepare_event_households", { p_event_id: createdEvent.id });
    setBusy(false);
    if (memberError || prepareError) {
      toast.error("इवेंट बन गया, लेकिन टीम/घर सूची तैयार करने में समस्या आई: " + (memberError?.message ?? prepareError?.message));
    } else {
      toast.success("इवेंट तुरंत शुरू हो गया। " + Number(preparedCount ?? 0) + " घरों की कॉलिंग सूची अपने-आप तैयार हुई।");
    }
    setCreateOpen(false);
    setSelected(createdEvent.id);
    await load();
    await loadHouseholds(createdEvent.id);
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

  const linkPendingVoter = async (account: PendingVoterAccount) => {
    const voterId = pendingLinkSelection[account.user_id];
    if (!voterId) { toast.error("पहले सही मतदाता रिकॉर्ड चुनें"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_link_pending_voter", { p_user_id: account.user_id, p_voter_record_id: voterId });
    setBusy(false);
    if (error) toast.error("मतदाता रिकॉर्ड लिंक नहीं हुआ: " + error.message);
    else { toast.success("मतदाता रिकॉर्ड सफलतापूर्वक लिंक हो गया"); setPendingLinkSelection((old) => ({ ...old, [account.user_id]: "" })); await load(); }
  };

  const approveVoterAccount = async (account: PendingVoterAccount) => {
    if (!account.voter_account_links?.length || account.voter_account_links.some((link) => !link.voters)) {
      toast.error("पहले इस अकाउंट से सही मतदाता रिकॉर्ड लिंक करें"); return;
    }
    const submission = pendingContactSubmissions.find((item) => item.user_id === account.user_id);
    if (!submission) { toast.error("मतदाता का मोबाइल नंबर रजिस्ट्रेशन में नहीं मिला। उससे दोबारा जानकारी भरवाएँ।"); return; }
    setBusy(true);
    const { error: contactError } = await supabase.rpc("admin_save_pending_voter_contact", { p_user_id: account.user_id });
    if (contactError) { setBusy(false); toast.error("मोबाइल नंबर मतदाता रिकॉर्ड में सेव नहीं हुआ: " + contactError.message); return; }
    const { error } = await supabase.functions.invoke("admin-user-management", { body: { action: "toggle", user_id: account.user_id, is_active: true } });
    setBusy(false);
    if (error) toast.error("मोबाइल नंबर सेव हुआ, लेकिन अकाउंट सक्रिय नहीं हुआ: " + error.message);
    else { toast.success("मोबाइल नंबर और सहमति जाँचकर मतदाता अकाउंट सक्रिय कर दिया गया"); await load(); }
  };

  const splitFamily = async () => {
    if (!splitHouse || !splitSelected.length || !splitLabel.trim()) { toast.error("अलग परिवार का नाम और सदस्य चुनें"); return; }
    if (splitSelected.length >= splitHouse.voter_ids.length) { toast.error("कम से कम एक सदस्य पुराने परिवार में छोड़ें"); return; }
    setBusy(true);
    const { error: insertError } = await supabase.rpc("split_event_household", {
      p_source_household: splitHouse.id, p_member_ids: splitSelected, p_family_label: splitLabel.trim(),
    });
    setBusy(false);
    if (insertError) toast.error("परिवार अलग नहीं हुआ: " + insertError.message);
    else { toast.success("एक ही मकान के अलग परिवार सुरक्षित रूप से बना दिए गए"); setSplitHouse(null); setSplitSelected([]); setSplitLabel(""); await loadHouseholds(selected); }
  };

  const releaseClaim = async (householdId: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("release_event_household_claim", { p_household_id: householdId });
    setBusy(false);
    if (error) toast.error("लॉक नहीं हटाया गया: " + error.message);
    else { toast.success("कॉल लॉक हटा दिया गया"); await loadHouseholds(selected); }
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

  const callingHouseholds = households.filter((h) => callingWardSelection.length === 0 || callingWardSelection.includes(h.ward_id));
  const exportReport = () => {
    const rows = [["घर नंबर","परिवार","स्थिति","मतदाता संख्या","कॉल करने वाला","परिणाम","समय"]];
    for (const h of callingHouseholds) {
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
    {role === "admin" && <Card className="mb-4 p-4"><h2 className="mb-2 font-bold">नए मतदाता अकाउंट की जाँच</h2>{pendingVoterAccounts.length === 0 ? <p className="text-sm text-muted-foreground">कोई नया अकाउंट स्वीकृति के लिए लंबित नहीं है।</p> : <div className="space-y-3">{pendingVoterAccounts.map((account) => {
      const links = account.voter_account_links ?? [];
      const linked = links.filter((link) => link.voters);
      const searchText = (pendingLinkSearch[account.user_id] ?? "").trim().toLowerCase();
      const selectedWard = pendingLinkWard[account.user_id] ?? "";
      const candidates = allVoters.filter((v) => (!selectedWard || v.ward_id === selectedWard) && (!searchText || [v.full_name, v.voter_id ?? "", v.house_number ?? ""].some((value) => value.toLowerCase().includes(searchText)))).slice(0, 100);
      return <div key={account.user_id} className="rounded-lg border p-3">
        <div className="font-semibold">{account.full_name}</div>
        <div className="mt-1 text-sm">मोबाइल: {pendingContactSubmissions.find((item) => item.user_id === account.user_id)?.phone ?? "नंबर उपलब्ध नहीं"}</div>
        <div className="text-sm text-muted-foreground">इवेंट संपर्क सहमति: {pendingContactSubmissions.find((item) => item.user_id === account.user_id)?.consent_to_event_contact ? "हाँ" : "नहीं"}</div>
        <div className="mt-1 text-sm text-muted-foreground">लिंक रिकॉर्ड: {linked.map((link) => link.voters ? `${link.voters.full_name} (${link.voters.voter_id ?? "ID नहीं"}) · मकान ${link.voters.house_number ?? "-"}` : "").filter(Boolean).join(" | ") || "रिकॉर्ड उपलब्ध नहीं"}</div>
        {!linked.length && <div className="mt-3 grid gap-3">
          <div>
            <div className="mb-2 text-sm font-semibold">पहले वार्ड चुनें</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={(!selectedWard ? btnPrimary : btnOutline)} onClick={() => { setPendingLinkWard((old) => ({ ...old, [account.user_id]: "" })); setPendingLinkSelection((old) => ({ ...old, [account.user_id]: "" })); }}>सभी वार्ड</button>
              {accountWards.map((ward) => <button type="button" key={ward.id} className={(selectedWard === ward.id ? btnPrimary : btnOutline)} onClick={() => { setPendingLinkWard((old) => ({ ...old, [account.user_id]: ward.id })); setPendingLinkSelection((old) => ({ ...old, [account.user_id]: "" })); }}>{ward.name || `वार्ड ${ward.ward_number}`}</button>)}
            </div>
          </div>
          <input className={inputCls} value={pendingLinkSearch[account.user_id] ?? ""} onChange={(e) => setPendingLinkSearch((old) => ({ ...old, [account.user_id]: e.target.value }))} placeholder="चुने हुए वार्ड में नाम, मकान या पहचान संख्या खोजें"/>
          <select className={inputCls} value={pendingLinkSelection[account.user_id] ?? ""} onChange={(e) => setPendingLinkSelection((old) => ({ ...old, [account.user_id]: e.target.value }))}>
            <option value="">सही मतदाता रिकॉर्ड चुनें ({candidates.length} रिकॉर्ड)</option>
            {candidates.map((v) => <option key={v.id} value={v.id}>{v.full_name} · {v.voter_id ?? "ID नहीं"} · मकान {v.house_number ?? "-"}</option>)}
          </select>
          <button className={btnOutline} disabled={busy || !pendingLinkSelection[account.user_id]} onClick={() => void linkPendingVoter(account)}>मतदाता रिकॉर्ड लिंक करें</button>
        </div>}
        <button className={btnPrimary + " mt-3"} disabled={busy || !links.length || links.some((link) => !link.voters)} onClick={() => void approveVoterAccount(account)}>जाँचकर सक्रिय करें</button>
      </div>;
    })}</div>}</Card>}
    <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.5fr)]">
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
              <select className={inputCls + " max-w-xs"} value={teamUser} onChange={(e) => setTeamUser(e.target.value)}><option value="">कॉलर चुनें</option>{profiles.filter((p) => p.user_id !== userId).map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name} ({p.role})</option>)}</select>
              <button disabled={busy || !teamUser} className={btnPrimary} onClick={() => void appointMember()}><Users className="h-4 w-4"/>टीम में जोड़ें</button>
            </div>}
          </Card>
          {selectedEvent.status === "approved" && <Card className="p-4">
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-muted p-2 text-center"><div className="text-xs text-muted-foreground">कुल घर</div><b>{callingHouseholds.length}</b></div><div className="rounded-lg bg-muted p-2 text-center"><div className="text-xs text-muted-foreground">लंबित</div><b>{callingHouseholds.filter((h) => h.status === "pending").length}</b></div><div className="rounded-lg bg-muted p-2 text-center"><div className="text-xs text-muted-foreground">दोबारा कॉल</div><b>{callingHouseholds.filter((h) => h.status === "retry").length}</b></div><div className="rounded-lg bg-muted p-2 text-center"><div className="text-xs text-muted-foreground">पूरे</div><b>{callingHouseholds.filter((h) => h.status === "completed").length}</b></div></div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">साझा कॉलिंग सूची</h3><div className="flex flex-wrap gap-2"><div className="flex flex-wrap gap-2" aria-label="कॉलिंग सूची के वार्ड चुनें"><button type="button" className={callingWardSelection.length === 0 ? btnPrimary : btnOutline} onClick={() => setCallingWardSelection([])}>सभी वार्ड</button>{accountWards.map((w) => <button type="button" key={w.id} className={callingWardSelection.includes(w.id) ? btnPrimary : btnOutline} onClick={() => setCallingWardSelection((old) => old.includes(w.id) ? old.filter((id) => id !== w.id) : [...old, w.id])}>वार्ड {w.ward_number}</button>)}</div><button className={btnOutline} onClick={exportReport}>Excel के लिए CSV रिपोर्ट</button><select className="h-9 rounded-lg border bg-card px-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="pending">बाकी घर</option><option value="retry">दोबारा कॉल</option><option value="completed">पूरे</option><option value="needs_correction">नंबर सुधार</option></select><button className={btnOutline} onClick={() => void loadHouseholds(selected)}><RefreshCw className="h-4 w-4"/>रीफ्रेश</button></div></div>
            {claimed ? <div className="rounded-xl border border-primary p-4">
              <div className="mb-2 font-bold">घर नं. {claimed.house_number} {claimed.household_label && "· " + claimed.household_label} — कॉल जारी</div>
              <div className="mb-3 space-y-2">{claimed.voter_ids.map((id) => {
                const c = contacts.find((x) => x.voter_id === id);
                return <div key={id} className="flex items-center justify-between gap-2 text-sm"><span>{voterDetails.find((v) => v.id === id)?.full_name ?? "मतदाता"} · {voterDetails.find((v) => v.id === id)?.voter_id ?? ""}</span>{c ? <a className="inline-flex items-center gap-1 font-semibold text-primary" href={"tel:" + c.phone}><Phone className="h-4 w-4"/>{c.phone}</a> : <span className="text-xs text-muted-foreground">सहमति वाला नंबर उपलब्ध नहीं</span>}</div>;
              })}</div>
              <textarea className={inputCls + " min-h-20 py-2"} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="कॉल नोट (वैकल्पिक)" />
              <div className="mt-3 flex flex-wrap gap-2">{([["contacted","बात हो गई"],["no_answer","फोन नहीं उठा"],["busy","व्यस्त"],["call_later","बाद में कॉल"],["invalid_number","गलत नंबर"]] as const).map(([v,l]) => <button key={v} disabled={busy} className={v==="contacted" ? btnPrimary : btnOutline} onClick={() => void submitCall(v)}>{l}</button>)}</div>
            </div> : <div className="max-h-[560px] space-y-2 overflow-y-auto">
              {callingHouseholds.filter((h) => h.status === filter).map((h) => <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div><div className="font-semibold">वार्ड {accountWards.find((w) => w.id === h.ward_id)?.ward_number ?? "-"} · घर नं. {h.house_number} {h.household_label && "· " + h.household_label}</div><div className="text-xs text-muted-foreground">{h.voter_ids.map((id) => voterDetails.find((v) => v.id === id)?.full_name ?? "मतदाता").join(", ")} · {h.voter_ids.length} सदस्य</div><div className="text-xs text-muted-foreground">{h.status === "retry" ? "दोबारा कॉल" : h.status === "completed" ? "संपर्क पूरा" : h.status === "needs_correction" ? "नंबर सुधार" : "लंबित"}</div></div>
                {h.status === "pending" || h.status === "retry" ? claims[h.id] ? <span className="text-xs text-warning">दूसरा सदस्य कॉल कर रहा है</span> : <button disabled={busy} className={btnPrimary} onClick={() => void claimHouse(h)}><Phone className="h-4 w-4"/>चुनें और कॉल करें</button> : null}{role === "admin" && <div className="flex flex-wrap gap-1">{claims[h.id] && <button disabled={busy} className={btnOutline} onClick={() => void releaseClaim(h.id)}>लॉक हटाएँ</button>}<button className={btnOutline} onClick={() => { setSplitHouse(h); setSplitSelected([]); }}>परिवार अलग करें</button><button className={btnOutline} onClick={() => void correctHousehold(h,"pending")}>पेंडिंग करें</button><button className={btnOutline} onClick={() => void correctHousehold(h,"completed")}>पूर्ण करें</button></div>}
              </div>)}
              {callingHouseholds.filter((h) => h.status === filter).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">इस श्रेणी में घर नहीं हैं।</p>}
            </div>}
          </Card>}
          {role === "admin" && splitHouse && <Card className="p-4"><h3 className="font-bold">मकान नं. {splitHouse.house_number} में दूसरा परिवार अलग करें</h3><p className="my-2 text-xs text-muted-foreground">अलग परिवार के सदस्य चुनें। बाकी सदस्य पहले परिवार में रहेंगे।</p><input className={inputCls} value={splitLabel} onChange={(e) => setSplitLabel(e.target.value)} placeholder="परिवार का नाम / पहचान"/><div className="my-3 max-h-52 space-y-2 overflow-y-auto">{splitHouse.voter_ids.map((id) => { const v = voterDetails.find((x) => x.id === id); return <label key={id} className="flex items-center gap-2 rounded border p-2 text-sm"><input type="checkbox" checked={splitSelected.includes(id)} onChange={(e) => setSplitSelected((old) => e.target.checked ? [...old,id] : old.filter((x) => x !== id))}/>{v?.full_name ?? "मतदाता"} · {v?.voter_id ?? id}</label>; })}</div><div className="flex justify-end gap-2"><button className={btnOutline} onClick={() => setSplitHouse(null)}>रद्द</button><button disabled={busy || !splitSelected.length || !splitLabel.trim()} className={btnPrimary} onClick={() => void splitFamily()}>परिवार अलग सेव करें</button></div></Card>}
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
