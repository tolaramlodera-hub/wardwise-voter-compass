import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Card } from "@/components/AppShell";
import { useStore } from "@/lib/mock-data";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — सभी गतिविधियाँ" },
      { name: "description", content: "सभी यूजर की लॉगिन, एंट्री और बदलाव का सुरक्षित रिकॉर्ड।" },
      { property: "og:title", content: "Audit Log" },
      { property: "og:description", content: "Complete activity record of all users." },
    ],
  }),
  component: Audit,
});

function Audit() {
  const { audit } = useStore();
  return (
    <AppShell title="Audit Log">
      <Card>
        <ul className="divide-y">
          {audit.map((a, i) => (
            <li key={i} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{a.time}</span>
              <span className="w-20 shrink-0 text-sm font-semibold">{a.user}</span>
              <span className="w-fit rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">{a.action}</span>
              <span className="text-sm">{a.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
