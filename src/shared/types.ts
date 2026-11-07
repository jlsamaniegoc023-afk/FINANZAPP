export type CurrencyCode = 'COP' | 'USD' | 'MXN' | 'EUR';

export type AccountType =
  | 'banco'
  | 'ahorros'
  | 'efectivo'
  | 'inversion'
  | 'billetera_digital';

export type TransactionType = 'ingreso' | 'gasto';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  occupation: string;
  currency: CurrencyCode;
  monthlySavingsRateGoal: number;
  avatarKey: 'carlos' | 'ana' | 'initials';
  createdAt: string;
}

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export interface FinancialAccount {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  institution: string;
  accountNumber: string;
  balance: number;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: TransactionType;
  color: string;
}

export interface FinancialTransaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  reference?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  month: string; // YYYY-MM
  limitAmount: number;
  alertThreshold: number; // e.g., 80 (%)
}

export interface DebtPayment {
  id: string;
  debtId: string;
  accountId: string;
  amount: number;
  date: string;
  note: string;
}

export interface Debt {
  id: string;
  userId: string;
  creditor: string;
  title: string;
  totalAmount: number;
  remainingAmount: number;
  monthlyInstallment: number;
  interestRateAnnual: number;
  dueDate: string; // YYYY-MM-DD
  totalInstallments: number;
  paidInstallments: number;
  payments: DebtPayment[];
  createdAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  accountId?: string;
  amount: number;
  date: string;
  note: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
  priority: 'alta' | 'media' | 'baja';
  contributions: GoalContribution[];
  createdAt: string;
}

export interface OtpRecord {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

export interface OtpChallengeResponse {
  ok: boolean;
  email: string;
  isNewUser: boolean;
  expiresInSeconds: number;
  delivery: 'gmail_smtp' | 'sandbox_preview';
  senderEmail?: string;
  sandboxCode?: string;
  message?: string;
}

export interface SmtpStatusResponse {
  configured: boolean;
  senderEmail: string | null;
}


export interface FinanzappWorkspacePayload {
  user: UserProfile;
  accounts: FinancialAccount[];
  categories: Category[];
  transactions: FinancialTransaction[];
  budgets: Budget[];
  debts: Debt[];
  goals: SavingsGoal[];
}
