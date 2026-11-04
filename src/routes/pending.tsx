import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusList } from "@/components/StatusList";

export const Route = createFileRoute("/pending")({
  head: () => ({
    meta: [
      { title: "Pending सूची — बाकी मतदाता" },
      { name: "description", content: "वार्ड वार उन मतदाताओं की सूची जिनकी मतदान उपस्थिति अभी दर्ज नहीं हुई।" },
      { property: "og:title", content: "Pending मतदाता सूची" },
      { property: "og:description", content: "Ward wise pending voter list." },
    ],
  }),
  component: () => <AppShell title="Pending सूची"><StatusList voted={false} /></AppShell>,
});
