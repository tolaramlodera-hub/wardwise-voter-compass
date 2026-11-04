import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, KeyRound, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, btnPrimary, btnOutline, inputCls } from "@/components/AppShell";
import { users as initial, wards, type AppUser } from "@/lib/mock-data";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "यूजर मैनेजमेंट — केवल एडमिन" },
      { name: "description", content: "यूजर बनाएं, पासवर्ड रीसेट करें, वार्ड की जिम्मेदारी दें और एक्टिव/डिसेबल करें।" },
      { property: "og:title", content: "यूजर मैनेजमेंट" },
      { property: "og:description", content: "Admin-only user and ward assignment management." },
    ],
  }),
  component: Users,
});

function Users() {
  const [list, setList] = useState<AppUser[]>(initial);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (id: string) => setList((l) => l.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));

  return (
    <AppShell title="यूजर मैनेजमेंट">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">नया यूजर केवल मुख्य एडमिन बना सकते हैं।</p>
        <button className={btnPrimary} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> नया यूजर</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{u.name} <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{u.role}</span></div>
                <div className="font-mono text-xs text-muted-foreground">ID: {u.loginId}</div>
              </div>
              {u.role === "User" && (
                <button onClick={() => toggle(u.id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${u.active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{u.active ? "Active" : "Disabled"}</button>
              )}
            </div>
            <div className="mt-2 text-sm">वार्ड: {u.role === "Admin" ? "सभी" : u.wards.join(", ")}</div>
            <div className="text-xs text-muted-foreground">अंतिम लॉगिन: {u.lastLogin}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnOutline} onClick={() => toast.success(`${u.loginId} का पासवर्ड रीसेट लिंक बनेगा (अगले चरण में)`)}><KeyRound className="h-3.5 w-3.5" /> पासवर्ड रीसेट</button>
            </div>
          </Card>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setList((l) => [...l, { id: String(Date.now()), name: String(f.get("name")), loginId: String(f.get("login")), role: "User", wards: sel, active: true, lastLogin: "—" }]);
            setOpen(false); setSel([]); toast.success("नया यूजर बनाया गया");
          }} className="w-full max-w-md space-y-3 rounded-t-2xl bg-card p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">नया यूजर बनाएं</h2><button type="button" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <input required name="name" className={inputCls} placeholder="यूजर का नाम" />
            <input required name="login" className={inputCls} placeholder="लॉगिन ID" />
            <input required type="password" name="pass" className={inputCls} placeholder="पासवर्ड सेट करें" />
            <div>
              <div className="mb-1 text-sm font-medium">वार्ड की जिम्मेदारी</div>
              <div className="grid grid-cols-6 gap-1.5">
                {wards.map((w) => (
                  <button type="button" key={w.number} onClick={() => setSel((s) => (s.includes(w.number) ? s.filter((x) => x !== w.number) : [...s, w.number]))} className={`h-9 rounded-md border text-sm ${sel.includes(w.number) ? "bg-primary text-primary-foreground" : ""}`}>{w.number}</button>
                ))}
              </div>
            </div>
            <button className={btnPrimary + " w-full"}>यूजर बनाएं</button>
          </form>
        </div>
      )}
    </AppShell>
  );
}
