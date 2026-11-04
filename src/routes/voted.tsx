import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusList } from "@/components/StatusList";

export const Route = createFileRoute("/voted")({
  head: () => ({
    meta: [
      { title: "Voted सूची — मतदान कर चुके मतदाता" },
      { name: "description", content: "वार्ड वार मतदान उपस्थिति दर्ज मतदाताओं की सूची, एंट्री करने वाले यूजर और समय सहित।" },
      { property: "og:title", content: "Voted सूची" },
      { property: "og:description", content: "Ward wise voted list with entry user and time." },
    ],
  }),
  component: () => <AppShell title="Voted सूची"><StatusList voted /></AppShell>,
});
