import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Upload, FileSpreadsheet, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, WardSelect, inputCls, btnOutline } from "@/components/AppShell";
import { VoterTable } from "@/components/VoterTable";
import { useStore } from "@/lib/mock-data";

export const Route = createFileRoute("/voters")({
  head: () => ({
    meta: [
      { title: "मतदाता सूची — वार्ड वार" },
      { name: "description", content: "वार्ड वार मतदाता सूची देखें और Excel/PDF से अपलोड करें।" },
      { property: "og:title", content: "वार्ड वार मतदाता सूची" },
      { property: "og:description", content: "Ward wise voter list with Excel/PDF upload." },
    ],
  }),
  component: Voters,
});

function Voters() {
  const { voters } = useStore();
  const [ward, setWard] = useState(0);
  const [q, setQ] = useState("");
  const list = voters.filter((v) => (!ward || v.ward === ward) && (!q || v.name.includes(q) || v.voterId.toLowerCase().includes(q.toLowerCase()) || v.house.includes(q)));
  return (
    <AppShell title="मतदाता सूची">
      <Card className="mb-4 border-dashed p-5">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="rounded-lg bg-secondary p-3"><FileSpreadsheet className="h-6 w-6 text-primary" /></div>
          <div className="flex-1">
            <div className="font-semibold">मतदाता सूची अपलोड करें</div>
            <div className="text-sm text-muted-foreground">Excel (.xlsx, .csv) या PDF — कॉलम: नाम, पिता/पति, उम्र, लिंग, मकान नं., वोटर ID, वार्ड</div>
          </div>
          <label className={btnOutline + " h-11 cursor-pointer"}>
            <Upload className="h-4 w-4" /> फाइल चुनें
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && toast.info(`${e.target.files[0].name} — अपलोड सुविधा अगले चरण में सक्रिय होगी`)} />
          </label>
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-4">
          <WardSelect value={ward} onChange={setWard} />
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls + " pl-9"} placeholder="नाम, वोटर ID या मकान नंबर" />
          </div>
          <button className={btnOutline + " h-11"} onClick={() => toast.info("नया मतदाता फॉर्म — अगले चरण में")}><Plus className="h-4 w-4" /> मतदाता जोड़ें</button>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground">{list.length} मतदाता</div>
        <VoterTable voters={list.slice(0, 100)} />
      </Card>
    </AppShell>
  );
}
