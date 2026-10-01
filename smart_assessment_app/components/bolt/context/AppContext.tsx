import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Role, User } from '@/types';
import { users } from '@/data/mockData';

interface AppContextValue {
  user: User;
  role: Role;
  setRole: (role: Role) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children, initialRole = 'teacher' }: { children: ReactNode; initialRole?: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const user = users[role];

  return (
    <AppContext.Provider value={{ user, role, setRole }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
