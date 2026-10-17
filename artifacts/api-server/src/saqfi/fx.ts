import { ClubError } from "./types";

/** Currencies a Kuwaiti club usually pays in: camps, transfers, kit suppliers. */
export const CURRENCIES = ["KWD", "USD", "EUR", "GBP", "SAR", "AED", "QAR", "BHD", "OMR", "EGP", "TRY"] as const;
export type Currency = (typeof CURRENCIES)[number];

type Rates = { rates: Record<string, number>; updated: string; source: string; fetchedAt: number };
let cache: Rates | undefined;
const TTL = 60 * 60 * 1000;

/**
 * Live rates from the free ExchangeRate-API (open.er-api.com, no key), base KWD.
 * Cached for an hour. If the service is down we keep the last good rates; with none at all we refuse
 * rather than invent a rate, because a wrong rate would put a wrong amount in the ledger.
 */
export async function getRates(): Promise<Rates> {
  if (cache && Date.now() - cache.fetchedAt < TTL) return cache;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/KWD", { signal: AbortSignal.timeout(8000) });
    const body = await res.json() as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (body.result !== "success" || !body.rates) throw new Error("bad response");
    const rates: Record<string, number> = {};
    for (const c of CURRENCIES) if (typeof body.rates[c] === "number" && body.rates[c] > 0) rates[c] = body.rates[c];
    cache = { rates, updated: body.time_last_update_utc ?? "", source: "ExchangeRate-API", fetchedAt: Date.now() };
    return cache;
  } catch {
    if (cache) return cache;
    throw new ClubError(503, "تعذر جلب أسعار الصرف الحين؛ سجّل المبلغ بالدينار أو حاول بعد شوي",
      "Exchange rates are unavailable right now. Enter the amount in KWD or retry shortly.");
  }
}

/** Convert a foreign amount to KWD (rounded to the fil). rate = units of currency per 1 KWD. */
export async function toKwd(amount: number, currency: string) {
  if (currency === "KWD") return { kwd: amount, rate: 1 };
  if (!(CURRENCIES as readonly string[]).includes(currency))
    throw new ClubError(400, "العملة غير مدعومة", "Unsupported currency.");
  const { rates } = await getRates();
  const rate = rates[currency];
  if (!rate) throw new ClubError(503, "سعر هالعملة مو متوفر الحين", "No rate for this currency right now.");
  return { kwd: Math.round((amount / rate) * 1000) / 1000, rate };
}
