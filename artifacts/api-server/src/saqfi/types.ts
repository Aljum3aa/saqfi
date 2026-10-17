export type Role = "manager" | "president" | "player";
export type Category = { id: string; name: string; nameEn: string; cap: number };
export type Contract = {
  id: string; name: string; nameEn: string; position: string;
  salary: number; start: string; end: string;
};
export type PayrollLine = {
  playerId: string; name: string; salary: number; bonus: number; fine: number; net: number;
};
export type Payroll = {
  id: string; month: string; total: number; paidAt: string; lines: PayrollLine[];
};
/** Amounts are KWD. currency/originalAmount/rate are kept when paid in a foreign currency. */
export type Transaction = {
  id: string; categoryId: string; amount: number; description: string;
  date: string; type: string; currency?: string; originalAmount?: number; rate?: number;
};
/** A bonus or fine waiting for the next payroll; settledMonth is set once it is paid. */
export type Adjustment = {
  id: string; playerId: string; kind: "bonus" | "fine"; amount: number;
  reason: string; date: string; matchId?: string; settledMonth?: string;
};
export type Match = {
  id: string; date: string; opponent: string; opponentEn: string; home: boolean;
  goalsFor: number; goalsAgainst: number; competition: string;
  result: "W" | "D" | "L"; bonusPlayers: number; bonusTotal: number;
};
export type BonusRules = { win: number; draw: number };
export type ApprovalRequest = {
  id: string; categoryId: string; amount: number; description: string; date: string;
  status: "pending" | "approved" | "rejected"; reason: "threshold" | "cap";
  requestedAt: string; decidedAt?: string; note?: string; fromReserve?: number;
  currency?: string; originalAmount?: number; rate?: number;
};
export type AuditEntry = { id: string; at: string; role: Role; action: string; detail: string; detailEn: string };
export type Club = {
  id: string; revision: number; club: string; clubEn: string;
  seasonStart: string; seasonEnd: string; totalBudget: number;
  categories: Category[]; contracts: Contract[];
  payrolls: Payroll[]; transactions: Transaction[];
  adjustments: Adjustment[]; matches: Match[]; bonusRules: BonusRules;
  approvalThreshold: number; requests: ApprovalRequest[]; audit: AuditEntry[];
};
export class ClubError extends Error {
  constructor(
    public status: number, message: string, public errorEn: string,
    public exceeded?: number,
  ) { super(message); }
}
