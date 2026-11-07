import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import type {
  AccountType,
  FinanzappWorkspacePayload,
  FinancialAccount,
} from '../../shared/types';
import { formatCurrency, getAccountTypeLabel } from '../../lib/format';

interface AccountsViewProps {
  workspace: FinanzappWorkspacePayload;
  onCreateAccount: (payload: {
    name: string;
    type: AccountType;
    institution: string;
    accountNumber: string;
    balance: number;
  }) => Promise<void>;
  onUpdateAccount: (
    id: string,
    payload: {
      name: string;
      type: AccountType;
      institution: string;
      accountNumber: string;
      balance: number;
    }
  ) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onTransfer: (payload: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    note: string;
  }) => Promise<void>;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  workspace,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onTransfer,
}) => {
  const { user, accounts, transactions } = workspace;
  const currency = user.currency;

  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('banco');
  const [institution, setInstitution] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [balance, setBalance] = useState('0');

  const [showTransfer, setShowTransfer] = useState(false);
  const [fromId, setFromId] = useState(accounts[0]?.id || '');
  const [toId, setToId] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const [feedback, setFeedback] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = accounts.reduce((s, a) => s + a.balance, 0);
    const liquid = accounts
      .filter((a) => a.type !== 'inversion')
      .reduce((s, a) => s + a.balance, 0);
    const invested = accounts
      .filter((a) => a.type === 'inversion')
      .reduce((s, a) => s + a.balance, 0);
    return { total, liquid, invested };
  }, [accounts]);

  const openCreate = () => {
    setEditingAccount(null);
    setName('');
    setType('banco');
    setInstitution('');
    setAccountNumber('');
    setBalance('0');
    setFeedback(null);
    setShowForm(true);
  };

  const openEdit = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setInstitution(acc.institution);
    setAccountNumber(acc.accountNumber);
    setBalance(String(acc.balance));
    setFeedback(null);
    setShowForm(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const payload = {
        name: name.trim(),
        type,
        institution: institution.trim() || 'Entidad Financiera',
        accountNumber: accountNumber.trim() || 'S/N',
        balance: Number(balance) || 0,
      };
      if (editingAccount) {
        await onUpdateAccount(editingAccount.id, payload);
        setFeedback({ kind: 'ok', text: 'Cuenta actualizada correctamente.' });
      } else {
        await onCreateAccount(payload);
        setFeedback({ kind: 'ok', text: 'Nueva cuenta registrada correctamente.' });
      }
      setShowForm(false);
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err.message || 'Error al guardar la cuenta.' });
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await onTransfer({
        fromAccountId: fromId,
        toAccountId: toId,
        amount: Number(transferAmount),
        note: transferNote,
      });
      setTransferAmount('');
      setTransferNote('');
      setShowTransfer(false);
      setFeedback({ kind: 'ok', text: 'Transferencia entre cuentas procesada con éxito.' });
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err.message || 'No se pudo completar la transferencia.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Indicadores consolidados de liquidez */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Disponibilidad total consolidada</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(summary.total, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Efectivo, bancos y ahorros a la vista</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#16A36A]">
            {formatCurrency(summary.liquid, currency)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Fondos de inversión y plazo</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#14243A]">
            {formatCurrency(summary.invested, currency)}
          </p>
        </div>
      </div>

      {/* Acciones principales */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#14243A]">Medios y cuentas registradas</h2>
          <p className="text-xs text-slate-500">
            Administra tus cuentas bancarias, efectivo y traslados internos de liquidez
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {accounts.length >= 2 && (
            <button
              type="button"
              onClick={() => {
                setFromId(accounts[0]?.id || '');
                setToId(accounts[1]?.id || '');
                setShowTransfer(!showTransfer);
                setShowForm(false);
              }}
              className="py-2 px-4 text-xs font-semibold text-[#14243A] bg-white border border-slate-300 hover:bg-[#F3F6FA] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> Transferir entre cuentas
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="py-2 px-4 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva cuenta
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between ${
            feedback.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Panel de transferencia */}
      {showTransfer && (
        <form
          onSubmit={handleTransferSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#14243A]">
              Transferencia interna de fondos
            </h3>
            <button
              type="button"
              onClick={() => setShowTransfer(false)}
              className="text-slate-400 hover:text-[#14243A] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cuenta origen
              </label>
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCurrency(a.balance, currency)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cuenta destino
              </label>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCurrency(a.balance, currency)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Monto a trasladar ({currency})
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Concepto (opcional)
              </label>
              <input
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Traslado ahorro..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="py-2 px-5 text-xs font-semibold text-white bg-[#14243A] hover:bg-[#1C314E] rounded-lg cursor-pointer"
            >
              Ejecutar transferencia
            </button>
          </div>
        </form>
      )}

      {/* Formulario crear / editar cuenta */}
      {showForm && (
        <form
          onSubmit={handleSaveAccount}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#14243A]">
              {editingAccount ? 'Editar cuenta financiera' : 'Registrar nueva cuenta financiera'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-[#14243A] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nombre de la cuenta
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cuenta Nómina, Billetera Nequi..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tipo de medio
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="banco">Cuenta Bancaria</option>
                <option value="ahorros">Cuenta de Ahorros</option>
                <option value="efectivo">Efectivo Disponible</option>
                <option value="billetera_digital">Billetera Digital</option>
                <option value="inversion">Fondo de Inversión</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Entidad / Banco
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ej. Bancolombia"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Saldo actual ({currency})
              </label>
              <input
                type="number"
                step="any"
                required
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="w-full max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Últimos dígitos / Referencia
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Ej. **** 4510"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="self-end py-2 px-5 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg cursor-pointer"
            >
              {editingAccount ? 'Actualizar cuenta' : 'Guardar cuenta'}
            </button>
          </div>
        </form>
      )}

      {/* Grilla de cuentas financieras */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const txCount = transactions.filter((t) => t.accountId === acc.id).length;
          const sharePct =
            summary.total > 0 ? Math.max(0, Math.round((acc.balance / summary.total) * 100)) : 0;
          const isConfirming = confirmDeleteId === acc.id;

          return (
            <div
              key={acc.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#14243A]">{acc.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {getAccountTypeLabel(acc.type)} · {acc.institution} ·{' '}
                    <span className="font-mono">{acc.accountNumber}</span>
                  </p>
                </div>

                {isConfirming ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onDeleteAccount(acc.id);
                          setConfirmDeleteId(null);
                        } catch (err: any) {
                          setFeedback({
                            kind: 'error',
                            text: err.message || 'No se pudo eliminar la cuenta.',
                          });
                          setConfirmDeleteId(null);
                        }
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-[#DC2626] rounded-md cursor-pointer"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-xs text-slate-500 cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(acc)}
                      className="p-1.5 text-slate-400 hover:text-[#14243A] rounded-md transition-colors cursor-pointer"
                      title="Editar cuenta"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(acc.id)}
                      className="p-1.5 text-slate-400 hover:text-[#DC2626] rounded-md transition-colors cursor-pointer"
                      title="Eliminar cuenta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500">Saldo disponible actual</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#14243A] mt-0.5">
                    {formatCurrency(acc.balance, currency)}
                  </p>
                </div>
                <p className="text-xs font-mono tabular-nums text-slate-500">
                  {sharePct}% del activo · {txCount} mov.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
