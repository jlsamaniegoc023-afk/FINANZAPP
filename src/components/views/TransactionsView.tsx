import React, { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type {
  FinanzappWorkspacePayload,
  FinancialTransaction,
  TransactionType,
} from '../../shared/types';
import {
  downloadCsv,
  formatCurrency,
  formatDateDisplay,
  formatMonthLabel,
} from '../../lib/format';

interface TransactionsViewProps {
  workspace: FinanzappWorkspacePayload;
  selectedMonth: string;
  onOpenNew: () => void;
  onEdit: (tx: FinancialTransaction) => void;
  onDelete: (txId: string) => Promise<void>;
  onCreateCategory: (name: string, type: TransactionType) => Promise<unknown>;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  workspace,
  selectedMonth,
  onOpenNew,
  onEdit,
  onDelete,
  onCreateCategory,
}) => {
  const { user, accounts, categories, transactions } = workspace;
  const currency = user.currency;

  const [typeFilter, setTypeFilter] = useState<'todos' | TransactionType>('todos');
  const [scopeFilter, setScopeFilter] = useState<'mes' | 'todos'>('mes');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [accountFilter, setAccountFilter] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('gasto');

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (scopeFilter === 'mes' && !tx.date.startsWith(selectedMonth)) return false;
      if (typeFilter !== 'todos' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'todas' && tx.categoryId !== categoryFilter) return false;
      if (accountFilter !== 'todas' && tx.accountId !== accountFilter) return false;
      if (q) {
        const catNameMatch = categoryMap.get(tx.categoryId)?.name.toLowerCase() || '';
        const accNameMatch = accountMap.get(tx.accountId)?.name.toLowerCase() || '';
        const refMatch = (tx.reference || '').toLowerCase();
        if (
          !tx.description.toLowerCase().includes(q) &&
          !catNameMatch.includes(q) &&
          !accNameMatch.includes(q) &&
          !refMatch.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    transactions,
    scopeFilter,
    selectedMonth,
    typeFilter,
    categoryFilter,
    accountFilter,
    searchQuery,
    categoryMap,
    accountMap,
  ]);

  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'ingreso') totalIn += tx.amount;
      else totalOut += tx.amount;
    }
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [filteredTransactions]);

  const handleExportCsv = () => {
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Cuenta', 'Descripción', 'Referencia', 'Monto'];
    const rows = filteredTransactions.map((tx) => [
      tx.date,
      tx.type === 'ingreso' ? 'Ingreso' : 'Gasto',
      categoryMap.get(tx.categoryId)?.name || 'General',
      accountMap.get(tx.accountId)?.name || 'Cuenta',
      tx.description,
      tx.reference || '',
      tx.type === 'ingreso' ? tx.amount : -tx.amount,
    ]);
    downloadCsv(`finanzapp_movimientos_${selectedMonth}.csv`, headers, rows);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await onCreateCategory(catName.trim(), catType);
    setCatName('');
    setShowCatForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Totales de la consulta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Ingresos filtrados</p>
          <p className="mt-1.5 text-xl font-bold font-mono tabular-nums text-[#16A36A]">
            +{formatCurrency(summary.totalIn, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Gastos filtrados</p>
          <p className="mt-1.5 text-xl font-bold font-mono tabular-nums text-[#14243A]">
            -{formatCurrency(summary.totalOut, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Flujo neto resultante</p>
          <p
            className={`mt-1.5 text-xl font-bold font-mono tabular-nums ${
              summary.balance >= 0 ? 'text-[#16A36A]' : 'text-[#DC2626]'
            }`}
          >
            {formatCurrency(summary.balance, currency)}
          </p>
        </div>
      </div>

      {/* Barra de filtros interactivos y herramientas */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por tipo */}
            <div className="flex items-center gap-1 p-1 bg-[#F3F6FA] rounded-lg">
              {(['todos', 'ingreso', 'gasto'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTypeFilter(item)}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    typeFilter === item
                      ? 'bg-white text-[#14243A] shadow-xs'
                      : 'text-slate-600 hover:text-[#14243A]'
                  }`}
                >
                  {item === 'todos' ? 'Todos' : item === 'ingreso' ? 'Ingresos' : 'Gastos'}
                </button>
              ))}
            </div>

            {/* Alcance temporal */}
            <div className="flex items-center gap-1 p-1 bg-[#F3F6FA] rounded-lg">
              <button
                type="button"
                onClick={() => setScopeFilter('mes')}
                className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeFilter === 'mes'
                    ? 'bg-white text-[#14243A] shadow-xs'
                    : 'text-slate-600 hover:text-[#14243A]'
                }`}
              >
                {formatMonthLabel(selectedMonth)}
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('todos')}
                className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeFilter === 'todos'
                    ? 'bg-white text-[#14243A] shadow-xs'
                    : 'text-slate-600 hover:text-[#14243A]'
                }`}
              >
                Histórico completo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCatForm(!showCatForm)}
              className="py-2 px-3.5 text-xs font-semibold text-[#14243A] bg-[#F3F6FA] hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              + Nueva categoría
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="py-2 px-3.5 text-xs font-semibold text-[#14243A] bg-[#F3F6FA] hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
            <button
              type="button"
              onClick={onOpenNew}
              className="py-2 px-4 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar movimiento
            </button>
          </div>
        </div>

        {showCatForm && (
          <form
            onSubmit={handleAddCategory}
            className="p-3.5 bg-[#F3F6FA] rounded-lg flex flex-wrap items-center gap-2.5"
          >
            <span className="text-xs font-semibold text-[#14243A]">Crear categoría:</span>
            <select
              value={catType}
              onChange={(e) => setCatType(e.target.value as TransactionType)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Ej. Mascotas, Impuestos, Dividendos..."
              className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            />
            <button
              type="submit"
              className="py-1.5 px-3.5 text-xs font-semibold text-white bg-[#14243A] rounded-md cursor-pointer"
            >
              Guardar categoría
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por concepto, categoría o referencia..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
          >
            <option value="todas">Todas las categorías ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type === 'ingreso' ? 'Ingreso' : 'Gasto'})
              </option>
            ))}
          </select>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
          >
            <option value="todas">Todas las cuentas ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} · {acc.institution}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de movimientos de alta densidad */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-[#14243A]">
              No se encontraron movimientos con los criterios seleccionados
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Prueba cambiando al histórico completo o registra un nuevo ingreso o gasto.
            </p>
            <button
              type="button"
              onClick={onOpenNew}
              className="mt-4 py-2 px-4 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors cursor-pointer"
            >
              Registrar movimiento
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F3F6FA]/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Fecha</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4">Clasificación y medio</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTransactions.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  const acc = accountMap.get(tx.accountId);
                  const isConfirming = confirmDeleteId === tx.id;

                  return (
                    <tr key={tx.id} className="hover:bg-[#F3F6FA]/60 transition-colors">
                      <td className="py-2.5 px-5 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {formatDateDisplay(tx.date)}
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-[#14243A]">{tx.description}</p>
                        {tx.reference && (
                          <p className="text-xs font-mono text-slate-400">Ref. {tx.reference}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        <span>{cat?.name || 'Sin categoría'}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-slate-500">{acc?.name || 'Cuenta'}</span>
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                          tx.type === 'ingreso' ? 'text-[#16A36A]' : 'text-[#14243A]'
                        }`}
                      >
                        {tx.type === 'ingreso' ? '+' : '-'}
                        {formatCurrency(tx.amount, currency)}
                      </td>
                      <td className="py-2.5 px-5 text-right whitespace-nowrap">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDelete(tx.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-[#DC2626] rounded-md cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:text-[#14243A] cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEdit(tx)}
                              className="p-1.5 text-slate-500 hover:text-[#14243A] rounded-md transition-colors cursor-pointer"
                              title="Editar movimiento"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(tx.id)}
                              className="p-1.5 text-slate-500 hover:text-[#DC2626] rounded-md transition-colors cursor-pointer"
                              title="Eliminar movimiento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
