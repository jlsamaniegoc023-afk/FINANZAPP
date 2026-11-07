import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import type {
  FinanzappWorkspacePayload,
  FinancialTransaction,
} from '../../shared/types';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateDisplay,
  formatMonthLabel,
  formatShortMonth,
  getDaysUntil,
  getLastSixMonths,
  getPreviousMonth,
} from '../../lib/format';

interface DashboardViewProps {
  workspace: FinanzappWorkspacePayload;
  selectedMonth: string;
  onNavigate: (tab: string) => void;
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: FinancialTransaction) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  workspace,
  selectedMonth,
  onNavigate,
  onOpenNewTransaction,
  onEditTransaction,
}) => {
  const { user, accounts, categories, transactions, budgets, debts, goals } = workspace;
  const currency = user.currency;

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // Indicadores principales
  const totalAvailableBalance = useMemo(
    () => accounts.reduce((acc, item) => acc + item.balance, 0),
    [accounts]
  );
  const totalDebtBalance = useMemo(
    () => debts.reduce((acc, item) => acc + item.remainingAmount, 0),
    [debts]
  );
  const netWorth = totalAvailableBalance - totalDebtBalance;

  const prevMonth = getPreviousMonth(selectedMonth);

  const monthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let prevIncome = 0;
    let prevExpense = 0;

    for (const tx of transactions) {
      const txMonth = tx.date.slice(0, 7);
      if (txMonth === selectedMonth) {
        if (tx.type === 'ingreso') income += tx.amount;
        else expense += tx.amount;
      } else if (txMonth === prevMonth) {
        if (tx.type === 'ingreso') prevIncome += tx.amount;
        else prevExpense += tx.amount;
      }
    }

    const savings = income - expense;
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
    const expenseDeltaPct =
      prevExpense > 0 ? Math.round(((expense - prevExpense) / prevExpense) * 100) : null;

    return { income, expense, savings, savingsRate, prevIncome, prevExpense, expenseDeltaPct };
  }, [transactions, selectedMonth, prevMonth]);

  // Evolución financiera últimos 6 meses
  const sixMonthSeries = useMemo(() => {
    const months = getLastSixMonths(selectedMonth);
    return months.map((m) => {
      let ingresos = 0;
      let gastos = 0;
      for (const tx of transactions) {
        if (tx.date.startsWith(m)) {
          if (tx.type === 'ingreso') ingresos += tx.amount;
          else gastos += tx.amount;
        }
      }
      return {
        month: m,
        label: formatShortMonth(m),
        Ingresos: ingresos,
        Gastos: gastos,
        Ahorro: ingresos - gastos,
      };
    });
  }, [transactions, selectedMonth]);

  // Cumplimiento de presupuestos del mes seleccionado
  const budgetProgress = useMemo(() => {
    const monthBudgets = budgets.filter((b) => b.month === selectedMonth);
    return monthBudgets
      .map((b) => {
        const spent = transactions
          .filter(
            (tx) =>
              tx.type === 'gasto' &&
              tx.categoryId === b.categoryId &&
              tx.date.startsWith(selectedMonth)
          )
          .reduce((sum, tx) => sum + tx.amount, 0);
        const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0;
        const catName = categoryMap.get(b.categoryId)?.name || 'Categoría';
        return {
          ...b,
          categoryName: catName,
          spent,
          pct,
          status:
            pct > 100
              ? ('excedido' as const)
              : pct >= b.alertThreshold
              ? ('alerta' as const)
              : ('normal' as const),
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, transactions, selectedMonth, categoryMap]);

  // Alertas de vencimiento de deudas
  const upcomingDebts = useMemo(() => {
    return debts
      .filter((d) => d.remainingAmount > 0)
      .map((d) => ({
        ...d,
        daysLeft: getDaysUntil(d.dueDate),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [debts]);

  const recentTransactions = useMemo(
    () => transactions.slice(0, 7),
    [transactions]
  );

  return (
    <div className="space-y-6">
      {/* Franja superior de 4 tarjetas de indicadores financieros (superficie plana 1px border) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Patrimonio neto consolidado</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(netWorth, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Activos {formatCompactCurrency(totalAvailableBalance, currency)} · Deudas{' '}
            {formatCompactCurrency(totalDebtBalance, currency)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Saldo disponible en cuentas</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(totalAvailableBalance, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Distribuido en {accounts.length}{' '}
            {accounts.length === 1 ? 'cuenta activa' : 'cuentas activas'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Ingresos · {formatMonthLabel(selectedMonth)}
          </p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#16A36A]">
            {formatCurrency(monthStats.income, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Excedente neto:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-700">
              {formatCurrency(monthStats.savings, currency)}
            </span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Gastos · {formatMonthLabel(selectedMonth)}
          </p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(monthStats.expense, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Tasa de ahorro:{' '}
            <span className="font-mono tabular-nums font-semibold text-[#16A36A]">
              {monthStats.savingsRate}%
            </span>
            {monthStats.expenseDeltaPct !== null && (
              <>
                {' '}
                · {monthStats.expenseDeltaPct > 0 ? '+' : ''}
                {monthStats.expenseDeltaPct}% vs mes ant.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Grilla central: Evolución de ingresos y gastos + Indicadores de presupuesto */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-bold text-[#14243A]">
                Evolución de ingresos y gastos (6 meses)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparativo histórico mensual de entradas frente a salidas operativas
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>Ingresos (#16A36A)</span>
              <span aria-hidden="true">·</span>
              <span>Gastos (#14243A)</span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sixMonthSeries}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => formatCompactCurrency(val, currency)}
                  tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    formatCurrency(Number(value), currency),
                    String(name),
                  ]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Ingresos" fill="#16A36A" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Gastos" fill="#14243A" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Seguimiento presupuestal */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-5">
              <div>
                <h2 className="text-base font-bold text-[#14243A]">
                  Ejecución de presupuestos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Límites de consumo en {formatMonthLabel(selectedMonth)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('presupuestos')}
                className="text-xs font-semibold text-[#16A36A] hover:underline flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Gestionar <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {budgetProgress.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-500">
                  No hay límites presupuestales configurados para {formatMonthLabel(selectedMonth)}.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('presupuestos')}
                  className="mt-3 py-2 px-4 text-xs font-semibold text-white bg-[#14243A] hover:bg-[#1C314E] rounded-lg transition-colors cursor-pointer"
                >
                  Configurar presupuesto
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {budgetProgress.slice(0, 5).map((b) => {
                  const barColor =
                    b.status === 'excedido'
                      ? 'bg-[#DC2626]'
                      : b.status === 'alerta'
                      ? 'bg-[#D97706]'
                      : 'bg-[#16A36A]';
                  const statusLabel =
                    b.status === 'excedido'
                      ? 'Excedido'
                      : b.status === 'alerta'
                      ? 'Cerca del límite'
                      : 'Normal';

                  return (
                    <div key={b.id}>
                      <div className="flex items-baseline justify-between gap-2 text-xs mb-1.5">
                        <span className="font-semibold text-[#14243A] truncate">
                          {b.categoryName}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 shrink-0">
                          {formatCurrency(b.spent, currency)} /{' '}
                          {formatCurrency(b.limitAmount, currency)} · {b.pct}% ({statusLabel})
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#F3F6FA] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} transition-transform duration-200 origin-left`}
                          style={{ width: `${Math.min(100, b.pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Meta de tasa de ahorro mensual</span>
            <span className="font-mono tabular-nums font-semibold text-[#14243A]">
              Objetivo {user.monthlySavingsRateGoal}% · Actual {monthStats.savingsRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Alertas de vencimientos y progreso de metas + Tabla de últimos movimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/*Tabla de últimos movimientos*/}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#14243A]">Últimos movimientos</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro cronológico reciente en tus cuentas financieras
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('movimientos')}
                className="text-xs font-semibold text-slate-600 hover:text-[#14243A] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ver historial
              </button>
              <button
                type="button"
                onClick={onOpenNewTransaction}
                className="py-1.5 px-3 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo
              </button>
            </div>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">
                Aún no has registrado movimientos financieros.
              </p>
              <button
                type="button"
                onClick={onOpenNewTransaction}
                className="mt-3 py-2 px-4 text-xs font-semibold text-white bg-[#16A36A] rounded-lg cursor-pointer"
              >
                Registrar primer movimiento
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F3F6FA]/60 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-5">Concepto y clasificación</th>
                    <th className="py-2.5 px-4">Fecha</th>
                    <th className="py-2.5 px-5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recentTransactions.map((tx) => {
                    const cat = categoryMap.get(tx.categoryId);
                    const acc = accountMap.get(tx.accountId);
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => onEditTransaction(tx)}
                        className="hover:bg-[#F3F6FA]/70 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-5">
                          <p className="font-medium text-[#14243A] truncate max-w-md">
                            {tx.description}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {cat?.name || 'General'} · {acc?.name || 'Cuenta'}
                            {tx.reference ? ` · Ref. ${tx.reference}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatDateDisplay(tx.date)}
                        </td>
                        <td
                          className={`py-3 px-5 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            tx.type === 'ingreso' ? 'text-[#16A36A]' : 'text-[#14243A]'
                          }`}
                        >
                          {tx.type === 'ingreso' ? '+' : '-'}
                          {formatCurrency(tx.amount, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alertas de vencimientos y metas */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-base font-bold text-[#14243A]">Próximos vencimientos</h2>
              <button
                type="button"
                onClick={() => onNavigate('deudas')}
                className="text-xs font-semibold text-[#16A36A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ir a deudas
              </button>
            </div>

            {upcomingDebts.length === 0 ? (
              <p className="text-xs text-slate-500">Sin obligaciones pendientes de pago.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingDebts.slice(0, 3).map((debt) => {
                  const isUrgent = debt.daysLeft <= 7;
                  return (
                    <div key={debt.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#14243A] truncate">
                            {debt.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            {isUrgent ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A36A] shrink-0" />
                            )}
                            <span>
                              Vence {formatDateDisplay(debt.dueDate)} ·{' '}
                              {debt.daysLeft < 0
                                ? `Vencida hace ${Math.abs(debt.daysLeft)} días`
                                : debt.daysLeft === 0
                                ? 'Vence hoy'
                                : `En ${debt.daysLeft} días`}
                            </span>
                          </p>
                        </div>
                        <span className="text-xs font-mono tabular-nums font-semibold text-[#14243A] shrink-0">
                          {formatCurrency(debt.monthlyInstallment, currency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-base font-bold text-[#14243A]">Avance metas de ahorro</h2>
              <button
                type="button"
                onClick={() => onNavigate('metas')}
                className="text-xs font-semibold text-[#16A36A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ver metas
              </button>
            </div>

            {goals.length === 0 ? (
              <p className="text-xs text-slate-500">No hay metas de ahorro activas.</p>
            ) : (
              <div className="space-y-3.5">
                {goals.slice(0, 3).map((goal) => {
                  const pct =
                    goal.targetAmount > 0
                      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
                      : 0;
                  return (
                    <div key={goal.id}>
                      <div className="flex items-baseline justify-between text-xs mb-1">
                        <span className="font-semibold text-[#14243A] truncate pr-2">
                          {goal.title}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 shrink-0">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#F3F6FA] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#16A36A]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
                        {formatCurrency(goal.currentAmount, currency)} de{' '}
                        {formatCurrency(goal.targetAmount, currency)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
