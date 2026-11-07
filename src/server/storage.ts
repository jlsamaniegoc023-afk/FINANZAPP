import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type {
  StoredUser,
  UserProfile,
  FinancialAccount,
  Category,
  FinancialTransaction,
  Budget,
  Debt,
  SavingsGoal,
  OtpRecord,
  FinanzappWorkspacePayload,
} from '../shared/types.ts';

interface DatabaseStore {
  users: StoredUser[];
  accounts: FinancialAccount[];
  categories: Category[];
  transactions: FinancialTransaction[];
  budgets: Budget[];
  debts: Debt[];
  goals: SavingsGoal[];
  otpVerifications?: OtpRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'finanzapp-db.json');

export function sanitizeUser(user: StoredUser): UserProfile {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function buildSeedDataForCarlos(userId: string): Omit<DatabaseStore, 'users'> {
  const categories: Category[] = [
    { id: `${userId}_cat_sal`, userId, name: 'Salario y Nómina', type: 'ingreso', color: '#16A36A' },
    { id: `${userId}_cat_hon`, userId, name: 'Consultoría y Honorarios', type: 'ingreso', color: '#0D9488' },
    { id: `${userId}_cat_ren`, userId, name: 'Rendimientos Financieros', type: 'ingreso', color: '#2563EB' },
    { id: `${userId}_cat_viv`, userId, name: 'Vivienda y Servicios', type: 'gasto', color: '#14243A' },
    { id: `${userId}_cat_ali`, userId, name: 'Alimentación y Mercado', type: 'gasto', color: '#D97706' },
    { id: `${userId}_cat_tra`, userId, name: 'Transporte y Movilidad', type: 'gasto', color: '#4F46E5' },
    { id: `${userId}_cat_deu`, userId, name: 'Obligaciones Financieras', type: 'gasto', color: '#DC2626' },
    { id: `${userId}_cat_salu`, userId, name: 'Salud y Bienestar', type: 'gasto', color: '#0891B2' },
    { id: `${userId}_cat_edu`, userId, name: 'Educación y Tecnología', type: 'gasto', color: '#7C3AED' },
    { id: `${userId}_cat_oci`, userId, name: 'Recreación y Cultura', type: 'gasto', color: '#EA580C' },
  ];

  const accounts: FinancialAccount[] = [
    {
      id: `${userId}_acc_nomina`,
      userId,
      name: 'Cuenta Nómina Principal',
      type: 'banco',
      institution: 'Bancolombia',
      accountNumber: '**** 4821',
      balance: 6850000,
      createdAt: '2026-01-10T09:00:00Z',
    },
    {
      id: `${userId}_acc_ahorros`,
      userId,
      name: 'Cajita Alto Rendimiento',
      type: 'ahorros',
      institution: 'Nu Colombia',
      accountNumber: '**** 9104',
      balance: 14200000,
      createdAt: '2026-02-15T10:30:00Z',
    },
    {
      id: `${userId}_acc_efectivo`,
      userId,
      name: 'Efectivo Disponible',
      type: 'efectivo',
      institution: 'Caja Personal',
      accountNumber: 'EFEC-01',
      balance: 480000,
      createdAt: '2026-01-10T09:05:00Z',
    },
    {
      id: `${userId}_acc_inversion`,
      userId,
      name: 'Fondo Fiduciario Vista',
      type: 'inversion',
      institution: 'Fiducolombia',
      accountNumber: '**** 3379',
      balance: 18500000,
      createdAt: '2026-03-01T14:00:00Z',
    },
  ];

  const transactions: FinancialTransaction[] = [
    // Junio 2026
    {
      id: `${userId}_tx_01`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_sal`,
      type: 'ingreso',
      amount: 7200000,
      description: 'Pago nómina mensual junio',
      date: '2026-06-01',
      reference: 'NOM-2026-06',
      createdAt: '2026-06-01T08:00:00Z',
    },
    {
      id: `${userId}_tx_02`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_viv`,
      type: 'gasto',
      amount: 2150000,
      description: 'Arriendo apartamento y administración',
      date: '2026-06-04',
      createdAt: '2026-06-04T10:00:00Z',
    },
    {
      id: `${userId}_tx_03`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_ali`,
      type: 'gasto',
      amount: 1180000,
      description: 'Mercado mensual y víveres',
      date: '2026-06-11',
      createdAt: '2026-06-11T17:20:00Z',
    },
    {
      id: `${userId}_tx_04`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_deu`,
      type: 'gasto',
      amount: 1320000,
      description: 'Cuota crédito vehicular y tarjeta',
      date: '2026-06-18',
      createdAt: '2026-06-18T11:00:00Z',
    },
    // Julio 2026
    {
      id: `${userId}_tx_05`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_sal`,
      type: 'ingreso',
      amount: 7200000,
      description: 'Pago nómina mensual julio',
      date: '2026-07-01',
      reference: 'NOM-2026-07',
      createdAt: '2026-07-01T08:00:00Z',
    },
    {
      id: `${userId}_tx_06`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_hon`,
      type: 'ingreso',
      amount: 1400000,
      description: 'Asesoría valoración financiera PyME',
      date: '2026-07-14',
      createdAt: '2026-07-14T16:30:00Z',
    },
    {
      id: `${userId}_tx_07`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_viv`,
      type: 'gasto',
      amount: 2210000,
      description: 'Arriendo y servicios públicos domiciliarios',
      date: '2026-07-05',
      createdAt: '2026-07-05T09:30:00Z',
    },
    {
      id: `${userId}_tx_08`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_ali`,
      type: 'gasto',
      amount: 1240000,
      description: 'Supermercado Éxito y plaza local',
      date: '2026-07-12',
      createdAt: '2026-07-12T18:10:00Z',
    },
    {
      id: `${userId}_tx_09`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_deu`,
      type: 'gasto',
      amount: 1450000,
      description: 'Abono obligaciones bancarias julio',
      date: '2026-07-20',
      createdAt: '2026-07-20T13:00:00Z',
    },
    // Agosto 2026
    {
      id: `${userId}_tx_10`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_sal`,
      type: 'ingreso',
      amount: 7200000,
      description: 'Pago nómina mensual agosto',
      date: '2026-08-01',
      reference: 'NOM-2026-08',
      createdAt: '2026-08-01T08:00:00Z',
    },
    {
      id: `${userId}_tx_11`,
      userId,
      accountId: `${userId}_acc_inversion`,
      categoryId: `${userId}_cat_ren`,
      type: 'ingreso',
      amount: 245000,
      description: 'Rendimientos fondo fiduciario agosto',
      date: '2026-08-28',
      createdAt: '2026-08-28T17:00:00Z',
    },
    {
      id: `${userId}_tx_12`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_viv`,
      type: 'gasto',
      amount: 2180000,
      description: 'Arriendo, energía, internet fibra óptica',
      date: '2026-08-04',
      createdAt: '2026-08-04T09:15:00Z',
    },
    {
      id: `${userId}_tx_13`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_ali`,
      type: 'gasto',
      amount: 1190000,
      description: 'Mercado familiar y restaurantes',
      date: '2026-08-15',
      createdAt: '2026-08-15T14:20:00Z',
    },
    {
      id: `${userId}_tx_14`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_edu`,
      type: 'gasto',
      amount: 680000,
      description: 'Diplomado integración continua y licencias cloud',
      date: '2026-08-22',
      createdAt: '2026-08-22T11:45:00Z',
    },
    {
      id: `${userId}_tx_15`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_deu`,
      type: 'gasto',
      amount: 1150000,
      description: 'Cuota mensual crédito vehicular',
      date: '2026-08-25',
      createdAt: '2026-08-25T10:00:00Z',
    },
    // Septiembre 2026
    {
      id: `${userId}_tx_16`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_sal`,
      type: 'ingreso',
      amount: 7500000,
      description: 'Pago nómina septiembre con ajuste salarial',
      date: '2026-09-01',
      reference: 'NOM-2026-09',
      createdAt: '2026-09-01T08:00:00Z',
    },
    {
      id: `${userId}_tx_17`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_viv`,
      type: 'gasto',
      amount: 2195000,
      description: 'Arriendo apartamento y servicios',
      date: '2026-09-04',
      createdAt: '2026-09-04T09:00:00Z',
    },
    {
      id: `${userId}_tx_18`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_ali`,
      type: 'gasto',
      amount: 1290000,
      description: 'Mercado quincenal y cafetería',
      date: '2026-09-14',
      createdAt: '2026-09-14T16:00:00Z',
    },
    {
      id: `${userId}_tx_19`,
      userId,
      accountId: `${userId}_acc_efectivo`,
      categoryId: `${userId}_cat_tra`,
      type: 'gasto',
      amount: 490000,
      description: 'Combustible, peajes y parqueaderos',
      date: '2026-09-19',
      createdAt: '2026-09-19T19:00:00Z',
    },
    {
      id: `${userId}_tx_20`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_deu`,
      type: 'gasto',
      amount: 1380000,
      description: 'Pago cuota vehículo y tarjeta crédito',
      date: '2026-09-24',
      createdAt: '2026-09-24T10:30:00Z',
    },
    // Octubre 2026
    {
      id: `${userId}_tx_21`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_sal`,
      type: 'ingreso',
      amount: 7500000,
      description: 'Pago nómina mensual octubre',
      date: '2026-10-01',
      reference: 'NOM-2026-10',
      createdAt: '2026-10-01T08:00:00Z',
    },
    {
      id: `${userId}_tx_22`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_hon`,
      type: 'ingreso',
      amount: 1850000,
      description: 'Auditoría presupuestal trimestral cliente externo',
      date: '2026-10-16',
      createdAt: '2026-10-16T15:00:00Z',
    },
    {
      id: `${userId}_tx_23`,
      userId,
      accountId: `${userId}_acc_ahorros`,
      categoryId: `${userId}_cat_ren`,
      type: 'ingreso',
      amount: 290000,
      description: 'Rendimientos mensuales Cajita Nu + Fiducolombia',
      date: '2026-10-30',
      createdAt: '2026-10-30T20:00:00Z',
    },
    {
      id: `${userId}_tx_24`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_viv`,
      type: 'gasto',
      amount: 2220000,
      description: 'Arriendo mensual, acueducto, energía e internet',
      date: '2026-10-04',
      createdAt: '2026-10-04T09:10:00Z',
    },
    {
      id: `${userId}_tx_25`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_ali`,
      type: 'gasto',
      amount: 1340000,
      description: 'Mercado mensual Carulla y almuerzos laborales',
      date: '2026-10-12',
      createdAt: '2026-10-12T13:45:00Z',
    },
    {
      id: `${userId}_tx_26`,
      userId,
      accountId: `${userId}_acc_efectivo`,
      categoryId: `${userId}_cat_tra`,
      type: 'gasto',
      amount: 540000,
      description: 'Tanqueo gasolina extra y mantenimiento preventivo',
      date: '2026-10-18',
      createdAt: '2026-10-18T11:20:00Z',
    },
    {
      id: `${userId}_tx_27`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_deu`,
      type: 'gasto',
      amount: 1420000,
      description: 'Pago cuota Sufi vehículo + cuota tarjeta Visa',
      date: '2026-10-23',
      createdAt: '2026-10-23T10:15:00Z',
    },
    {
      id: `${userId}_tx_28`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_salu`,
      type: 'gasto',
      amount: 310000,
      description: 'Medicina prepagada y chequeo odontológico',
      date: '2026-10-26',
      createdAt: '2026-10-26T16:00:00Z',
    },
    // Noviembre 2026 (mes en curso)
    {
      id: `${userId}_tx_29`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_sal`,
      type: 'ingreso',
      amount: 7500000,
      description: 'Pago nómina mensual noviembre',
      date: '2026-11-01',
      reference: 'NOM-2026-11',
      createdAt: '2026-11-01T08:05:00Z',
    },
    {
      id: `${userId}_tx_30`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_hon`,
      type: 'ingreso',
      amount: 1250000,
      description: 'Consultoría modelo flujo de caja empresarial',
      date: '2026-11-02',
      reference: 'FAC-109',
      createdAt: '2026-11-02T14:30:00Z',
    },
    {
      id: `${userId}_tx_31`,
      userId,
      accountId: `${userId}_acc_ahorros`,
      categoryId: `${userId}_cat_ren`,
      type: 'ingreso',
      amount: 315000,
      description: 'Abono rendimientos efectivos cuentas remuneradas',
      date: '2026-11-03',
      createdAt: '2026-11-03T07:30:00Z',
    },
    {
      id: `${userId}_tx_32`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_viv`,
      type: 'gasto',
      amount: 2220000,
      description: 'Canon de arrendamiento y administración noviembre',
      date: '2026-11-02',
      createdAt: '2026-11-02T09:15:00Z',
    },
    {
      id: `${userId}_tx_33`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_ali`,
      type: 'gasto',
      amount: 960000,
      description: 'Compra quincenal supermercado y proteínas',
      date: '2026-11-02',
      createdAt: '2026-11-02T18:40:00Z',
    },
    {
      id: `${userId}_tx_34`,
      userId,
      accountId: `${userId}_acc_efectivo`,
      categoryId: `${userId}_cat_tra`,
      type: 'gasto',
      amount: 380000,
      description: 'Combustible vehículo y recarga TAG peajes',
      date: '2026-11-03',
      createdAt: '2026-11-03T08:50:00Z',
    },
    {
      id: `${userId}_tx_35`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_edu`,
      type: 'gasto',
      amount: 490000,
      description: 'Suscripciones servidor Docker Registry y libros técnicos',
      date: '2026-11-03',
      createdAt: '2026-11-03T11:15:00Z',
    },
    {
      id: `${userId}_tx_36`,
      userId,
      accountId: `${userId}_acc_nomina`,
      categoryId: `${userId}_cat_oci`,
      type: 'gasto',
      amount: 340000,
      description: 'Cena aniversario y entradas teatro',
      date: '2026-11-03',
      createdAt: '2026-11-03T13:20:00Z',
    },
  ];

  const budgets: Budget[] = [
    {
      id: `${userId}_bud_viv`,
      userId,
      categoryId: `${userId}_cat_viv`,
      month: '2026-11',
      limitAmount: 2350000,
      alertThreshold: 85,
    },
    {
      id: `${userId}_bud_ali`,
      userId,
      categoryId: `${userId}_cat_ali`,
      month: '2026-11',
      limitAmount: 1300000,
      alertThreshold: 80,
    },
    {
      id: `${userId}_bud_tra`,
      userId,
      categoryId: `${userId}_cat_tra`,
      month: '2026-11',
      limitAmount: 550000,
      alertThreshold: 80,
    },
    {
      id: `${userId}_bud_edu`,
      userId,
      categoryId: `${userId}_cat_edu`,
      month: '2026-11',
      limitAmount: 450000,
      alertThreshold: 80,
    },
    {
      id: `${userId}_bud_oci`,
      userId,
      categoryId: `${userId}_cat_oci`,
      month: '2026-11',
      limitAmount: 500000,
      alertThreshold: 80,
    },
    {
      id: `${userId}_bud_deu`,
      userId,
      categoryId: `${userId}_cat_deu`,
      month: '2026-11',
      limitAmount: 1650000,
      alertThreshold: 85,
    },
  ];

  const debts: Debt[] = [
    {
      id: `${userId}_debt_auto`,
      userId,
      creditor: 'Sufi Bancolombia',
      title: 'Crédito Vehicular Mazda CX-30',
      totalAmount: 42000000,
      remainingAmount: 18450000,
      monthlyInstallment: 985000,
      interestRateAnnual: 14.8,
      dueDate: '2026-11-12',
      totalInstallments: 48,
      paidInstallments: 27,
      payments: [
        {
          id: `${userId}_dp_1`,
          debtId: `${userId}_debt_auto`,
          accountId: `${userId}_acc_nomina`,
          amount: 985000,
          date: '2026-10-12',
          note: 'Cuota ordinaria #27 pagada por PSE',
        },
      ],
      createdAt: '2024-08-12T10:00:00Z',
    },
    {
      id: `${userId}_debt_tc`,
      userId,
      creditor: 'Banco de Bogotá',
      title: 'Tarjeta Visa Platinum',
      totalAmount: 5600000,
      remainingAmount: 2180000,
      monthlyInstallment: 435000,
      interestRateAnnual: 24.9,
      dueDate: '2026-11-08',
      totalInstallments: 12,
      paidInstallments: 7,
      payments: [
        {
          id: `${userId}_dp_2`,
          debtId: `${userId}_debt_tc`,
          accountId: `${userId}_acc_nomina`,
          amount: 435000,
          date: '2026-10-08',
          note: 'Pago cuota mensual sin mora',
        },
      ],
      createdAt: '2026-04-08T10:00:00Z',
    },
    {
      id: `${userId}_debt_edu`,
      userId,
      creditor: 'Fincomercio',
      title: 'Crédito Posgrado Ingeniería de Software',
      totalAmount: 9800000,
      remainingAmount: 3250000,
      monthlyInstallment: 390000,
      interestRateAnnual: 11.2,
      dueDate: '2026-11-25',
      totalInstallments: 24,
      paidInstallments: 16,
      payments: [],
      createdAt: '2025-07-25T10:00:00Z',
    },
  ];

  const goals: SavingsGoal[] = [
    {
      id: `${userId}_goal_emerg`,
      userId,
      title: 'Fondo de Emergencia (6 Meses)',
      targetAmount: 24000000,
      currentAmount: 17400000,
      deadline: '2027-04-30',
      priority: 'alta',
      contributions: [
        {
          id: `${userId}_gc_1`,
          goalId: `${userId}_goal_emerg`,
          accountId: `${userId}_acc_ahorros`,
          amount: 1200000,
          date: '2026-10-05',
          note: 'Aporte automático nómina octubre',
        },
        {
          id: `${userId}_gc_2`,
          goalId: `${userId}_goal_emerg`,
          accountId: `${userId}_acc_ahorros`,
          amount: 1100000,
          date: '2026-11-01',
          note: 'Aporte programado noviembre',
        },
      ],
      createdAt: '2026-01-15T10:00:00Z',
    },
    {
      id: `${userId}_goal_apto`,
      userId,
      title: 'Cuota Inicial Vivienda Propia',
      targetAmount: 65000000,
      currentAmount: 26800000,
      deadline: '2028-06-30',
      priority: 'alta',
      contributions: [
        {
          id: `${userId}_gc_3`,
          goalId: `${userId}_goal_apto`,
          accountId: `${userId}_acc_inversion`,
          amount: 1850000,
          date: '2026-10-20',
          note: 'Abono extraordinario honorarios consultoría',
        },
      ],
      createdAt: '2025-11-01T10:00:00Z',
    },
    {
      id: `${userId}_goal_viaje`,
      userId,
      title: 'Viaje Familiar Costa Caribe',
      targetAmount: 5500000,
      currentAmount: 4400000,
      deadline: '2026-12-20',
      priority: 'media',
      contributions: [
        {
          id: `${userId}_gc_4`,
          goalId: `${userId}_goal_viaje`,
          accountId: `${userId}_acc_ahorros`,
          amount: 650000,
          date: '2026-10-28',
          note: 'Reserva tiquetes y alojamiento',
        },
      ],
      createdAt: '2026-05-10T10:00:00Z',
    },
  ];

  return { accounts, categories, transactions, budgets, debts, goals };
}

function buildSeedDataForAna(userId: string): Omit<DatabaseStore, 'users'> {
  const categories: Category[] = [
    { id: `${userId}_cat_sal`, userId, name: 'Salario Ingeniería', type: 'ingreso', color: '#16A36A' },
    { id: `${userId}_cat_fre`, userId, name: 'Proyectos Freelance', type: 'ingreso', color: '#0D9488' },
    { id: `${userId}_cat_viv`, userId, name: 'Alquiler y Servicios', type: 'gasto', color: '#14243A' },
    { id: `${userId}_cat_ali`, userId, name: 'Supermercado y Restaurantes', type: 'gasto', color: '#D97706' },
    { id: `${userId}_cat_tec`, userId, name: 'Suscripciones y Cloud', type: 'gasto', color: '#7C3AED' },
    { id: `${userId}_cat_tra`, userId, name: 'Movilidad Urbana', type: 'gasto', color: '#4F46E5' },
  ];

  const accounts: FinancialAccount[] = [
    {
      id: `${userId}_acc_chk`,
      userId,
      name: 'Checking Account Principal',
      type: 'banco',
      institution: 'Mercury Bank',
      accountNumber: '**** 7712',
      balance: 4820,
      createdAt: '2026-01-12T10:00:00Z',
    },
    {
      id: `${userId}_acc_sav`,
      userId,
      name: 'High-Yield Savings',
      type: 'ahorros',
      institution: 'Ally Bank',
      accountNumber: '**** 2049',
      balance: 16400,
      createdAt: '2026-02-01T10:00:00Z',
    },
    {
      id: `${userId}_acc_cash`,
      userId,
      name: 'Efectivo Operativo',
      type: 'efectivo',
      institution: 'Billetera Personal',
      accountNumber: 'CASH-USD',
      balance: 340,
      createdAt: '2026-02-05T10:00:00Z',
    },
  ];

  const transactions: FinancialTransaction[] = [
    {
      id: `${userId}_tx_1`,
      userId,
      accountId: `${userId}_acc_chk`,
      categoryId: `${userId}_cat_sal`,
      type: 'ingreso',
      amount: 4600,
      description: 'Pago mensual ingeniería remota octubre',
      date: '2026-10-01',
      createdAt: '2026-10-01T09:00:00Z',
    },
    {
      id: `${userId}_tx_2`,
      userId,
      accountId: `${userId}_acc_chk`,
      categoryId: `${userId}_cat_viv`,
      type: 'gasto',
      amount: 1450,
      description: 'Renta departamento y electricidad octubre',
      date: '2026-10-03',
      createdAt: '2026-10-03T10:00:00Z',
    },
    {
      id: `${userId}_tx_3`,
      userId,
      accountId: `${userId}_acc_chk`,
      categoryId: `${userId}_cat_ali`,
      type: 'gasto',
      amount: 620,
      description: 'Supermercado orgánico y cafés',
      date: '2026-10-14',
      createdAt: '2026-10-14T18:00:00Z',
    },
    {
      id: `${userId}_tx_4`,
      userId,
      accountId: `${userId}_acc_chk`,
      categoryId: `${userId}_cat_sal`,
      type: 'ingreso',
      amount: 4600,
      description: 'Pago mensual ingeniería remota noviembre',
      date: '2026-11-01',
      createdAt: '2026-11-01T09:00:00Z',
    },
    {
      id: `${userId}_tx_5`,
      userId,
      accountId: `${userId}_acc_chk`,
      categoryId: `${userId}_cat_fre`,
      type: 'ingreso',
      amount: 850,
      description: 'Automatización pipeline Jenkins cliente fintech',
      date: '2026-11-02',
      createdAt: '2026-11-02T15:00:00Z',
    },
    {
      id: `${userId}_tx_6`,
      userId,
      accountId: `${userId}_acc_chk`,
      categoryId: `${userId}_cat_viv`,
      type: 'gasto',
      amount: 1450,
      description: 'Renta departamento noviembre',
      date: '2026-11-02',
      createdAt: '2026-11-02T11:00:00Z',
    },
    {
      id: `${userId}_tx_7`,
      userId,
      accountId: `${userId}_acc_chk`,
      categoryId: `${userId}_cat_ali`,
      type: 'gasto',
      amount: 410,
      description: 'Compras quincenales mercado',
      date: '2026-11-03',
      createdAt: '2026-11-03T12:00:00Z',
    },
    {
      id: `${userId}_tx_8`,
      userId,
      accountId: `${userId}_acc_chk`,
      categoryId: `${userId}_cat_tec`,
      type: 'gasto',
      amount: 145,
      description: 'Infraestructura AWS, GitHub Pro y herramientas DevOps',
      date: '2026-11-03',
      createdAt: '2026-11-03T13:30:00Z',
    },
  ];

  const budgets: Budget[] = [
    {
      id: `${userId}_bud_1`,
      userId,
      categoryId: `${userId}_cat_viv`,
      month: '2026-11',
      limitAmount: 1500,
      alertThreshold: 85,
    },
    {
      id: `${userId}_bud_2`,
      userId,
      categoryId: `${userId}_cat_ali`,
      month: '2026-11',
      limitAmount: 700,
      alertThreshold: 80,
    },
    {
      id: `${userId}_bud_3`,
      userId,
      categoryId: `${userId}_cat_tec`,
      month: '2026-11',
      limitAmount: 200,
      alertThreshold: 80,
    },
  ];

  const debts: Debt[] = [
    {
      id: `${userId}_debt_1`,
      userId,
      creditor: 'Apple Card / Goldman Sachs',
      title: 'Estación de Trabajo MacBook Pro M4',
      totalAmount: 2800,
      remainingAmount: 1120,
      monthlyInstallment: 235,
      interestRateAnnual: 0,
      dueDate: '2026-11-15',
      totalInstallments: 12,
      paidInstallments: 7,
      payments: [],
      createdAt: '2026-04-15T10:00:00Z',
    },
  ];

  const goals: SavingsGoal[] = [
    {
      id: `${userId}_goal_1`,
      userId,
      title: 'Portafolio ETF S&P 500 Inicial',
      targetAmount: 20000,
      currentAmount: 14800,
      deadline: '2027-03-31',
      priority: 'alta',
      contributions: [
        {
          id: `${userId}_gc_1`,
          goalId: `${userId}_goal_1`,
          accountId: `${userId}_acc_sav`,
          amount: 950,
          date: '2026-11-01',
          note: 'Aporte mensual sistemático',
        },
      ],
      createdAt: '2026-01-20T10:00:00Z',
    },
    {
      id: `${userId}_goal_2`,
      userId,
      title: 'Maestría Arquitectura Cloud',
      targetAmount: 8500,
      currentAmount: 5100,
      deadline: '2027-08-30',
      priority: 'media',
      contributions: [],
      createdAt: '2026-03-10T10:00:00Z',
    },
  ];

  return { accounts, categories, transactions, budgets, debts, goals };
}

export async function createInitialDatabase(): Promise<DatabaseStore> {
  const carlosHash = await bcrypt.hash('Demo2026!', 10);
  const anaHash = await bcrypt.hash('Finanzas2026!', 10);

  const carlosId = 'usr_carlos';
  const anaId = 'usr_ana';

  const users: StoredUser[] = [
    {
      id: carlosId,
      name: 'Carlos Andrés Mendoza',
      email: 'carlos.mendoza.finanzapp@gmail.com',
      passwordHash: carlosHash,
      occupation: 'Analista Financiero Senior',
      currency: 'COP',
      monthlySavingsRateGoal: 25,
      avatarKey: 'carlos',
      createdAt: '2026-01-10T08:30:00Z',
    },
    {
      id: anaId,
      name: 'Ana Sofía Martínez',
      email: 'ana.martinez.finanzapp@gmail.com',
      passwordHash: anaHash,
      occupation: 'Ingeniera DevOps & CI/CD',
      currency: 'USD',
      monthlySavingsRateGoal: 30,
      avatarKey: 'ana',
      createdAt: '2026-01-12T09:15:00Z',
    },
  ];

  const carlosData = buildSeedDataForCarlos(carlosId);
  const anaData = buildSeedDataForAna(anaId);

  return {
    users,
    accounts: [...carlosData.accounts, ...anaData.accounts],
    categories: [...carlosData.categories, ...anaData.categories],
    transactions: [...carlosData.transactions, ...anaData.transactions],
    budgets: [...carlosData.budgets, ...anaData.budgets],
    debts: [...carlosData.debts, ...anaData.debts],
    goals: [...carlosData.goals, ...anaData.goals],
    otpVerifications: [],
  };
}

let memoryCache: DatabaseStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export async function loadDatabase(): Promise<DatabaseStore> {
  if (memoryCache) {
    return memoryCache;
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseStore;
    if (!parsed.otpVerifications) parsed.otpVerifications = [];

    // Migrar correos de demostración previos al formato @gmail.com
    let migrated = false;
    for (const u of parsed.users) {
      if (u.id === 'usr_carlos' && u.email === 'carlos.mendoza@finanzapp.co') {
        u.email = 'carlos.mendoza.finanzapp@gmail.com';
        migrated = true;
      }
      if (u.id === 'usr_ana' && u.email === 'ana.martinez@finanzapp.co') {
        u.email = 'ana.martinez.finanzapp@gmail.com';
        migrated = true;
      }
    }
    memoryCache = parsed;
    if (migrated) {
      await saveDatabase(parsed);
    }
    return memoryCache;
  } catch {
    const seeded = await createInitialDatabase();
    memoryCache = seeded;
    await saveDatabase(seeded);
    return seeded;
  }
}

export async function saveDatabase(store: DatabaseStore): Promise<void> {
  memoryCache = store;
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmpFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
    await fs.rename(tmpFile, DATA_FILE);
  });
  return writeQueue;
}

export async function seedStarterDataForNewUser(userId: string): Promise<void> {
  const db = await loadDatabase();
  const starterCategories: Category[] = [
    { id: generateId('cat'), userId, name: 'Salario Principal', type: 'ingreso', color: '#16A36A' },
    { id: generateId('cat'), userId, name: 'Ingresos Adicionales', type: 'ingreso', color: '#0D9488' },
    { id: generateId('cat'), userId, name: 'Vivienda y Servicios', type: 'gasto', color: '#14243A' },
    { id: generateId('cat'), userId, name: 'Alimentación', type: 'gasto', color: '#D97706' },
    { id: generateId('cat'), userId, name: 'Transporte', type: 'gasto', color: '#4F46E5' },
    { id: generateId('cat'), userId, name: 'Salud y Educación', type: 'gasto', color: '#0891B2' },
    { id: generateId('cat'), userId, name: 'Obligaciones y Deudas', type: 'gasto', color: '#DC2626' },
  ];

  const starterAccount: FinancialAccount = {
    id: generateId('acc'),
    userId,
    name: 'Efectivo Inicial',
    type: 'efectivo',
    institution: 'Disponible Personal',
    accountNumber: 'EFEC-001',
    balance: 0,
    createdAt: new Date().toISOString(),
  };

  db.categories.push(...starterCategories);
  db.accounts.push(starterAccount);
  await saveDatabase(db);
}

export function buildUserSeedDataset(userId: string): Omit<DatabaseStore, 'users'> {
  return userId === 'usr_ana' ? buildSeedDataForAna(userId) : buildSeedDataForCarlos(userId);
}

export async function resetUserDemoData(userId: string): Promise<void> {
  const db = await loadDatabase();
  db.accounts = db.accounts.filter((a) => a.userId !== userId);
  db.categories = db.categories.filter((c) => c.userId !== userId);
  db.transactions = db.transactions.filter((t) => t.userId !== userId);
  db.budgets = db.budgets.filter((b) => b.userId !== userId);
  db.debts = db.debts.filter((d) => d.userId !== userId);
  db.goals = db.goals.filter((g) => g.userId !== userId);

  const seed = buildUserSeedDataset(userId);

  db.accounts.push(...seed.accounts);
  db.categories.push(...seed.categories);
  db.transactions.push(...seed.transactions);
  db.budgets.push(...seed.budgets);
  db.debts.push(...seed.debts);
  db.goals.push(...seed.goals);

  await saveDatabase(db);
}

export async function getWorkspaceForUser(userId: string): Promise<FinanzappWorkspacePayload | null> {
  const db = await loadDatabase();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;

  const transactions = db.transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return {
    user: sanitizeUser(user),
    accounts: db.accounts.filter((a) => a.userId === userId),
    categories: db.categories.filter((c) => c.userId === userId),
    transactions,
    budgets: db.budgets.filter((b) => b.userId === userId),
    debts: db.debts
      .filter((d) => d.userId === userId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    goals: db.goals.filter((g) => g.userId === userId),
  };
}
