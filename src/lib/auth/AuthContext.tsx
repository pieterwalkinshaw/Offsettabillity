'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { Role, User } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (role: Role) => {
    setUser({
      userId: `mock-${role}-id`,
      name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      email: `${role}@offsettable.co`,
      role: role,
      createdAt: new Date().toISOString(),
    });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
