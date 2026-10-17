import mongoose, { Schema } from "mongoose";

// One season aggregate is one atomic MongoDB document. All finance mutations use
// a revision compare-and-swap, so commitments and ledger cannot drift on races.
const options = { _id: false };
export const categorySchema = new Schema({
  id: { type: String, required: true }, name: String, nameEn: String,
  cap: { type: Number, required: true, min: 0 },
}, options);
export const contractSchema = new Schema({
  id: { type: String, required: true }, name: String, nameEn: String, position: String,
  salary: { type: Number, required: true, min: 0 }, start: String, end: String,
}, options);
export const payrollLineSchema = new Schema({
  playerId: String, name: String, salary: Number, bonus: Number, fine: Number, net: Number,
}, options);
export const payrollSchema = new Schema({
  id: String, month: String, total: Number, paidAt: String, lines: [payrollLineSchema],
}, options);
export const transactionSchema = new Schema({
  id: String, categoryId: String, amount: Number, description: String, date: String, type: String,
  currency: String, originalAmount: Number, rate: Number,
}, options);
const seasonSchema = new Schema({
  id: { type: String, required: true, unique: true }, revision: { type: Number, required: true },
  club: String, clubEn: String, seasonStart: String, seasonEnd: String,
  totalBudget: { type: Number, required: true, min: 0 },
  categories: [categorySchema], contracts: [contractSchema],
  payrolls: [payrollSchema], transactions: [transactionSchema],
  // Newer collections are plain sub-documents; shapes are validated in the API layer.
  adjustments: [Schema.Types.Mixed], matches: [Schema.Types.Mixed], requests: [Schema.Types.Mixed],
  audit: [Schema.Types.Mixed], bonusRules: Schema.Types.Mixed, approvalThreshold: Number,
}, { versionKey: false });
export const Season = mongoose.model("SaqfiSeason", seasonSchema);
