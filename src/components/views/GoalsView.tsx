import React, { useMemo, useState } from 'react';
import { PiggyBank, Plus, Trash2, X } from 'lucide-react';
import type { FinanzappWorkspacePayload, SavingsGoal } from '../../shared/types';
import { formatCurrency, formatDateDisplay, getDaysUntil } from '../../lib/format';

interface GoalsViewProps {
  workspace: FinanzappWorkspacePayload;
  onCreateGoal: (payload: {
    title: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string;
    priority: 'alta' | 'media' | 'baja';
  }) => Promise<void>;
  onContributeGoal: (
    goalId: string,
    payload: {
      amount: number;
      date: string;
      note: string;
      fromAccountId?: string;
      toSavingsAccountId?: string;
    }
  ) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  workspace,
  onCreateGoal,
  onContributeGoal,
  onDeleteGoal,
}) => {
  const { user, goals, accounts } = workspace;
  const currency = user.currency;

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState('2027-06-30');
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja'>('alta');

  const [activeGoal, setActiveGoal] = useState<SavingsGoal | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState('2026-11-03');
  const [contribNote, setContribNote] = useState('');
  const [fromAcc, setFromAcc] = useState('');
  const [toAcc, setToAcc] = useState('');

  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const saved = goals.reduce((s, g) => s + g.currentAmount, 0);
    const target = goals.reduce((s, g) => s + g.targetAmount, 0);
    const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    return { saved, target, remaining: Math.max(0, target - saved), pct };
  }, [goals]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onCreateGoal({
        title,
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount) || 0,
        deadline,
        priority,
      });
      setTitle('');
      setTargetAmount('');
      setCurrentAmount('0');
      setShowCreate(false);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la meta.');
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal) return;
    setError(null);
    try {
      await onContributeGoal(activeGoal.id, {
        amount: Number(contribAmount),
        date: contribDate,
        note: contribNote,
        fromAccountId: fromAcc || undefined,
        toSavingsAccountId: toAcc || undefined,
      });
      setActiveGoal(null);
      setContribAmount('');
      setContribNote('');
    } catch (err: any) {
      setError(err.message || 'No se pudo registrar el aporte.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Ahorro acumulado en objetivos</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#16A36A]">
            {formatCurrency(summary.saved, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Valor total esperado de metas</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(summary.target, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Cumplimiento consolidado</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {summary.pct}%
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#14243A]">Metas de ahorro y patrimonio futuro</h2>
          <p className="text-xs text-slate-500">
            Define tus proyectos, realiza aportes periódicos y monitorea la cuota mensual sugerida
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="py-2 px-4 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva meta
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#14243A]">Definir nuevo objetivo de ahorro</h3>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-slate-400 hover:text-[#14243A] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de la meta
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Fondo de Emergencia, Maestría..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor objetivo ({currency})
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saldo inicial ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha límite
              </label>
              <input
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Prioridad:</span>
              {(['alta', 'media', 'baja'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md capitalize cursor-pointer ${
                    priority === p
                      ? 'bg-[#14243A] text-white'
                      : 'bg-[#F3F6FA] text-slate-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="py-2 px-5 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg cursor-pointer"
            >
              Guardar meta
            </button>
          </div>
        </form>
      )}

      {/* Modal de aporte */}
      {activeGoal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#14243A]">Registrar aporte a meta</h3>
              <button
                type="button"
                onClick={() => setActiveGoal(null)}
                className="text-slate-400 hover:text-[#14243A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleContribute} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Meta: <strong className="text-[#14243A]">{activeGoal.title}</strong> · Restante{' '}
                <span className="font-mono font-semibold">
                  {formatCurrency(
                    Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount),
                    currency
                  )}
                </span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Monto del aporte ({currency})
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={contribDate}
                    onChange={(e) => setContribDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {accounts.length >= 2 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Trasladar desde (opcional)
                    </label>
                    <select
                      value={fromAcc}
                      onChange={(e) => setFromAcc(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">Sin traslado bancario</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Cuenta ahorro destino
                    </label>
                    <select
                      value={toAcc}
                      onChange={(e) => setToAcc(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">Seleccionar destino</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nota del aporte
                </label>
                <input
                  type="text"
                  value={contribNote}
                  onChange={(e) => setContribNote(e.target.value)}
                  placeholder="Ej. Ahorro programado quincenal"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveGoal(null)}
                  className="py-2 px-4 text-xs font-semibold text-slate-700 bg-[#F3F6FA] rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg cursor-pointer"
                >
                  Sumar aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grilla de metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {goals.map((goal) => {
          const pct =
            goal.targetAmount > 0
              ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
              : 0;
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
          const daysRemaining = Math.max(1, getDaysUntil(goal.deadline));
          const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
          const suggestedMonthly = remaining > 0 ? Math.ceil(remaining / monthsRemaining) : 0;

          return (
            <div
              key={goal.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[#14243A]">{goal.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">
                      Prioridad {goal.priority} · Fecha meta {formatDateDisplay(goal.deadline)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveGoal(goal);
                        setContribAmount(suggestedMonthly ? String(suggestedMonthly) : '');
                      }}
                      className="py-1.5 px-3 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <PiggyBank className="w-3.5 h-3.5" /> Aportar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      className="p-1.5 text-slate-400 hover:text-[#DC2626] rounded-md cursor-pointer"
                      title="Eliminar meta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between font-mono tabular-nums mb-1.5">
                    <span className="text-lg font-bold text-[#14243A]">
                      {formatCurrency(goal.currentAmount, currency)}
                    </span>
                    <span className="text-xs text-slate-500">
                      de {formatCurrency(goal.targetAmount, currency)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#F3F6FA] rounded-full overflow-hidden">
                    <div className="h-full bg-[#16A36A]" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {remaining === 0 ? (
                      <span className="text-[#16A36A] font-semibold">Meta alcanzada al 100%</span>
                    ) : (
                      <>
                        Aporte mensual sugerido:{' '}
                        <span className="font-mono tabular-nums font-semibold text-[#14243A]">
                          {formatCurrency(suggestedMonthly, currency)}/mes
                        </span>{' '}
                        durante {monthsRemaining} {monthsRemaining === 1 ? 'mes' : 'meses'}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {goal.contributions.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Aportes recientes:</p>
                  <div className="space-y-1">
                    {goal.contributions.slice(0, 2).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs text-slate-500"
                      >
                        <span className="truncate pr-2">
                          {formatDateDisplay(c.date)} · {c.note}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-[#16A36A] shrink-0">
                          +{formatCurrency(c.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
