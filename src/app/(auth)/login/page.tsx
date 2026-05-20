'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useAuth } from '@/lib/auth/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect authenticated users away from login
  if (!authLoading && user) {
    router.replace('/overview');
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    // Validate with Zod
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: FieldErrors = {};
      const fieldIssues = result.error.flatten().fieldErrors;
      if (fieldIssues.email?.[0]) errors.email = fieldIssues.email[0];
      if (fieldIssues.password?.[0]) errors.password = fieldIssues.password[0];
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push('/overview');
    } catch {
      // Error is set in the AuthContext login function
      setGeneralError('Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Sign in to Offsettabillity
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Access your dashboard and manage your ESG impact portfolio.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-sm border border-gray-200"
          noValidate
        >
          {generalError && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
            >
              {generalError}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                fieldErrors.email
                  ? 'border-red-300 text-red-900'
                  : 'border-gray-300 text-gray-900'
              }`}
              placeholder="you@example.com"
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? 'password-error' : undefined
              }
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                fieldErrors.password
                  ? 'border-red-300 text-red-900'
                  : 'border-gray-300 text-gray-900'
              }`}
              placeholder="Enter your password"
            />
            {fieldErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          <p className="text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <a
              href="/register"
              className="font-medium text-green-600 hover:text-green-500"
            >
              Register here
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
