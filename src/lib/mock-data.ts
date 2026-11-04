import { useSyncExternalStore } from "react";

// PREVIEW ONLY: in-memory sample data. Real data + secure backend come after approval.
export type Voter = {
  id: string;
  name: string;
  relative: string;
  age: number;
  gender: "पुरुष" | "महिला";
  house: string;
  voterId: string;
  ward: number;
  votedAt?: string | undefined;
  votedBy?: string | undefined;
};
export type Ward = { number: number; name: string; booth: string };
export type AppUser = { id: string; name: string; loginId: string; role: "Admin" | "User"; wards: number[]; active: boolean; lastLogin: string };
export type Audit = { time: string; user: string; action: string; detail: string };

const first = ["राम", "सीता", "मोहन", "गीता", "सुरेश", "कमला", "राजेश", "सुनीता", "अजय", "पूजा", "विजय", "रेखा", "दिनेश", "आशा", "महेश", "किरण"];
const last = ["शर्मा", "वर्मा", "सिंह", "यादव", "गुप्ता", "मीणा", "जाट", "कुमावत"];
const fathers = ["रामलाल", "श्यामलाल", "हरिप्रसाद", "गोपाल", "भंवरलाल", "किशनलाल", "बद्रीनारायण", "मांगीलाल"];

export const wards: Ward[] = Array.from({ length: 12 }, (_, i) => ({
  number: i + 1,
  name: `वार्ड ${i + 1}`,
  booth: `बूथ ${101 + i}`,
}));

function seeded(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

const initialVoters: Voter[] = [];
let k = 1;
for (const w of wards) {
  const count = 40 + Math.floor(seeded(w.number) * 30);
  for (let j = 0; j < count; j++) {
    const r = seeded(k * 7);
    const f = first[Math.floor(r * first.length)];
    const female = ["सीता", "गीता", "कमला", "सुनीता", "पूजा", "रेखा", "आशा", "किरण"].includes(f);
    const voted = seeded(k * 13) < 0.45;
    initialVoters.push({
      id: String(k),
      name: `${f} ${last[Math.floor(seeded(k * 3) * last.length)]}`,
      relative: fathers[Math.floor(seeded(k * 5) * fathers.length)],
      age: 18 + Math.floor(seeded(k * 11) * 62),
      gender: female ? "महिला" : "पुरुष",
      house: `${w.number}-${1 + Math.floor(j / 3)}`,
      voterId: `RJX${String(1000000 + k * 37).slice(0, 7)}`,
      ward: w.number,
      ...(voted ? { votedAt: `04-11-2026 ${String(8 + (k % 8)).padStart(2, "0")}:${String((k * 7) % 60).padStart(2, "0")}`, votedBy: `user${(w.number % 4) + 1}` } : {}),
    });
    k++;
  }
}

export const users: AppUser[] = [
  { id: "1", name: "मुख्य एडमिन", loginId: "admin", role: "Admin", wards: wards.map((w) => w.number), active: true, lastLogin: "04-11-2026 08:02" },
  { id: "2", name: "रमेश कुमार", loginId: "user1", role: "User", wards: [1, 2, 3], active: true, lastLogin: "04-11-2026 08:10" },
  { id: "3", name: "सुनीता देवी", loginId: "user2", role: "User", wards: [4, 5, 6], active: true, lastLogin: "04-11-2026 08:15" },
  { id: "4", name: "अजय मीणा", loginId: "user3", role: "User", wards: [7, 8, 9], active: true, lastLogin: "04-11-2026 08:21" },
  { id: "5", name: "पूजा शर्मा", loginId: "user4", role: "User", wards: [10, 11, 12], active: false, lastLogin: "03-11-2026 17:40" },
];

let state = { voters: initialVoters, audit: [
  { time: "04-11-2026 08:02", user: "admin", action: "लॉगिन", detail: "एडमिन लॉगिन सफल" },
  { time: "04-11-2026 08:10", user: "user1", action: "लॉगिन", detail: "वार्ड 1, 2, 3" },
  { time: "04-11-2026 08:34", user: "user1", action: "मतदान उपस्थिति", detail: "वोटर ID RJX1000037 — वार्ड 1" },
  { time: "04-11-2026 08:40", user: "admin", action: "यूजर डिसेबल", detail: "user4 को डिसेबल किया" },
  { time: "04-11-2026 09:05", user: "admin", action: "एंट्री वापस", detail: "वोटर ID RJX1000148 की गलत एंट्री हटाई" },
] as Audit[] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useStore() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}

function now() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function markVoted(id: string, by = "admin") {
  const v = state.voters.find((x) => x.id === id);
  if (!v || v.votedAt) return false; // no duplicate entry
  const t = now();
  state = {
    voters: state.voters.map((x) => (x.id === id ? { ...x, votedAt: t, votedBy: by } : x)),
    audit: [{ time: t, user: by, action: "मतदान उपस्थिति", detail: `वोटर ID ${v.voterId} — वार्ड ${v.ward}` }, ...state.audit],
  };
  emit();
  return true;
}

export function revertVote(id: string) {
  const v = state.voters.find((x) => x.id === id);
  if (!v?.votedAt) return;
  const t = now();
  state = {
    voters: state.voters.map((x) => (x.id === id ? { ...x, votedAt: undefined, votedBy: undefined } : x)),
    audit: [{ time: t, user: "admin", action: "एंट्री वापस", detail: `वोटर ID ${v.voterId} की एंट्री हटाई` }, ...state.audit],
  };
  emit();
}

export function wardStats(voters: Voter[], ward?: number) {
  const list = ward ? voters.filter((v) => v.ward === ward) : voters;
  const voted = list.filter((v) => v.votedAt).length;
  return { total: list.length, voted, pending: list.length - voted, pct: list.length ? Math.round((voted / list.length) * 1000) / 10 : 0 };
}
