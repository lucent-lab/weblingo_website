"use client";

import * as React from "react";

type DashboardTitleContextValue = {
  title: string | null;
  setTitle: (title: string | null) => void;
};

const DashboardTitleContext = React.createContext<DashboardTitleContextValue | null>(null);

export function DashboardTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = React.useState<string | null>(null);

  const value = React.useMemo(() => ({ title, setTitle }), [title]);

  return <DashboardTitleContext.Provider value={value}>{children}</DashboardTitleContext.Provider>;
}

export function useDashboardTitle() {
  const context = React.useContext(DashboardTitleContext);
  if (!context) {
    throw new Error("useDashboardTitle must be used within a DashboardTitleProvider.");
  }
  return context;
}

export function DashboardTitleSetter({ title }: { title: string | null }) {
  const { setTitle } = useDashboardTitle();

  React.useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);

  return null;
}
