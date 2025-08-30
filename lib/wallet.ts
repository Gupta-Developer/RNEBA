export type TransactionStatus = 'paid' | 'pending' | 'rejected';

export type Transaction = {
  id: string;
  title: string; // app/task name
  icon?: string;
  status: TransactionStatus;
  amount?: number;
  timestamp: number; // ms epoch
};

// In-memory store. In a real app, replace with backend persistence.
let transactions: Transaction[] = [
  {
    id: 'seed-1',
    title: 'Ludo Turbo',
    status: 'paid',
    amount: 5,
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: 'seed-2',
    title: 'Cash Runner',
    status: 'paid',
    amount: 7,
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: 'seed-3',
    title: 'Story TV',
    status: 'pending',
    amount: 6,
    timestamp: Date.now() - 1000 * 60 * 60 * 20,
  },
  {
    id: 'seed-4',
    title: 'QuizMaster',
    status: 'rejected',
    amount: 7,
    timestamp: Date.now() - 1000 * 60 * 60 * 40,
  },
  {
    id: 'seed-5',
    title: 'Puzzle King',
    status: 'paid',
    amount: 8,
    timestamp: Date.now() - 1000 * 60 * 60 * 72,
  },
  {
    id: 'seed-6',
    title: 'FinanceGo',
    status: 'pending',
    amount: 10,
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
  },
];

const subs = new Set<(items: Transaction[]) => void>();

function notify() {
  const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  subs.forEach((cb) => cb(sorted));
}

export function subscribeTransactions(cb: (items: Transaction[]) => void) {
  subs.add(cb);
  cb([...transactions].sort((a, b) => b.timestamp - a.timestamp));
  return () => {
    subs.delete(cb);
  };
}

export function getTransactions(): Transaction[] {
  return [...transactions].sort((a, b) => b.timestamp - a.timestamp);
}

export function getCompletedCount(): number {
  return transactions.filter((t) => t.status === 'paid').length;
}

export function addTransactionPending(params: {
  title: string;
  icon?: string;
  amount?: number;
}): Transaction {
  const tx: Transaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: params.title,
    icon: params.icon,
    amount: params.amount,
    status: 'pending',
    timestamp: Date.now(),
  };
  transactions = [tx, ...transactions];
  notify();
  return tx;
}

export function updateTransactionStatus(id: string, status: TransactionStatus) {
  transactions = transactions.map((t) => (t.id === id ? { ...t, status } : t));
  notify();
}

// Convenience helpers to simulate admin actions
export const Admin = {
  approve(id: string) {
    updateTransactionStatus(id, 'paid');
  },
  reject(id: string) {
    updateTransactionStatus(id, 'rejected');
  },
};
