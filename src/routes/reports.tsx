import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, btnOutline } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "वार्ड वार रिपोर्ट — मतदान प्रतिशत" },
      { name: "description", content: "हर वार्ड के कुल, वोटेड, बाकी मतदाता और मतदान प्रतिशत की रिपोर्ट।" },
      { property: "og:title", content: "वार्ड वार रिपोर्ट" },
      { property: "og:description", content: "Ward wise turnout report." },
    ],
  }),
  component: Reports,
});

function Reports() {
 const supabase = useMemo(() => getSupabaseBrowserClient(), []);
 const [rows,setRows] = useState<{number:number;total:number;voted:number;pending:number;pct:number}[]>([]);
 useEffect(() => { let active=true; const load=async()=> {
  const {data:wards,error:we}=await supabase.from("wards").select("id,ward_number").eq("is_active",true).lte("ward_number",7).order("ward_number");
  if(we){toast.error("रिपोर्ट वार्ड डेटा लोड नहीं हुआ");return;}
  try {
   // Exact server-side counts avoid downloading the full voter table and the 1,000-row API cap.
   const result=await Promise.all((wards??[]).map(async w=>{
    const [{count:total,error:te},{count:voted,error:ve}]=await Promise.all([
     supabase.from("voters").select("id",{count:"exact",head:true}).eq("ward_id",w.id),
     supabase.from("attendance").select("voter_id, voters!inner(ward_id)",{count:"exact",head:true}).eq("voters.ward_id",w.id),
    ]);
    if(te||ve) throw te??ve;
    const all=total??0,done=voted??0;
    return {number:w.ward_number,total:all,voted:done,pending:all-done,pct:all?Math.round(done/all*1000)/10:0};
   }));
   if(active)setRows(result);
  } catch(error) { console.error("Ward report aggregate count failed:",error); toast.error("रिपोर्ट की गिनती लोड नहीं हुई"); }
 };void load();return()=>{active=false;};},[supabase]);
 const all=rows.reduce((a,w)=>({total:a.total+w.total,voted:a.voted+w.voted,pending:a.pending+w.pending}),{total:0,voted:0,pending:0});
 const pct=all.total?Math.round(all.voted/all.total*1000)/10:0;
 const downloadCsv = () => {
  if (!rows.length) { toast.error("डाउनलोड करने के लिए रिपोर्ट उपलब्ध नहीं है"); return; }
  const csvCell = (value: string | number) => '"' + String(value).replace(/"/g, '""') + '"';
  const lines = [
   ["वार्ड", "कुल मतदाता", "वोटेड", "बाकी", "मतदान प्रतिशत"],
   ...rows.map(w => ["वार्ड " + w.number, w.total, w.voted, w.pending, w.pct + "%"]),
   ["कुल", all.total, all.voted, all.pending, pct + "%"],
  ];
  const csv = String.fromCharCode(0xFEFF) + lines.map(line => line.map(csvCell).join(",")).join(String.fromCharCode(13, 10));
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ward-wise-voting-report-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast.success("वार्ड रिपोर्ट डाउनलोड हो गई");
 };
 return <AppShell title="वार्ड वार रिपोर्ट">
  <div className="mb-4 flex justify-end"><button className={btnOutline} onClick={downloadCsv}><Download className="h-4 w-4"/> डाउनलोड</button></div>
  <Card className="overflow-hidden"><table className="w-full text-sm"><thead className="bg-primary text-left text-primary-foreground"><tr>{["वार्ड","कुल","वोटेड","बाकी","प्रतिशत","सूची"].map(h=><th key={h} className="px-3 py-3 font-medium md:px-5">{h}</th>)}</tr></thead><tbody>
  {rows.map(w=><tr key={w.number} className="border-t"><td className="px-3 py-3 font-semibold md:px-5">वार्ड {w.number}</td><td className="px-3 py-3 md:px-5">{w.total}</td><td className="px-3 py-3 text-success md:px-5">{w.voted}</td><td className="px-3 py-3 md:px-5">{w.pending}</td><td className="px-3 py-3 md:px-5">{w.pct}%</td><td className="px-3 py-3 md:px-5"><a className={btnOutline + " inline-flex whitespace-nowrap"} href={`/voters?ward=${w.number}`}><Eye className="h-4 w-4"/> सूची देखें</a></td></tr>)}
  <tr className="border-t-2 bg-muted font-bold"><td className="px-3 py-3 md:px-5">कुल</td><td className="px-3 py-3 md:px-5">{all.total}</td><td className="px-3 py-3 md:px-5">{all.voted}</td><td className="px-3 py-3 md:px-5">{all.pending}</td><td className="px-3 py-3 md:px-5">{pct}%</td><td className="px-3 py-3 md:px-5">—</td></tr>
  </tbody></table></Card>
 </AppShell>;
}
