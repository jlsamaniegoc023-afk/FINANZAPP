import pg from 'pg';
import type { PoolClient } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildUserSeedDataset,
  createInitialDatabase,
  generateId,
  sanitizeUser,
} from './storage.ts';
import type {
  AccountType,
  Budget,
  Category,
  CurrencyCode,
  Debt,
  DebtPayment,
  FinancialAccount,
  FinancialTransaction,
  FinanzappWorkspacePayload,
  GoalContribution,
  OtpRecord,
  SavingsGoal,
  StoredUser,
  TransactionType,
  UserProfile,
} from '../shared/types.ts';

const { Pool } = pg;

declare global {
  var _finanzappPgPool: pg.Pool | undefined;
}

function getPool(): pg.Pool {
  if (!global._finanzappPgPool) {
    global._finanzappPgPool = new Pool({
      host: process.env.PGHOST || 'finanzapp-db',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'finanzapp',
      user: process.env.PGUSER || 'finanzapp_user',
      password: process.env.PGPASSWORD || 'finanzapp_password',
      max: 10,
      connectionTimeoutMillis: 10000,
    });

    global._finanzappPgPool.on('error', (err) => {
      console.error('Error inesperado en cliente inactivo del pool PostgreSQL:', err);
    });
  }
  return global._finanzappPgPool;
}

let initializedPromise: Promise<void> | null = null;

