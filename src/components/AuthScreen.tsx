import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Mail,
  RefreshCw,
  Settings,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { UserAvatar } from '../lib/avatars';
import type {
  CurrencyCode,
  FinanzappWorkspacePayload,
  OtpChallengeResponse,
  SmtpStatusResponse,
} from '../shared/types';

interface DemoUserSummary {
  id: string;
  name: string;
  email: string;
  occupation: string;
  currency: CurrencyCode;
  avatarKey: string;
}

interface AuthScreenProps {
  onAuthenticated: (token: string, workspace: FinanzappWorkspacePayload) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [demoUsers, setDemoUsers] = useState<DemoUserSummary[]>([]);

  const [email, setEmail] = useState('carlos.mendoza.finanzapp@gmail.com');
  const [verifiedTargetEmail, setVerifiedTargetEmail] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('COP');

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [deliveryMode, setDeliveryMode] = useState<'gmail_smtp' | 'sandbox_preview' | null>(null);
  const [senderEmailUsed, setSenderEmailUsed] = useState<string | undefined>(undefined);
  const [sandboxCode, setSandboxCode] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Estado del servicio SMTP
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatusResponse>({
    configured: false,
    senderEmail: null,
  });
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [smtpFormUser, setSmtpFormUser] = useState('');
  const [smtpFormPass, setSmtpFormPass] = useState('');
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [smtpSuccess, setSmtpSuccess] = useState<string | null>(null);

  const fetchSmtpStatus = () => {
    apiRequest<SmtpStatusResponse>('/api/auth/smtp-status')
      .then((res) => {
        setSmtpStatus(res);
        if (res.senderEmail) {
          setSmtpFormUser(res.senderEmail);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchSmtpStatus();
    apiRequest<{ users: DemoUserSummary[] }>('/api/auth/demo-users')
      .then((res) => setDemoUsers(res.users))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== 'code' || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, secondsLeft]);

  const formatCountdown = (totalSecs: number): string => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const requestVerificationCode = async (targetEmailInput: string) => {
    setError(null);
    setLoading(true);
    try {
      let candidate = targetEmailInput.trim().toLowerCase();
      if (candidate && !candidate.includes('@')) {
        candidate = `${candidate}@gmail.com`;
        setEmail(candidate);
      }

      const res = await apiRequest<OtpChallengeResponse>('/api/auth/request-code', {
        method: 'POST',
        body: { email: candidate },
      });

      setVerifiedTargetEmail(res.email);
      setIsNewUser(res.isNewUser);
      setSecondsLeft(res.expiresInSeconds);
      setDeliveryMode(res.delivery);
      setSenderEmailUsed(res.senderEmail);
      setSandboxCode(res.sandboxCode);
      setDigits(['', '', '', '', '', '']);
      setStep('code');

      window.setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 60);
    } catch (err: any) {
      setError(err.message || 'No fue posible enviar el código de verificación.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestVerificationCode(email);
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, '');
    if (!onlyDigits) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    if (onlyDigits.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 6; i += 1) {
        if (index + i < 6 && onlyDigits[i]) {
          next[index + i] = onlyDigits[i];
        }
      }
      setDigits(next);
      const focusIdx = Math.min(5, index + onlyDigits.length);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = onlyDigits[0];
    setDigits(next);
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePasteDigits = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i];
    }
    setDigits(next);
    inputRefs.current[Math.min(5, pasted.length - 1)]?.focus();
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = digits.join('');
    if (fullCode.length !== 6) {
      setError('Ingresa los 6 dígitos del código de verificación.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; workspace: FinanzappWorkspacePayload }>(
        '/api/auth/verify-code',
        {
          method: 'POST',
          body: {
            email: verifiedTargetEmail,
            code: fullCode,
            name: isNewUser ? name : undefined,
            occupation: isNewUser ? occupation : undefined,
            currency: isNewUser ? currency : undefined,
          },
        }
      );
      onAuthenticated(res.token, res.workspace);
    } catch (err: any) {
      setError(err.message || 'El código ingresado no es válido.');
    } finally {
      setLoading(false);
    }
  };

