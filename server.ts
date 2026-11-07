import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getRepository } from './src/server/repository.ts';
import {
  generateSixDigitCode,
  sendVerificationCodeEmail,
  getSmtpConfigStatus,
  verifyAndSaveSmtpCredentials,
} from './src/server/mailer.ts';
import { signToken, requireAuth } from './src/server/auth.ts';
import type { AuthenticatedRequest } from './src/server/auth.ts';
import type {
  CurrencyCode,
  AccountType,
  TransactionType,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Endpoint de verificación para Docker Compose, Jenkins local y Travis CI
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'finanzapp-api', timestamp: new Date().toISOString() });
  });

  // Estado del servicio de correo Gmail SMTP
  app.get('/api/auth/smtp-status', (_req, res) => {
    try {
      res.json(getSmtpConfigStatus());
    } catch (error) {
      console.error('Error getting SMTP status:', error);
      res.status(500).json({ error: 'Error al consultar estado SMTP.' });
    }
  });

  // Configuración y prueba de credenciales de Gmail SMTP
  app.post('/api/auth/configure-smtp', async (req, res) => {
    try {
      const { gmailUser, gmailAppPassword } = req.body as {
        gmailUser?: string;
        gmailAppPassword?: string;
      };

      if (!gmailUser || !gmailAppPassword) {
        res.status(400).json({
          error:
            'Debes ingresar el correo Gmail remitente y la contraseña de aplicación de 16 caracteres.',
        });
        return;
      }

      const result = await verifyAndSaveSmtpCredentials(gmailUser, gmailAppPassword);
      res.json(result);
    } catch (error: any) {
      console.error('Configure SMTP error:', error);
      res.status(400).json({
        error: error?.message || 'Error al validar credenciales con Google SMTP.',
      });
    }
  });

  // Usuarios de prueba precargados (@gmail.com)
  app.get('/api/auth/demo-users', async (_req, res) => {
    try {
      const users = await getRepository().getDemoUsers();
      res.json({ users });
    } catch (error) {
      console.error('Error loading demo users:', error);
      res.status(500).json({ error: 'No se pudieron consultar los usuarios de prueba.' });
    }
  });

  // 08. Solicitud de código aleatorio de 6 dígitos al correo Gmail
  app.post('/api/auth/request-code', async (req, res) => {
    try {
      const { email: rawEmail } = req.body as { email?: string };
      if (!rawEmail || !rawEmail.trim()) {
        res.status(400).json({ error: 'Ingresa tu dirección de correo Gmail.' });
        return;
      }

      let normalized = rawEmail.trim().toLowerCase();
      if (!normalized.includes('@')) {
        normalized = `${normalized}@gmail.com`;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalized)) {
        res.status(400).json({ error: 'Ingresa un formato de correo electrónico válido (ej. usuario@gmail.com).' });
        return;
      }

      const repo = getRepository();
      const existingUser = await repo.findUserByEmail(normalized);

      const code = generateSixDigitCode();
      const codeHash = await bcrypt.hash(code, 8);
      const expiresAtIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await repo.saveOtpVerification(normalized, codeHash, expiresAtIso);

      try {
        const mailResult = await sendVerificationCodeEmail(normalized, code);
        res.json({
          ok: true,
          email: normalized,
          isNewUser: !existingUser,
          expiresInSeconds: 600,
          delivery: mailResult.delivery,
          senderEmail: mailResult.senderEmail,
          sandboxCode: mailResult.sandboxCode,
          message: mailResult.message,
        });
      } catch (smtpError: any) {
        console.error('Gmail SMTP send error:', smtpError);
        res.status(502).json({
          error: `Error al enviar correo vía Gmail: ${smtpError?.message || 'Error de conexión SMTP'}. Revisa la configuración del remitente o genera una Contraseña de aplicación de 16 caracteres.`,
        });
      }
    } catch (error) {
      console.error('Request OTP code error:', error);
      res.status(500).json({ error: 'Error interno al generar el código de verificación.' });
    }
  });

  // 08. Verificación del código de 6 dígitos y emisión de sesión JWT
  app.post('/api/auth/verify-code', async (req, res) => {
    try {
      const { email: rawEmail, code, name, occupation, currency } = req.body as {
        email?: string;
        code?: string;
        name?: string;
        occupation?: string;
        currency?: CurrencyCode;
      };

      const normalized = (rawEmail || '').trim().toLowerCase();
      const cleanCode = String(code || '').replace(/\D/g, '');

      if (!normalized || cleanCode.length !== 6) {
        res.status(400).json({ error: 'Debes ingresar el código completo de 6 dígitos.' });
        return;
      }

      const repo = getRepository();
      const otpRecord = await repo.getOtpVerification(normalized);

      if (!otpRecord) {
        res.status(400).json({
          error: 'No existe un código pendiente para este correo. Haz clic en reenviar código.',
        });
        return;
      }

      if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
        await repo.consumeOtpVerification(normalized);
        res.status(401).json({
          error: 'El código de 6 dígitos ha expirado. Solicita uno nuevo para ingresar.',
        });
        return;
      }

      if (otpRecord.attempts >= 5) {
        await repo.consumeOtpVerification(normalized);
        res.status(429).json({
          error: 'Superaste el número máximo de intentos. Solicita un nuevo código.',
        });
        return;
      }

      const matches = await bcrypt.compare(cleanCode, otpRecord.codeHash);
      if (!matches) {
        const attempts = await repo.incrementOtpAttempts(normalized);
        const remaining = Math.max(0, 5 - attempts);
        res.status(401).json({
          error:
            remaining > 0
              ? `Código incorrecto. Verifica los 6 dígitos (${remaining} intentos restantes).`
              : 'Código incorrecto. Se agotaron los intentos; solicita un nuevo código.',
        });
        return;
      }

      // Código válido: consumir inmediatamente (un solo uso)
      await repo.consumeOtpVerification(normalized);

      let user = await repo.findUserByEmail(normalized);
      if (!user) {
        const fallbackName = normalized
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (ch) => ch.toUpperCase());
        const randomSecretHash = await bcrypt.hash(crypto.randomUUID(), 10);

        await repo.createUser({
          name: name?.trim() || fallbackName || 'Usuario Gmail',
          email: normalized,
          passwordHash: randomSecretHash,
          occupation: occupation?.trim() || 'Gestión Personal',
          currency: (currency && ['COP', 'USD', 'MXN', 'EUR'].includes(currency)
            ? currency
            : 'COP') as CurrencyCode,
        });
        user = await repo.findUserByEmail(normalized);
      }

      if (!user) {
        res.status(500).json({ error: 'No fue posible inicializar la cuenta del usuario.' });
        return;
      }

      const token = signToken(user.id, user.email);
      const workspace = await repo.getWorkspace(user.id);
      res.json({ token, workspace });
    } catch (error) {
      console.error('Verify OTP code error:', error);
      res.status(500).json({ error: 'Error interno al validar el código de verificación.' });
    }
  });

  // 08. Inicio de sesión JWT + bcrypt
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: 'Ingresa tu correo electrónico y contraseña.' });
        return;
      }

      const repo = getRepository();
      const user = await repo.findUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Credenciales incorrectas. Verifica tu correo o contraseña.' });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Credenciales incorrectas. Verifica tu correo o contraseña.' });
        return;
      }

      const token = signToken(user.id, user.email);
      const workspace = await repo.getWorkspace(user.id);
      res.json({ token, workspace });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Error interno al iniciar sesión.' });
    }
  });

  // 08. Registro de usuario con bcrypt + JWT
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, occupation, currency } = req.body as {
        name?: string;
        email?: string;
        password?: string;
        occupation?: string;
        currency?: CurrencyCode;
      };

      if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
        res.status(400).json({
          error: 'Completa nombre, correo válido y una contraseña de mínimo 6 caracteres.',
        });
        return;
      }

      const repo = getRepository();
      const normalized = email.trim().toLowerCase();
      const existing = await repo.findUserByEmail(normalized);
      if (existing) {
        res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const created = await repo.createUser({
        name: name.trim(),
        email: normalized,
        passwordHash,
        occupation: occupation?.trim() || 'Gestión Personal',
        currency: (currency || 'COP') as CurrencyCode,
      });

      const token = signToken(created.id, created.email);
      const workspace = await repo.getWorkspace(created.id);
      res.status(201).json({ token, workspace });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'No se pudo completar el registro del usuario.' });
    }
  });

  // Estado financiero consolidado del usuario autenticado
  app.get('/api/workspace', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const workspace = await getRepository().getWorkspace(req.userId!);
      if (!workspace) {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
      res.json({ workspace });
    } catch (error) {
      console.error('Workspace load error:', error);
      res.status(500).json({ error: 'Error al cargar la información financiera.' });
    }
  });

  // 08. Perfil y preferencias
  app.put('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, occupation, currency, monthlySavingsRateGoal, currentPassword, newPassword } =
        req.body as {
          name?: string;
          occupation?: string;
          currency?: CurrencyCode;
          monthlySavingsRateGoal?: number;
          currentPassword?: string;
          newPassword?: string;
        };

      const repo = getRepository();
      const user = await repo.findUserById(req.userId!);
      if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }

      let newPasswordHash: string | undefined;
      if (newPassword) {
        if (!currentPassword) {
          res.status(400).json({ error: 'Ingresa tu contraseña actual para cambiarla.' });
          return;
        }
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) {
          res.status(400).json({ error: 'La contraseña actual no coincide.' });
          return;
        }
        if (newPassword.length < 6) {
          res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
          return;
        }
        newPasswordHash = await bcrypt.hash(newPassword, 10);
      }

      const validCurrency =
        currency && ['COP', 'USD', 'MXN', 'EUR'].includes(currency) ? currency : undefined;
      const validGoal =
        typeof monthlySavingsRateGoal === 'number' &&
        monthlySavingsRateGoal >= 0 &&
        monthlySavingsRateGoal <= 90
          ? monthlySavingsRateGoal
          : undefined;

      const updated = await repo.updateProfile(req.userId!, {
        name,
        occupation,
        currency: validCurrency,
        monthlySavingsRateGoal: validGoal,
        newPasswordHash,
      });

      res.json({ user: updated });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
    }
  });

  // Restaurar datos semilla de demostración
  app.post('/api/profile/reset-demo', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const workspace = await getRepository().resetDemoData(req.userId!);
      res.json({ workspace });
    } catch (error) {
      console.error('Demo reset error:', error);
      res.status(500).json({ error: 'No se pudieron restaurar los datos de demostración.' });
    }
  });

  // 04. Cuentas financieras
  app.post('/api/accounts', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, type, institution, accountNumber, balance } = req.body as {
        name?: string;
        type?: AccountType;
        institution?: string;
        accountNumber?: string;
        balance?: number;
      };

      if (!name?.trim() || !type) {
        res.status(400).json({ error: 'Nombre y tipo de cuenta son obligatorios.' });
        return;
      }

      const account = await getRepository().createAccount(req.userId!, {
        name: name.trim(),
        type,
        institution: institution?.trim() || 'Entidad Financiera',
        accountNumber: accountNumber?.trim() || 'S/N',
        balance: Number(balance) || 0,
      });
      res.status(201).json({ account });
    } catch (error) {
      console.error('Create account error:', error);
      res.status(500).json({ error: 'Error al registrar la cuenta financiera.' });
    }
  });

  app.put('/api/accounts/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const account = await getRepository().updateAccount(req.userId!, req.params.id, req.body);
      if (!account) {
        res.status(404).json({ error: 'Cuenta financiera no encontrada.' });
        return;
      }
      res.json({ account });
    } catch (error) {
      console.error('Update account error:', error);
      res.status(500).json({ error: 'Error al actualizar la cuenta financiera.' });
    }
  });

  app.delete('/api/accounts/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const status = await getRepository().deleteAccount(req.userId!, req.params.id);
      if (status === 'not_found') {
        res.status(404).json({ error: 'Cuenta financiera no encontrada.' });
        return;
      }
      if (status === 'has_transactions') {
        res.status(400).json({
          error: 'No se puede eliminar una cuenta con movimientos asociados. Elimina o reasigna sus movimientos primero.',
        });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ error: 'Error al eliminar la cuenta financiera.' });
    }
  });

  app.post('/api/accounts/transfer', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { fromAccountId, toAccountId, amount, note } = req.body as {
        fromAccountId?: string;
        toAccountId?: string;
        amount?: number;
        note?: string;
      };

      const parsedAmount = Number(amount);
      if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || parsedAmount <= 0) {
        res.status(400).json({ error: 'Selecciona cuentas de origen y destino distintas con un monto positivo.' });
        return;
      }

      const result = await getRepository().transferBetweenAccounts(
        req.userId!,
        fromAccountId,
        toAccountId,
        parsedAmount
      );
      res.json({
        ...result,
        message: note?.trim() || 'Transferencia ejecutada correctamente',
      });
    } catch (error: any) {
      if (error?.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Una de las cuentas seleccionadas no existe.' });
        return;
      }
      if (error?.message === 'INSUFFICIENT_FUNDS') {
        res.status(400).json({ error: 'Saldo insuficiente en la cuenta de origen para realizar la transferencia.' });
        return;
      }
      console.error('Transfer error:', error);
      res.status(500).json({ error: 'Error al procesar la transferencia entre cuentas.' });
    }
  });

  // Categorías
  app.post('/api/categories', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, type, color } = req.body as {
        name?: string;
        type?: TransactionType;
        color?: string;
      };

      if (!name?.trim() || (type !== 'ingreso' && type !== 'gasto')) {
        res.status(400).json({ error: 'Ingresa el nombre y tipo de categoría.' });
        return;
      }

      const category = await getRepository().createCategory(req.userId!, {
        name: name.trim(),
        type,
        color: color || (type === 'ingreso' ? '#16A36A' : '#14243A'),
      });
      res.status(201).json({ category });
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({ error: 'No se pudo crear la categoría.' });
    }
  });

  // 02. Ingresos y gastos
  app.post('/api/transactions', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { accountId, categoryId, type, amount, description, date, reference } = req.body as {
        accountId?: string;
        categoryId?: string;
        type?: TransactionType;
        amount?: number;
        description?: string;
        date?: string;
        reference?: string;
      };

      const parsedAmount = Number(amount);
      if (
        !accountId ||
        !categoryId ||
        (type !== 'ingreso' && type !== 'gasto') ||
        !parsedAmount ||
        parsedAmount <= 0 ||
        !description?.trim() ||
        !date
      ) {
        res.status(400).json({ error: 'Completa cuenta, categoría, monto positivo, fecha y descripción.' });
        return;
      }

      const result = await getRepository().createTransaction(req.userId!, {
        accountId,
        categoryId,
        type,
        amount: parsedAmount,
        description: description.trim(),
        date,
        reference: reference?.trim() || undefined,
      });
      res.status(201).json(result);
    } catch (error: any) {
      if (error?.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'La cuenta o categoría seleccionada no es válida.' });
        return;
      }
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'No se pudo registrar el movimiento financiero.' });
    }
  });

  app.put('/api/transactions/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.body?.amount !== undefined && Number(req.body.amount) <= 0) {
        res.status(400).json({ error: 'El monto del movimiento debe ser mayor a cero.' });
        return;
      }
      const result = await getRepository().updateTransaction(
        req.userId!,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      if (error?.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Movimiento no encontrado.' });
        return;
      }
      if (error?.message === 'ACCOUNT_NOT_FOUND') {
        res.status(404).json({ error: 'Cuenta destino no encontrada.' });
        return;
      }
      console.error('Update transaction error:', error);
      res.status(500).json({ error: 'No se pudo actualizar el movimiento financiero.' });
    }
  });

  app.delete('/api/transactions/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await getRepository().deleteTransaction(req.userId!, req.params.id);
      if (!result) {
        res.status(404).json({ error: 'Movimiento no encontrado.' });
        return;
      }
      res.json({ ok: true, account: result.account });
    } catch (error) {
      console.error('Delete transaction error:', error);
      res.status(500).json({ error: 'No se pudo eliminar el movimiento.' });
    }
  });

  // 03. Presupuestos
  app.post('/api/budgets', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { categoryId, month, limitAmount, alertThreshold } = req.body as {
        categoryId?: string;
        month?: string;
        limitAmount?: number;
        alertThreshold?: number;
      };

      const parsedLimit = Number(limitAmount);
      if (!categoryId || !month || !parsedLimit || parsedLimit <= 0) {
        res.status(400).json({ error: 'Selecciona categoría, mes y un límite presupuestal mayor a cero.' });
        return;
      }

      const budget = await getRepository().saveBudget(req.userId!, {
        categoryId,
        month,
        limitAmount: parsedLimit,
        alertThreshold: Number(alertThreshold) || 80,
      });
      res.status(201).json({ budget });
    } catch (error) {
      console.error('Save budget error:', error);
      res.status(500).json({ error: 'Error al guardar el presupuesto.' });
    }
  });

  app.delete('/api/budgets/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const deleted = await getRepository().deleteBudget(req.userId!, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Presupuesto no encontrado.' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete budget error:', error);
      res.status(500).json({ error: 'No se pudo eliminar el presupuesto.' });
    }
  });

  // 05. Gestión de deudas
  app.post('/api/debts', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        creditor,
        title,
        totalAmount,
        remainingAmount,
        monthlyInstallment,
        interestRateAnnual,
        dueDate,
        totalInstallments,
        paidInstallments,
      } = req.body as {
        creditor?: string;
        title?: string;
        totalAmount?: number;
        remainingAmount?: number;
        monthlyInstallment?: number;
        interestRateAnnual?: number;
        dueDate?: string;
        totalInstallments?: number;
        paidInstallments?: number;
      };

      if (!creditor?.trim() || !title?.trim() || !Number(totalAmount) || !dueDate) {
        res.status(400).json({ error: 'Completa entidad acreedora, concepto, monto total y fecha de vencimiento.' });
        return;
      }

      const debt = await getRepository().createDebt(req.userId!, {
        creditor: creditor.trim(),
        title: title.trim(),
        totalAmount: Number(totalAmount),
        remainingAmount:
          remainingAmount !== undefined ? Number(remainingAmount) : Number(totalAmount),
        monthlyInstallment: Number(monthlyInstallment) || 0,
        interestRateAnnual: Number(interestRateAnnual) || 0,
        dueDate,
        totalInstallments: Number(totalInstallments) || 12,
        paidInstallments: Number(paidInstallments) || 0,
      });
      res.status(201).json({ debt });
    } catch (error) {
      console.error('Create debt error:', error);
      res.status(500).json({ error: 'No se pudo registrar la obligación financiera.' });
    }
  });

  app.post('/api/debts/:id/pay', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { accountId, amount, date, note } = req.body as {
        accountId?: string;
        amount?: number;
        date?: string;
        note?: string;
      };

      const parsedAmount = Number(amount);
      if (!accountId || !parsedAmount || parsedAmount <= 0 || !date) {
        res.status(400).json({ error: 'Selecciona la cuenta de pago, fecha y un monto válido.' });
        return;
      }

      const workspace = await getRepository().payDebt(req.userId!, req.params.id, {
        accountId,
        amount: parsedAmount,
        date,
        note: note?.trim() || 'Pago cuota obligación',
      });
      res.json({ workspace });
    } catch (error: any) {
      if (error?.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Deuda o cuenta asociada no encontrada.' });
        return;
      }
      if (error?.message === 'INSUFFICIENT_FUNDS') {
        res.status(400).json({ error: 'Saldo insuficiente en la cuenta seleccionada para cubrir el pago.' });
        return;
      }
      console.error('Pay debt error:', error);
      res.status(500).json({ error: 'No se pudo procesar el pago de la obligación.' });
    }
  });

  app.delete('/api/debts/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const deleted = await getRepository().deleteDebt(req.userId!, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Deuda no encontrada.' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete debt error:', error);
      res.status(500).json({ error: 'No se pudo eliminar la obligación.' });
    }
  });

  // 06. Metas de ahorro
  app.post('/api/goals', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { title, targetAmount, currentAmount, deadline, priority } = req.body as {
        title?: string;
        targetAmount?: number;
        currentAmount?: number;
        deadline?: string;
        priority?: 'alta' | 'media' | 'baja';
      };

      if (!title?.trim() || !Number(targetAmount) || Number(targetAmount) <= 0 || !deadline) {
        res.status(400).json({ error: 'Completa el objetivo, valor esperado mayor a cero y fecha meta.' });
        return;
      }

      const goal = await getRepository().createGoal(req.userId!, {
        title: title.trim(),
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount) || 0,
        deadline,
        priority: priority || 'media',
      });
      res.status(201).json({ goal });
    } catch (error) {
      console.error('Create goal error:', error);
      res.status(500).json({ error: 'No se pudo registrar la meta de ahorro.' });
    }
  });

  app.post('/api/goals/:id/contribute', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { amount, date, note, fromAccountId, toSavingsAccountId } = req.body as {
        amount?: number;
        date?: string;
        note?: string;
        fromAccountId?: string;
        toSavingsAccountId?: string;
      };

      const parsedAmount = Number(amount);
      if (!parsedAmount || parsedAmount <= 0 || !date) {
        res.status(400).json({ error: 'Ingresa un valor de aporte positivo y la fecha.' });
        return;
      }

      const workspace = await getRepository().contributeGoal(req.userId!, req.params.id, {
        amount: parsedAmount,
        date,
        note: note?.trim() || 'Aporte voluntario a meta',
        fromAccountId,
        toSavingsAccountId,
      });
      res.json({ workspace });
    } catch (error: any) {
      if (error?.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Meta de ahorro no encontrada.' });
        return;
      }
      if (error?.message === 'INSUFFICIENT_FUNDS') {
        res.status(400).json({ error: 'Saldo insuficiente en la cuenta origen para transferir el aporte.' });
        return;
      }
      console.error('Contribute goal error:', error);
      res.status(500).json({ error: 'No se pudo registrar el aporte a la meta.' });
    }
  });

  app.delete('/api/goals/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const deleted = await getRepository().deleteGoal(req.userId!, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Meta de ahorro no encontrada.' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete goal error:', error);
      res.status(500).json({ error: 'No se pudo eliminar la meta de ahorro.' });
    }
  });

  return app;
}

async function startServer() {
  const app = await createApiApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FINANZAPP servidor integrado activo en http://0.0.0.0:${PORT}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
