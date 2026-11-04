import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Lock, User } from "lucide-react";
import { btnPrimary, inputCls } from "@/components/AppShell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "लॉगिन — वार्ड वार मतदाता प्रबंधन" },
      { name: "description", content: "एडमिन और अधिकृत यूजर के लिए सुरक्षित लॉगिन।" },
      { property: "og:title", content: "लॉगिन — मतदाता प्रबंधन" },
      { property: "og:description", content: "Secure login for admin and ward users." },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  return (
    <div className="bg-hero flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-card">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent"><ShieldCheck className="h-7 w-7 text-accent-foreground" /></div>
          <h1 className="text-2xl font-bold">मतदाता प्रबंधन प्रणाली</h1>
          <p className="text-sm text-muted-foreground">Ward Wise Voter Management</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); nav({ to: "/" }); }} className="space-y-3">
          <label className="block text-sm font-medium">लॉगिन ID
            <div className="relative mt-1"><User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input className={inputCls + " pl-9"} placeholder="admin" defaultValue="admin" /></div>
          </label>
          <label className="block text-sm font-medium">पासवर्ड
            <div className="relative mt-1"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input type="password" className={inputCls + " pl-9"} defaultValue="preview" /></div>
          </label>
          <button className={btnPrimary + " w-full"}>लॉगिन करें</button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">नया अकाउंट केवल मुख्य एडमिन बना सकते हैं।</p>
      </div>
    </div>
  );
}
