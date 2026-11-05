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
        <div className="grid grid-cols-7 gap-2" role="group" aria-label="वार्ड चुनें">
          {Array.from({ length: 7 }, (_, index) => index + 1).map((number) => (
            <button
              key={number}
              type="button"
              aria-pressed={ward === number}
              onClick={() => setWard(number)}
              className={`flex h-11 min-w-0 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                ward === number
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:bg-secondary"
              }`}
            >
              {number}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{ward === 0 ? "अभी सभी वार्ड दिख रहे हैं" : `चयनित: वार्ड ${ward}`}</span>
          {ward !== 0 && <button type="button" className="text-xs font-medium text-primary underline underline-offset-4" onClick={() => setWard(0)}>सभी वार्ड</button>}
        </div>
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
