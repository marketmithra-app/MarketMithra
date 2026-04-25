/**
 * Stable anonymous device id, stored in localStorage.
 * Lets us track pre-auth votes so they can be reconciled to a user on sign-in.
 */
const KEY = "mm_anon_id";

export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

type LocalJudgement = {
  symbol: string;
  verdict: "BUY" | "HOLD" | "SELL";
  probability: number;
  vote: "agree" | "disagree";
  asOf: string;
  createdAt: string;
};

const LOCAL_KEY = "mm_judgements";

export function readLocalJudgements(): LocalJudgement[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function appendLocalJudgement(j: LocalJudgement): void {
  if (typeof window === "undefined") return;
  const all = readLocalJudgements();
  all.push(j);
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(all.slice(-500)));
}

export function latestLocalVote(symbol: string, asOf: string): "agree" | "disagree" | null {
  const all = readLocalJudgements();
  for (let i = all.length - 1; i >= 0; i--) {
    const j = all[i];
    if (j.symbol === symbol && j.asOf === asOf) return j.vote;
  }
  return null;
}
