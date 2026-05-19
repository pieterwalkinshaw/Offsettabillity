'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { Role } from '@/types';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = (role: Role) => {
    login(role);
    router.push('/dashboard');
  };

  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4 bg-background">
      <div className="max-w-md w-full glass-dark rounded-3xl p-8 border border-white/10 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-foreground/60">Select a role to mock login to the platform.</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => handleLogin('funder')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-primary-500/10 hover:border-primary-500/30 transition-all group"
          >
            <div className="text-left">
              <div className="font-semibold text-primary-400">Funder</div>
              <div className="text-xs text-foreground/50">Access verified projects & reports</div>
            </div>
            <span className="text-primary-500 group-hover:translate-x-1 transition-transform">→</span>
          </button>

          <button 
            onClick={() => handleLogin('owner')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group"
          >
            <div className="text-left">
              <div className="font-semibold text-emerald-400">Project Owner</div>
              <div className="text-xs text-foreground/50">Manage projects & audits</div>
            </div>
            <span className="text-emerald-500 group-hover:translate-x-1 transition-transform">→</span>
          </button>

          <button 
            onClick={() => handleLogin('auditor')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-accent-500/10 hover:border-accent-500/30 transition-all group"
          >
            <div className="text-left">
              <div className="font-semibold text-accent-400">Auditor</div>
              <div className="text-xs text-foreground/50">Verify projects & upload reports</div>
            </div>
            <span className="text-accent-500 group-hover:translate-x-1 transition-transform">→</span>
          </button>

          <button 
            onClick={() => handleLogin('admin')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
          >
            <div className="text-left">
              <div className="font-semibold text-red-400">Admin</div>
              <div className="text-xs text-foreground/50">God mode access</div>
            </div>
            <span className="text-red-500 group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
