import { useEffect, useMemo, useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, WardSelect, inputCls } from "@/components/AppShell";
import { VoterTable } from "@/components/VoterTable";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Voter } from "@/lib/mock-data";

type Row = { id: string; serial_no: number | null; full_name: string; relative_name: string | null; age: number | null; gender: "पुरुष" | "महिला" | "अन्य" | null; house_number: string | null; voter_id: string; wards: { ward_number: number } | null; attendance: { recorded_at: string; recorded_by: string }[] };

export function StatusList({ voted }: { voted: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [ward, setWard] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      let query = supabase.from("voters").select("id,serial_no,full_name,relative_name,age,gender,house_number,voter_id,wards!inner(ward_number),attendance(recorded_at,recorded_by)").order("serial_no", { ascending: true });
      if (ward) query = query.eq("wards.ward_number", ward);
      const { data, error } = await query;
      if (!active) return;
      if (error) toast.error("सूची लोड नहीं हुई: " + error.message);
      else setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [supabase, ward]);

  const all = rows.map(v => ({ id:v.id, serialNo:v.serial_no ?? undefined, name:v.full_name, relative:v.relative_name ?? "", age:v.age ?? 0, gender:v.gender ?? "अन्य", house:v.house_number ?? "", voterId:v.voter_id, ward:v.wards?.ward_number ?? 0, votedAt:v.attendance[0]?.recorded_at, votedBy:v.attendance[0]?.recorded_by } as Voter));
  const filtered = all.filter(v => (!!v.votedAt) === voted && (!q || v.name.includes(q) || v.voterId.toLowerCase().includes(q.toLowerCase())));
  const votedCount = all.filter(v => !!v.votedAt).length;
  return <>
    <div className="mb-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-success/15 p-4"><div className="text-sm text-success">Voted</div><div className="font-display text-3xl font-bold">{votedCount}</div></div>
      <div className="rounded-xl bg-warning/25 p-4"><div className="text-sm text-warning-foreground">Pending</div><div className="font-display text-3xl font-bold">{all.length-votedCount}</div></div>
    </div>
    <Card>
      <div className="flex flex-wrap gap-2 border-b p-4"><WardSelect value={ward} onChange={setWard} /><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} className={inputCls + " pl-9"} placeholder="नाम या वोटर ID से खोजें" /></div></div>
      {loading ? <div className="p-8 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div> : <VoterTable voters={filtered} showVote={voted} />}
    </Card>
  </>;
}
