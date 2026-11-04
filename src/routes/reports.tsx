import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, btnOutline } from "@/components/AppShell";
import { useStore, wardStats, wards } from "@/lib/mock-data";

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
  const { voters } = useStore();
  const all = wardStats(voters);
  return (
    <AppShell title="वार्ड वार रिपोर्ट">
      <div className="mb-4 flex justify-end">
        <button className={btnOutline} onClick={() => toast.info("Excel/PDF डाउनलोड — अगले चरण में")}><Download className="h-4 w-4" /> डाउनलोड</button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-primary text-left text-primary-foreground">
            <tr>{["वार्ड", "कुल", "वोटेड", "बाकी", "प्रतिशत"].map((h) => <th key={h} className="px-3 py-3 font-medium md:px-5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {wards.map((w) => {
              const s = wardStats(voters, w.number);
              return (
                <tr key={w.number} className="border-t">
                  <td className="px-3 py-3 font-semibold md:px-5">वार्ड {w.number}</td>
                  <td className="px-3 py-3 md:px-5">{s.total}</td>
                  <td className="px-3 py-3 text-success md:px-5">{s.voted}</td>
                  <td className="px-3 py-3 md:px-5">{s.pending}</td>
                  <td className="px-3 py-3 md:px-5">
                    <div className="flex items-center gap-2"><span className="w-12 font-bold">{s.pct}%</span><div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:block"><div className="h-full bg-success" style={{ width: `${s.pct}%` }} /></div></div>
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 bg-muted font-bold">
              <td className="px-3 py-3 md:px-5">कुल</td><td className="px-3 py-3 md:px-5">{all.total}</td><td className="px-3 py-3 md:px-5">{all.voted}</td><td className="px-3 py-3 md:px-5">{all.pending}</td><td className="px-3 py-3 md:px-5">{all.pct}%</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
