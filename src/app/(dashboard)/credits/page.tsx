'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import { calculatePurchasePrice, formatZAR } from '@shared/creditUtils';
import type {
  CreditInventory,
  CreditPackage,
  PurchaseTransaction,
} from '@shared/types';
import {
  Leaf,
  Loader2,
  AlertCircle,
  Package,
  SlidersHorizontal,
  CheckCircle2,
  ShoppingCart,
  Award,
  RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewState = 'packages' | 'custom' | 'confirm';

// ─── Tier styling ────────────────────────────────────────────────────────────

function tierStyle(tier: string): { bg: string; border: string; badge: string } {
  switch (tier) {
    case 'bronze':
      return { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' };
    case 'silver':
      return { bg: 'bg-gray-50', border: 'border-gray-300', badge: 'bg-gray-200 text-gray-700' };
    case 'gold':
      return { bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-700' };
    default:
      return { bg: 'bg-white', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600' };
  }
}

// ─── Main Content ────────────────────────────────────────────────────────────

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();

  // State
  const [inventory, setInventory] = useState<CreditInventory[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom purchase form
  const [customQuantity, setCustomQuantity] = useState('');
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Confirmation state
  const [confirmTransaction, setConfirmTransaction] = useState<PurchaseTransaction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Query param view state
  const viewParam = searchParams.get('view') || 'packages';
  const txnParam = searchParams.get('txn');
  const currentView: ViewState = viewParam === 'confirm' ? 'confirm' : viewParam === 'custom' ? 'custom' : 'packages';

  // Derived values
  const totalAvailable = useMemo(
    () => inventory.reduce((sum, inv) => sum + inv.availableTonnage, 0),
    [inventory]
  );

  const unitPriceCents = useMemo(
    () => (inventory.length > 0 ? inventory[0].unitPriceCents : 15000),
    [inventory]
  );

  // ─── Data Fetching ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch credit inventory
      const inventoryQuery = query(
        collection(db, 'creditInventory'),
        where('availableTonnage', '>', 0)
      );
      const inventorySnap = await getDocs(inventoryQuery);
      const inventoryData = inventorySnap.docs.map((d) => d.data() as CreditInventory);
      setInventory(inventoryData);

      // Fetch active credit packages
      const packagesQuery = query(
        collection(db, 'creditPackages'),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const packagesSnap = await getDocs(packagesQuery);
      const packagesData = packagesSnap.docs.map((d) => d.data() as CreditPackage);
      setPackages(packagesData);
    } catch {
      setError('Failed to load marketplace data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch confirmation transaction
  const fetchTransaction = useCallback(async (txnId: string) => {
    setConfirmLoading(true);
    try {
      const txnRef = doc(db, 'purchaseTransactions', txnId);
      const txnSnap = await getDoc(txnRef);
      if (txnSnap.exists()) {
        setConfirmTransaction(txnSnap.data() as PurchaseTransaction);
      } else {
        setError('Transaction not found.');
      }
    } catch {
      setError('Failed to load transaction details.');
    } finally {
      setConfirmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && userProfile) {
      if (currentView === 'confirm' && txnParam) {
        fetchTransaction(txnParam);
      }
      fetchData();
    }
  }, [user, userProfile, fetchData, currentView, txnParam, fetchTransaction]);

  // ─── Navigation Helpers ────────────────────────────────────────────────────

  const navigateTo = useCallback(
    (view: ViewState, params?: Record<string, string>) => {
      const searchParts = [`view=${view}`];
      if (params) {
        Object.entries(params).forEach(([k, v]) => searchParts.push(`${k}=${v}`));
      }
      router.push(`/credits?${searchParts.join('&')}`);
    },
    [router]
  );

  // ─── Custom Quantity Handlers ──────────────────────────────────────────────

  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9.]/g, '');
      setCustomQuantity(value);
      setQuantityError(null);
      setSubmitError(null);
    },
    []
  );

  const validateQuantity = useCallback(
    (value: string): number | null => {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || parsed <= 0) {
        setQuantityError('Please enter a valid quantity.');
        return null;
      }
      if (parsed < 1) {
        setQuantityError('Minimum purchase is 1 ton.');
        return null;
      }
      if (parsed > totalAvailable) {
        setQuantityError(`Maximum available is ${totalAvailable.toFixed(2)} tons.`);
        return null;
      }
      // Check max 2 decimal places
      const decimalParts = value.split('.');
      if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        setQuantityError('Maximum 2 decimal places allowed.');
        return null;
      }
      return parsed;
    },
    [totalAvailable]
  );

  const customPrice = useMemo(() => {
    const parsed = parseFloat(customQuantity);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return calculatePurchasePrice(parsed, unitPriceCents);
  }, [customQuantity, unitPriceCents]);

  // ─── Purchase Handlers ─────────────────────────────────────────────────────

  const handlePackagePurchase = useCallback(
    async (pkg: CreditPackage) => {
      if (!selectedProject) {
        setSubmitError('Please select a project allocation.');
        return;
      }

      setSubmitting(true);
      setSubmitError(null);

      try {
        const purchaseFn = httpsCallable<
          { quantity: number; projectAllocations: { projectId: string; tonnage: number }[]; packageId?: string },
          { transactionId: string }
        >(functions, 'credits_purchase');

        const result = await purchaseFn({
          quantity: pkg.tonnage,
          projectAllocations: [{ projectId: selectedProject, tonnage: pkg.tonnage }],
          packageId: pkg.packageId,
        });

        navigateTo('confirm', { txn: result.data.transactionId });
      } catch (err: unknown) {
        const error = err as { message?: string; details?: { error?: { message?: string } } };
        setSubmitError(
          error.details?.error?.message ?? error.message ?? 'Purchase failed. Please try again.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [selectedProject, navigateTo]
  );

  const handleCustomPurchase = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const quantity = validateQuantity(customQuantity);
      if (quantity === null) return;

      if (!selectedProject) {
        setSubmitError('Please select a project allocation.');
        return;
      }

      setSubmitting(true);

      try {
        const purchaseFn = httpsCallable<
          { quantity: number; projectAllocations: { projectId: string; tonnage: number }[] },
          { transactionId: string }
        >(functions, 'credits_purchase');

        const result = await purchaseFn({
          quantity,
          projectAllocations: [{ projectId: selectedProject, tonnage: quantity }],
        });

        navigateTo('confirm', { txn: result.data.transactionId });
      } catch (err: unknown) {
        const error = err as { message?: string; details?: { error?: { message?: string } } };
        setSubmitError(
          error.details?.error?.message ?? error.message ?? 'Purchase failed. Please try again.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [customQuantity, selectedProject, validateQuantity, navigateTo]
  );

  // ─── Loading State ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero skeleton */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8 animate-pulse">
            <div className="h-6 w-48 bg-gray-200 rounded mb-3" />
            <div className="h-10 w-32 bg-gray-100 rounded mb-2" />
            <div className="h-4 w-64 bg-gray-100 rounded" />
          </div>
          {/* Cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse">
                <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
                <div className="h-8 w-20 bg-gray-100 rounded mb-3" />
                <div className="h-4 w-32 bg-gray-100 rounded mb-2" />
                <div className="h-4 w-28 bg-gray-100 rounded mb-4" />
                <div className="h-10 w-full bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────

  if (error && !confirmTransaction && inventory.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Empty State ─────────────────────────────────────────────────────────────

  if (!loading && inventory.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-16 px-6">
            <Leaf className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground">No carbon credits available</p>
            <p className="text-sm text-foreground/60 mt-2 max-w-md mx-auto">
              Carbon credit inventory is currently depleted. Check back soon as new verified solar projects add credits.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Confirmation View ───────────────────────────────────────────────────────

  if (currentView === 'confirm') {
    if (confirmLoading) {
      return (
        <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
          <div className="max-w-2xl mx-auto flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <span className="ml-3 text-foreground/60">Loading confirmation...</span>
          </div>
        </div>
      );
    }

    if (!confirmTransaction) {
      return (
        <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
          <div className="max-w-2xl mx-auto text-center py-16">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-semibold">Transaction not found</p>
            <button
              onClick={() => navigateTo('packages')}
              className="mt-4 px-4 py-2 text-sm font-medium text-primary-600 hover:underline"
            >
              Return to Marketplace
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-2xl mx-auto">
          {/* Success header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Purchase Submitted</h1>
            <p className="text-foreground/60 mt-2">
              Your carbon credit purchase is being processed.
            </p>
          </div>

          {/* Purchase summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
            <h2 className="text-sm font-medium text-foreground/60 uppercase tracking-wide mb-4">Purchase Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-foreground/70">Quantity</span>
                <span className="text-sm font-medium text-foreground">{confirmTransaction.quantity.toFixed(2)} tons CO₂e</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-foreground/70">Unit Price</span>
                <span className="text-sm font-medium text-foreground">{formatZAR(confirmTransaction.unitPriceCents)}/ton</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-lg font-bold text-primary-700">{formatZAR(confirmTransaction.totalAmountCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-foreground/70">Status</span>
                <span className={`text-sm font-medium capitalize ${confirmTransaction.status === 'confirmed' ? 'text-green-600' : 'text-amber-600'}`}>
                  {confirmTransaction.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-foreground/70">Date</span>
                <span className="text-sm text-foreground">{new Date(confirmTransaction.createdAt).toLocaleDateString('en-ZA')}</span>
              </div>
            </div>
          </div>

          {/* Project allocations */}
          {confirmTransaction.projectAllocations.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
              <h2 className="text-sm font-medium text-foreground/60 uppercase tracking-wide mb-4">Project Allocation</h2>
              <div className="space-y-2">
                {confirmTransaction.projectAllocations.map((alloc) => (
                  <div key={alloc.projectId} className="flex justify-between items-center">
                    <span className="text-sm text-foreground">{alloc.projectTitle}</span>
                    <span className="text-sm font-medium text-foreground">{alloc.tonnage.toFixed(2)} tons</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certificate note */}
          {confirmTransaction.status === 'confirmed' && confirmTransaction.certificateId && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-6 flex items-center gap-3">
              <Award className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700">
                Your certificate is ready. View it in the{' '}
                <a href="/credits/sustainability" className="font-medium underline hover:no-underline">
                  Sustainability Dashboard
                </a>.
              </p>
            </div>
          )}

          {confirmTransaction.status === 'pending' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-600 flex-shrink-0 animate-spin" />
              <p className="text-sm text-amber-700">
                Your purchase is pending confirmation. A certificate will be generated once confirmed.
              </p>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/overview"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-foreground"
            >
              Return to Dashboard
            </a>
            <a
              href="/credits/sustainability"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Leaf className="w-4 h-4" />
              View Sustainability Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loaded State (Packages & Custom views) ────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Leaf className="w-6 h-6 text-green-600" />
                Carbon Credit Marketplace
              </h1>
              <p className="text-foreground/60 mt-1">
                Offset your carbon footprint with verified solar project credits.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-foreground/60">Total Available Credits</p>
              <p className="text-3xl font-bold text-green-700">{totalAvailable.toFixed(2)}</p>
              <p className="text-xs text-foreground/50">metric tons CO₂e</p>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => navigateTo('packages')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentView === 'packages'
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-foreground hover:bg-gray-50'
            }`}
          >
            <Package className="w-4 h-4" />
            Packages
          </button>
          <button
            onClick={() => navigateTo('custom')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentView === 'custom'
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-foreground hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Custom Quantity
          </button>
        </div>

        {/* Project Allocation Selector */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
          <label htmlFor="project-allocation" className="block text-sm font-medium text-foreground mb-2">
            Select Project Source
          </label>
          <select
            id="project-allocation"
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              setSubmitError(null);
            }}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Choose a project...</option>
            {inventory.map((inv) => (
              <option key={inv.inventoryId} value={inv.projectId}>
                {inv.projectTitle} — {inv.availableTonnage.toFixed(2)} tons available ({inv.projectLocation})
              </option>
            ))}
          </select>
          {submitError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {submitError}
            </p>
          )}
        </div>

        {/* Packages View */}
        {currentView === 'packages' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const style = tierStyle(pkg.tier);
              const isDisabled = pkg.tonnage > totalAvailable;

              return (
                <div
                  key={pkg.packageId}
                  className={`rounded-xl border ${style.border} ${style.bg} p-6 flex flex-col transition-shadow ${
                    isDisabled ? 'opacity-60' : 'hover:shadow-md'
                  }`}
                >
                  {/* Tier badge */}
                  <span className={`inline-flex self-start items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.badge} mb-4`}>
                    {pkg.tier.charAt(0).toUpperCase() + pkg.tier.slice(1)}
                  </span>

                  {/* Package name */}
                  <h3 className="text-lg font-semibold text-foreground mb-2">{pkg.name}</h3>

                  {/* Tonnage */}
                  <p className="text-3xl font-bold text-foreground mb-1">
                    {pkg.tonnage} <span className="text-sm font-normal text-foreground/60">tons CO₂e</span>
                  </p>

                  {/* Discount */}
                  <p className="text-sm text-green-600 font-medium mb-3">
                    {pkg.discountPercentage}% discount
                  </p>

                  {/* Price */}
                  <p className="text-lg font-bold text-primary-700 mb-4">
                    {formatZAR(pkg.priceCents)}
                  </p>

                  {/* Insufficient stock indicator */}
                  {isDisabled && (
                    <p className="text-xs text-red-600 font-medium mb-3">
                      Insufficient stock
                    </p>
                  )}

                  {/* Purchase button */}
                  <button
                    onClick={() => handlePackagePurchase(pkg)}
                    disabled={isDisabled || submitting || !selectedProject}
                    className="mt-auto flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-4 h-4" />
                    )}
                    {isDisabled ? 'Unavailable' : 'Purchase'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Custom Quantity View */}
        {currentView === 'custom' && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-lg">
            <h2 className="text-lg font-semibold text-foreground mb-4">Custom Quantity</h2>
            <p className="text-sm text-foreground/60 mb-6">
              Enter the exact number of metric tons you wish to offset.
            </p>

            <form onSubmit={handleCustomPurchase} noValidate>
              {/* Quantity input */}
              <div className="mb-4">
                <label htmlFor="custom-quantity" className="block text-sm font-medium text-foreground mb-1.5">
                  Quantity (metric tons CO₂e)
                </label>
                <input
                  id="custom-quantity"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 10.50"
                  value={customQuantity}
                  onChange={handleQuantityChange}
                  disabled={submitting}
                  className={`w-full px-4 py-3 border rounded-lg text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                    quantityError ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-200'
                  }`}
                  aria-describedby={quantityError ? 'quantity-error' : 'quantity-hint'}
                  aria-invalid={!!quantityError}
                />
                {quantityError && (
                  <p id="quantity-error" className="mt-1.5 text-sm text-red-600" role="alert">
                    {quantityError}
                  </p>
                )}
                {!quantityError && (
                  <p id="quantity-hint" className="mt-1.5 text-xs text-foreground/50">
                    Min 1 ton — Max {totalAvailable.toFixed(2)} tons — Up to 2 decimal places
                  </p>
                )}
              </div>

              {/* Real-time price */}
              <div className="rounded-lg bg-gray-50 p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground/70">Estimated Price</span>
                  <span className="text-xl font-bold text-primary-700">
                    {customPrice > 0 ? formatZAR(customPrice) : '—'}
                  </span>
                </div>
                <p className="text-xs text-foreground/50 mt-1">
                  Unit price: {formatZAR(unitPriceCents)}/ton
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !customQuantity || !selectedProject}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    Purchase Credits
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function CreditsPage() {
  return (
    <ProtectedRoute allowedRoles={['funder']}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        }
      >
        <MarketplaceContent />
      </Suspense>
    </ProtectedRoute>
  );
}
