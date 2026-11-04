import { useEffect, useMemo, useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, WardSelect, inputCls } from "@/components/AppShell";
import { VoterTable } from "@/components/VoterTable";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Voter } from "@/lib/mock-data";

type Row = {
  id: string;
  serial_no: number | null;
  full_name: string;
  relative_name: string | null;
  age: number | null;
  gender: "पुरुष" | "महिला" | "अन्य" | null;
  house_number: string | null;
  voter_id: string | null;
  wards: { ward_number: number } | null;
  attendance: { recorded_at: string; recorded_by: string }[] | null;
};

const PAGE_SIZE = 50;

export function StatusList({ voted }: { voted: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [ward, setWard] = useState(0);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [votedCount, setVotedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(q.trim()); setPage(0); }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          if (active) { setRows([]); setIsAdmin(false); setTotal(0); }
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("is_active,role").eq("user_id", user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.is_active) {
          if (active) { setRows([]); setIsAdmin(false); setTotal(0); }
          return;
        }
        if (active) setIsAdmin(String(profile.role ?? "").toLowerCase() === "admin");

        let wardId: string | null = null;
        if (ward) {
          const { data: wardRow, error } = await supabase.from("wards").select("id").eq("ward_number", ward).maybeSingle();
          if (error) throw error;
          wardId = wardRow?.id ?? null;
        }

        const countFor = async (hasVote: boolean) => {
          let query = supabase.from("voters")
            .select(hasVote ? "id,attendance!inner(voter_id)" : "id,attendance(voter_id)", { count: "exact", head: true });
          if (wardId) query = query.eq("ward_id", wardId);
          if (!hasVote) query = query.is("attendance", null);
          const { count, error } = await query;
          if (error) throw error;
          return count ?? 0;
        };
        const [votedTotal, pendingTotal] = await Promise.all([countFor(true), countFor(false)]);

        let query = supabase.from("voters")
          .select(voted
            ? "id,serial_no,full_name,relative_name,age,gender,house_number,voter_id,wards!inner(ward_number),attendance!inner(recorded_at,recorded_by)"
            : "id,serial_no,full_name,relative_name,age,gender,house_number,voter_id,wards!inner(ward_number),attendance(recorded_at,recorded_by)",
            { count: "exact" })
          .order("serial_no", { ascending: true, nullsFirst: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (ward) query = query.eq("wards.ward_number", ward);
        if (!voted) query = query.is("attendance", null);
        if (search) {
          const safe = search.replace(/[,.%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
          if (safe) query = query.or(`full_name.ilike.%${safe}%,voter_id.ilike.%${safe}%,house_number.ilike.%${safe}%`);
        }
        const { data, count, error } = await query;
        if (error) throw error;
        if (!active) return;
        setRows((data ?? []) as unknown as Row[]);
        setTotal(count ?? 0);
        setVotedCount(votedTotal);
        setPendingCount(pendingTotal);
      } catch (error) {
        if (active) {
          setRows([]);
          const message = error && typeof error === "object" && "message" in error
            ? String(error.message) : error instanceof Error ? error.message : "कृपया दोबारा प्रयास करें";
          toast.error("सूची लोड नहीं हुई: " + message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [supabase, ward, voted, page, search]);

  const removeVote = async (voter: Voter) => {
    if (!isAdmin || !window.confirm(`क्या आप ${voter.name} का दर्ज वोट वापस हटाना चाहते हैं? मतदाता का विवरण सुरक्षित रहेगा।`)) return;
    setRemovingId(voter.id);
    try {
      const { error } = await supabase.from("attendance").delete().eq("voter_id", voter.id);
      if (error) throw error;
      setRows((current) => current.filter((row) => row.id !== voter.id));
      setTotal((value) => Math.max(0, value - 1));
      setVotedCount((value) => Math.max(0, value - 1));
      setPendingCount((value) => value + 1);
      toast.success("वोट एंट्री वापस हटा दी गई। मतदाता Pending सूची में आ गया है।");
    } catch (error) {
      toast.error("वोट वापस नहीं हट सका: " + (error instanceof Error ? error.message : "कृपया दोबारा प्रयास करें"));
    } finally {
      setRemovingId(null);
    }
  };

  const voters = rows.map((v) => {
    const latestAttendance = Array.isArray(v.attendance) ? v.attendance[0] : undefined;
    return {
      id: v.id, serialNo: v.serial_no ?? undefined, name: v.full_name,
      relative: v.relative_name ?? "", age: v.age ?? 0, gender: v.gender ?? "अन्य",
      house: v.house_number ?? "", voterId: v.voter_id ?? "", ward: v.wards?.ward_number ?? 0,
      votedAt: latestAttendance?.recorded_at, votedBy: latestAttendance?.recorded_by,
    } as Voter;
  });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <>
    <div className="mb-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-success/15 p-4"><div className="text-sm text-success">Voted</div><div className="font-display text-3xl font-bold">{votedCount}</div></div>
      <div className="rounded-xl bg-warning/25 p-4"><div className="text-sm text-warning-foreground">Pending</div><div className="font-display text-3xl font-bold">{pendingCount}</div></div>
    </div>
    <Card>
      <div className="flex flex-wrap gap-2 border-b p-4">
        <WardSelect value={ward} onChange={(value) => { setWard(value); setPage(0); }} />
        <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} className={inputCls + " pl-9"} placeholder="नाम या वोटर ID से खोजें" /></div>
      </div>
      {loading ? <div className="p-8 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div> : <>
        <VoterTable voters={voters} showVote={voted} action={voted && isAdmin ? (v) => <button type="button" disabled={removingId === v.id} onClick={() => void removeVote(v)} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-50">{removingId === v.id ? "हटा रहे हैं…" : "वोट वापस हटाएँ"}</button> : undefined} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm">
          <span className="text-muted-foreground">{total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} / ${total}` : "0 रिकॉर्ड"}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-lg border px-3 py-2 disabled:opacity-40">पिछला</button>
            <span className="tabular-nums">{page + 1} / {pageCount}</span>
            <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">अगला</button>
          </div>
        </div>
      </>}
    </Card>
  </>;
}
