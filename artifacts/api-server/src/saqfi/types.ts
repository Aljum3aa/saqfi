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
export type Transaction = {
  id: string; categoryId: string; amount: number; description: string;
  date: string; type: string;
};
export type Club = {
  id: string; revision: number; club: string; clubEn: string;
  seasonStart: string; seasonEnd: string; totalBudget: number;
  categories: Category[]; contracts: Contract[];
  payrolls: Payroll[]; transactions: Transaction[];
};
export class ClubError extends Error {
  constructor(
    public status: number, message: string, public errorEn: string,
    public exceeded?: number,
  ) { super(message); }
}
