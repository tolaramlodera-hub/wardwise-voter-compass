import { useState } from "react";
import { Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Card, WardSelect, inputCls, btnOutline } from "@/components/AppShell";
import { VoterTable } from "@/components/VoterTable";
import { useStore, wardStats, revertVote } from "@/lib/mock-data";

export function StatusList({ voted }: { voted: boolean }) {
  const { voters } = useStore();
  const [ward, setWard] = useState(0);
  const [q, setQ] = useState("");
  const s = wardStats(voters, ward || undefined);
  const list = voters.filter((v) => !!v.votedAt === voted && (!ward || v.ward === ward) && (!q || v.name.includes(q) || v.voterId.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-success/15 p-4"><div className="text-sm text-success">Voted</div><div className="font-display text-3xl font-bold">{s.voted}</div></div>
        <div className="rounded-xl bg-warning/25 p-4"><div className="text-sm text-warning-foreground">Pending</div><div className="font-display text-3xl font-bold">{s.pending}</div></div>
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-4">
          <WardSelect value={ward} onChange={setWard} />
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls + " pl-9"} placeholder="नाम या वोटर ID से खोजें" />
          </div>
        </div>
        <VoterTable
          voters={list.slice(0, 100)}
          showVote={voted}
          action={voted ? (v) => (
            <button className={btnOutline} title="केवल एडमिन" onClick={() => { revertVote(v.id); toast.success("एंट्री वापस की गई (Audit Log में दर्ज)"); }}>
              <Undo2 className="h-3.5 w-3.5" /> वापस
            </button>
          ) : undefined}
        />
      </Card>
    </>
  );
}
