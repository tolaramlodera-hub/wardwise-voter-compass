import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, btnPrimary, btnOutline } from "@/components/AppShell";
import { useStore, wardStats, wards, users } from "@/lib/mock-data";

export const Route = createFileRoute("/wards")({
  head: () => ({
    meta: [
      { title: "वार्ड मैनेजमेंट — नए वार्ड जोड़ें" },
      { name: "description", content: "वार्ड जोड़ें, बूथ और जिम्मेदार यूजर देखें।" },
      { property: "og:title", content: "वार्ड मैनेजमेंट" },
      { property: "og:description", content: "Manage wards and booth assignments." },
    ],
  }),
  component: Wards,
});

function Wards() {
  const { voters } = useStore();
  return (
    <AppShell title="वार्ड मैनेजमेंट">
      <div className="mb-4 flex justify-end"><button className={btnPrimary} onClick={() => toast.info("नया वार्ड फॉर्म — अगले चरण में")}><Plus className="h-4 w-4" /> नया वार्ड</button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {wards.map((w) => {
          const s = wardStats(voters, w.number);
          const owners = users.filter((u) => u.role === "User" && u.wards.includes(w.number));
          return (
            <Card key={w.number} className="p-4">
              <div className="flex items-start justify-between">
                <div><div className="font-display text-xl font-bold">{w.name}</div><div className="text-xs text-muted-foreground">{w.booth}</div></div>
                <button className={btnOutline}><Pencil className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-3 text-sm">कुल मतदाता: <b>{s.total}</b></div>
              <div className="text-sm">जिम्मेदार: {owners.map((o) => o.name).join(", ") || "—"}</div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
