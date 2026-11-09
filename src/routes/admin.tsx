import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Card } from "@/components/AppShell";
import { Activity, BarChart3, Database, Hammer, Map, ScrollText, Shield, Users } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPanel });

const sections = [
  { to: "/data-admin", title: "वार्ड मतदाता सूची प्रबंधन", detail: "वार्ड चुनकर उस वार्ड की मतदाता सूची और संबंधित रिकॉर्ड हटाने का विकल्प", icon: Database, danger: true },
  { to: "/wards", title: "वार्ड मैनेजमेंट", detail: "वार्ड जोड़ें, संपादित करें और प्रबंधित करें", icon: Map },
  { to: "/users", title: "यूजर मैनेजमेंट", detail: "एडमिन और स्टाफ अकाउंट प्रबंधन", icon: Users },
  { to: "/audit", title: "Audit Log", detail: "सिस्टम में हुए बदलावों का रिकॉर्ड", icon: ScrollText },
  { to: "/build-manager", title: "Build Manager", detail: "वेबसाइट बिल्ड और डिप्लॉयमेंट", icon: Hammer },
  { to: "/website-health", title: "Website Health", detail: "वेबसाइट की स्थिति और मॉनिटरिंग", icon: Activity },
  { to: "/reports", title: "वार्ड रिपोर्ट", detail: "वार्डवार रिपोर्ट देखें", icon: BarChart3 },
];

function AdminPanel() {
  return <AppShell title="Admin Panel">
    <div className="mb-5"><h2 className="text-lg font-semibold">प्रशासनिक नियंत्रण केंद्र</h2><p className="text-sm text-muted-foreground">वार्ड की मतदाता सूची हटाने सहित सभी एडमिन सुविधाएँ यहाँ उपलब्ध हैं।</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map((item) => <Link key={item.to} to={item.to} className="block">
        <Card className={`h-full p-4 transition-colors hover:border-primary/50 hover:bg-muted/40 ${item.danger ? "border-destructive/50" : ""}`}>
          <div className="flex items-start gap-3"><div className={`rounded-lg p-2 ${item.danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><item.icon className="h-5 w-5" /></div><div><div className="font-semibold">{item.title}</div><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div></div>
        </Card>
      </Link>)}
    </div>
  </AppShell>;
}
