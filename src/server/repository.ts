import {
  generateId,
  getWorkspaceForUser,
  loadDatabase,
  resetUserDemoData,
  sanitizeUser,
  saveDatabase,
  seedStarterDataForNewUser,
} from './storage.ts';
import { PostgresFinanzappRepository } from './postgresRepository.ts';
import type {
  AccountType,
  Budget,
  Category,
  CurrencyCode,
  Debt,
  FinancialAccount,
  FinancialTransaction,
  FinanzappWorkspacePayload,
  OtpRecord,
  SavingsGoal,
  StoredUser,
  TransactionType,
  UserProfile,
} from '../shared/types.ts';

export interface FinanzappRepository {
  getDemoUsers(): Promise<
    {
      id: string;
      name: string;
      email: string;
      occupation: string;
      currency: CurrencyCode;
      avatarKey: string;
      demoPassword: string;
    }[]
  >;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(userId: string): Promise<StoredUser | null>;
  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    occupation: string;
    currency: CurrencyCode;
  }): Promise<UserProfile>;
  updateProfile(
    userId: string,
    updates: {
      name?: string;
      occupation?: string;
      currency?: CurrencyCode;
      monthlySavingsRateGoal?: number;
      newPasswordHash?: string;
    }
  ): Promise<UserProfile | null>;
  resetDemoData(userId: string): Promise<FinanzappWorkspacePayload | null>;
  getWorkspace(userId: string): Promise<FinanzappWorkspacePayload | null>;
  createAccount(
    userId: string,
    input: {
      name: string;
      type: AccountType;
      institution: string;
      accountNumber: string;
      balance: number;
    }
  ): Promise<FinancialAccount>;
  updateAccount(
    userId: string,
    accountId: string,
    input: {
      name?: string;
      type?: AccountType;
      institution?: string;
      accountNumber?: string;
      balance?: number;
    }
  ): Promise<FinancialAccount | null>;
  deleteAccount(
    userId: string,
    accountId: string
  ): Promise<'ok' | 'not_found' | 'has_transactions'>;
  transferBetweenAccounts(
    userId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number
  ): Promise<{ fromAccount: FinancialAccount; toAccount: FinancialAccount }>;
  createCategory(
    userId: string,
    input: { name: string; type: TransactionType; color: string }
  ): Promise<Category>;
  createTransaction(
    userId: string,
    input: {
      accountId: string;
      categoryId: string;
      type: TransactionType;
      amount: number;
      description: string;
      date: string;
      reference?: string;
    }
  ): Promise<{ transaction: FinancialTransaction; account: FinancialAccount }>;
  updateTransaction(
    userId: string,
    txId: string,
    input: {
      accountId?: string;
      categoryId?: string;
      type?: TransactionType;
      amount?: number;
      description?: string;
      date?: string;
      reference?: string;
    }
  ): Promise<{ transaction: FinancialTransaction; accounts: FinancialAccount[] }>;
  deleteTransaction(
    userId: string,
    txId: string
  ): Promise<{ account?: FinancialAccount } | null>;
  saveBudget(
    userId: string,
    input: { categoryId: string; month: string; limitAmount: number; alertThreshold: number }
  ): Promise<Budget>;
  deleteBudget(userId: string, budgetId: string): Promise<boolean>;
  createDebt(
    userId: string,
    input: {
      creditor: string;
      title: string;
      totalAmount: number;
      remainingAmount: number;
      monthlyInstallment: number;
      interestRateAnnual: number;
      dueDate: string;
      totalInstallments: number;
      paidInstallments: number;
    }
  ): Promise<Debt>;
  payDebt(
    userId: string,
    debtId: string,
    input: { accountId: string; amount: number; date: string; note: string }
  ): Promise<FinanzappWorkspacePayload>;
  deleteDebt(userId: string, debtId: string): Promise<boolean>;
  createGoal(
    userId: string,
    input: {
      title: string;
      targetAmount: number;
      currentAmount: number;
      deadline: string;
      priority: 'alta' | 'media' | 'baja';
    }
  ): Promise<SavingsGoal>;
  contributeGoal(
    userId: string,
    goalId: string,
    input: {
      amount: number;
      date: string;
      note: string;
      fromAccountId?: string;
      toSavingsAccountId?: string;
    }
  ): Promise<FinanzappWorkspacePayload>;
  deleteGoal(userId: string, goalId: string): Promise<boolean>;
  saveOtpVerification(email: string, codeHash: string, expiresAtIso: string): Promise<void>;
  getOtpVerification(email: string): Promise<OtpRecord | null>;
  incrementOtpAttempts(email: string): Promise<number>;
  consumeOtpVerification(email: string): Promise<void>;
}

