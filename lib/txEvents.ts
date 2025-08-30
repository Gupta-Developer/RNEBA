export type TxEvent<T> = (tx: T) => void;

const listeners = new Set<TxEvent<any>>();

export function addTransactionListener<T>(cb: TxEvent<T>) {
  // @ts-ignore generic pass-through
  listeners.add(cb);
  return () => listeners.delete(cb as any);
}

export function emitTransaction<T>(tx: T) {
  for (const cb of Array.from(listeners)) {
    try {
      // @ts-ignore generic pass-through
      cb(tx);
    } catch {}
  }
}
