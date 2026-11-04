import {createFileRoute} from "@tanstack/react-router";
import {useEffect,useMemo,useState} from "react";
import {AlertTriangle,LoaderCircle,Trash2,RefreshCw} from "lucide-react";
import {toast} from "sonner";
import {AppShell,Card,btnPrimary,inputCls} from "@/components/AppShell";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
type WardInfo={id:string;ward_number:number;name:string;voters:{count:number}[]};
export const Route=createFileRoute("/data-admin")({head:()=>({meta:[{title:"डेटा प्रबंधन | एडमिन"}]}),component:DataAdmin});
function DataAdmin(){
 const supabase=useMemo(()=>getSupabaseBrowserClient(),[]);
 const [wards,setWards]=useState<WardInfo[]>([]),[loading,setLoading]=useState(true),[selected,setSelected]=useState("1"),[confirmText,setConfirmText]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState<number|null>(null);
 const load=async()=>{setLoading(true);const {data,error}=await supabase.from("wards").select("id,ward_number,name,voters(count)").gte("ward_number",1).lte("ward_number",7).order("ward_number");if(error)toast.error("डेटा नहीं मिला: "+error.message);else setWards((data??[]) as unknown as WardInfo[]);setLoading(false);};
 useEffect(()=>{void load();},[]);
 const ward=wards.find(w=>String(w.ward_number)===selected),count=ward?.voters?.[0]?.count??0;
 const clear=async()=>{if(!ward||confirmText!==String(ward.ward_number))return;setBusy(true);setDone(null);const {data,error}=await supabase.rpc("admin_clear_ward_voters",{target_ward_number:ward.ward_number});setBusy(false);if(error){toast.error("डेटा नहीं हटाया गया: "+error.message);return;}setDone(Number(data));setConfirmText("");toast.success("वार्ड "+ward.ward_number+" के पुराने रिकॉर्ड हटाए गए");await load();};
 return <AppShell title="डेटा प्रबंधन"><div className="mx-auto max-w-3xl space-y-4">
 <Card className="border-warning/50 p-4 md:p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-warning"/><div><h2 className="text-lg font-bold">पुराना मतदाता डेटा हटाएँ</h2><p className="mt-1 text-sm text-muted-foreground">केवल एडमिन। चुने गए वार्ड के मतदाता रिकॉर्ड और उनसे जुड़ी उपस्थिति हटेगी। वार्ड, यूजर और दूसरे वार्ड सुरक्षित रहेंगे। हटाया गया डेटा वापस नहीं आएगा।</p></div></div></Card>
 <Card className="space-y-4 p-4 md:p-6">{loading?<div className="flex justify-center p-6"><LoaderCircle className="animate-spin"/></div>:<>
 <label className="block text-sm font-medium">वार्ड चुनें<select className={inputCls+" mt-1"} value={selected} onChange={e=>{setSelected(e.target.value);setConfirmText("");setDone(null);}}>{wards.map(w=><option key={w.id} value={w.ward_number}>वार्ड {w.ward_number} — {w.name}</option>)}</select></label>
 <div className="rounded-lg bg-muted p-4"><div className="text-sm text-muted-foreground">मौजूदा मतदाता रिकॉर्ड</div><div className="text-3xl font-bold">{count}</div></div>
 <label className="block text-sm font-medium">पुष्टि के लिए वार्ड नंबर {selected} लिखें<input className={inputCls+" mt-1"} inputMode="numeric" value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder={"वार्ड "+selected+" लिखें"}/></label>
 <button type="button" className={btnPrimary+" w-full bg-destructive hover:bg-destructive/90"} disabled={busy||!ward||count===0||confirmText!==selected} onClick={()=>void clear()}>{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Trash2 className="h-4 w-4"/>}{busy?"हटाया जा रहा है...":"वार्ड "+selected+" के "+count+" रिकॉर्ड हटाएँ"}</button>
 <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={()=>void load()}><RefreshCw className="h-4 w-4"/>गिनती रीफ्रेश करें</button>
 {done!==null&&<p className="rounded-lg bg-success/10 p-3 text-sm text-success">सफल: {done} मतदाता रिकॉर्ड हटाए गए।</p>}</>}</Card>
 <p className="text-xs text-muted-foreground">यह सुविधा केवल पुराने रिकॉर्ड हटाती है। नई Excel सूची का आयात अलग चरण है।</p></div></AppShell>;
}