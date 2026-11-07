import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Card, btnOutline } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = { wardNumber: number; onDeleted: () => void };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const code = "code" in error && typeof error.code === "string" ? " [" + error.code + "]" : "";
    const details = "details" in error && typeof error.details === "string" ? " — " + error.details : "";
    return error.message + code + details;
  }
  return fallback;
}

export function DeleteWardVoters({ wardNumber, onDeleted }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [wardId, setWardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [typedWard, setTypedWard] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshCount = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: ward, error: wardError } = await supabase.from("wards").select("id").eq("ward_number", wardNumber).single();
      if (wardError || !ward) throw new Error("वार्ड " + wardNumber + " नहीं मिला।");
      const { count: total, error } = await supabase.from("voters").select("id", { count: "exact", head: true }).eq("ward_id", ward.id);
      if (error) throw error;
      setWardId(ward.id);
      setCount(total ?? 0);
    } catch (error) {
      toast.error("रिकॉर्ड की संख्या नहीं मिल सकी: " + errorMessage(error, "अज्ञात त्रुटि"));
      setWardId(null);
      setCount(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { void refreshCount(); }, [wardNumber]);

  const deleteAll = async () => {
    if (!wardId || typedWard.trim() !== String(wardNumber) || busy) return;
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      // First remove attendance history linked to voters in this ward, then remove
      // only these ward's voters. This satisfies attendance_voter_id_fkey.
      const voterIds: string[] = [];
      // Page through all voters; Supabase's default row limit must not leave
      // attendance references behind on larger wards.
      for (let offset = 0; ; offset += 1000) {
        const { data: wardVoters, error: voterListError } = await supabase
          .from("voters").select("id").eq("ward_id", wardId).range(offset, offset + 999);
        if (voterListError) throw voterListError;
        voterIds.push(...(wardVoters ?? []).map((voter) => voter.id));
        if (!wardVoters || wardVoters.length < 1000) break;
      }
      for (let i = 0; i < voterIds.length; i += 100) {
        const { error: attendanceDeleteError } = await supabase
          .from("attendance").delete().in("voter_id", voterIds.slice(i, i + 100));
        if (attendanceDeleteError) throw attendanceDeleteError;
      }
      // Ward scope remains explicit; other wards are never included.
      const { error } = await supabase.from("voters").delete().eq("ward_id", wardId);
      if (error) throw error;
      const { count: remaining, error: verifyError } = await supabase.from("voters").select("id", { count: "exact", head: true }).eq("ward_id", wardId);
      if (verifyError) throw verifyError;
      if ((remaining ?? 0) !== 0) throw new Error("कुछ रिकॉर्ड अभी बाकी हैं (" + remaining + ")। कृपया दोबारा जाँचें।");
      toast.success("वार्ड " + wardNumber + " के सभी पुराने मतदाता रिकॉर्ड हटा दिए गए।");
      setDialog(false);
      setTypedWard("");
      setCount(0);
      onDeleted();
    } catch (error) {
      toast.error("पुराना डेटा नहीं हट पाया: " + errorMessage(error, "अज्ञात त्रुटि"));
      await refreshCount();
    } finally { setBusy(false); }
  };

  return <>
    <Card className="mb-4 border border-destructive/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2 text-destructive"><Trash2 className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold">वार्ड {wardNumber} का पुराना डेटा हटाएँ</div>
            <p className="text-sm text-muted-foreground">केवल चुने हुए वार्ड के सभी मतदाता रिकॉर्ड हटेंगे। दूसरे वार्ड सुरक्षित रहेंगे।</p>
            <p className="mt-1 text-sm font-medium">{loading ? "रिकॉर्ड गिने जा रहे हैं..." : count === null ? "रिकॉर्ड संख्या उपलब्ध नहीं" : "मौजूदा रिकॉर्ड: " + count}</p>
          </div>
        </div>
        <button type="button" className={btnOutline + " border-destructive/40 text-destructive hover:bg-destructive/10"} disabled={loading || count === null || count === 0 || !wardId} onClick={() => setDialog(true)}>
          <Trash2 className="h-4 w-4" /> पुराना डेटा हटाएँ
        </button>
      </div>
    </Card>

    {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3" role="dialog" aria-modal="true" aria-labelledby="delete-ward-title">
      <div className="my-auto w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" /><h2 id="delete-ward-title" className="text-lg font-bold">स्थायी रूप से डेटा हटाएँ?</h2></div>
          <button type="button" className={btnOutline} onClick={() => { setDialog(false); setTypedWard(""); }} disabled={busy} aria-label="बंद करें"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm">वार्ड {wardNumber} के <strong>{count ?? 0} मतदाता रिकॉर्ड</strong> स्थायी रूप से हटेंगे। यह कार्रवाई वापस नहीं की जा सकती। दूसरे वार्डों का डेटा प्रभावित नहीं होगा।</p>
        <label className="mt-4 block text-sm font-medium">पुष्टि के लिए नीचे वार्ड नंबर {wardNumber} लिखें
          <input inputMode="numeric" autoComplete="off" className="mt-2 h-11 w-full rounded-md border bg-background px-3" value={typedWard} onChange={(e) => setTypedWard(e.target.value)} placeholder={"वार्ड नंबर " + wardNumber} disabled={busy} />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btnOutline} onClick={() => { setDialog(false); setTypedWard(""); }} disabled={busy}>रद्द करें</button>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground disabled:opacity-50" onClick={() => void deleteAll()} disabled={busy || typedWard.trim() !== String(wardNumber) || !count}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {busy ? "हटाया जा रहा है..." : "हाँ, पूरा डेटा हटाएँ"}
          </button>
        </div>
      </div>
    </div>}
  </>;
}
