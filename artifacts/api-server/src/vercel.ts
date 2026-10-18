import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { initializeStore } from "./saqfi/store";

/* Vercel serverless entry: connect the store once per instance, then hand the request to Express. */
let ready: Promise<void> | undefined;
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= initializeStore().catch((e) => { ready = undefined; throw e; });
  try { await ready; }
  catch {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "تعذر الاتصال بقاعدة البيانات", errorEn: "Database unavailable." }));
    return;
  }
  return (app as unknown as (q: IncomingMessage, s: ServerResponse) => void)(req, res);
}
