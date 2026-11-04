import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Lock, User } from "lucide-react";
import { btnPrimary, inputCls } from "@/components/AppShell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "लॉगिन — वार्ड वार मतदाता प्रबंधन" },
      { name: "description", content: "अधिकृत एडमिन और यूजर के लिए लॉगिन।" },
      { property: "og:title", content: "लॉगिन — मतदाता प्रबंधन" },
      { property: "og:description", content: "Authorized login for ward management." },
    ],
  }),
  component: Login,
});

function Login() {
  return (
    <div className="bg-hero flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-card">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent"><ShieldCheck className="h-7 w-7 text-accent-foreground" /></div>
          <h1 className="text-2xl font-bold">मतदाता प्रबंधन प्रणाली</h1>
          <p className="text-sm text-muted-foreground">Ward Wise Voter Management</p>
        </div>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
          <label className="block text-sm font-medium">लॉगिन ID
            <div className="relative mt-1"><User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} placeholder="अपनी लॉगिन ID दर्ज करें" autoComplete="username" disabled /></div>
          </label>
          <label className="block text-sm font-medium">पासवर्ड
            <div className="relative mt-1"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input type="password" className={inputCls + " pl-9"} placeholder="पासवर्ड दर्ज करें" autoComplete="current-password" disabled /></div>
          </label>
          <button type="button" disabled className={btnPrimary + " w-full"}>लॉगिन अभी उपलब्ध नहीं</button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">सुरक्षित यूजर लॉगिन सेवा सेट होने के बाद ही लॉगिन चालू होगा। डेमो पासवर्ड हटा दिए गए हैं।</p>
      </div>
    </div>
  );
}
