import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import type { FinanzappWorkspacePayload } from '../../shared/types';
import { formatCurrency, formatMonthLabel } from '../../lib/format';

interface BudgetsViewProps {
  workspace: FinanzappWorkspacePayload;
  selectedMonth: string;
  onSaveBudget: (payload: {
    categoryId: string;
    month: string;
    limitAmount: number;
    alertThreshold: number;
  }) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  workspace,
  selectedMonth,
  onSaveBudget,
  onDeleteBudget,
}) => {
  const { user, categories, budgets, transactions } = workspace;
  const currency = user.currency;

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'gasto'),
    [categories]
  );

  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id || '');
  const [limitAmount, setLimitAmount] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const budgetRows = useMemo(() => {
    const monthBudgets = budgets.filter((b) => b.month === selectedMonth);
    return monthBudgets
      .map((b) => {
        const cat = expenseCategories.find((c) => c.id === b.categoryId);
        const spent = transactions
          .filter(
            (tx) =>
              tx.type === 'gasto' &&
              tx.categoryId === b.categoryId &&
              tx.date.startsWith(selectedMonth)
          )
          .reduce((sum, tx) => sum + tx.amount, 0);
        const remaining = b.limitAmount - spent;
        const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0;
        return {
          ...b,
          categoryName: cat?.name || 'Categoría',
          spent,
          remaining,
          pct,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, expenseCategories, transactions, selectedMonth]);

  const totals = useMemo(() => {
    const totalLimit = budgetRows.reduce((s, r) => s + r.limitAmount, 0);
    const totalSpent = budgetRows.reduce((s, r) => s + r.spent, 0);
    const globalPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
    return { totalLimit, totalSpent, remaining: totalLimit - totalSpent, globalPct };
  }, [budgetRows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(limitAmount);
    if (!categoryId || !num || num <= 0) {
      setError('Selecciona una categoría y define un límite mayor a cero.');
      return;
    }
    setSaving(true);
    try {
      await onSaveBudget({
        categoryId,
        month: selectedMonth,
        limitAmount: num,
        alertThreshold: Number(alertThreshold) || 80,
      });
      setLimitAmount('');
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadForEdit = (catId: string, limit: number, threshold: number) => {
    setCategoryId(catId);
    setLimitAmount(String(limit));
    setAlertThreshold(String(threshold));
  };

  return (
    <div className="space-y-6">
      {/* Resumen presupuestal del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Presupuesto asignado · {formatMonthLabel(selectedMonth)}
          </p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(totals.totalLimit, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Consumo acumulado en categorías</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(totals.totalSpent, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {totals.globalPct}% del techo mensual utilizado
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Margen disponible restante</p>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              totals.remaining >= 0 ? 'text-[#16A36A]' : 'text-[#DC2626]'
            }`}
          >
            {formatCurrency(totals.remaining, currency)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulario lateral para fijar o editar límite */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#14243A]">
            Definir límite por categoría
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Asigna o actualiza el tope máximo mensual para {formatMonthLabel(selectedMonth)}.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Categoría de gasto
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Límite mensual ({currency})
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="Ej. 1200000"
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Umbral preventivo de alerta (%)
              </label>
              <input
                type="number"
                min="50"
                max="100"
                required
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar presupuesto mensual'}
            </button>
          </form>
        </div>

        {/* Lista de seguimiento por categoría */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          <div className="px-6 py-4">
            <h2 className="text-base font-bold text-[#14243A]">
              Control de cumplimiento por categoría
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Haz clic en cualquier fila para ajustar su tope presupuestal
            </p>
          </div>

          {budgetRows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">
                Aún no existen presupuestos definidos para {formatMonthLabel(selectedMonth)}.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Utiliza el formulario de la izquierda para establecer tu primer límite de gasto.
              </p>
            </div>
          ) : (
            budgetRows.map((row) => {
              const isOver = row.pct > 100;
              const isWarn = !isOver && row.pct >= row.alertThreshold;
              const barColor = isOver
                ? 'bg-[#DC2626]'
                : isWarn
                ? 'bg-[#D97706]'
                : 'bg-[#16A36A]';

              return (
                <div
                  key={row.id}
                  onClick={() =>
                    handleLoadForEdit(row.categoryId, row.limitAmount, row.alertThreshold)
                  }
                  className="p-5 hover:bg-[#F3F6FA]/60 transition-colors cursor-pointer"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
                    <div>
                      <p className="text-sm font-bold text-[#14243A]">{row.categoryName}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        {isOver ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
                            <span className="text-[#DC2626] font-medium">
                              Presupuesto excedido en{' '}
                              {formatCurrency(Math.abs(row.remaining), currency)}
                            </span>
                          </>
                        ) : isWarn ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                            <span className="text-[#D97706] font-medium">
                              Atención: superó umbral del {row.alertThreshold}% · Disponible{' '}
                              {formatCurrency(row.remaining, currency)}
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A36A]" />
                            <span>
                              Dentro del límite · Disponible{' '}
                              {formatCurrency(row.remaining, currency)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono tabular-nums">
                        <p className="text-sm font-bold text-[#14243A]">
                          {formatCurrency(row.spent, currency)}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            / {formatCurrency(row.limitAmount, currency)}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">{row.pct}% ejecutado</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBudget(row.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-[#DC2626] rounded-md transition-colors cursor-pointer"
                        title="Eliminar presupuesto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="h-2.5 w-full bg-[#F3F6FA] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor}`}
                      style={{ width: `${Math.min(100, row.pct)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
