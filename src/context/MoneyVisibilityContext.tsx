import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { formatCurrency } from '../utils/calculator';

export const MONEY_MASK = '••••••';

export const getHideMoneyStorageKey = (uid: string): string =>
  `ot_app_u_${uid}_hide_money_v1`;

export interface FormatMoneyOptions {
  /** Currency/sign prefix, defaults to '฿' */
  prefix?: string;
  /** Number of decimals when visible, defaults to 2 (uses formatCurrency) */
  decimals?: number;
}

export const formatMaskedMoney = (
  amount: number,
  isHidden: boolean,
  options?: FormatMoneyOptions
): string => {
  const prefix = options?.prefix !== undefined ? options.prefix : '฿';
  if (isHidden) {
    return `${prefix}${MONEY_MASK}`;
  }
  const decimals = options?.decimals ?? 2;
  if (decimals === 0) {
    return `${prefix}${Math.round(amount).toLocaleString('th-TH')}`;
  }
  return `${prefix}${formatCurrency(amount)}`;
};

interface MoneyVisibilityContextType {
  isMoneyHidden: boolean;
  toggleMoneyVisibility: () => void;
  setMoneyHidden: (hidden: boolean) => void;
  formatMoney: (amount: number, options?: FormatMoneyOptions) => string;
}

const MoneyVisibilityContext = createContext<MoneyVisibilityContextType | null>(null);

export const MoneyVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, registerBeforeLogout } = useAuth();
  const [isMoneyHidden, setIsMoneyHiddenState] = useState<boolean>(false);

  // Sync per-UID preference whenever user changes; reset to default (false) on logout
  useEffect(() => {
    if (!user?.uid) {
      setIsMoneyHiddenState(false);
      return;
    }

    try {
      const saved = localStorage.getItem(getHideMoneyStorageKey(user.uid));
      setIsMoneyHiddenState(saved === '1');
    } catch {
      setIsMoneyHiddenState(false);
    }
  }, [user?.uid]);

  // Reset in-memory state immediately before Firebase signOut completes (Session Isolation)
  useEffect(() => {
    const unregister = registerBeforeLogout(() => {
      setIsMoneyHiddenState(false);
    });
    return unregister;
  }, [registerBeforeLogout]);

  const setMoneyHidden = useCallback(
    (hidden: boolean) => {
      setIsMoneyHiddenState(hidden);
      if (user?.uid) {
        try {
          localStorage.setItem(getHideMoneyStorageKey(user.uid), hidden ? '1' : '0');
        } catch {
          // Ignore storage quota / private mode errors safely
        }
      }
    },
    [user?.uid]
  );

  const toggleMoneyVisibility = useCallback(() => {
    setMoneyHidden(!isMoneyHidden);
  }, [isMoneyHidden, setMoneyHidden]);

  const formatMoney = useCallback(
    (amount: number, options?: FormatMoneyOptions) =>
      formatMaskedMoney(amount, isMoneyHidden, options),
    [isMoneyHidden]
  );

  return (
    <MoneyVisibilityContext.Provider
      value={{
        isMoneyHidden,
        toggleMoneyVisibility,
        setMoneyHidden,
        formatMoney,
      }}
    >
      {children}
    </MoneyVisibilityContext.Provider>
  );
};

export const useMoneyVisibility = (): MoneyVisibilityContextType => {
  const ctx = useContext(MoneyVisibilityContext);
  if (!ctx) {
    throw new Error('useMoneyVisibility must be used within a MoneyVisibilityProvider');
  }
  return ctx;
};
