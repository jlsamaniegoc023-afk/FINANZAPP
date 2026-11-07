import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApiApp } from '../server.ts';

async function withTestServer(fn: (baseUrl: string) => Promise<void>) {
  process.env.NODE_ENV = 'test';
  const app = await createApiApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('FINANZAPP API — Ingreso Gmail con código aleatorio de 6 dígitos + consistencia contable', async () => {
  await withTestServer(async (baseUrl) => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { status: string };
    assert.equal(healthJson.status, 'ok');

    // 0. Verificar estado de SMTP y validación de configuración
    const smtpStatusRes = await fetch(`${baseUrl}/api/auth/smtp-status`);
    assert.equal(smtpStatusRes.status, 200);
    const smtpStatusJson = (await smtpStatusRes.json()) as { configured: boolean };
    assert.ok(typeof smtpStatusJson.configured === 'boolean');

    const invalidSmtpRes = await fetch(`${baseUrl}/api/auth/configure-smtp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(invalidSmtpRes.status, 400);

    // 1. Solicitar código aleatorio de 6 dígitos al correo Gmail
    const reqCodeRes = await fetch(`${baseUrl}/api/auth/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carlos.mendoza.finanzapp@gmail.com',
      }),
    });
    assert.equal(reqCodeRes.status, 200);
    const reqCodeJson = (await reqCodeRes.json()) as {
      ok: boolean;
      email: string;
      sandboxCode?: string;
    };
    assert.equal(reqCodeJson.ok, true);
    assert.ok(reqCodeJson.sandboxCode && /^\d{6}$/.test(reqCodeJson.sandboxCode));

    // 2. Verificar rechazo de un código incorrecto
    const wrongCode = reqCodeJson.sandboxCode === '000000' ? '111111' : '000000';
    const badVerifyRes = await fetch(`${baseUrl}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: reqCodeJson.email,
        code: wrongCode,
      }),
    });
    assert.equal(badVerifyRes.status, 401);

    // 3. Verificar ingreso exitoso con el código de 6 dígitos correcto
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: reqCodeJson.email,
        code: reqCodeJson.sandboxCode,
      }),
    });
    assert.equal(verifyRes.status, 200);
    const loginJson = (await verifyRes.json()) as {
      token: string;
      workspace: {
        accounts: { id: string; balance: number }[];
        categories: { id: string; type: string }[];
      };
    };
    assert.ok(loginJson.token.length > 20);
    assert.ok(loginJson.workspace.accounts.length >= 1);

    // 4. Confirmar que el código es de un solo uso
    const reuseRes = await fetch(`${baseUrl}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: reqCodeJson.email,
        code: reqCodeJson.sandboxCode,
      }),
    });
    assert.equal(reuseRes.status, 400);

    // 5. Registrar y eliminar movimiento verificando consistencia de saldo
    const targetAccount = loginJson.workspace.accounts[0];
    const incomeCategory = loginJson.workspace.categories.find((c) => c.type === 'ingreso')!;

    const createTxRes = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginJson.token}`,
      },
      body: JSON.stringify({
        accountId: targetAccount.id,
        categoryId: incomeCategory.id,
        type: 'ingreso',
        amount: 100000,
        description: 'Prueba automatizada CI OTP',
        date: '2026-11-04',
      }),
    });
    assert.equal(createTxRes.status, 201);
    const createdPayload = (await createTxRes.json()) as {
      transaction: { id: string };
      account: { balance: number };
    };
    assert.equal(createdPayload.account.balance, targetAccount.balance + 100000);

    const deleteTxRes = await fetch(
      `${baseUrl}/api/transactions/${createdPayload.transaction.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${loginJson.token}` },
      }
    );
    assert.equal(deleteTxRes.status, 200);
  });
});
