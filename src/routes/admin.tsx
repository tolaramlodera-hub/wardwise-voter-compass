import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Card } from "@/components/AppShell";
import { Activity, BarChart3, ClipboardList, Database, Hammer, Map, ScrollText, Users } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPanel });

const sections = [
  { to: "/wards", title: "वार्ड मैनेजमेंट", detail: "वार्ड जोड़ें, संपादित करें और प्रबंधित करें", icon: Map },
  { to: "/data-admin", title: "डेटा प्रबंधन", detail: "मतदाता डेटा और आयात प्रबंधन", icon: Database },
  { to: "/users", title: "यूजर मैनेजमेंट", detail: "एडमिन और स्टाफ अकाउंट प्रबंधन", icon: Users },
  { to: "/audit", title: "Audit Log", detail: "सिस्टम में हुए बदलावों का रिकॉर्ड", icon: ScrollText },
  { to: "/build-manager", title: "Build Manager", detail: "वेबसाइट बिल्ड और डिप्लॉयमेंट", icon: Hammer },
  { to: "/website-health", title: "Website Health", detail: "वेबसाइट की स्थिति और मॉनिटरिंग", icon: Activity },
  { to: "/reports", title: "वार्ड रिपोर्ट", detail: "वार्डवार रिपोर्ट देखें", icon: BarChart3 },
  { to: "/events", title: "Event Management", detail: "कार्यक्रम और कॉलिंग प्रबंधन", icon: ClipboardList },
];

function AdminPanel() {
  return <AppShell title="Admin Panel">
    <div className="mb-5"><h2 className="text-lg font-semibold">प्रशासनिक नियंत्रण केंद्र</h2><p className="text-sm text-muted-foreground">सभी एडमिन सुविधाएँ एक ही जगह से खोलें।</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map((item) => <Link key={item.to} to={item.to} className="block">
        <Card className="h-full p-4 transition-colors hover:border-primary/50 hover:bg-muted/40">
          <div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><item.icon className="h-5 w-5" /></div><div><div className="font-semibold">{item.title}</div><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div></div>
        </Card>
      </Link>)}
    </div>
  </AppShell>;
}
