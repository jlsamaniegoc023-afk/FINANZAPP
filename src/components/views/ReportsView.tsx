import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Download } from 'lucide-react';
import type { FinanzappWorkspacePayload } from '../../shared/types';
import {
  downloadCsv,
  formatCompactCurrency,
  formatCurrency,
  formatMonthLabel,
  formatShortMonth,
  getLastSixMonths,
} from '../../lib/format';

interface ReportsViewProps {
  workspace: FinanzappWorkspacePayload;
  selectedMonth: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  workspace,
  selectedMonth,
}) => {
  const { user, accounts, categories, transactions, debts, budgets } = workspace;
  const currency = user.currency;

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Indicadores estratégicos del período
  const indicators = useMemo(() => {
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const tx of transactions) {
      if (tx.date.startsWith(selectedMonth)) {
        if (tx.type === 'ingreso') monthlyIncome += tx.amount;
        else monthlyExpense += tx.amount;
      }
    }

    const monthlySavings = monthlyIncome - monthlyExpense;
    const savingsRate =
      monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0;

    const monthlyDebtInstallments = debts
      .filter((d) => d.remainingAmount > 0)
      .reduce((s, d) => s + d.monthlyInstallment, 0);

    const debtBurdenPct =
      monthlyIncome > 0 ? Math.round((monthlyDebtInstallments / monthlyIncome) * 100) : 0;

    const liquidAssets = accounts.reduce((s, a) => s + a.balance, 0);
    const emergencyMonths =
      monthlyExpense > 0 ? Number((liquidAssets / monthlyExpense).toFixed(1)) : 0;

    const monthBudgets = budgets.filter((b) => b.month === selectedMonth);
    const compliantBudgets = monthBudgets.filter((b) => {
      const spent = transactions
        .filter(
          (tx) =>
            tx.type === 'gasto' &&
            tx.categoryId === b.categoryId &&
            tx.date.startsWith(selectedMonth)
        )
        .reduce((s, tx) => s + tx.amount, 0);
      return spent <= b.limitAmount;
    }).length;

    return {
      monthlyIncome,
      monthlyExpense,
      monthlySavings,
      savingsRate,
      debtBurdenPct,
      emergencyMonths,
      compliantBudgets,
      totalBudgets: monthBudgets.length,
    };
  }, [transactions, debts, accounts, budgets, selectedMonth]);

  // Distribución de gastos por categoría
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    let grandTotal = 0;
    for (const tx of transactions) {
      if (tx.type === 'gasto' && tx.date.startsWith(selectedMonth)) {
        totals.set(tx.categoryId, (totals.get(tx.categoryId) || 0) + tx.amount);
        grandTotal += tx.amount;
      }
    }

    return Array.from(totals.entries())
      .map(([catId, amount]) => ({
        categoryId: catId,
        name: categoryMap.get(catId)?.name || 'General',
        amount,
        sharePct: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, selectedMonth, categoryMap]);

  // Evolución de ingresos y capacidad de ahorro (6 meses)
  const evolutionSeries = useMemo(() => {
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
        label: formatShortMonth(m),
        Ingresos: ingresos,
        CapacidadAhorro: ingresos - gastos,
      };
    });
  }, [transactions, selectedMonth]);

  const handleExportReport = () => {
    const headers = ['Categoría de Gasto', 'Periodo', 'Monto Ejecutado', 'Participación (%)'];
    const rows = categoryBreakdown.map((item) => [
      item.name,
      selectedMonth,
      item.amount,
      `${item.sharePct}%`,
    ]);
    downloadCsv(`finanzapp_reporte_${selectedMonth}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado de reportes */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#14243A]">
            Indicadores de comportamiento financiero · {formatMonthLabel(selectedMonth)}
          </h2>
          <p className="text-xs text-slate-500">
            Evaluación cuantitativa de solvencia, consumo por rubros y capacidad mensual de ahorro
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportReport}
          className="py-2 px-4 text-xs font-semibold text-[#14243A] bg-white border border-slate-300 hover:bg-[#F3F6FA] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Descargar reporte CSV
        </button>
      </div>

      {/* 4 Indicadores financieros clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Capacidad real de ahorro</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#16A36A]">
            {indicators.savingsRate}%
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Meta personal {user.monthlySavingsRateGoal}% ·{' '}
            {indicators.savingsRate >= user.monthlySavingsRateGoal
              ? 'Objetivo cumplido'
              : 'Por debajo de meta'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Carga financiera de deuda</p>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              indicators.debtBurdenPct > 35 ? 'text-[#DC2626]' : 'text-[#14243A]'
            }`}
          >
            {indicators.debtBurdenPct}%
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Cuotas mensuales / ingresos (recomendado ≤ 30%)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Cobertura de liquidez</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {indicators.emergencyMonths} meses
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Autonomía ante gastos mensuales actuales
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Disciplina presupuestal</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {indicators.compliantBudgets}/{indicators.totalBudgets}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Categorías dentro del límite asignado
          </p>
        </div>
      </div>

      {/* Gráficos analíticos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-[#14243A]">
            Categorías donde más dinero se consume
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">
            Distribución porcentual de egresos en {formatMonthLabel(selectedMonth)}
          </p>

          {categoryBreakdown.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Sin gastos registrados en el período seleccionado.
            </p>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryBreakdown}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      tickFormatter={(val) => formatCompactCurrency(val, currency)}
                      tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      tick={{ fill: '#14243A', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: any) => [
                        formatCurrency(Number(val), currency),
                        'Consumo',
                      ]}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="amount" fill="#14243A" radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                {categoryBreakdown.map((item) => (
                  <div
                    key={item.categoryId}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-700 font-medium">{item.name}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {formatCurrency(item.amount, currency)} · {item.sharePct}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-[#14243A]">
            Evolución de ingresos y capacidad de ahorro
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">
            Tendencia semestral de entradas frente al ahorro neto retenido
          </p>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={evolutionSeries}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
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
                  formatter={(val: any, name: any) => [
                    formatCurrency(Number(val), currency),
                    name === 'CapacidadAhorro' ? 'Capacidad de ahorro' : 'Ingresos',
                  ]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Ingresos"
                  stroke="#14243A"
                  strokeWidth={2}
                  fill="#14243A"
                  fillOpacity={0.08}
                />
                <Area
                  type="monotone"
                  dataKey="CapacidadAhorro"
                  stroke="#16A36A"
                  strokeWidth={2.5}
                  fill="#16A36A"
                  fillOpacity={0.18}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Ahorro neto en {formatMonthLabel(selectedMonth)}</span>
            <span className="font-mono tabular-nums font-bold text-[#16A36A]">
              {formatCurrency(indicators.monthlySavings, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