async function insertDatasetForUser(
  client: PoolClient,
  userId: string,
  dataset: ReturnType<typeof buildUserSeedDataset>
): Promise<void> {
  for (const acc of dataset.accounts) {
    await client.query(
      `INSERT INTO accounts (id, user_id, name, type, institution, account_number, balance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [acc.id, userId, acc.name, acc.type, acc.institution, acc.accountNumber, acc.balance, acc.createdAt]
    );
  }

  for (const cat of dataset.categories) {
    await client.query(
      `INSERT INTO categories (id, user_id, name, type, color)
       VALUES ($1, $2, $3, $4, $5)`,
      [cat.id, userId, cat.name, cat.type, cat.color]
    );
  }

  for (const tx of dataset.transactions) {
    await client.query(
      `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, description, tx_date, reference, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tx.id,
        userId,
        tx.accountId,
        tx.categoryId,
        tx.type,
        tx.amount,
        tx.description,
        tx.date,
        tx.reference || null,
        tx.createdAt,
      ]
    );
  }

  for (const b of dataset.budgets) {
    await client.query(
      `INSERT INTO budgets (id, user_id, category_id, budget_month, limit_amount, alert_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [b.id, userId, b.categoryId, b.month, b.limitAmount, b.alertThreshold]
    );
  }

  for (const d of dataset.debts) {
    await client.query(
      `INSERT INTO debts (id, user_id, creditor, title, total_amount, remaining_amount, monthly_installment, interest_rate_annual, due_date, total_installments, paid_installments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        d.id,
        userId,
        d.creditor,
        d.title,
        d.totalAmount,
        d.remainingAmount,
        d.monthlyInstallment,
        d.interestRateAnnual,
        d.dueDate,
        d.totalInstallments,
        d.paidInstallments,
        d.createdAt,
      ]
    );
    for (const p of d.payments) {
      await client.query(
        `INSERT INTO debt_payments (id, debt_id, account_id, amount, payment_date, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [p.id, d.id, p.accountId, p.amount, p.date, p.note]
      );
    }
  }

  for (const g of dataset.goals) {
    await client.query(
      `INSERT INTO savings_goals (id, user_id, title, target_amount, current_amount, deadline, priority, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [g.id, userId, g.title, g.targetAmount, g.currentAmount, g.deadline, g.priority, g.createdAt]
    );
    for (const c of g.contributions) {
      await client.query(
        `INSERT INTO goal_contributions (id, goal_id, account_id, amount, contribution_date, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [c.id, g.id, c.accountId || null, c.amount, c.date, c.note]
      );
    }
  }
}

async function ensurePostgresSchemaAndSeed(): Promise<void> {
  if (!initializedPromise) {
    initializedPromise = (async () => {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const ddlPath = path.resolve(process.cwd(), 'database', 'init.sql');
        const ddlSql = await fs.readFile(ddlPath, 'utf-8');
        await client.query(ddlSql);

        const countRes = await client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM users');
        if (Number(countRes.rows[0]?.total || 0) === 0) {
          const initial = await createInitialDatabase();
          for (const u of initial.users) {
            await client.query(
              `INSERT INTO users (id, name, email, password_hash, occupation, currency, monthly_savings_rate_goal, avatar_key, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO NOTHING`,
              [
                u.id,
                u.name,
                u.email,
                u.passwordHash,
                u.occupation,
                u.currency,
                u.monthlySavingsRateGoal,
                u.avatarKey,
                u.createdAt,
              ]
            );
            await insertDatasetForUser(client, u.id, buildUserSeedDataset(u.id));
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        initializedPromise = null;
        throw err;
      } finally {
        client.release();
      }
    })();
  }
  return initializedPromise;
}

function mapUserRow(row: any): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    occupation: row.occupation,
    currency: row.currency as CurrencyCode,
    monthlySavingsRateGoal: Number(row.monthly_savings_rate_goal),
    avatarKey: row.avatar_key,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapAccountRow(row: any): FinancialAccount {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type as AccountType,
    institution: row.institution,
    accountNumber: row.account_number,
    balance: Number(row.balance),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toDateStr(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export class PostgresFinanzappRepository {
  async getDemoUsers() {
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(
      `SELECT * FROM users WHERE id IN ('usr_carlos', 'usr_ana') ORDER BY created_at ASC`
    );
    return res.rows.map((row) => {
      const u = mapUserRow(row);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        occupation: u.occupation,
        currency: u.currency,
        avatarKey: u.avatarKey,
        demoPassword: u.id === 'usr_carlos' ? 'Demo2026!' : 'Finanzas2026!',
      };
    });
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email.trim()]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    occupation: string;
    currency: CurrencyCode;
  }): Promise<UserProfile> {
    await ensurePostgresSchemaAndSeed();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const userId = generateId('usr');
      const userRes = await client.query(
        `INSERT INTO users (id, name, email, password_hash, occupation, currency, monthly_savings_rate_goal, avatar_key)
         VALUES ($1, $2, $3, $4, $5, $6, 20, 'initials')
         RETURNING *`,
        [userId, input.name, input.email, input.passwordHash, input.occupation, input.currency]
      );

      const starterCats: [string, TransactionType, string][] = [
        ['Salario Principal', 'ingreso', '#16A36A'],
        ['Ingresos Adicionales', 'ingreso', '#0D9488'],
        ['Vivienda y Servicios', 'gasto', '#14243A'],
        ['Alimentación', 'gasto', '#D97706'],
        ['Transporte', 'gasto', '#4F46E5'],
        ['Salud y Educación', 'gasto', '#0891B2'],
        ['Obligaciones y Deudas', 'gasto', '#DC2626'],
      ];
      for (const [name, type, color] of starterCats) {
        await client.query(
          `INSERT INTO categories (id, user_id, name, type, color) VALUES ($1, $2, $3, $4, $5)`,
          [generateId('cat'), userId, name, type, color]
        );
      }

      await client.query(
        `INSERT INTO accounts (id, user_id, name, type, institution, account_number, balance)
         VALUES ($1, $2, 'Efectivo Inicial', 'efectivo', 'Disponible Personal', 'EFEC-001', 0)`,
        [generateId('acc'), userId]
      );

      await client.query('COMMIT');
      return sanitizeUser(mapUserRow(userRes.rows[0]));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
    await ensurePostgresSchemaAndSeed();
    const current = await this.findUserById(userId);
    if (!current) return null;

    const nextName = updates.name?.trim() || current.name;
    const nextOcc =
      updates.occupation !== undefined ? updates.occupation.trim() || 'Gestión Personal' : current.occupation;
    const nextCurr = updates.currency || current.currency;
    const nextGoal =
      updates.monthlySavingsRateGoal !== undefined
        ? updates.monthlySavingsRateGoal
        : current.monthlySavingsRateGoal;
    const nextHash = updates.newPasswordHash || current.passwordHash;

    const res = await getPool().query(
      `UPDATE users
       SET name = $1, occupation = $2, currency = $3, monthly_savings_rate_goal = $4, password_hash = $5
       WHERE id = $6
       RETURNING *`,
      [nextName, nextOcc, nextCurr, nextGoal, nextHash, userId]
    );
    return res.rows[0] ? sanitizeUser(mapUserRow(res.rows[0])) : null;
  }

  async resetDemoData(userId: string): Promise<FinanzappWorkspacePayload | null> {
    await ensurePostgresSchemaAndSeed();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM goal_contributions WHERE goal_id IN (SELECT id FROM savings_goals WHERE user_id = $1)`, [userId]);
      await client.query(`DELETE FROM savings_goals WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM debt_payments WHERE debt_id IN (SELECT id FROM debts WHERE user_id = $1)`, [userId]);
      await client.query(`DELETE FROM debts WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM budgets WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM transactions WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM categories WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM accounts WHERE user_id = $1`, [userId]);

      await insertDatasetForUser(client, userId, buildUserSeedDataset(userId));
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.getWorkspace(userId);
  }

  async getWorkspace(userId: string): Promise<FinanzappWorkspacePayload | null> {
    await ensurePostgresSchemaAndSeed();
    const pool = getPool();
    const user = await this.findUserById(userId);
    if (!user) return null;

    const [accRes, catRes, txRes, budRes, debtRes, dpRes, goalRes, gcRes] = await Promise.all([
      pool.query(`SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at ASC`, [userId]),
      pool.query(`SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC`, [userId]),
      pool.query(
        `SELECT * FROM transactions WHERE user_id = $1 ORDER BY tx_date DESC, created_at DESC`,
        [userId]
      ),
      pool.query(`SELECT * FROM budgets WHERE user_id = $1`, [userId]),
      pool.query(`SELECT * FROM debts WHERE user_id = $1 ORDER BY due_date ASC`, [userId]),
      pool.query(
        `SELECT dp.* FROM debt_payments dp
         INNER JOIN debts d ON d.id = dp.debt_id
         WHERE d.user_id = $1
         ORDER BY dp.payment_date DESC`,
        [userId]
      ),
      pool.query(`SELECT * FROM savings_goals WHERE user_id = $1 ORDER BY created_at ASC`, [userId]),
      pool.query(
        `SELECT gc.* FROM goal_contributions gc
         INNER JOIN savings_goals g ON g.id = gc.goal_id
         WHERE g.user_id = $1
         ORDER BY gc.contribution_date DESC`,
        [userId]
      ),
    ]);

    const paymentsByDebt = new Map<string, DebtPayment[]>();
    for (const r of dpRes.rows) {
      const list = paymentsByDebt.get(r.debt_id) || [];
      list.push({
        id: r.id,
        debtId: r.debt_id,
        accountId: r.account_id,
        amount: Number(r.amount),
        date: toDateStr(r.payment_date),
        note: r.note,
      });
      paymentsByDebt.set(r.debt_id, list);
    }

    const contribsByGoal = new Map<string, GoalContribution[]>();
    for (const r of gcRes.rows) {
      const list = contribsByGoal.get(r.goal_id) || [];
      list.push({
        id: r.id,
        goalId: r.goal_id,
        accountId: r.account_id || undefined,
        amount: Number(r.amount),
        date: toDateStr(r.contribution_date),
        note: r.note,
      });
      contribsByGoal.set(r.goal_id, list);
    }

    const categories: Category[] = catRes.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      type: r.type as TransactionType,
      color: r.color,
    }));

    const transactions: FinancialTransaction[] = txRes.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      accountId: r.account_id,
      categoryId: r.category_id,
      type: r.type as TransactionType,
      amount: Number(r.amount),
      description: r.description,
      date: toDateStr(r.tx_date),
      reference: r.reference || undefined,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    const budgets: Budget[] = budRes.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      categoryId: r.category_id,
      month: r.budget_month,
      limitAmount: Number(r.limit_amount),
      alertThreshold: Number(r.alert_threshold),
    }));

    const debts: Debt[] = debtRes.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      creditor: r.creditor,
      title: r.title,
      totalAmount: Number(r.total_amount),
      remainingAmount: Number(r.remaining_amount),
      monthlyInstallment: Number(r.monthly_installment),
      interestRateAnnual: Number(r.interest_rate_annual),
      dueDate: toDateStr(r.due_date),
      totalInstallments: Number(r.total_installments),
      paidInstallments: Number(r.paid_installments),
      payments: paymentsByDebt.get(r.id) || [],
      createdAt: new Date(r.created_at).toISOString(),
    }));

    const goals: SavingsGoal[] = goalRes.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      targetAmount: Number(r.target_amount),
      currentAmount: Number(r.current_amount),
      deadline: toDateStr(r.deadline),
      priority: r.priority,
      contributions: contribsByGoal.get(r.id) || [],
      createdAt: new Date(r.created_at).toISOString(),
    }));

    return {
      user: sanitizeUser(user),
      accounts: accRes.rows.map(mapAccountRow),
      categories,
      transactions,
      budgets,
      debts,
      goals,
    };
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
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(
      `INSERT INTO accounts (id, user_id, name, type, institution, account_number, balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        generateId('acc'),
        userId,
        input.name,
        input.type,
        input.institution,
        input.accountNumber,
        input.balance,
      ]
    );
    return mapAccountRow(res.rows[0]);
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
    await ensurePostgresSchemaAndSeed();
    const curRes = await getPool().query(
      `SELECT * FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );
    if (!curRes.rows[0]) return null;
    const cur = mapAccountRow(curRes.rows[0]);

    const res = await getPool().query(
      `UPDATE accounts
       SET name = $1, type = $2, institution = $3, account_number = $4, balance = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        input.name?.trim() || cur.name,
        input.type || cur.type,
        input.institution !== undefined ? input.institution.trim() : cur.institution,
        input.accountNumber !== undefined ? input.accountNumber.trim() : cur.accountNumber,
        typeof input.balance === 'number' && !Number.isNaN(input.balance) ? input.balance : cur.balance,
        accountId,
        userId,
      ]
    );
    return mapAccountRow(res.rows[0]);
  }

  async deleteAccount(
    userId: string,
    accountId: string
  ): Promise<'ok' | 'not_found' | 'has_transactions'> {
    await ensurePostgresSchemaAndSeed();
    const txCheck = await getPool().query(
      `SELECT 1 FROM transactions WHERE account_id = $1 AND user_id = $2 LIMIT 1`,
      [accountId, userId]
    );
    if (txCheck.rowCount && txCheck.rowCount > 0) return 'has_transactions';

    const del = await getPool().query(
      `DELETE FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );
    return del.rowCount && del.rowCount > 0 ? 'ok' : 'not_found';
  }

  async transferBetweenAccounts(
    userId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number
  ): Promise<{ fromAccount: FinancialAccount; toAccount: FinancialAccount }> {
    await ensurePostgresSchemaAndSeed();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const fromRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [fromAccountId, userId]
      );
      const toRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [toAccountId, userId]
      );
      if (!fromRes.rows[0] || !toRes.rows[0]) {
        throw new Error('NOT_FOUND');
      }
      if (Number(fromRes.rows[0].balance) < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const upFrom = await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING *`,
        [amount, fromAccountId]
      );
      const upTo = await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING *`,
        [amount, toAccountId]
      );
      await client.query('COMMIT');
      return {
        fromAccount: mapAccountRow(upFrom.rows[0]),
        toAccount: mapAccountRow(upTo.rows[0]),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async createCategory(
    userId: string,
    input: { name: string; type: TransactionType; color: string }
  ): Promise<Category> {
    await ensurePostgresSchemaAndSeed();
    const id = generateId('cat');
    await getPool().query(
      `INSERT INTO categories (id, user_id, name, type, color) VALUES ($1, $2, $3, $4, $5)`,
      [id, userId, input.name, input.type, input.color]
    );
    return { id, userId, ...input };
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
    await ensurePostgresSchemaAndSeed();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const accCheck = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [input.accountId, userId]
      );
      const catCheck = await client.query(
        `SELECT 1 FROM categories WHERE id = $1 AND user_id = $2`,
        [input.categoryId, userId]
      );
      if (!accCheck.rows[0] || !catCheck.rowCount) {
        throw new Error('NOT_FOUND');
      }

      const delta = input.type === 'ingreso' ? input.amount : -input.amount;
      const upAcc = await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING *`,
        [delta, input.accountId]
      );

      const txId = generateId('tx');
      const txRes = await client.query(
        `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, description, tx_date, reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          txId,
          userId,
          input.accountId,
          input.categoryId,
          input.type,
          input.amount,
          input.description,
          input.date,
          input.reference || null,
        ]
      );
      await client.query('COMMIT');
      const r = txRes.rows[0];
      return {
        transaction: {
          id: r.id,
          userId: r.user_id,
          accountId: r.account_id,
          categoryId: r.category_id,
          type: r.type,
          amount: Number(r.amount),
          description: r.description,
          date: toDateStr(r.tx_date),
          reference: r.reference || undefined,
          createdAt: new Date(r.created_at).toISOString(),
        },
        account: mapAccountRow(upAcc.rows[0]),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
    await ensurePostgresSchemaAndSeed();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const curRes = await client.query(
        `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [txId, userId]
      );
      if (!curRes.rows[0]) throw new Error('NOT_FOUND');
      const cur = curRes.rows[0];

      const nextAccountId = input.accountId || cur.account_id;
      const nextCategoryId = input.categoryId || cur.category_id;
      const nextType = (input.type || cur.type) as TransactionType;
      const nextAmount = input.amount !== undefined ? Number(input.amount) : Number(cur.amount);

      // Revertir efecto anterior
      const prevDelta = cur.type === 'ingreso' ? Number(cur.amount) : -Number(cur.amount);
      await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3`, [
        prevDelta,
        cur.account_id,
        userId,
      ]);

      // Aplicar nuevo efecto
      const nextDelta = nextType === 'ingreso' ? nextAmount : -nextAmount;
      const targetAcc = await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
        [nextDelta, nextAccountId, userId]
      );
      if (!targetAcc.rows[0]) throw new Error('ACCOUNT_NOT_FOUND');

      const upTx = await client.query(
        `UPDATE transactions
         SET account_id = $1, category_id = $2, type = $3, amount = $4, description = $5, tx_date = $6, reference = $7
         WHERE id = $8 AND user_id = $9
         RETURNING *`,
        [
          nextAccountId,
          nextCategoryId,
          nextType,
          nextAmount,
          input.description?.trim() || cur.description,
          input.date || toDateStr(cur.tx_date),
          input.reference?.trim() || null,
          txId,
          userId,
        ]
      );
      const allAccounts = await client.query(
        `SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at ASC`,
        [userId]
      );
      await client.query('COMMIT');
      const r = upTx.rows[0];
      return {
        transaction: {
          id: r.id,
          userId: r.user_id,
          accountId: r.account_id,
          categoryId: r.category_id,
          type: r.type,
          amount: Number(r.amount),
          description: r.description,
          date: toDateStr(r.tx_date),
          reference: r.reference || undefined,
          createdAt: new Date(r.created_at).toISOString(),
        },
        accounts: allAccounts.rows.map(mapAccountRow),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteTransaction(
    userId: string,
    txId: string
  ): Promise<{ account?: FinancialAccount } | null> {
    await ensurePostgresSchemaAndSeed();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const delRes = await client.query(
        `DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING *`,
        [txId, userId]
      );
      if (!delRes.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const removed = delRes.rows[0];
      const delta = removed.type === 'ingreso' ? Number(removed.amount) : -Number(removed.amount);
      const upAcc = await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
        [delta, removed.account_id, userId]
      );
      await client.query('COMMIT');
      return { account: upAcc.rows[0] ? mapAccountRow(upAcc.rows[0]) : undefined };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async saveBudget(
    userId: string,
    input: { categoryId: string; month: string; limitAmount: number; alertThreshold: number }
  ): Promise<Budget> {
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(
      `INSERT INTO budgets (id, user_id, category_id, budget_month, limit_amount, alert_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, category_id, budget_month)
       DO UPDATE SET limit_amount = EXCLUDED.limit_amount, alert_threshold = EXCLUDED.alert_threshold
       RETURNING *`,
      [generateId('bud'), userId, input.categoryId, input.month, input.limitAmount, input.alertThreshold]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      categoryId: r.category_id,
      month: r.budget_month,
      limitAmount: Number(r.limit_amount),
      alertThreshold: Number(r.alert_threshold),
    };
  }

  async deleteBudget(userId: string, budgetId: string): Promise<boolean> {
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(
      `DELETE FROM budgets WHERE id = $1 AND user_id = $2`,
      [budgetId, userId]
    );
    return Boolean(res.rowCount && res.rowCount > 0);
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
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(
      `INSERT INTO debts (id, user_id, creditor, title, total_amount, remaining_amount, monthly_installment, interest_rate_annual, due_date, total_installments, paid_installments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        generateId('debt'),
        userId,
        input.creditor,
        input.title,
        input.totalAmount,
        input.remainingAmount,
        input.monthlyInstallment,
        input.interestRateAnnual,
        input.dueDate,
        input.totalInstallments,
        input.paidInstallments,
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      creditor: r.creditor,
      title: r.title,
      totalAmount: Number(r.total_amount),
      remainingAmount: Number(r.remaining_amount),
      monthlyInstallment: Number(r.monthly_installment),
      interestRateAnnual: Number(r.interest_rate_annual),
      dueDate: toDateStr(r.due_date),
      totalInstallments: Number(r.total_installments),
      paidInstallments: Number(r.paid_installments),
      payments: [],
      createdAt: new Date(r.created_at).toISOString(),
    };
  }

  async payDebt(
    userId: string,
    debtId: string,
    input: { accountId: string; amount: number; date: string; note: string }
  ): Promise<FinanzappWorkspacePayload> {
    await ensurePostgresSchemaAndSeed();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const debtRes = await client.query(
        `SELECT * FROM debts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [debtId, userId]
      );
      const accRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [input.accountId, userId]
      );
      if (!debtRes.rows[0] || !accRes.rows[0]) throw new Error('NOT_FOUND');

      if (Number(accRes.rows[0].balance) < input.amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [
        input.amount,
        input.accountId,
      ]);

      const curDebt = debtRes.rows[0];
      const nextRemaining = Math.max(0, Number(curDebt.remaining_amount) - input.amount);
      const nextPaid =
        Number(curDebt.paid_installments) < Number(curDebt.total_installments)
          ? Number(curDebt.paid_installments) + 1
          : Number(curDebt.paid_installments);

      let nextDueStr = toDateStr(curDebt.due_date);
      if (nextRemaining > 0) {
        const parts = nextDueStr.split('-').map(Number);
        if (parts.length === 3) {
          const nextDue = new Date(Date.UTC(parts[0], parts[1], parts[2]));
          nextDueStr = nextDue.toISOString().slice(0, 10);
        }
      }

      await client.query(
        `UPDATE debts SET remaining_amount = $1, paid_installments = $2, due_date = $3 WHERE id = $4`,
        [nextRemaining, nextPaid, nextDueStr, debtId]
      );

      const dpId = generateId('dp');
      await client.query(
        `INSERT INTO debt_payments (id, debt_id, account_id, amount, payment_date, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dpId, debtId, input.accountId, input.amount, input.date, input.note]
      );

      const catRes = await client.query(
        `SELECT id FROM categories WHERE user_id = $1 AND type = 'gasto'
         ORDER BY CASE WHEN LOWER(name) LIKE '%obligaciones%' THEN 0 ELSE 1 END
         LIMIT 1`,
        [userId]
      );
      if (catRes.rows[0]) {
        await client.query(
          `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, description, tx_date, reference)
           VALUES ($1, $2, $3, $4, 'gasto', $5, $6, $7, $8)`,
          [
            generateId('tx'),
            userId,
            input.accountId,
            catRes.rows[0].id,
            input.amount,
            `Abono deuda: ${curDebt.title} (${curDebt.creditor})`,
            input.date,
            dpId.toUpperCase(),
          ]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const ws = await this.getWorkspace(userId);
    return ws!;
  }

  async deleteDebt(userId: string, debtId: string): Promise<boolean> {
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(`DELETE FROM debts WHERE id = $1 AND user_id = $2`, [
      debtId,
      userId,
    ]);
    return Boolean(res.rowCount && res.rowCount > 0);
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
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(
      `INSERT INTO savings_goals (id, user_id, title, target_amount, current_amount, deadline, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        generateId('goal'),
        userId,
        input.title,
        input.targetAmount,
        input.currentAmount,
        input.deadline,
        input.priority,
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      targetAmount: Number(r.target_amount),
      currentAmount: Number(r.current_amount),
      deadline: toDateStr(r.deadline),
      priority: r.priority,
      contributions: [],
      createdAt: new Date(r.created_at).toISOString(),
    };
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
    await ensurePostgresSchemaAndSeed();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const gRes = await client.query(
        `SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [goalId, userId]
      );
      if (!gRes.rows[0]) throw new Error('NOT_FOUND');

      if (
        input.fromAccountId &&
        input.toSavingsAccountId &&
        input.fromAccountId !== input.toSavingsAccountId
      ) {
        const fromRes = await client.query(
          `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [input.fromAccountId, userId]
        );
        const toRes = await client.query(
          `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [input.toSavingsAccountId, userId]
        );
        if (fromRes.rows[0] && toRes.rows[0]) {
          if (Number(fromRes.rows[0].balance) < input.amount) {
            throw new Error('INSUFFICIENT_FUNDS');
          }
          await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [
            input.amount,
            input.fromAccountId,
          ]);
          await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [
            input.amount,
            input.toSavingsAccountId,
          ]);
        }
      }

      await client.query(
        `UPDATE savings_goals SET current_amount = current_amount + $1 WHERE id = $2`,
        [input.amount, goalId]
      );
      await client.query(
        `INSERT INTO goal_contributions (id, goal_id, account_id, amount, contribution_date, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [generateId('gc'), goalId, input.fromAccountId || null, input.amount, input.date, input.note]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const ws = await this.getWorkspace(userId);
    return ws!;
  }

  async deleteGoal(userId: string, goalId: string): Promise<boolean> {
    await ensurePostgresSchemaAndSeed();
    const res = await getPool().query(
      `DELETE FROM savings_goals WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  async saveOtpVerification(email: string, codeHash: string, expiresAtIso: string): Promise<void> {
    await ensurePostgresSchemaAndSeed();
    const normalized = email.trim().toLowerCase();
    await getPool().query(
      `INSERT INTO otp_verifications (email, code_hash, expires_at, attempts, created_at)
       VALUES ($1, $2, $3, 0, NOW())
       ON CONFLICT (email)
       DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = NOW()`,
      [normalized, codeHash, expiresAtIso]
    );
  }

  async getOtpVerification(email: string): Promise<OtpRecord | null> {
    await ensurePostgresSchemaAndSeed();
    const normalized = email.trim().toLowerCase();
    const res = await getPool().query(
      `SELECT * FROM otp_verifications WHERE email = $1 LIMIT 1`,
      [normalized]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      email: r.email,
      codeHash: r.code_hash,
      expiresAt: new Date(r.expires_at).toISOString(),
      attempts: Number(r.attempts),
      createdAt: new Date(r.created_at).toISOString(),
    };
  }

  async incrementOtpAttempts(email: string): Promise<number> {
    await ensurePostgresSchemaAndSeed();
    const normalized = email.trim().toLowerCase();
    const res = await getPool().query(
      `UPDATE otp_verifications SET attempts = attempts + 1 WHERE email = $1 RETURNING attempts`,
      [normalized]
    );
    return Number(res.rows[0]?.attempts || 0);
  }

  async consumeOtpVerification(email: string): Promise<void> {
    await ensurePostgresSchemaAndSeed();
    const normalized = email.trim().toLowerCase();
    await getPool().query(`DELETE FROM otp_verifications WHERE email = $1`, [normalized]);
  }
}
