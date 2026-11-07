import { useState } from "react";
import { FileSpreadsheet, Upload, LoaderCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, btnOutline } from "@/components/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = { wardNumber: number; onComplete: () => void };
type ImportRow = {
  serial_no: number;
  voter_id: string | null;
  full_name: string;
  relative_name: string | null;
  age: number | null;
  gender: "पुरुष" | "महिला" | "अन्य" | null;
  house_number: string | null;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}
function normalize(value: string) { return value.trim().toLowerCase().replace(/[\s._-]+/g, ""); }

export function VoterCsvImport({ wardNumber, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const importFile = async (file: File) => {
    setResult(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("अभी केवल CSV फाइल समर्थित है। Excel फाइल को पहले CSV में सेव करें।");
      return;
    }
    setBusy(true);
    try {
      const csv = parseCsv(await file.text());
      if (csv.length < 2) throw new Error("CSV में हेडर और कम से कम एक रिकॉर्ड होना चाहिए।");
      const headers = csv[0].map(normalize);
      const find = (...names: string[]) => headers.findIndex((h) => names.map(normalize).includes(h));
      const serialIdx = find("क्रम संख्या", "क्रमांक", "serial_no", "serial", "srno");
      const voterIdx = find("मतदाता पहचान पत्र संख्या", "मतदाता पहचान पत्र", "वोटर आईडी", "voter_id", "epicno", "epic");
      const nameIdx = find("मतदाता का नाम", "मतदाता नाम", "नाम", "full_name", "name");
      const relativeIdx = find("पिता/पति का नाम", "पिता/पति/माता का नाम", "पिता का नाम", "पति का नाम", "relative_name", "father_name");
      const ageIdx = find("आयु", "उम्र", "age");
      const genderIdx = find("लिंग", "gender", "sex");
      const houseIdx = find("मकान संख्या", "मकान नंबर", "house_number", "house");
      if (serialIdx < 0 || nameIdx < 0) throw new Error("क्रम संख्या और मतदाता का नाम वाले कॉलम नहीं मिले।");
      const raw = csv.slice(1).map((cells, index) => {
        const val = (idx: number) => idx < 0 ? "" : (cells[idx] ?? "").trim();
        const serial = Number(val(serialIdx));
        const ageValue = val(ageIdx);
        const age = ageValue ? Number(ageValue) : null;
        const genderValue = val(genderIdx);
        const gender: ImportRow["gender"] = genderValue.includes("महिला") ? "महिला" : genderValue.includes("पुरुष") ? "पुरुष" : genderValue ? "अन्य" : null;
        return {
          rowNumber: index + 2,
          record: {
            serial_no: serial,
            voter_id: val(voterIdx) || null,
            full_name: val(nameIdx),
            relative_name: val(relativeIdx) || null,
            age: age !== null && Number.isInteger(age) && age >= 18 && age <= 120 ? age : null,
            gender,
            house_number: val(houseIdx) || null,
          } satisfies ImportRow,
        };
      });
      const invalid = raw.filter(({ record }) => !Number.isInteger(record.serial_no) || record.serial_no < 1 || !record.full_name);
      if (invalid.length) throw new Error("पंक्ति " + invalid.slice(0, 5).map((x) => x.rowNumber).join(", ") + " में क्रम संख्या या नाम खाली/गलत है। कोई रिकॉर्ड अपलोड नहीं किया गया।");
      const serials = new Set<number>();
      for (const { record } of raw) {
        if (serials.has(record.serial_no)) throw new Error("CSV में क्रम संख्या " + record.serial_no + " एक से अधिक बार है। कोई रिकॉर्ड अपलोड नहीं किया गया।");
        serials.add(record.serial_no);
      }

      const supabase = getSupabaseBrowserClient();
      const { data: ward, error: wardError } = await supabase.from("wards").select("id").eq("ward_number", wardNumber).single();
      if (wardError || !ward) throw new Error("वार्ड " + wardNumber + " नहीं मिला।");
      const records = raw.map(({ record }) => ({ ...record, ward_id: ward.id }));
      const voterIds = records.map((record) => record.voter_id).filter((id): id is string => Boolean(id));
      const { data: existingIds, error: idsError } = voterIds.length
        ? await supabase.from("voters").select("voter_id").in("voter_id", voterIds)
        : { data: [], error: null };
      if (idsError) throw new Error("मौजूदा वोटर ID जाँची नहीं जा सकीं: " + idsError.message);
      const { data: existingSerials, error: serialError } = await supabase.from("voters").select("serial_no").eq("ward_id", ward.id);
      if (serialError) throw new Error("वार्ड की मौजूदा क्रम संख्या जाँची नहीं जा सकीं: " + serialError.message);
      const knownIds = new Set((existingIds ?? []).map((item) => (item.voter_id ?? "").trim().toUpperCase()));
      const knownSerials = new Set((existingSerials ?? []).map((item) => item.serial_no).filter((n): n is number => n !== null));
      const seenDuringImport = new Set<string>();
      const fresh = records.filter((record) => {
        const normalizedId = (record.voter_id ?? "").trim().toUpperCase();
        if (normalizedId && (knownIds.has(normalizedId) || seenDuringImport.has(normalizedId))) return false;
        if (normalizedId) seenDuringImport.add(normalizedId);
        return !knownSerials.has(record.serial_no);
      });
      let inserted = 0;
      for (let i = 0; i < fresh.length; i += 100) {
        const batch = fresh.slice(i, i + 100);
        const { data, error } = await supabase.from("voters").insert(batch).select("id");
        if (error) throw new Error("अपलोड पंक्ति " + (i + 1) + "–" + Math.min(i + 100, fresh.length) + " पर रुका: " + error.message);
        inserted += data?.length ?? 0;
      }
      const skipped = records.length - inserted;
      setResult({ inserted, skipped });
      toast.success("वार्ड " + wardNumber + " में " + inserted + " रिकॉर्ड इम्पोर्ट हुए");
      onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV इम्पोर्ट नहीं हो पाया");
    } finally { setBusy(false); }
  };

  return <Card className="mb-4 border-dashed p-5">
    <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
      <div className="rounded-lg bg-secondary p-3"><FileSpreadsheet className="h-6 w-6 text-primary" /></div>
      <div className="flex-1">
        <div className="font-semibold">वार्ड {wardNumber} की मतदाता सूची अपलोड करें</div>
        <div className="text-sm text-muted-foreground">CSV फाइल — क्रम संख्या, मतदाता का नाम, वोटर ID, पिता/पति का नाम, आयु, लिंग और मकान संख्या</div>
      </div>
      <label className={btnOutline + " h-11 cursor-pointer"}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "अपलोड हो रहा है..." : "CSV फाइल चुनें"}
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void importFile(file); e.currentTarget.value = ""; }} />
      </label>
    </div>
    {result && <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm"><CheckCircle2 className="h-5 w-5 text-success" /><span>सफल: {result.inserted} · पहले से मौजूद/स्किप: {result.skipped}</span></div>}
    <p className="mt-3 text-xs text-muted-foreground">पहले से मौजूद वोटर ID दोबारा नहीं जुड़ेंगी। अन्य वार्डों का डेटा नहीं बदलेगा।</p>
  </Card>;
}
