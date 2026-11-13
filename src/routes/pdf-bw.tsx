import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell, Card } from "@/components/AppShell";

export const Route = createFileRoute("/pdf-bw")({
  head: () => ({
    meta: [
      { title: "PDF ब्लैक & व्हाइट कन्वर्टर" },
      { name: "description", content: "रंगीन PDF का बैकग्राउंड हटाकर सभी अक्षर साफ़ काले-सफ़ेद करें।" },
      { property: "og:title", content: "PDF ब्लैक & व्हाइट कन्वर्टर" },
      { property: "og:description", content: "Convert colour PDFs to clean black & white text." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PdfBw,
});

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

function binarize(ctx: CanvasRenderingContext2D, w: number, h: number, threshold: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    // darkest channel catches coloured text; luminance for grey
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const v = Math.min(lum, (r + g + b) / 3 + 20) < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

async function renderPage(pdf: any, n: number, scale: number, threshold: number) {
  const page = await pdf.getPage(n);
  const vp = page.getViewport({ scale });
  const c = document.createElement("canvas");
  c.width = Math.floor(vp.width);
  c.height = Math.floor(vp.height);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
  binarize(ctx, c.width, c.height, threshold);
  return { c, wPt: page.getViewport({ scale: 1 }).width, hPt: page.getViewport({ scale: 1 }).height };
}

function PdfBw() {
  const [file, setFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(160);
  const [preview, setPreview] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const pdfRef = useRef<any>(null);

  async function open(f: File) {
    setFile(f); setPreview(null); setProgress("PDF खुल रही है...");
    const pdfjs = await loadPdfjs();
    const pdf = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
    pdfRef.current = pdf; setPages(pdf.numPages);
    await makePreview(threshold);
  }

  async function makePreview(t: number) {
    if (!pdfRef.current) return;
    const { c } = await renderPage(pdfRef.current, 1, 1.5, t);
    setPreview(c.toDataURL("image/png")); setProgress("");
  }

  async function convert() {
    if (!pdfRef.current || !file) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      let doc: any = null;
      for (let i = 1; i <= pages; i++) {
        setProgress(`पन्ना ${i} / ${pages} साफ़ हो रहा है...`);
        const { c, wPt, hPt } = await renderPage(pdfRef.current, i, 2.5, threshold);
        const o = wPt > hPt ? "l" : "p";
        if (!doc) doc = new jsPDF({ orientation: o, unit: "pt", format: [wPt, hPt], compress: true });
        else doc.addPage([wPt, hPt], o);
        doc.addImage(c.toDataURL("image/png"), "PNG", 0, 0, wPt, hPt, undefined, "FAST");
      }
      doc.save(file.name.replace(/\.pdf$/i, "") + "-BW.pdf");
      setProgress("✅ तैयार! फ़ाइल डाउनलोड हो गई।");
    } catch (e) {
      setProgress("गड़बड़ी हुई: " + (e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <AppShell title="PDF ब्लैक & व्हाइट कन्वर्टर">
      <div className="space-y-4">
        <Card className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">रंगीन PDF चुनें — बैकग्राउंड सफ़ेद और सारे अक्षर गहरे काले हो जाएंगे। फ़ाइल आपके फ़ोन/कंप्यूटर में ही प्रोसेस होती है, कहीं भेजी नहीं जाती।</p>
          <input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && open(e.target.files[0])}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground" />
          {pages > 0 && <p className="mt-2 text-sm">कुल पन्ने: {pages}</p>}
        </Card>
        {file && (
          <Card className="p-4">
            <label className="text-sm font-medium">अक्षरों का गाढ़ापन: {threshold}</label>
            <input type="range" min={60} max={240} value={threshold} className="w-full accent-primary"
              onChange={(e) => setThreshold(+e.target.value)} onMouseUp={() => makePreview(threshold)} onTouchEnd={() => makePreview(threshold)} onKeyUp={() => makePreview(threshold)} />
            <p className="text-xs text-muted-foreground">कम = सिर्फ़ गहरे अक्षर • ज़्यादा = हल्के अक्षर भी काले (बैकग्राउंड बचा रहे तो कम करें)</p>
            <button disabled={busy} onClick={convert} className="mt-3 w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? "बन रही है..." : "B&W PDF डाउनलोड करें"}
            </button>
            {progress && <p className="mt-2 text-sm">{progress}</p>}
          </Card>
        )}
        {preview && (
          <Card className="p-4">
            <p className="mb-2 text-sm font-medium">पहले पन्ने का प्रीव्यू</p>
            <img src={preview} alt="B&W preview" className="w-full rounded border" />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