  const fillSandboxCode = (codeStr: string) => {
    const clean = codeStr.replace(/\D/g, '').slice(0, 6).split('');
    setDigits([
      clean[0] || '',
      clean[1] || '',
      clean[2] || '',
      clean[3] || '',
      clean[4] || '',
      clean[5] || '',
    ]);
    navigator.clipboard?.writeText(codeStr).then(() => {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const handleConfigureSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpLoading(true);
    setSmtpError(null);
    setSmtpSuccess(null);

    try {
      const res = await apiRequest<{ ok: boolean; senderEmail: string }>(
        '/api/auth/configure-smtp',
        {
          method: 'POST',
          body: {
            gmailUser: smtpFormUser,
            gmailAppPassword: smtpFormPass,
          },
        }
      );

      setSmtpSuccess(
        `¡Conexión verificada exitosamente! Se configuró "${res.senderEmail}" como remitente activo de FINANZAPP.`
      );
      setSmtpStatus({ configured: true, senderEmail: res.senderEmail });
      fetchSmtpStatus();
    } catch (err: any) {
      setSmtpError(err.message || 'Error al conectar con los servidores SMTP de Google.');
    } finally {
      setSmtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FA] flex flex-col lg:flex-row">
      {/* Columna institucional izquierda */}
      <div className="lg:w-[46%] bg-[#14243A] text-white p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold tracking-tight font-display">FINANZAPP</span>
            <span className="text-xs text-slate-300">Administración Financiera Personal</span>
          </div>

          <div className="mt-10 lg:mt-14 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Autenticación por Código Aleatorio de 6 Dígitos</span>
            </div>
            <h1
              className="text-3xl lg:text-4xl font-bold leading-tight text-white"
              style={{ textWrap: 'balance' }}
            >
              Control claro sobre tu patrimonio, flujo mensual, deudas y metas de ahorro.
            </h1>
            <p className="mt-4 text-sm lg:text-base text-slate-300 leading-relaxed">
              Ingresa con tu correo Gmail: al hacer clic en <strong>Ingresar</strong>, el sistema
              despacha un código numérico aleatorio de 6 dígitos con vigencia de 10 minutos y uso
              único para garantizar la seguridad de tu información.
            </p>
          </div>

          {/* Estado de conectividad de Gmail SMTP */}
          <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10 max-w-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    smtpStatus.configured ? 'bg-[#16A36A] animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs font-semibold text-slate-200">
                  {smtpStatus.configured
                    ? 'Remitente Gmail SMTP Activo'
                    : 'Modo Local / SMTP Sin Configurar'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSmtpModal(true);
                  setSmtpError(null);
                  setSmtpSuccess(null);
                }}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{smtpStatus.configured ? 'Cambiar remitente' : 'Configurar Gmail'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {smtpStatus.configured ? (
                <>
                  Los correos se envían directamente a bandejas reales desde{' '}
                  <span className="font-mono text-emerald-300 font-medium">
                    {smtpStatus.senderEmail}
                  </span>
                  .
                </>
              ) : (
                'Para enviar el código a tu bandeja real de Gmail, conecta tus credenciales SMTP de Google. En modo local el código se genera y muestra en pantalla.'
              )}
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 gap-6 max-w-lg">
            <div>
              <p className="text-2xl font-semibold font-mono tabular-nums text-white">08 Módulos</p>
              <p className="text-xs text-slate-300 mt-1">
                Dashboard · Movimientos · Presupuestos · Cuentas · Deudas · Metas · Reportes · Perfil
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold font-mono tabular-nums text-[#16A36A]">
                PostgreSQL 16
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Docker Compose · Jenkins · Travis CI · Sesiones seguras JWT
              </p>
            </div>
          </div>
        </div>

        {/* Selección rápida de cuentas Gmail de prueba */}
        {demoUsers.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs font-medium text-slate-300 mb-3">
              Cuentas Gmail de demostración precargadas (ingresar en 1 clic):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {demoUsers.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(demo.email);
                    requestVerificationCode(demo.email);
                  }}
                  className="text-left p-3 rounded-lg bg-[#1C314E] hover:bg-[#264166] border border-white/10 transition-colors flex items-center gap-3 group cursor-pointer disabled:opacity-60"
                >
                  <UserAvatar
                    name={demo.name}
                    avatarKey={demo.avatarKey}
                    sizeClass="w-9 h-9 text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{demo.name}</p>
                    <p className="text-xs text-slate-300 truncate">{demo.email}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#16A36A] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Columna de autenticación en 2 pasos */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-7 sm:p-9 shadow-sm">
          {step === 'email' ? (
            <>
              <div className="mb-6">
                <p className="text-xs font-semibold text-[#16A36A] mb-1">Paso 1 de 2</p>
                <h2 className="text-xl font-bold text-[#14243A]">
                  Ingresa con tu correo Gmail
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Enviaremos un código aleatorio de 6 dígitos a tu correo apenas hagas clic en
                  Ingresar.
                </p>
              </div>

              {/* Indicador de estado del envío */}
              <div
                className={`mb-5 p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                  smtpStatus.configured
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-900'
                }`}
              >
                {smtpStatus.configured ? (
                  <CheckCircle2 className="w-4 h-4 text-[#16A36A] shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  {smtpStatus.configured ? (
                    <p>
                      <strong>Envío real activo:</strong> El código llegará directamente a tu
                      bandeja de Gmail desde{' '}
                      <span className="font-mono font-medium">{smtpStatus.senderEmail}</span>.
                    </p>
                  ) : (
                    <div>
                      <p>
                        <strong>Modo local de pruebas activo:</strong> El código se generará al
                        hacer clic en Ingresar y se mostrará en pantalla.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSmtpModal(true);
                          setSmtpError(null);
                          setSmtpSuccess(null);
                        }}
                        className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline mt-1 block cursor-pointer"
                      >
                        ¿Deseas que llegue a tu bandeja real de Gmail? Haz clic aquí para
                        configurarlo.
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{error}</p>
                    {error.includes('Gmail') && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSmtpModal(true);
                          setSmtpError(null);
                          setSmtpSuccess(null);
                        }}
                        className="text-xs underline font-semibold text-red-800 mt-1 cursor-pointer"
                      >
                        Revisar credenciales de remitente Gmail
                      </button>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Correo electrónico Gmail
                    </label>
                    {email && !email.includes('@') && (
                      <button
                        type="button"
                        onClick={() => setEmail(`${email.trim()}@gmail.com`)}
                        className="text-xs font-mono font-semibold text-[#16A36A] hover:underline cursor-pointer"
                      >
                        Completar @gmail.com
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu.nombre@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Puedes escribir cualquier correo (ej. tu cuenta personal{' '}
                    <span className="font-mono text-slate-600">jlsamaniegoc023@gmail.com</span>).
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#16A36A] hover:bg-[#128757] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  <span>{loading ? 'Generando y enviando código...' : 'Ingresar'}</span>
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setError(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-[#14243A] flex items-center gap-1 mb-3 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Cambiar correo Gmail
                </button>
                <p className="text-xs font-semibold text-[#16A36A] mb-1">Paso 2 de 2</p>
                <h2 className="text-xl font-bold text-[#14243A]">
                  Código de verificación
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Digita el código aleatorio de 6 dígitos para{' '}
                  <span className="font-mono font-medium text-[#14243A]">
                    {verifiedTargetEmail}
                  </span>
                </p>
              </div>

              {deliveryMode === 'gmail_smtp' && (
                <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A36A] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">¡Código enviado a tu bandeja de Gmail!</p>
                    <p className="text-emerald-800 mt-0.5 leading-relaxed">
                      Remitente: <span className="font-mono font-medium">{senderEmailUsed}</span>.
                      Revisa tu bandeja principal y la carpeta de Notificaciones o Spam si es la
                      primera vez que recibes un correo de FINANZAPP.
                    </p>
                  </div>
                </div>
              )}

              {deliveryMode === 'sandbox_preview' && sandboxCode && (
                <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#14243A] flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#16A36A]" />
                      Código generado para este acceso:
                    </span>
                    <button
                      type="button"
                      onClick={() => fillSandboxCode(sandboxCode)}
                      className="text-xs font-semibold text-[#16A36A] hover:text-[#128757] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3 h-3 text-[#16A36A]" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Autocompletar
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
                    <span className="font-mono text-2xl font-bold tracking-[8px] text-[#14243A]">
                      {sandboxCode}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-start justify-between gap-2 pt-1 border-t border-slate-200">
                    <span>
                      Modo local activo. Para recibirlo en tu correo real, configura las
                      credenciales SMTP de Google.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSmtpModal(true);
                        setSmtpError(null);
                        setSmtpSuccess(null);
                      }}
                      className="font-semibold text-emerald-700 hover:underline shrink-0 cursor-pointer"
                    >
                      Configurar Gmail
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifySubmit} className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#14243A]" />
                      Código de 6 dígitos
                    </label>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      Expira en {formatCountdown(secondsLeft)}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {digits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        onPaste={handlePasteDigits}
                        aria-label={`Dígito ${idx + 1}`}
                        className="w-full h-12 text-center text-lg font-bold font-mono tabular-nums text-[#14243A] bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#16A36A]"
                      />
                    ))}
                  </div>
                </div>

                {isNewUser && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <p className="text-xs font-semibold text-[#14243A]">
                      Completa los datos iniciales de tu perfil nuevo:
                    </p>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nombre completo
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ej. Julián Samaniego"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ocupación
                        </label>
                        <div className="relative">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={occupation}
                            onChange={(e) => setOccupation(e.target.value)}
                            placeholder="Ingeniería..."
                            className="w-full pl-8 pr-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Moneda base
                        </label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="COP">COP ($)</option>
                          <option value="USD">USD ($)</option>
                          <option value="MXN">MXN ($)</option>
                          <option value="EUR">EUR (€)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || digits.join('').length !== 6}
                  className="w-full py-2.5 px-4 bg-[#16A36A] hover:bg-[#128757] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  {loading ? 'Validando código...' : 'Verificar código e ingresar'}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>¿No recibiste el código?</span>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => requestVerificationCode(verifiedTargetEmail)}
                  className="font-semibold text-[#14243A] hover:text-[#16A36A] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reenviar código
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Configuración Gmail SMTP */}
      {showSmtpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-[#14243A] text-white rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base">Configuración de Remitente Gmail</h3>
                  <p className="text-xs text-slate-300">
                    Envío real de correos mediante Google SMTP (puerto 465 SSL)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSmtpModal(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2">
                <p className="font-semibold text-[#14243A]">
                  ¿Cómo funciona el envío a bandejas reales de Gmail?
                </p>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                  <li>
                    Google exige usar una <strong>Contraseña de Aplicación de 16 caracteres</strong>{' '}
                    (no tu contraseña personal habitual).
                  </li>
                  <li>
                    Ingresa a tu cuenta de Google en:{' '}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      myaccount.google.com/apppasswords
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Crea una aplicación con el nombre &quot;FINANZAPP&quot;.</li>
                  <li>
                    Copia la clave generada de 16 letras (ejemplo:{' '}
                    <span className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">
                      abcd efgh ijkl mnop
                    </span>
                    ) y pégala aquí abajo.
                  </li>
                </ol>
              </div>

              {smtpSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16A36A] shrink-0 mt-0.5" />
                  <span>{smtpSuccess}</span>
                </div>
              )}

              {smtpError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{smtpError}</span>
                </div>
              )}

              <form onSubmit={handleConfigureSmtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Gmail remitente
                  </label>
                  <input
                    type="email"
                    required
                    value={smtpFormUser}
                    onChange={(e) => setSmtpFormUser(e.target.value)}
                    placeholder="ejemplo@gmail.com"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Desde esta dirección saldrán los correos con los códigos de 6 dígitos.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contraseña de aplicación de Google (16 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    value={smtpFormPass}
                    onChange={(e) => setSmtpFormPass(e.target.value)}
                    placeholder="16 caracteres generados por Google"
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Google genera esta clave tras activar la verificación en dos pasos.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSmtpModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={smtpLoading || !smtpFormUser || !smtpFormPass}
                    className="px-5 py-2.5 bg-[#16A36A] hover:bg-[#128757] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {smtpLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verificando con Google...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Verificar y Guardar Remitente</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
