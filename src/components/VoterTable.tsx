import type { ReactNode } from "react";
import type { Voter } from "@/lib/mock-data";

export function VoterTable({ voters, showVote, action }: { voters: Voter[]; showVote?: boolean | undefined; action?: ((v: Voter) => ReactNode) | undefined }) {
  if (!voters.length) return <div className="p-8 text-center text-sm text-muted-foreground">कोई मतदाता नहीं मिला</div>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              {["क्रमांक", "नाम", "पिता/पति", "उम्र", "लिंग", "मकान नं.", "वोटर ID", "वार्ड", ...(showVote ? ["एंट्री किसने", "समय"] : []), ...(action ? [""] : [])].map((h, i) => (
                <th key={i} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {voters.map((v) => (
              <tr key={v.id} className="border-t hover:bg-muted/50">
                <td className="px-4 py-2.5 tabular-nums">{v.serialNo ?? "—"}</td>
                <td className="px-4 py-2.5 font-medium">{v.name}</td>
                <td className="px-4 py-2.5">{v.relative}</td>
                <td className="px-4 py-2.5">{v.age}</td>
                <td className="px-4 py-2.5">{v.gender}</td>
                <td className="px-4 py-2.5">{v.house}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{v.voterId || "—"}</td>
                <td className="px-4 py-2.5">{v.ward}</td>
                {showVote && <><td className="px-4 py-2.5">{v.votedBy}</td><td className="px-4 py-2.5 text-xs">{v.votedAt}</td></>}
                {action && <td className="px-4 py-2.5 text-right">{action(v)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y md:hidden">
        {voters.map((v) => (
          <li key={v.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="font-semibold">{v.name}</div>
              <div className="text-xs text-muted-foreground">पिता/पति: {v.relative} · {v.age} वर्ष · {v.gender}</div>
              <div className="text-xs text-muted-foreground">मकान {v.house} · वार्ड {v.ward} · <span className="font-mono">{v.voterId || "—"}</span></div>
              {showVote && <div className="mt-1 text-xs text-success">✓ {v.votedBy} · {v.votedAt}</div>}
            </div>
            {action && <div className="shrink-0">{action(v)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
