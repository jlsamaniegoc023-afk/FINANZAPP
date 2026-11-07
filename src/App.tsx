import React, { useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Plus,
  Settings,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { TransactionModal } from './components/TransactionModal';
import { DashboardView } from './components/views/DashboardView';
import { TransactionsView } from './components/views/TransactionsView';
import { BudgetsView } from './components/views/BudgetsView';
import { AccountsView } from './components/views/AccountsView';
import { DebtsView } from './components/views/DebtsView';
import { GoalsView } from './components/views/GoalsView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';
import { UserAvatar } from './lib/avatars';
import { apiRequest } from './lib/api';
import { formatMonthLabel } from './lib/format';
import type {
  Category,
  FinanzappWorkspacePayload,
  FinancialTransaction,
  TransactionType,
} from './shared/types';

type ModuleKey =
  | 'dashboard'
  | 'movimientos'
  | 'presupuestos'
  | 'cuentas'
  | 'deudas'
  | 'metas'
  | 'reportes'
  | 'configuracion';

const NAV_MODULES: {
  id: ModuleKey;
  index: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', index: '01', label: 'Dashboard financiero', icon: LayoutDashboard },
  { id: 'movimientos', index: '02', label: 'Ingresos y gastos', icon: ArrowLeftRight },
  { id: 'presupuestos', index: '03', label: 'Presupuestos', icon: Target },
  { id: 'cuentas', index: '04', label: 'Cuentas financieras', icon: Wallet },
  { id: 'deudas', index: '05', label: 'Gestión de deudas', icon: CreditCard },
  { id: 'metas', index: '06', label: 'Metas de ahorro', icon: PiggyBank },
  { id: 'reportes', index: '07', label: 'Reportes e indicadores', icon: BarChart3 },
  { id: 'configuracion', index: '08', label: 'Usuarios y configuración', icon: Settings },
];

const AVAILABLE_MONTHS = [
  '2026-11',
  '2026-10',
  '2026-09',
  '2026-08',
  '2026-07',
  '2026-06',
];

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<FinanzappWorkspacePayload | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);

  const refreshWorkspace = async (authToken = token) => {
    if (!authToken) return;
    const res = await apiRequest<{ workspace: FinanzappWorkspacePayload }>('/api/workspace', {
      token: authToken,
    });
    setWorkspace(res.workspace);
  };

  const handleAuthenticated = (newToken: string, initialWorkspace: FinanzappWorkspacePayload) => {
    setToken(newToken);
    setWorkspace(initialWorkspace);
    setActiveModule('dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    setWorkspace(null);
    setMobileNavOpen(false);
  };

  if (!token || !workspace) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const currentModuleMeta =
    NAV_MODULES.find((m) => m.id === activeModule) || NAV_MODULES[0];

  const handleSaveTransaction = async (payload: {
    id?: string;
    accountId: string;
    categoryId: string;
    type: TransactionType;
    amount: number;
    description: string;
    date: string;
    reference?: string;
  }) => {
    if (payload.id) {
      await apiRequest(`/api/transactions/${payload.id}`, {
        method: 'PUT',
        token,
        body: payload,
      });
    } else {
      await apiRequest('/api/transactions', {
        method: 'POST',
        token,
        body: payload,
      });
    }
    await refreshWorkspace();
  };

  const handleCreateCategory = async (
    name: string,
    type: TransactionType
  ): Promise<Category> => {
    const res = await apiRequest<{ category: Category }>('/api/categories', {
      method: 'POST',
      token,
      body: { name, type },
    });
    await refreshWorkspace();
    return res.category;
  };

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-[#14243A] flex">
      {/* Menú lateral fijo en escritorio (264px, Azul oscuro #14243A) */}
      <aside className="hidden lg:flex lg:w-[264px] lg:flex-col lg:fixed lg:inset-y-0 bg-[#14243A] text-white z-30">
        <div className="px-6 py-5 border-b border-white/10">
          <span className="text-lg font-bold tracking-tight font-display whitespace-nowrap">
            FINANZAPP
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_MODULES.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#16A36A] text-white font-semibold'
                    : 'text-slate-300 hover:bg-[#1C314E] hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {item.index}. {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <UserAvatar
              name={workspace.user.name}
              avatarKey={workspace.user.avatarKey}
              sizeClass="w-9 h-9 text-xs"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {workspace.user.name}
              </p>
              <p className="text-[11px] text-slate-300 truncate">
                Moneda {workspace.user.currency}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg bg-[#1C314E] hover:bg-[#264166] text-xs font-medium text-slate-200 flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Menú lateral adaptable en celulares */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-[#14243A] text-white flex flex-col z-10">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-base font-bold font-display">FINANZAPP</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_MODULES.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-medium whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#16A36A] text-white font-semibold'
                        : 'text-slate-300 hover:bg-[#1C314E]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {item.index}. {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 px-3 rounded-lg bg-[#1C314E] text-xs font-medium text-slate-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Lienzo principal */}
      <div className="flex-1 lg:pl-[264px] flex flex-col min-w-0">
        {/* Barra superior de trabajo (SaaS Top Bar Contract) */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#14243A] hover:bg-[#F3F6FA] rounded-lg cursor-pointer"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                FINANZAPP /
              </span>
              <h1 className="font-bold text-[#14243A] truncate">
                {currentModuleMeta.index}. {currentModuleMeta.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Seleccionar período mensual"
              className="px-3 py-2 text-xs font-semibold bg-[#F3F6FA] text-[#14243A] border border-slate-200 rounded-lg focus:outline-none focus:border-[#14243A] cursor-pointer"
            >
              {AVAILABLE_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setTxModalOpen(true);
              }}
              className="py-2 px-4 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#128757] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Registrar movimiento</span>
              <span className="sm:hidden">Movimiento</span>
            </button>
          </div>
        </header>

        {/* Contenido activo del módulo */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1360px] w-full mx-auto">
          {activeModule === 'dashboard' && (
            <DashboardView
              workspace={workspace}
              selectedMonth={selectedMonth}
              onNavigate={(tab) => setActiveModule(tab as ModuleKey)}
              onOpenNewTransaction={() => {
                setEditingTx(null);
                setTxModalOpen(true);
              }}
              onEditTransaction={(tx) => {
                setEditingTx(tx);
                setTxModalOpen(true);
              }}
            />
          )}

          {activeModule === 'movimientos' && (
            <TransactionsView
              workspace={workspace}
              selectedMonth={selectedMonth}
              onOpenNew={() => {
                setEditingTx(null);
                setTxModalOpen(true);
              }}
              onEdit={(tx) => {
                setEditingTx(tx);
                setTxModalOpen(true);
              }}
              onDelete={async (txId) => {
                await apiRequest(`/api/transactions/${txId}`, {
                  method: 'DELETE',
                  token,
                });
                await refreshWorkspace();
              }}
              onCreateCategory={handleCreateCategory}
            />
          )}

          {activeModule === 'presupuestos' && (
            <BudgetsView
              workspace={workspace}
              selectedMonth={selectedMonth}
              onSaveBudget={async (payload) => {
                await apiRequest('/api/budgets', {
                  method: 'POST',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
              onDeleteBudget={async (id) => {
                await apiRequest(`/api/budgets/${id}`, {
                  method: 'DELETE',
                  token,
                });
                await refreshWorkspace();
              }}
            />
          )}

          {activeModule === 'cuentas' && (
            <AccountsView
              workspace={workspace}
              onCreateAccount={async (payload) => {
                await apiRequest('/api/accounts', {
                  method: 'POST',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
              onUpdateAccount={async (id, payload) => {
                await apiRequest(`/api/accounts/${id}`, {
                  method: 'PUT',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
              onDeleteAccount={async (id) => {
                await apiRequest(`/api/accounts/${id}`, {
                  method: 'DELETE',
                  token,
                });
                await refreshWorkspace();
              }}
              onTransfer={async (payload) => {
                await apiRequest('/api/accounts/transfer', {
                  method: 'POST',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
            />
          )}

          {activeModule === 'deudas' && (
            <DebtsView
              workspace={workspace}
              onCreateDebt={async (payload) => {
                await apiRequest('/api/debts', {
                  method: 'POST',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
              onPayDebt={async (debtId, payload) => {
                await apiRequest(`/api/debts/${debtId}/pay`, {
                  method: 'POST',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
              onDeleteDebt={async (debtId) => {
                await apiRequest(`/api/debts/${debtId}`, {
                  method: 'DELETE',
                  token,
                });
                await refreshWorkspace();
              }}
            />
          )}

          {activeModule === 'metas' && (
            <GoalsView
              workspace={workspace}
              onCreateGoal={async (payload) => {
                await apiRequest('/api/goals', {
                  method: 'POST',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
              onContributeGoal={async (goalId, payload) => {
                await apiRequest(`/api/goals/${goalId}/contribute`, {
                  method: 'POST',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
              onDeleteGoal={async (goalId) => {
                await apiRequest(`/api/goals/${goalId}`, {
                  method: 'DELETE',
                  token,
                });
                await refreshWorkspace();
              }}
            />
          )}

          {activeModule === 'reportes' && (
            <ReportsView workspace={workspace} selectedMonth={selectedMonth} />
          )}

          {activeModule === 'configuracion' && (
            <SettingsView
              workspace={workspace}
              onUpdateProfile={async (payload) => {
                await apiRequest('/api/profile', {
                  method: 'PUT',
                  token,
                  body: payload,
                });
                await refreshWorkspace();
              }}
              onResetDemoData={async () => {
                await apiRequest('/api/profile/reset-demo', {
                  method: 'POST',
                  token,
                });
                await refreshWorkspace();
              }}
            />
          )}
        </main>
      </div>

      {/* Modal global de ingresos y gastos */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setEditingTx(null);
        }}
        accounts={workspace.accounts}
        categories={workspace.categories}
        currency={workspace.user.currency}
        initialTransaction={editingTx}
        defaultDate={`${selectedMonth}-03`}
        onSave={handleSaveTransaction}
        onCreateCategory={handleCreateCategory}
      />
    </div>
  );
}
