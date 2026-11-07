import React, { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import type { CurrencyCode, FinanzappWorkspacePayload } from '../../shared/types';
import { UserAvatar } from '../../lib/avatars';

interface SettingsViewProps {
  workspace: FinanzappWorkspacePayload;
  onUpdateProfile: (payload: {
    name: string;
    occupation: string;
    currency: CurrencyCode;
    monthlySavingsRateGoal: number;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  onResetDemoData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  workspace,
  onUpdateProfile,
  onResetDemoData,
}) => {
  const { user, categories } = workspace;

  const [name, setName] = useState(user.name);
  const [occupation, setOccupation] = useState(user.occupation);
  const [currency, setCurrency] = useState<CurrencyCode>(user.currency);
  const [savingsGoal, setSavingsGoal] = useState(String(user.monthlySavingsRateGoal));

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      await onUpdateProfile({
        name,
        occupation,
        currency,
        monthlySavingsRateGoal: Number(savingsGoal) || 20,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({ kind: 'ok', text: 'Preferencias y perfil actualizados correctamente.' });
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err.message || 'Error al guardar cambios.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-medium ${
            feedback.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario de perfil y preferencias */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
            <UserAvatar
              name={user.name}
              avatarKey={user.avatarKey}
              sizeClass="w-14 h-14 text-base"
            />
            <div>
              <h2 className="text-base font-bold text-[#14243A]">{user.name}</h2>
              <p className="text-xs text-slate-500">
                {user.email} · Cuenta activa en FINANZAPP
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nombre completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Ocupación / Perfil profesional
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Moneda de visualización
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              >
                <option value="COP">COP — Peso Colombiano ($)</option>
                <option value="USD">USD — Dólar Estadounidense ($)</option>
                <option value="MXN">MXN — Peso Mexicano ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Meta mensual de ahorro (% sobre ingresos)
              </label>
              <input
                type="number"
                min="0"
                max="90"
                value={savingsGoal}
                onChange={(e) => setSavingsGoal(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-[#14243A] mb-3">
              Actualizar contraseña (cifrado bcrypt)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Contraseña actual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Dejar vacío para no cambiar"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-5 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Guardando...' : 'Guardar preferencias'}
            </button>
          </div>
        </form>

        {/* Categorías y utilidades de entorno académico */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-bold text-[#14243A]">
              Catálogo de categorías ({categories.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Rubros activos para clasificar ingresos y gastos
            </p>
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
              {categories.map((c) => (
                <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-[#14243A]">{c.name}</span>
                  <span className="text-slate-500 capitalize">{c.type}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-base font-bold text-[#14243A]">
              Datos de prueba y entorno Docker local
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Configurado para ejecutarse mediante <span className="font-mono">Docker Compose</span>{' '}
              con <span className="font-semibold">PostgreSQL 16</span> en red interna aislada,
              persistencia en el volumen <span className="font-mono">finanzapp_data</span>, control
              de versiones en <span className="font-semibold">GitHub Free</span> e integración
              continua con <span className="font-semibold">Jenkins local</span> y{' '}
              <span className="font-semibold">Travis CI</span>.
            </p>

            {confirmReset ? (
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onResetDemoData();
                    setConfirmReset(false);
                    setFeedback({
                      kind: 'ok',
                      text: 'Datos iniciales de prueba restaurados con éxito.',
                    });
                  }}
                  className="py-2 px-3.5 text-xs font-semibold text-white bg-[#DC2626] rounded-lg cursor-pointer"
                >
                  Confirmar restauración
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="py-2 px-3 text-xs font-semibold text-slate-600 bg-[#F3F6FA] rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="py-2 px-4 text-xs font-semibold text-[#14243A] bg-[#F3F6FA] hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar datos iniciales de prueba
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
