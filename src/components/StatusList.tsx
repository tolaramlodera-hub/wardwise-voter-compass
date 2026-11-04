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

export function StatusList({ voted }: { voted: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [ward, setWard] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        // Wait for a valid signed-in user before querying tables protected by RLS.
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          if (active) setRows([]);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_active,role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.is_active) {
          if (active) setRows([]);
          return;
        }
        if (active) setIsAdmin(String(profile.role ?? "").toLowerCase() === "admin");

        let query = supabase
          .from("voters")
          .select("id,serial_no,full_name,relative_name,age,gender,house_number,voter_id,wards!inner(ward_number),attendance(recorded_at,recorded_by)")
          .order("serial_no", { ascending: true, nullsFirst: false });
        if (ward) query = query.eq("wards.ward_number", ward);
        const { data, error } = await query;
        if (error) throw error;
        if (active) setRows((data ?? []) as unknown as Row[]);
      } catch (error) {
        if (active) {
          setRows([]);
          toast.error("सूची लोड नहीं हुई: " + (error instanceof Error ? error.message : "कृपया दोबारा प्रयास करें"));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [supabase, ward]);

  const removeVote = async (voter: Voter) => {
    if (!isAdmin || !window.confirm(`क्या आप ${voter.name} का दर्ज वोट वापस हटाना चाहते हैं? मतदाता का विवरण सुरक्षित रहेगा।`)) return;
    setRemovingId(voter.id);
    try {
      const { error } = await supabase.from("attendance").delete().eq("voter_id", voter.id);
      if (error) throw error;
      setRows((current) => current.map((row) => row.id === voter.id ? { ...row, attendance: [] } : row));
      toast.success("वोट एंट्री वापस हटा दी गई। मतदाता Pending सूची में आ गया है।");
    } catch (error) {
      toast.error("वोट वापस नहीं हट सका: " + (error instanceof Error ? error.message : "कृपया दोबारा प्रयास करें"));
    } finally {
      setRemovingId(null);
    }
  };

  const all = rows.map((v) => {
    const attendance = Array.isArray(v.attendance) ? v.attendance : [];
    const latestAttendance = attendance[0];
    return {
      id: v.id,
      serialNo: v.serial_no ?? undefined,
      name: v.full_name,
      relative: v.relative_name ?? "",
      age: v.age ?? 0,
      gender: v.gender ?? "अन्य",
      house: v.house_number ?? "",
      voterId: v.voter_id ?? "",
      ward: v.wards?.ward_number ?? 0,
      votedAt: latestAttendance?.recorded_at,
      votedBy: latestAttendance?.recorded_by,
    } as Voter;
  });
  const normalizedQuery = q.trim().toLowerCase();
  const filtered = all.filter((v) =>
    (!!v.votedAt) === voted &&
    (!normalizedQuery || v.name.toLowerCase().includes(normalizedQuery) || (v.voterId ?? "").toLowerCase().includes(normalizedQuery))
  );
  const votedCount = all.filter((v) => !!v.votedAt).length;

  return <>
    <div className="mb-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-success/15 p-4"><div className="text-sm text-success">Voted</div><div className="font-display text-3xl font-bold">{votedCount}</div></div>
      <div className="rounded-xl bg-warning/25 p-4"><div className="text-sm text-warning-foreground">Pending</div><div className="font-display text-3xl font-bold">{all.length-votedCount}</div></div>
    </div>
    <Card>
      <div className="flex flex-wrap gap-2 border-b p-4"><WardSelect value={ward} onChange={setWard} /><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} className={inputCls + " pl-9"} placeholder="नाम या वोटर ID से खोजें" /></div></div>
      {loading ? <div className="p-8 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div> : <VoterTable voters={filtered} showVote={voted} action={voted && isAdmin ? (v) => <button type="button" disabled={removingId === v.id} onClick={() => void removeVote(v)} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-50">{removingId === v.id ? "हटा रहे हैं…" : "वोट वापस हटाएँ"}</button> : undefined} />}
    </Card>
  </>;
}
