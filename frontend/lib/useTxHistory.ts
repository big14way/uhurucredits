"use client";

import { useState, useEffect, useCallback } from "react";

export type TxType = "loan_applied" | "installment_paid";
export type TxStatus = "success" | "failed";

export interface TxRecord {
  id: string;
  type: TxType;
  amount: number;
  txHash: string;
  status: TxStatus;
  timestamp: number;
  loanId?: number;
  installmentNum?: number;
}

const STORAGE_KEY = "uhuru_tx_history";

function load(): TxRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useTxHistory() {
  const [history, setHistory] = useState<TxRecord[]>([]);

  useEffect(() => {
    setHistory(load());
  }, []);

  const addTx = useCallback((record: Omit<TxRecord, "id">) => {
    const entry: TxRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 50); // keep last 50
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { history, addTx };
}
