import { addDays, istDateTime, weekdayOf } from "../../src/lib/dates";
import { FEMALE_FIRST_NAMES, type SeedPerson } from "./data";

/** Small deterministic PRNG so every seed run produces the same demo company. */
export function randomFor(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const BLOOD = ["O+", "B+", "A+", "AB+", "O-", "B-", "A-", "AB-"] as const;
const IFSC = ["HDFC0001234", "ICIC0004321", "SBIN0001234", "PUNB0123400"];
const KIN = [["Rakesh", "Father"], ["Sunita", "Mother"], ["Anil", "Father"], ["Kiran", "Mother"], ["Aarti", "Spouse"], ["Rohit", "Sibling"]] as const;

/** Plausible, format-valid (and entirely fake) personal and bank details for a seed person. */
export function profileFor(p: SeedPerson, index: number) {
  const [first, ...rest] = p.name.split(" ");
  const last = rest.join(" ");
  const rand = randomFor(`profile-${p.name}`);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const kin = pick(KIN);
  const sector = 60 + (index % 20);
  return {
    phone: `+9198${pad(10000000 + ((index * 7919) % 89999999), 8)}`,
    personalEmail: `${first.toLowerCase()}.${last.toLowerCase().replace(/\s+/g, "")}${index}@example.com`,
    dateOfBirth: `${1978 + ((index * 7) % 27)}-${pad(1 + ((index * 5) % 12))}-${pad(1 + ((index * 11) % 28))}`,
    gender: FEMALE_FIRST_NAMES.has(first) ? "FEMALE" : "MALE",
    bloodGroup: BLOOD[index % BLOOD.length],
    currentAddress: `House ${100 + index}, Sector ${sector}, Mohali, Punjab 160062`,
    permanentAddress: index % 3 === 0 ? `House ${100 + index}, Sector ${sector}, Mohali, Punjab 160062` : `${12 + index} Model Town, Ludhiana, Punjab 141002`,
    emergencyName: `${kin[0]} ${last}`,
    emergencyRelation: kin[1],
    emergencyPhone: `+9197${pad(20000000 + ((index * 104729) % 79999999), 8)}`,
    bankHolder: p.name,
    bankAccount: pad((31415926535 + index * 104729) % 1e12, 12),
    bankIfsc: IFSC[index % IFSC.length],
    pan: `${LETTERS[index % 24]}${LETTERS[(index * 3 + 1) % 24]}${LETTERS[(index * 5 + 2) % 24]}P${LETTERS[(index * 7 + 3) % 24]}${pad(1000 + ((index * 37) % 9000), 4)}${LETTERS[(index * 11 + 4) % 24]}`,
    aadhaar: String(234512340000 + index * 7777),
  };
}

export type SeedEvent = { employeeId: string; workDate: string; at: Date; kind: string; source: string };

/**
 * One person's attendance for one past working day: mostly full days, some short or half days,
 * the odd absence or forgotten check-out, with a lunch break.
 */
export function dayEvents(employeeId: string, code: string, date: string): SeedEvent[] {
  const rand = randomFor(`${code}-${date}`);
  const r = rand();
  if (r < 0.02) return []; // absent
  const at = (minutesAfterNine: number) => new Date(istDateTime(date, "09:00").getTime() + minutesAfterNine * 60000);
  const start = Math.floor(rand() * 75);
  const ev = (kind: string, minute: number): SeedEvent => ({ employeeId, workDate: date, at: at(minute), kind, source: "WEB" });
  if (r < 0.03) return [ev("IN", start)]; // forgot to check out
  const worked = r < 0.11 ? 450 + Math.floor(rand() * 70) : r < 0.13 ? 180 + Math.floor(rand() * 80) : 540 + Math.floor(rand() * 40);
  if (worked < 300) return [ev("IN", start), ev("OUT", start + worked)];
  const lunch = 240 + Math.floor(rand() * 40) - 20; // around 13:00
  const breakLength = 25 + Math.floor(rand() * 20);
  return [ev("IN", start), ev("BREAK_START", lunch), ev("BREAK_END", lunch + breakLength), ev("OUT", start + worked + breakLength)];
}

/** Working days (not weekends, not holidays) from `from` up to but excluding `until`. */
export function workingDaysBetween(from: string, until: string, weekend: number[], holidays: Set<string>): string[] {
  const out: string[] = [];
  for (let d = from; d < until; d = addDays(d, 1)) {
    if (!weekend.includes(weekdayOf(d)) && !holidays.has(d)) out.push(d);
  }
  return out;
}
