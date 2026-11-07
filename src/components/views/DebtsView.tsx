import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Plus, Trash2, X } from 'lucide-react';
import type { Debt, FinanzappWorkspacePayload } from '../../shared/types';
import { formatCurrency, formatDateDisplay, getDaysUntil } from '../../lib/format';

interface DebtsViewProps {
  workspace: FinanzappWorkspacePayload;
  onCreateDebt: (payload: {
    creditor: string;
    title: string;
    totalAmount: number;
    remainingAmount: number;
    monthlyInstallment: number;
    interestRateAnnual: number;
    dueDate: string;
    totalInstallments: number;
    paidInstallments: number;
  }) => Promise<void>;
  onPayDebt: (
    debtId: string,
    payload: { accountId: string; amount: number; date: string; note: string }
  ) => Promise<void>;
  onDeleteDebt: (debtId: string) => Promise<void>;
}

export const DebtsView: React.FC<DebtsViewProps> = ({
  workspace,
  onCreateDebt,
  onPayDebt,
  onDeleteDebt,
}) => {
  const { user, debts, accounts } = workspace;
  const currency = user.currency;

  const [showCreate, setShowCreate] = useState(false);
  const [creditor, setCreditor] = useState('');
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [interestRateAnnual, setInterestRateAnnual] = useState('15');
  const [dueDate, setDueDate] = useState('2026-11-20');
  const [totalInstallments, setTotalInstallments] = useState('24');
  const [paidInstallments, setPaidInstallments] = useState('0');

  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAccountId, setPayAccountId] = useState(accounts[0]?.id || '');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('2026-11-03');
  const [payNote, setPayNote] = useState('');

  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const totalOriginal = debts.reduce((s, d) => s + d.totalAmount, 0);
    const totalRemaining = debts.reduce((s, d) => s + d.remainingAmount, 0);
    const monthlyCommitment = debts
      .filter((d) => d.remainingAmount > 0)
      .reduce((s, d) => s + d.monthlyInstallment, 0);
    const paidPct =
      totalOriginal > 0
        ? Math.round(((totalOriginal - totalRemaining) / totalOriginal) * 100)
        : 0;
    return { totalOriginal, totalRemaining, monthlyCommitment, paidPct };
  }, [debts]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onCreateDebt({
        creditor,
        title,
        totalAmount: Number(totalAmount),
        remainingAmount: remainingAmount ? Number(remainingAmount) : Number(totalAmount),
        monthlyInstallment: Number(monthlyInstallment) || 0,
        interestRateAnnual: Number(interestRateAnnual) || 0,
        dueDate,
        totalInstallments: Number(totalInstallments) || 12,
        paidInstallments: Number(paidInstallments) || 0,
      });
      setCreditor('');
      setTitle('');
      setTotalAmount('');
      setRemainingAmount('');
      setMonthlyInstallment('');
      setShowCreate(false);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la obligación.');
    }
  };

  const openPayModal = (debt: Debt) => {
    setPayingDebt(debt);
    setPayAccountId(accounts[0]?.id || '');
    setPayAmount(String(Math.min(debt.remainingAmount, debt.monthlyInstallment || debt.remainingAmount)));
    setPayDate('2026-11-03');
    setPayNote(`Pago cuota #${debt.paidInstallments + 1}`);
    setError(null);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDebt) return;
    setError(null);
    try {
      await onPayDebt(payingDebt.id, {
        accountId: payAccountId,
        amount: Number(payAmount),
        date: payDate,
        note: payNote,
      });
      setPayingDebt(null);
    } catch (err: any) {
      setError(err.message || 'No se pudo procesar el abono.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Indicadores de pasivos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Saldo total de deuda pendiente</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(summary.totalRemaining, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Compromiso mensual en cuotas</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#D97706]">
            {formatCurrency(summary.monthlyCommitment, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Capital amortizado acumulado</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#16A36A]">
            {summary.paidPct}%
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#14243A]">Obligaciones y créditos activos</h2>
          <p className="text-xs text-slate-500">
            Controla vencimientos, tasas efectivas anuales y abona cuotas directamente desde tus cuentas
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="py-2 px-4 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Registrar deuda
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#14243A]">Nueva obligación financiera</h3>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-slate-400 hover:text-[#14243A] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Concepto / Obligación
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Crédito Libre Inversión"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Entidad acreedora
              </label>
              <input
                type="text"
                required
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                placeholder="Ej. Davivienda"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Próximo vencimiento
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Monto original ({currency})
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saldo pendiente actual ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={remainingAmount}
                onChange={(e) => setRemainingAmount(e.target.value)}
                placeholder="Igual al original si es nueva"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor cuota mensual ({currency})
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={monthlyInstallment}
                onChange={(e) => setMonthlyInstallment(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tasa efectiva anual (% E.A.)
              </label>
              <input
                type="number"
                step="0.1"
                value={interestRateAnnual}
                onChange={(e) => setInterestRateAnnual(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plazo total (cuotas)
              </label>
              <input
                type="number"
                min="1"
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cuotas ya pagadas
              </label>
              <input
                type="number"
                min="0"
                value={paidInstallments}
                onChange={(e) => setPaidInstallments(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="py-2 px-5 text-xs font-semibold text-white bg-[#14243A] hover:bg-[#1C314E] rounded-lg cursor-pointer"
            >
              Guardar obligación
            </button>
          </div>
        </form>
      )}

      {/* Modal de abono / pago de cuota */}
      {payingDebt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#14243A]">Registrar pago de obligación</h3>
              <button
                type="button"
                onClick={() => setPayingDebt(null)}
                className="text-slate-400 hover:text-[#14243A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Obligación: <strong className="text-[#14243A]">{payingDebt.title}</strong> · Saldo
                pendiente{' '}
                <span className="font-mono font-semibold">
                  {formatCurrency(payingDebt.remainingAmount, currency)}
                </span>
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Debitar pago desde la cuenta
                </label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balance, currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Valor a abonar ({currency})
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Fecha de pago
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nota o comprobante
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingDebt(null)}
                  className="py-2 px-4 text-xs font-semibold text-slate-700 bg-[#F3F6FA] rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg cursor-pointer"
                >
                  Confirmar pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Listado detallado de deudas */}
      {debts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm font-medium text-[#14243A]">
            No tienes deudas ni obligaciones registradas actualmente
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => {
            const paidPct =
              debt.totalAmount > 0
                ? Math.min(
                    100,
                    Math.round(((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100)
                  )
                : 100;
            const daysLeft = getDaysUntil(debt.dueDate);
            const isPaidOff = debt.remainingAmount <= 0;

            return (
              <div
                key={debt.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-[#14243A]">{debt.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {debt.creditor} · Tasa {debt.interestRateAnnual}% E.A. · Cuotas{' '}
                      <span className="font-mono">
                        {debt.paidInstallments}/{debt.totalInstallments}
                      </span>
                    </p>
                    <p className="text-xs mt-1.5 flex items-center gap-1.5">
                      {isPaidOff ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A36A]" />
                          <span className="text-[#16A36A] font-medium">
                            Obligación saldada en su totalidad
                          </span>
                        </>
                      ) : daysLeft <= 7 ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                          <span className="text-[#D97706] font-medium">
                            Próximo vencimiento: {formatDateDisplay(debt.dueDate)} (
                            {daysLeft < 0
                              ? `vencida hace ${Math.abs(daysLeft)} días`
                              : `en ${daysLeft} días`}
                            )
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-600">
                          Próximo vencimiento: {formatDateDisplay(debt.dueDate)} (en {daysLeft} días)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono tabular-nums">
                      <p className="text-xs text-slate-500">Saldo pendiente</p>
                      <p className="text-lg font-bold text-[#14243A]">
                        {formatCurrency(debt.remainingAmount, currency)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Cuota mensual {formatCurrency(debt.monthlyInstallment, currency)}
                      </p>
                    </div>

                    {!isPaidOff && (
                      <button
                        type="button"
                        onClick={() => openPayModal(debt)}
                        className="py-2 px-3.5 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Pagar cuota
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteDebt(debt.id)}
                      className="p-2 text-slate-400 hover:text-[#DC2626] rounded-lg transition-colors cursor-pointer"
                      title="Eliminar deuda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1 font-mono tabular-nums">
                    <span>
                      Pagado:{' '}
                      {formatCurrency(debt.totalAmount - debt.remainingAmount, currency)} de{' '}
                      {formatCurrency(debt.totalAmount, currency)}
                    </span>
                    <span>{paidPct}% amortizado</span>
                  </div>
                  <div className="h-2 w-full bg-[#F3F6FA] rounded-full overflow-hidden">
                    <div className="h-full bg-[#14243A]" style={{ width: `${paidPct}%` }} />
                  </div>
                </div>

                {debt.payments.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 mb-2">
                      Últimos pagos aplicados:
                    </p>
                    <div className="space-y-1">
                      {debt.payments.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-xs text-slate-500"
                        >
                          <span>
                            {formatDateDisplay(p.date)} · {p.note}
                          </span>
                          <span className="font-mono tabular-nums font-medium text-[#16A36A]">
                            {formatCurrency(p.amount, currency)}
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
      )}
    </div>
  );
};
