'use client';

import { RedirectIfAuthenticated } from '@/lib/auth/RedirectIfAuthenticated';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RedirectIfAuthenticated>{children}</RedirectIfAuthenticated>;
}
