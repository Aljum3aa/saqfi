import mongoose from "mongoose";
import { Season } from "./models";
import { seedClub } from "./seed";
import { ClubError, type Club } from "./types";
import { enforce, normalize } from "./finance";
import { logger } from "../lib/logger";

let memory: Club | undefined;
export let dataMode: "demo" | "database" = "demo";
export async function initializeStore() {
  if (!process.env.MONGODB_URI) {
    memory = seedClub();
    enforce(memory);
    logger.info("Saqfi: explicit in-memory demo mode; data resets on restart");
    return;
  }
  // Never fall back to demo on an invalid URI or an outage: fail explicitly.
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Season.init();
  const found = await Season.findOne({ id: "saqfi-demo-club" }).lean();
  if (!found) {
    if (await Season.countDocuments({}) !== 0)
      throw new Error("Saqfi database is not empty and has no matching season; refusing to seed.");
    const seed = seedClub();
    enforce(seed);
    // Upsert is race-safe on the unique season ID, and never overwrites data.
    await Season.updateOne({ id: seed.id }, { $setOnInsert: seed }, { upsert: true });
  }
  dataMode = "database";
  logger.info("Saqfi: MongoDB data mode");
}
export async function readClub(): Promise<Club> {
  if (dataMode === "demo") return normalize(structuredClone(memory!));
  const doc = await Season.findOne({ id: "saqfi-demo-club" }).lean();
  if (!doc) throw new ClubError(503, "تعذر تحميل بيانات النادي", "Club data unavailable.");
  return normalize(JSON.parse(JSON.stringify(doc)) as Club);
}
export async function mutateClub(action: (club: Club) => void | Promise<void>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const club = await readClub();
    const revision = club.revision;
    await action(club);
    enforce(club);
    club.revision++;
    if (dataMode === "demo") {
      if (memory!.revision !== revision) continue;
      memory = club;
      return;
    }
    const { id, revision: newRevision, club: name, clubEn, seasonStart, seasonEnd,
      totalBudget, categories, contracts, payrolls, transactions,
      adjustments, matches, bonusRules, approvalThreshold, requests, market, payments, wallet, invoices, installments, advances } = club;
    const audit = club.audit.slice(-500);
    const result = await Season.updateOne({ id, revision }, {
      $set: { revision: newRevision, club: name, clubEn, seasonStart, seasonEnd, totalBudget,
        categories, contracts, payrolls, transactions,
        adjustments, matches, bonusRules, approvalThreshold, requests, audit, market, payments, wallet, invoices, installments, advances },
    }, { runValidators: true });
    if (result.modifiedCount === 1) return;
  }
  throw new ClubError(409, "تغيرت البيانات أثناء العملية؛ أعد المحاولة", "Data changed during the operation. Please retry.");
}
