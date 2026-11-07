import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';

export function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hasValidGmailSmtpCredentials(): boolean {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').trim();
  if (!user || !pass) return false;
  if (user.startsWith('MY_') || pass.startsWith('MY_')) return false;
  return true;
}

export function getSmtpConfigStatus(): {
  configured: boolean;
  senderEmail: string | null;
} {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').trim();
  const isValid = Boolean(user && pass && !user.startsWith('MY_') && !pass.startsWith('MY_'));
  return {
    configured: isValid,
    senderEmail: isValid ? user : null,
  };
}

export async function verifyAndSaveSmtpCredentials(
  user: string,
  pass: string
): Promise<{ ok: boolean; senderEmail: string }> {
  const cleanUser = user.trim().toLowerCase();
  const cleanPass = pass.replace(/\s+/g, '').trim();

  if (!cleanUser || !cleanPass) {
    throw new Error('Debes proporcionar el correo Gmail y la contraseña de aplicación de 16 caracteres.');
  }

  // Verificar conexión real con los servidores de Google antes de guardar
  const testTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: cleanUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await testTransporter.verify();
  } catch (error: any) {
    const errorMsg = error?.message || 'Error de autenticación con Gmail SMTP';
    console.error('Fallo de verificación Gmail SMTP:', errorMsg);
    if (errorMsg.includes('Username and Password not accepted') || errorMsg.includes('535')) {
      throw new Error(
        'Google rechazó las credenciales. Asegúrate de usar una "Contraseña de aplicación" de 16 caracteres generada en https://myaccount.google.com/apppasswords (no tu contraseña normal de Google).'
      );
    }
    throw new Error(`No se pudo conectar a smtp.gmail.com: ${errorMsg}`);
  }

  // Si la verificación fue exitosa, actualizar en memoria y persistir en .env
  process.env.GMAIL_USER = cleanUser;
  process.env.GMAIL_APP_PASSWORD = cleanPass;

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = '';
    try {
      content = await fs.readFile(envPath, 'utf-8');
    } catch {
      content = '';
    }

    const setEnvVar = (raw: string, key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(raw)) {
        return raw.replace(regex, `${key}="${value}"`);
      }
      return `${raw}\n${key}="${value}"`;
    };

    let updated = setEnvVar(content, 'GMAIL_USER', cleanUser);
    updated = setEnvVar(updated, 'GMAIL_APP_PASSWORD', cleanPass);
    await fs.writeFile(envPath, updated.trim() + '\n', 'utf-8');
  } catch (err) {
    console.warn('No se pudo escribir en el archivo .env:', err);
  }

  return { ok: true, senderEmail: cleanUser };
}

export async function sendVerificationCodeEmail(
  recipientEmail: string,
  code: string
): Promise<{
  delivery: 'gmail_smtp' | 'sandbox_preview';
  senderEmail?: string;
  sandboxCode?: string;
  message?: string;
}> {
  if (!hasValidGmailSmtpCredentials() || process.env.NODE_ENV === 'test') {
    console.log(
      `[FINANZAPP OTP Sandbox] Código generado para ${recipientEmail}: ${code} (SMTP no configurado)`
    );
    return {
      delivery: 'sandbox_preview',
      sandboxCode: code,
      message:
        'Servidor en modo local: No hay credenciales de Gmail SMTP configuradas. Configura GMAIL_USER y GMAIL_APP_PASSWORD para enviar a bandejas reales.',
    };
  }

  const smtpUser = process.env.GMAIL_USER!.trim();
  const smtpPass = process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await transporter.sendMail({
      from: `"FINANZAPP Seguridad" <${smtpUser}>`,
      to: recipientEmail,
      subject: `${code} es tu código de verificación para FINANZAPP`,
      text: `Hola,\n\nTu código aleatorio de 6 dígitos para ingresar a FINANZAPP es: ${code}\n\nEste código vence en 10 minutos y es de un solo uso.\nSi no solicitaste este acceso, puedes ignorar este mensaje de forma segura.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F3F6FA; padding: 32px 16px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="background-color: #14243A; padding: 22px 28px; color: #FFFFFF;">
              <strong style="font-size: 20px; letter-spacing: -0.02em;">FINANZAPP</strong>
              <div style="font-size: 12px; color: #94A3B8; margin-top: 4px;">Plataforma de Administración Financiera Personal</div>
            </div>
            <div style="padding: 28px; color: #14243A;">
              <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: #334155;">
                Hola, hemos recibido una solicitud de ingreso con tu correo en <strong>FINANZAPP</strong>. Usa el siguiente código aleatorio de 6 dígitos para continuar:
              </p>
              <div style="margin: 22px 0; padding: 20px; background-color: #F3F6FA; border: 1px solid #E2E8F0; border-radius: 10px; text-align: center;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; margin-bottom: 6px; font-weight: 600;">Código de verificación</div>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 10px; color: #14243A;">
                  ${code}
                </span>
              </div>
              <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                ⏱️ Este código es válido por <strong>10 minutos</strong> y sólo puede usarse una vez.<br/>
                🔒 Si no solicitaste este código, puedes ignorar este correo; nadie puede ingresar a tu cuenta sin él.
              </p>
            </div>
            <div style="padding: 16px 28px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8;">
              FINANZAPP · Proyecto de Integración Continua · Seguridad de Acceso
            </div>
          </div>
        </div>
      `,
    });

    console.log(`[FINANZAPP OTP] Correo con código enviado exitosamente a ${recipientEmail} desde ${smtpUser}`);
    return {
      delivery: 'gmail_smtp',
      senderEmail: smtpUser,
    };
  } catch (error: any) {
    const errorMsg = error?.message || 'Fallo desconocido al enviar correo vía Gmail';
    console.error(`[FINANZAPP OTP] Error enviando correo a ${recipientEmail}:`, errorMsg);
    throw new Error(`Fallo en el servicio de Gmail: ${errorMsg}`);
  }
}
