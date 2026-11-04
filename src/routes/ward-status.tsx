import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock } from "lucide-react";
import { AppShell, Card, WardSelect } from "@/components/AppShell";
import { StatusList } from "@/components/StatusList";

export const Route = createFileRoute("/ward-status")({
  head: () => ({
    meta: [
      { title: "वार्डवार वोट स्थिति — Voted और Pending सूची" },
      { name: "description", content: "चुने हुए वार्ड की Voted और Pending मतदाता सूचियाँ अलग-अलग देखें।" },
    ],
  }),
  component: WardWiseStatus,
});

function WardWiseStatus() {
  const [ward, setWard] = useState(0);

  return (
    <AppShell title="वार्डवार वोट स्थिति">
      <Card className="mb-5 p-4">
        <div className="mb-2 text-sm font-semibold">वार्ड चुनें</div>
        <WardSelect value={ward} onChange={setWard} />
        <p className="mt-2 text-xs text-muted-foreground">
          {ward === 0 ? "सभी सक्रिय वार्डों की अलग-अलग Voted और Pending सूचियाँ नीचे दिखाई जाएँगी।" : `वार्ड ${ward} की दोनों सूचियाँ नीचे अलग-अलग दिखाई जाएँगी।`}
        </p>
      </Card>

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <h2 className="text-lg font-bold">Voted सूची — मतदान कर चुके मतदाता</h2>
        </div>
        <StatusList key={`ward-${ward}-voted`} voted initialWard={ward} showWardSelect={false} />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-bold">Pending सूची — जिनका वोट बाकी है</h2>
        </div>
        <StatusList key={`ward-${ward}-pending`} voted={false} initialWard={ward} showWardSelect={false} />
      </section>
    </AppShell>
  );
}
