import { useSyncExternalStore } from "react";

// Preview-only store. No sample or fabricated voter records are loaded.
// The voter list stays empty until an authorized, official list is imported.
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

export const wards: Ward[] = Array.from({ length: 12 }, (_, i) => ({
  number: i + 1,
  name: `वार्ड ${i + 1}`,
  booth: `बूथ ${101 + i}`,
}));

// No dummy voters: the list is intentionally empty before official import.
const initialVoters: Voter[] = [];

export const users: AppUser[] = [
  { id: "1", name: "मुख्य एडमिन", loginId: "admin", role: "Admin", wards: wards.map((w) => w.number), active: true, lastLogin: "—" },
  { id: "2", name: "रमेश कुमार", loginId: "user1", role: "User", wards: [1, 2, 3], active: true, lastLogin: "—" },
  { id: "3", name: "सुनीता देवी", loginId: "user2", role: "User", wards: [4, 5, 6], active: true, lastLogin: "—" },
  { id: "4", name: "अजय मीणा", loginId: "user3", role: "User", wards: [7, 8, 9], active: true, lastLogin: "—" },
  { id: "5", name: "पूजा शर्मा", loginId: "user4", role: "User", wards: [10, 11, 12], active: false, lastLogin: "—" },
];

let state: { voters: Voter[]; audit: Audit[] } = { voters: initialVoters, audit: [] };
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
    audit: [{ time: t, user: by, action: "मतदान उपस्थिति", detail: `मतदाता रिकॉर्ड ${v.id} — वार्ड ${v.ward}` }, ...state.audit],
  };
  emit();
  return true;
}

export function revertVote(id: string) {
  const v = state.voters.find((x) => x.id === id);
  if (!v?.votedAt) return;
  const t = now();
  state = {
    voters: state.voters.map((x) => (x.id === id ? ({ ...x, votedAt: undefined, votedBy: undefined } as Voter) : x)),
    audit: [{ time: t, user: "admin", action: "एंट्री वापस", detail: `मतदाता रिकॉर्ड ${v.id} की एंट्री हटाई` }, ...state.audit],
  };
  emit();
}

export function wardStats(voters: Voter[], ward?: number) {
  const list = ward ? voters.filter((v) => v.ward === ward) : voters;
  const voted = list.filter((v) => v.votedAt).length;
  return { total: list.length, voted, pending: list.length - voted, pct: list.length ? Math.round((voted / list.length) * 1000) / 10 : 0 };
}
