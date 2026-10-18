import { ClubError } from "./types";
import { getRates } from "./fx";

/**
 * Payment gateway. With a Stripe TEST key (sk_test_…) payments go through Stripe Checkout;
 * without one the built-in sandbox confirms them, so the flow can be demonstrated anywhere.
 * Live keys are refused on purpose: this is a demo and must never move real money.
 */
export type Provider = "stripe" | "sandbox";
const key = () => process.env.STRIPE_SECRET_KEY?.trim() ?? "";
export function provider(): Provider {
  return key().startsWith("sk_test_") ? "stripe" : "sandbox";
}
export function assertNotLive() {
  if (key().startsWith("sk_live_") || key().startsWith("rk_live_"))
    throw new ClubError(503, "مفتاح Stripe حقيقي؛ سقفي يقبل مفاتيح الاختبار فقط", "A live Stripe key is configured; Saqfi only accepts test keys.");
}

/** Stripe test accounts settle in USD everywhere, so the KWD amount is charged in USD at today's rate. */
export async function chargeQuote(amountKwd: number) {
  if (provider() === "sandbox") return { chargeAmount: amountKwd, chargeCurrency: "KWD" };
  const { rates } = await getRates();
  const usd = rates.USD;
  if (!usd) throw new ClubError(503, "سعر الدولار مو متوفر الحين", "USD rate unavailable right now.");
  return { chargeAmount: Math.round(amountKwd * usd * 100) / 100, chargeCurrency: "USD" };
}

async function stripe(path: string, init: { method: "GET" | "POST"; form?: Record<string, string> }) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method,
    headers: { authorization: `Bearer ${key()}`, ...(init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: init.form ? new URLSearchParams(init.form).toString() : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json() as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new ClubError(502, "بوابة الدفع رفضت الطلب", `Stripe: ${body.error?.message ?? res.status}`);
  return body;
}

export async function createCheckout(o: { paymentId: string; name: string; chargeAmount: number; successUrl: string; cancelUrl: string }) {
  const s = await stripe("checkout/sessions", { method: "POST", form: {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(o.chargeAmount * 100)),
    "line_items[0][price_data][product_data][name]": o.name.slice(0, 200),
    success_url: o.successUrl, cancel_url: o.cancelUrl,
    client_reference_id: o.paymentId, "metadata[paymentId]": o.paymentId,
  } });
  return { id: String(s.id), url: String(s.url) };
}

/** Verify on the server that Stripe really took the money for this payment. */
export async function verifyCheckout(sessionId: string, paymentId: string, chargeAmount: number) {
  if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) throw new ClubError(400, "مرجع الدفع غير صالح", "Invalid payment reference.");
  const s = await stripe(`checkout/sessions/${sessionId}`, { method: "GET" }) as {
    payment_status?: string; amount_total?: number; metadata?: { paymentId?: string }; payment_intent?: string };
  if (s.metadata?.paymentId !== paymentId) throw new ClubError(400, "الدفع لا يخص هذه العملية", "Payment does not belong to this operation.");
  if (s.payment_status !== "paid") throw new ClubError(402, "الدفع ما اكتمل", "Payment was not completed.");
  if (s.amount_total !== Math.round(chargeAmount * 100)) throw new ClubError(400, "مبلغ الدفع غير مطابق", "Paid amount does not match.");
  return { reference: String(s.payment_intent ?? sessionId) };
}
