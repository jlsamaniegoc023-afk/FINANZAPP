import React, { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import type {
  Category,
  CurrencyCode,
  FinancialAccount,
  FinancialTransaction,
  TransactionType,
} from '../shared/types';
import { formatCurrency } from '../lib/format';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  categories: Category[];
  currency: CurrencyCode;
  initialTransaction?: FinancialTransaction | null;
  defaultDate?: string;
  onSave: (payload: {
    id?: string;
    accountId: string;
    categoryId: string;
    type: TransactionType;
    amount: number;
    description: string;
    date: string;
    reference?: string;
  }) => Promise<void>;
  onCreateCategory: (name: string, type: TransactionType) => Promise<Category>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories,
  currency,
  initialTransaction,
  defaultDate = '2026-11-03',
  onSave,
  onCreateCategory,
}) => {
  const [type, setType] = useState<TransactionType>('gasto');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [reference, setReference] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setAddingCat(false);
    setNewCatName('');

    if (initialTransaction) {
      setType(initialTransaction.type);
      setAccountId(initialTransaction.accountId);
      setCategoryId(initialTransaction.categoryId);
      setAmount(String(initialTransaction.amount));
      setDescription(initialTransaction.description);
      setDate(initialTransaction.date);
      setReference(initialTransaction.reference || '');
    } else {
      const initialType: TransactionType = 'gasto';
      setType(initialType);
      setAccountId(accounts[0]?.id || '');
      const firstCat = categories.find((c) => c.type === initialType);
      setCategoryId(firstCat?.id || '');
      setAmount('');
      setDescription('');
      setDate(defaultDate);
      setReference('');
    }
  }, [isOpen, initialTransaction, accounts, categories, defaultDate]);

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    const matching = categories.filter((c) => c.type === nextType);
    setCategoryId(matching[0]?.id || '');
  };

  const handleQuickAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await onCreateCategory(newCatName.trim(), type);
      setCategoryId(created.id);
      setNewCatName('');
      setAddingCat(false);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la categoría.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numericAmount = Number(amount);
    if (!accountId || !categoryId || !numericAmount || numericAmount <= 0 || !description.trim()) {
      setError('Por favor completa todos los campos obligatorios con un monto mayor a cero.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: initialTransaction?.id,
        accountId,
        categoryId,
        type,
        amount: numericAmount,
        description: description.trim(),
        date,
        reference: reference.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-[#14243A]">
            {initialTransaction ? 'Editar movimiento financiero' : 'Registrar movimiento financiero'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-[#14243A] rounded-lg transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Tipo de movimiento */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipo de movimiento
            </label>
            <div className="flex items-center gap-1 p-1 bg-[#F3F6FA] rounded-lg">
              <button
                type="button"
                onClick={() => handleTypeChange('gasto')}
                className={`flex-1 py-2 px-4 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  type === 'gasto'
                    ? 'bg-white text-[#14243A] shadow-xs'
                    : 'text-slate-600 hover:text-[#14243A]'
                }`}
              >
                Gasto / Egreso
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('ingreso')}
                className={`flex-1 py-2 px-4 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  type === 'ingreso'
                    ? 'bg-[#16A36A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#14243A]'
                }`}
              >
                Ingreso / Abono
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Monto ({currency})
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fecha del movimiento
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cuenta financiera
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance, currency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Categoría</label>
                <button
                  type="button"
                  onClick={() => setAddingCat(!addingCat)}
                  className="text-xs font-semibold text-[#16A36A] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Nueva
                </button>
              </div>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
              >
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {addingCat && (
            <div className="p-3 rounded-lg bg-[#F3F6FA] border border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={`Nombre de categoría de ${type}...`}
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#14243A]"
              />
              <button
                type="button"
                onClick={handleQuickAddCategory}
                className="px-3 py-1.5 text-xs font-semibold bg-[#14243A] text-white rounded-md hover:bg-[#1C314E] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Agregar
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Descripción o concepto
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Pago servicios públicos, compra mercado, honorarios..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Comprobante o referencia (opcional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. FAC-204, PSE-9981"
              className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14243A]"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-xs font-semibold text-slate-700 bg-[#F3F6FA] hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-5 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {saving
                ? 'Guardando...'
                : initialTransaction
                ? 'Guardar cambios'
                : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
