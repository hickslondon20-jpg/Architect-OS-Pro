import React, { createContext, useContext, useState, ReactNode } from 'react';

type Tier = 'free' | 'pro';

interface AppContextType {
  tier: Tier;
  setTier: (tier: Tier) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tier, setTier] = useState<Tier>('free');
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile, layout handles desktop

  return (
    <AppContext.Provider value={{ tier, setTier, isSidebarOpen, setSidebarOpen }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
