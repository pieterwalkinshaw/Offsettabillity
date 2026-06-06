'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';

/**
 * Account Settings Page
 *
 * Provides account management options including:
 * - Marketing consent withdrawal/grant (Requirement 12.6)
 * - Account deletion request with PII anonymization (Requirement 12.2)
 *
 * Validates: Requirements 12.2, 12.6
 */

type DeletionStatus = 'idle' | 'confirming' | 'processing' | 'success' | 'error';
type ConsentStatus = 'loading' | 'idle' | 'updating' | 'success' | 'error';

export default function SettingsPage() {
  const { userProfile, user, logout } = useAuth();
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Marketing Consent State ─────────────────────────────────────────────────
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('loading');
  const [marketingConsent, setMarketingConsent] = useState<boolean>(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // Fetch current consent status from Firestore user document
  useEffect(() => {
    async function fetchConsent() {
      if (!user) {
        setConsentStatus('idle');
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setMarketingConsent(data.marketingConsent ?? false);
        }
        setConsentStatus('idle');
      } catch {
        setConsentStatus('idle');
      }
    }
    fetchConsent();
  }, [user]);

  async function handleConsentToggle() {
    const newConsent = !marketingConsent;
    setConsentStatus('updating');
    setConsentError(null);

    try {
      const updateConsentFn = httpsCallable(functions, 'auth_updateConsent');
      await updateConsentFn({ marketingConsent: newConsent });

      setMarketingConsent(newConsent);
      setConsentStatus('success');

      // Reset success indicator after 3 seconds
      setTimeout(() => setConsentStatus('idle'), 3000);
    } catch (error: unknown) {
      setConsentStatus('error');
      const err = error as { message?: string };
      setConsentError(
        err.message || 'Failed to update consent preferences. Please try again.'
      );
    }
  }

  async function handleDeleteAccount() {
    setDeletionStatus('processing');
    setErrorMessage(null);

    try {
      const deleteAccountFn = httpsCallable(functions, 'auth_deleteAccount');
      await deleteAccountFn();

      setDeletionStatus('success');

      // Log the user out after successful deletion
      setTimeout(async () => {
        await logout();
      }, 3000);
    } catch (error: unknown) {
      setDeletionStatus('error');
      const err = error as { message?: string };
      setErrorMessage(
        err.message || 'Account deletion could not be completed. Please try again.'
      );
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
          <p className="text-foreground/60 mt-1">
            Manage your account preferences and data.
          </p>
        </div>

        {/* Account Info Section */}
        <section
          aria-labelledby="account-info-heading"
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-8"
        >
          <h2 id="account-info-heading" className="text-lg font-semibold text-foreground mb-4">
            Account Information
          </h2>
          <dl className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-sm font-medium text-foreground/60 sm:w-32">Name</dt>
              <dd className="text-sm text-foreground">{userProfile?.name || '—'}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-sm font-medium text-foreground/60 sm:w-32">Email</dt>
              <dd className="text-sm text-foreground">{userProfile?.email || '—'}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-sm font-medium text-foreground/60 sm:w-32">Role</dt>
              <dd className="text-sm text-foreground capitalize">{userProfile?.role || '—'}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-sm font-medium text-foreground/60 sm:w-32">Country</dt>
              <dd className="text-sm text-foreground">{userProfile?.country || '—'}</dd>
            </div>
          </dl>
        </section>

        {/* Marketing Consent Section */}
        <section
          aria-labelledby="consent-heading"
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-8"
        >
          <h2 id="consent-heading" className="text-lg font-semibold text-foreground mb-2">
            Marketing Communications
          </h2>
          <p className="text-sm text-foreground/70 mb-4">
            Control whether you receive marketing communications from Offsettable.
            Changes take effect within 24 hours.{' '}
            <a
              href="/privacy"
              className="text-primary-600 underline hover:text-primary-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </p>

          {consentStatus === 'loading' ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-foreground/70">Loading preferences...</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={marketingConsent}
                  aria-label="Marketing communications consent"
                  onClick={handleConsentToggle}
                  disabled={consentStatus === 'updating'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    marketingConsent ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      marketingConsent ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-foreground">
                  {marketingConsent
                    ? 'Receiving marketing communications'
                    : 'Not receiving marketing communications'}
                </span>
              </div>

              {consentStatus === 'updating' && (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-foreground/70">Updating...</span>
                </div>
              )}

              {consentStatus === 'success' && (
                <span className="text-sm text-green-600 font-medium" role="alert" aria-live="polite">
                  ✓ Updated
                </span>
              )}
            </div>
          )}

          {consentStatus === 'error' && consentError && (
            <div
              className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"
              role="alert"
              aria-live="polite"
            >
              <p className="text-sm text-red-700">{consentError}</p>
            </div>
          )}
        </section>

        {/* Danger Zone — Account Deletion */}
        <section
          aria-labelledby="danger-zone-heading"
          className="rounded-xl border border-red-200 bg-white p-6 shadow-sm"
        >
          <h2 id="danger-zone-heading" className="text-lg font-semibold text-red-700 mb-2">
            Danger Zone
          </h2>
          <p className="text-sm text-foreground/70 mb-4">
            Requesting account deletion will anonymize your personal information (email, name, phone)
            within 30 days. Non-personal data will be retained for platform integrity. This action
            cannot be undone.
          </p>

          {/* Success State */}
          {deletionStatus === 'success' && (
            <div
              className="rounded-lg border border-green-200 bg-green-50 p-4 mb-4"
              role="alert"
              aria-live="polite"
            >
              <p className="text-sm text-green-800 font-medium">
                Account deletion request submitted successfully.
              </p>
              <p className="text-sm text-green-700 mt-1">
                Your personal information has been anonymized. You will be logged out shortly.
              </p>
            </div>
          )}

          {/* Error State */}
          {deletionStatus === 'error' && errorMessage && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4"
              role="alert"
              aria-live="polite"
            >
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* Confirmation Dialog */}
          {deletionStatus === 'confirming' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
              <p className="text-sm text-amber-800 font-medium mb-3">
                Are you sure you want to delete your account?
              </p>
              <p className="text-sm text-amber-700 mb-4">
                This will permanently anonymize your email, name, and phone number. You will no
                longer be able to log in to this account.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Yes, delete my account
                </button>
                <button
                  onClick={() => setDeletionStatus('idle')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Delete Button */}
          {(deletionStatus === 'idle' || deletionStatus === 'error') && (
            <button
              onClick={() => setDeletionStatus('confirming')}
              className="px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Request Account Deletion
            </button>
          )}

          {/* Processing State */}
          {deletionStatus === 'processing' && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-foreground/70">Processing deletion request...</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