class LocalFileFinanzappRepository implements FinanzappRepository {
  async getDemoUsers() {
    const db = await loadDatabase();
    return db.users
      .filter((u) => u.id === 'usr_carlos' || u.id === 'usr_ana')
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        occupation: u.occupation,
        currency: u.currency,
        avatarKey: u.avatarKey,
        demoPassword: u.id === 'usr_carlos' ? 'Demo2026!' : 'Finanzas2026!',
      }));
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const db = await loadDatabase();
    const normalized = email.trim().toLowerCase();
    return db.users.find((u) => u.email.toLowerCase() === normalized) || null;
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    const db = await loadDatabase();
    return db.users.find((u) => u.id === userId) || null;
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    occupation: string;
    currency: CurrencyCode;
  }): Promise<UserProfile> {
    const db = await loadDatabase();
    const userId = generateId('usr');
    const newUser: StoredUser = {
      id: userId,
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      occupation: input.occupation,
      currency: input.currency,
      monthlySavingsRateGoal: 20,
      avatarKey: 'initials',
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    await saveDatabase(db);
    await seedStarterDataForNewUser(userId);
    return sanitizeUser(newUser);
  }

  async updateProfile(
    userId: string,
    updates: {
      name?: string;
      occupation?: string;
      currency?: CurrencyCode;
      monthlySavingsRateGoal?: number;
      newPasswordHash?: string;
    }
  ): Promise<UserProfile | null> {
    const db = await loadDatabase();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    if (updates.name?.trim()) user.name = updates.name.trim();
    if (updates.occupation !== undefined) {
      user.occupation = updates.occupation.trim() || 'Gestión Personal';
    }
    if (updates.currency) user.currency = updates.currency;
    if (updates.monthlySavingsRateGoal !== undefined) {
      user.monthlySavingsRateGoal = updates.monthlySavingsRateGoal;
    }
    if (updates.newPasswordHash) user.passwordHash = updates.newPasswordHash;
    await saveDatabase(db);
    return sanitizeUser(user);
  }

  async resetDemoData(userId: string): Promise<FinanzappWorkspacePayload | null> {
    await resetUserDemoData(userId);
    return getWorkspaceForUser(userId);
  }

  async getWorkspace(userId: string): Promise<FinanzappWorkspacePayload | null> {
    return getWorkspaceForUser(userId);
  }

  async createAccount(
    userId: string,
    input: {
      name: string;
      type: AccountType;
      institution: string;
      accountNumber: string;
      balance: number;
    }
  ): Promise<FinancialAccount> {
    const db = await loadDatabase();
    const account: FinancialAccount = {
      id: generateId('acc'),
      userId,
      ...input,
      createdAt: new Date().toISOString(),
    };
    db.accounts.push(account);
    await saveDatabase(db);
    return account;
  }

  async updateAccount(
    userId: string,
    accountId: string,
    input: {
      name?: string;
      type?: AccountType;
      institution?: string;
      accountNumber?: string;
      balance?: number;
    }
  ): Promise<FinancialAccount | null> {
    const db = await loadDatabase();
    const account = db.accounts.find((a) => a.id === accountId && a.userId === userId);
    if (!account) return null;
    if (input.name?.trim()) account.name = input.name.trim();
    if (input.type) account.type = input.type;
    if (input.institution !== undefined) account.institution = input.institution.trim();
    if (input.accountNumber !== undefined) account.accountNumber = input.accountNumber.trim();
    if (typeof input.balance === 'number' && !Number.isNaN(input.balance)) {
      account.balance = input.balance;
    }
    await saveDatabase(db);
    return account;
  }

  async deleteAccount(
    userId: string,
    accountId: string
  ): Promise<'ok' | 'not_found' | 'has_transactions'> {
    const db = await loadDatabase();
    const index = db.accounts.findIndex((a) => a.id === accountId && a.userId === userId);
    if (index === -1) return 'not_found';
    if (db.transactions.some((t) => t.accountId === accountId && t.userId === userId)) {
      return 'has_transactions';
    }
    db.accounts.splice(index, 1);
    await saveDatabase(db);
    return 'ok';
  }

  async transferBetweenAccounts(
    userId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number
  ): Promise<{ fromAccount: FinancialAccount; toAccount: FinancialAccount }> {
    const db = await loadDatabase();
    const fromAcc = db.accounts.find((a) => a.id === fromAccountId && a.userId === userId);
    const toAcc = db.accounts.find((a) => a.id === toAccountId && a.userId === userId);
    if (!fromAcc || !toAcc) throw new Error('NOT_FOUND');
    if (fromAcc.balance < amount) throw new Error('INSUFFICIENT_FUNDS');
    fromAcc.balance -= amount;
    toAcc.balance += amount;
    await saveDatabase(db);
    return { fromAccount: fromAcc, toAccount: toAcc };
  }

  async createCategory(
    userId: string,
    input: { name: string; type: TransactionType; color: string }
  ): Promise<Category> {
    const db = await loadDatabase();
    const category: Category = {
      id: generateId('cat'),
      userId,
      ...input,
    };
    db.categories.push(category);
    await saveDatabase(db);
    return category;
  }

  async createTransaction(
    userId: string,
    input: {
      accountId: string;
      categoryId: string;
      type: TransactionType;
      amount: number;
      description: string;
      date: string;
      reference?: string;
    }
  ): Promise<{ transaction: FinancialTransaction; account: FinancialAccount }> {
    const db = await loadDatabase();
    const account = db.accounts.find((a) => a.id === input.accountId && a.userId === userId);
    const category = db.categories.find((c) => c.id === input.categoryId && c.userId === userId);
    if (!account || !category) throw new Error('NOT_FOUND');

    account.balance += input.type === 'ingreso' ? input.amount : -input.amount;
    const transaction: FinancialTransaction = {
      id: generateId('tx'),
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      date: input.date,
      reference: input.reference,
      createdAt: new Date().toISOString(),
    };
    db.transactions.push(transaction);
    await saveDatabase(db);
    return { transaction, account };
  }

  async updateTransaction(
    userId: string,
    txId: string,
    input: {
      accountId?: string;
      categoryId?: string;
      type?: TransactionType;
      amount?: number;
      description?: string;
      date?: string;
      reference?: string;
    }
  ): Promise<{ transaction: FinancialTransaction; accounts: FinancialAccount[] }> {
    const db = await loadDatabase();
    const tx = db.transactions.find((t) => t.id === txId && t.userId === userId);
    if (!tx) throw new Error('NOT_FOUND');

    const nextAccountId = input.accountId || tx.accountId;
    const nextCategoryId = input.categoryId || tx.categoryId;
    const nextType = input.type || tx.type;
    const nextAmount = input.amount !== undefined ? Number(input.amount) : tx.amount;

    const prevAccount = db.accounts.find((a) => a.id === tx.accountId && a.userId === userId);
    const nextAccount = db.accounts.find((a) => a.id === nextAccountId && a.userId === userId);
    if (!nextAccount) throw new Error('ACCOUNT_NOT_FOUND');

    if (prevAccount) {
      prevAccount.balance -= tx.type === 'ingreso' ? tx.amount : -tx.amount;
    }
    nextAccount.balance += nextType === 'ingreso' ? nextAmount : -nextAmount;

    tx.accountId = nextAccountId;
    tx.categoryId = nextCategoryId;
    tx.type = nextType;
    tx.amount = nextAmount;
    if (input.description?.trim()) tx.description = input.description.trim();
    if (input.date) tx.date = input.date;
    tx.reference = input.reference?.trim() || undefined;

    await saveDatabase(db);
    return {
      transaction: tx,
      accounts: db.accounts.filter((a) => a.userId === userId),
    };
  }

  async deleteTransaction(
    userId: string,
    txId: string
  ): Promise<{ account?: FinancialAccount } | null> {
    const db = await loadDatabase();
    const idx = db.transactions.findIndex((t) => t.id === txId && t.userId === userId);
    if (idx === -1) return null;
    const [removed] = db.transactions.splice(idx, 1);
    const account = db.accounts.find((a) => a.id === removed.accountId && a.userId === userId);
    if (account) {
      account.balance -= removed.type === 'ingreso' ? removed.amount : -removed.amount;
    }
    await saveDatabase(db);
    return { account };
  }

  async saveBudget(
    userId: string,
    input: { categoryId: string; month: string; limitAmount: number; alertThreshold: number }
  ): Promise<Budget> {
    const db = await loadDatabase();
    const existing = db.budgets.find(
      (b) =>
        b.userId === userId && b.categoryId === input.categoryId && b.month === input.month
    );
    if (existing) {
      existing.limitAmount = input.limitAmount;
      existing.alertThreshold = input.alertThreshold;
      await saveDatabase(db);
      return existing;
    }
    const budget: Budget = {
      id: generateId('bud'),
      userId,
      ...input,
    };
    db.budgets.push(budget);
    await saveDatabase(db);
    return budget;
  }

  async deleteBudget(userId: string, budgetId: string): Promise<boolean> {
    const db = await loadDatabase();
    const idx = db.budgets.findIndex((b) => b.id === budgetId && b.userId === userId);
    if (idx === -1) return false;
    db.budgets.splice(idx, 1);
    await saveDatabase(db);
    return true;
  }

  async createDebt(
    userId: string,
    input: {
      creditor: string;
      title: string;
      totalAmount: number;
      remainingAmount: number;
      monthlyInstallment: number;
      interestRateAnnual: number;
      dueDate: string;
      totalInstallments: number;
      paidInstallments: number;
    }
  ): Promise<Debt> {
    const db = await loadDatabase();
    const debt: Debt = {
      id: generateId('debt'),
      userId,
      ...input,
      payments: [],
      createdAt: new Date().toISOString(),
    };
    db.debts.push(debt);
    await saveDatabase(db);
    return debt;
  }

  async payDebt(
    userId: string,
    debtId: string,
    input: { accountId: string; amount: number; date: string; note: string }
  ): Promise<FinanzappWorkspacePayload> {
    const db = await loadDatabase();
    const debt = db.debts.find((d) => d.id === debtId && d.userId === userId);
    const account = db.accounts.find((a) => a.id === input.accountId && a.userId === userId);
    if (!debt || !account) throw new Error('NOT_FOUND');
    if (account.balance < input.amount) throw new Error('INSUFFICIENT_FUNDS');

    account.balance -= input.amount;
    debt.remainingAmount = Math.max(0, debt.remainingAmount - input.amount);
    if (debt.paidInstallments < debt.totalInstallments) {
      debt.paidInstallments += 1;
    }
    if (debt.remainingAmount > 0 && debt.dueDate) {
      const parts = debt.dueDate.split('-').map(Number);
      if (parts.length === 3) {
        const nextDue = new Date(Date.UTC(parts[0], parts[1], parts[2]));
        debt.dueDate = nextDue.toISOString().slice(0, 10);
      }
    }

    const paymentRecord = {
      id: generateId('dp'),
      debtId: debt.id,
      accountId: input.accountId,
      amount: input.amount,
      date: input.date,
      note: input.note,
    };
    debt.payments.unshift(paymentRecord);

    const debtCategory =
      db.categories.find(
        (c) =>
          c.userId === userId &&
          c.type === 'gasto' &&
          c.name.toLowerCase().includes('obligaciones')
      ) || db.categories.find((c) => c.userId === userId && c.type === 'gasto');

    if (debtCategory) {
      db.transactions.push({
        id: generateId('tx'),
        userId,
        accountId: input.accountId,
        categoryId: debtCategory.id,
        type: 'gasto',
        amount: input.amount,
        description: `Abono deuda: ${debt.title} (${debt.creditor})`,
        date: input.date,
        reference: paymentRecord.id.toUpperCase(),
        createdAt: new Date().toISOString(),
      });
    }

    await saveDatabase(db);
    const ws = await getWorkspaceForUser(userId);
    return ws!;
  }

  async deleteDebt(userId: string, debtId: string): Promise<boolean> {
    const db = await loadDatabase();
    const idx = db.debts.findIndex((d) => d.id === debtId && d.userId === userId);
    if (idx === -1) return false;
    db.debts.splice(idx, 1);
    await saveDatabase(db);
    return true;
  }

  async createGoal(
    userId: string,
    input: {
      title: string;
      targetAmount: number;
      currentAmount: number;
      deadline: string;
      priority: 'alta' | 'media' | 'baja';
    }
  ): Promise<SavingsGoal> {
    const db = await loadDatabase();
    const goal: SavingsGoal = {
      id: generateId('goal'),
      userId,
      ...input,
      contributions: [],
      createdAt: new Date().toISOString(),
    };
    db.goals.push(goal);
    await saveDatabase(db);
    return goal;
  }

  async contributeGoal(
    userId: string,
    goalId: string,
    input: {
      amount: number;
      date: string;
      note: string;
      fromAccountId?: string;
      toSavingsAccountId?: string;
    }
  ): Promise<FinanzappWorkspacePayload> {
    const db = await loadDatabase();
    const goal = db.goals.find((g) => g.id === goalId && g.userId === userId);
    if (!goal) throw new Error('NOT_FOUND');

    if (
      input.fromAccountId &&
      input.toSavingsAccountId &&
      input.fromAccountId !== input.toSavingsAccountId
    ) {
      const fromAcc = db.accounts.find((a) => a.id === input.fromAccountId && a.userId === userId);
      const toAcc = db.accounts.find(
        (a) => a.id === input.toSavingsAccountId && a.userId === userId
      );
      if (fromAcc && toAcc) {
        if (fromAcc.balance < input.amount) throw new Error('INSUFFICIENT_FUNDS');
        fromAcc.balance -= input.amount;
        toAcc.balance += input.amount;
      }
    }

    goal.currentAmount += input.amount;
    goal.contributions.unshift({
      id: generateId('gc'),
      goalId: goal.id,
      accountId: input.fromAccountId || undefined,
      amount: input.amount,
      date: input.date,
      note: input.note,
    });

    await saveDatabase(db);
    const ws = await getWorkspaceForUser(userId);
    return ws!;
  }

  async deleteGoal(userId: string, goalId: string): Promise<boolean> {
    const db = await loadDatabase();
    const idx = db.goals.findIndex((g) => g.id === goalId && g.userId === userId);
    if (idx === -1) return false;
    db.goals.splice(idx, 1);
    await saveDatabase(db);
    return true;
  }

  async saveOtpVerification(email: string, codeHash: string, expiresAtIso: string): Promise<void> {
    const db = await loadDatabase();
    const normalized = email.trim().toLowerCase();
    if (!db.otpVerifications) db.otpVerifications = [];
    db.otpVerifications = db.otpVerifications.filter((item) => item.email !== normalized);
    db.otpVerifications.push({
      email: normalized,
      codeHash,
      expiresAt: expiresAtIso,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    await saveDatabase(db);
  }

  async getOtpVerification(email: string): Promise<OtpRecord | null> {
    const db = await loadDatabase();
    const normalized = email.trim().toLowerCase();
    return (db.otpVerifications || []).find((item) => item.email === normalized) || null;
  }

  async incrementOtpAttempts(email: string): Promise<number> {
    const db = await loadDatabase();
    const normalized = email.trim().toLowerCase();
    const record = (db.otpVerifications || []).find((item) => item.email === normalized);
    if (!record) return 0;
    record.attempts += 1;
    await saveDatabase(db);
    return record.attempts;
  }

  async consumeOtpVerification(email: string): Promise<void> {
    const db = await loadDatabase();
    const normalized = email.trim().toLowerCase();
    if (!db.otpVerifications) return;
    db.otpVerifications = db.otpVerifications.filter((item) => item.email !== normalized);
    await saveDatabase(db);
  }
}

const pgRepo = new PostgresFinanzappRepository();
const localRepo = new LocalFileFinanzappRepository();

/**
 * Selecciona PostgreSQL 16 automáticamente cuando PGHOST está configurado
 * (p. ej. contenedor Docker Compose conectado por red interna a finanzapp-db),
 * manteniendo respaldo transparente en archivo local para previsualización sin demonio Docker.
 */
export function getRepository(): FinanzappRepository {
  if (process.env.PGHOST && process.env.PGHOST.trim().length > 0) {
    return pgRepo;
  }
  return localRepo;
}
