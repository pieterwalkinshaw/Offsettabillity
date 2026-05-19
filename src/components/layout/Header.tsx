'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 glass-dark bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-2xl tracking-tight gradient-text">
            Offsettable
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/projects" className="text-foreground/80 hover:text-primary-400 transition-colors">
            Projects
          </Link>
          <Link href="/auditors" className="text-foreground/80 hover:text-primary-400 transition-colors">
            For Auditors
          </Link>
          <Link href="/contact" className="text-foreground/80 hover:text-primary-400 transition-colors">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {!user ? (
            <>
              <Link href="/login" className="text-sm font-medium hover:text-primary-400 transition-colors hidden md:block">
                Log in
              </Link>
              <Link 
                href="/login"
                className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-lg shadow-primary-500/20"
              >
                Get Started
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm font-medium text-foreground/80 hover:text-primary-400 transition-colors hidden md:block">
                Dashboard
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold text-xs uppercase border border-primary-500/30">
                  {user.name.charAt(0)}
                </div>
                <button 
                  onClick={logout}
                  className="text-xs font-medium text-foreground/50 hover:text-red-400 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
