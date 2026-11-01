// Questions the chat can answer without writing anything: "kal ka total", "kitna udhaar", "Sharma ka hisaab".
// Pure and total: never throws, linear time (no nested quantifiers), so it is safe on any pasted text.
export type ChatQuestion =
  | { type: 'day'; offset: number }   // 0 today, -1 yesterday
  | { type: 'udhaar' }                // everyone who owes the shop
  | { type: 'party'; name: string };  // one customer's balance

const YESTERDAY = /\b(kal|yesterday|beeta hua kal|bita hua kal)\b|कल/i;
const ASK = /kitna|kitni|total|hisab|hisaab|summary|kaisa|kaisi|how much|balance|baaki|baki|bacha|कितना|हिसाब|टोटल|बाकी/i;
const UDHAAR = /udhaar|udhar|credit|baaki|baki|उधार|बाकी/i;
// "<name> ka hisaab", "Sharma ka udhaar kitna", "hisaab of Sharma", "Sharma balance"
const PARTY = /^(.{1,40}?)\s+(?:ka|ki|ke|का|की|के)\s+(?:hisab|hisaab|udhaar|udhar|baaki|baki|balance|हिसाब|उधार|बाकी)\b/i;
const PARTY_OF = /^(?:hisab|hisaab|balance|udhaar|हिसाब)\s+(?:of|for|ka|की|का)\s+(.{1,40})$/i;
const STOP = new Set(['kal', 'aaj', 'ka', 'ki', 'ke', 'mera', 'meri', 'sabka', 'total', 'sab', 'kul', 'the', 'my', 'all', 'yesterday', 'today']);

export function readQuestion(text: unknown): ChatQuestion | null {
  if (typeof text !== 'string') return null;
  const s = text.trim().slice(0, 200);
  if (!s || /\d/.test(s.replace(/[०-९]/g, '0')) && !/^[^\d]*\d{0,2}\s*(din|day)/i.test(s)) return null; // amounts belong to the reader
  const low = s.toLowerCase().replace(/[?!.।]+$/g, '').trim();
  const m = PARTY.exec(low) ?? PARTY_OF.exec(low);
  if (m) {
    const name = m[1].trim();
    const words = name.split(/\s+/);
    if (name && !words.every((w) => STOP.has(w))) return { type: 'party', name };
  }
  if (UDHAAR.test(low) && ASK.test(low)) return { type: 'udhaar' };
  if (ASK.test(low) || /^(aaj|today|kal|yesterday|कल|आज)\b/.test(low)) return { type: 'day', offset: YESTERDAY.test(low) ? -1 : 0 };
  return null;
}

export type Party = { party: string; balance: number };
// Customers whose name contains the typed name (case-insensitive); exact match wins.
export function findParty(list: Party[], name: string): Party[] {
  const n = name.trim().toLowerCase();
  if (!n) return [];
  const exact = list.filter((p) => p.party.toLowerCase() === n);
  return exact.length ? exact : list.filter((p) => p.party.toLowerCase().includes(n));
}
