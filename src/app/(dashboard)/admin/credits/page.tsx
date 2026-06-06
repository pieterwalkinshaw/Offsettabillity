'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import { formatZAR } from '@shared/creditUtils';
import type {
  CreditInventory,
  CreditPackage,
  CreditPackageTier,
  PurchaseTransaction,
  PurchaseTransactionStatus,
} from '@shared/types';
import {
  Leaf,
  Package,
  ShoppingCart,
  Plus,
  XCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<PurchaseTransactionStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

const TIER_OPTIONS: CreditPackageTier[] = ['bronze', 'silver', 'gold', 'platinum'];

// ─── Create Package Form ─────────────────────────────────────────────────────

interface PackageFormData {
  name: string;
  tier: CreditPackageTier;
  tonnage: string;
  priceCents: string;
  sortOrder: string;
}

const INITIAL_FORM: PackageFormData = {
  name: '',
  tier: 'bronze',
  tonnage: '',
  priceCents: '',
  sortOrder: '0',
};

// ─── Main Content ────────────────────────────────────────────────────────────

function AdminCreditManagementContent() {
  const { userProfile } = useAuth();

  // Inventory state
  const [inventory, setInventory] = useState<CreditInventory[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // Packages state
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);

  // Transactions state
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<PackageFormData>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const q = query(collection(db, 'creditInventory'), orderBy('projectTitle', 'asc'));
      const snapshot = await getDocs(q);
      setInventory(snapshot.docs.map((d) => d.data() as CreditInventory));
    } catch {
      setInventoryError('Failed to load inventory.');
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const fetchPackages = useCallback(async () => {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const q = query(collection(db, 'creditPackages'), orderBy('sortOrder', 'asc'));
      const snapshot = await getDocs(q);
      setPackages(snapshot.docs.map((d) => d.data() as CreditPackage));
    } catch {
      setPackagesError('Failed to load packages.');
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const q = query(collection(db, 'purchaseTransactions'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setTransactions(snapshot.docs.map((d) => d.data() as PurchaseTransaction));
    } catch {
      setTransactionsError('Failed to load transactions.');
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userProfile) {
      fetchInventory();
      fetchPackages();
      fetchTransactions();
    }
  }, [userProfile, fetchInventory, fetchPackages, fetchTransactions]);

  // ─── Toast Helper ──────────────────────────────────────────────────────────

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Package Actions ───────────────────────────────────────────────────────

  async function handleCreatePackage(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const tonnage = parseFloat(formData.tonnage);
    const priceCents = parseInt(formData.priceCents, 10);
    const sortOrder = parseInt(formData.sortOrder, 10);

    if (!formData.name.trim()) {
      setFormError('Package name is required.');
      return;
    }
    if (isNaN(tonnage) || tonnage < 1) {
      setFormError('Tonnage must be at least 1.');
      return;
    }
    if (isNaN(priceCents) || priceCents < 100) {
      setFormError('Price must be at least 100 cents (R1.00).');
      return;
    }
    if (isNaN(sortOrder) || sortOrder < 0) {
      setFormError('Sort order must be a non-negative integer.');
      return;
    }

    setFormSubmitting(true);
    try {
      const createFn = httpsCallable(functions, 'credits_packageCreate');
      await createFn({
        name: formData.name.trim(),
        tier: formData.tier,
        tonnage,
        priceCents,
        isActive: true,
        sortOrder,
      });
      showToast('success', 'Package created successfully.');
      setShowCreateForm(false);
      setFormData(INITIAL_FORM);
      fetchPackages();
    } catch {
      setFormError('Failed to create package. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeactivatePackage(packageId: string) {
    setActionLoading(packageId);
    try {
      const deactivateFn = httpsCallable(functions, 'credits_packageDeactivate');
      await deactivateFn({ packageId });
      showToast('success', 'Package deactivated.');
      fetchPackages();
    } catch {
      showToast('error', 'Failed to deactivate package.');
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Transaction Actions ───────────────────────────────────────────────────

  async function handleConfirmTransaction(transactionId: string) {
    setActionLoading(transactionId);
    try {
      const confirmFn = httpsCallable(functions, 'credits_confirmPurchase');
      await confirmFn({ transactionId });
      showToast('success', 'Purchase confirmed.');
      fetchTransactions();
    } catch {
      showToast('error', 'Failed to confirm purchase.');
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" />
            Credit Inventory Management
          </h1>
          <p className="text-foreground/60 mt-1">
            Manage carbon credit inventory, packages, and purchase transactions.
          </p>
        </div>

        {/* ─── Section 1: Inventory Overview ──────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="inventory-heading">
          <h2 id="inventory-heading" className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-500" />
            Inventory Overview
          </h2>

          {inventoryLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
                  <div className="h-4 w-48 bg-gray-200 rounded" />
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-4 w-20 bg-gray-200 rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : inventoryError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
              <p className="text-sm text-red-700">{inventoryError}</p>
              <button onClick={fetchInventory} className="px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100">
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Retry
              </button>
            </div>
          ) : inventory.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
              <Leaf className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-foreground">No inventory records</p>
              <p className="text-sm text-foreground/60 mt-1">Credit inventory will appear when solar projects are verified.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Project</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Location</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Available</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Total</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((inv) => (
                      <tr key={inv.inventoryId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{inv.projectTitle}</td>
                        <td className="px-4 py-3 text-foreground/70">{inv.projectLocation}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {inv.availableTonnage.toFixed(2)} <span className="text-foreground/50">tons</span>
                        </td>
                        <td className="px-4 py-3 text-right text-foreground/70">
                          {inv.totalTonnage.toFixed(2)} <span className="text-foreground/50">tons</span>
                        </td>
                        <td className="px-4 py-3 text-right text-foreground/70">
                          {formatZAR(inv.unitPriceCents)}/ton
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ─── Section 2: Package Management ──────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="packages-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="packages-heading" className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Package Management
            </h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Package
            </button>
          </div>

          {/* Create package form */}
          {showCreateForm && (
            <div className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Create New Package</h3>
              <form onSubmit={handleCreatePackage} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="pkg-name" className="block text-xs font-medium text-foreground/70 mb-1">Name</label>
                  <input
                    id="pkg-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Bronze Package"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={formSubmitting}
                  />
                </div>
                <div>
                  <label htmlFor="pkg-tier" className="block text-xs font-medium text-foreground/70 mb-1">Tier</label>
                  <select
                    id="pkg-tier"
                    value={formData.tier}
                    onChange={(e) => setFormData({ ...formData, tier: e.target.value as CreditPackageTier })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={formSubmitting}
                  >
                    {TIER_OPTIONS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pkg-tonnage" className="block text-xs font-medium text-foreground/70 mb-1">Tonnage (tons)</label>
                  <input
                    id="pkg-tonnage"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.tonnage}
                    onChange={(e) => setFormData({ ...formData, tonnage: e.target.value })}
                    placeholder="e.g. 25"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={formSubmitting}
                  />
                </div>
                <div>
                  <label htmlFor="pkg-price" className="block text-xs font-medium text-foreground/70 mb-1">Price (cents)</label>
                  <input
                    id="pkg-price"
                    type="number"
                    min="100"
                    step="1"
                    value={formData.priceCents}
                    onChange={(e) => setFormData({ ...formData, priceCents: e.target.value })}
                    placeholder="e.g. 30000000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={formSubmitting}
                  />
                </div>
                <div>
                  <label htmlFor="pkg-sort" className="block text-xs font-medium text-foreground/70 mb-1">Sort Order</label>
                  <input
                    id="pkg-sort"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={formSubmitting}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); setFormError(null); setFormData(INITIAL_FORM); }}
                    className="px-4 py-2 text-sm font-medium text-foreground/70 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
              {formError && (
                <p className="mt-3 text-sm text-red-600" role="alert">{formError}</p>
              )}
            </div>
          )}

          {/* Packages listing */}
          {packagesLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-4 w-16 bg-gray-200 rounded" />
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-6 w-16 bg-gray-200 rounded-full ml-auto" />
                </div>
              ))}
            </div>
          ) : packagesError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
              <p className="text-sm text-red-700">{packagesError}</p>
              <button onClick={fetchPackages} className="px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100">
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Retry
              </button>
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-foreground">No packages yet</p>
              <p className="text-sm text-foreground/60 mt-1">Create your first credit package above.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Tier</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Tonnage</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Price</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Discount</th>
                      <th className="text-center px-4 py-3 font-medium text-foreground/70">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr key={pkg.packageId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{pkg.name}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                            {pkg.tier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-foreground">{pkg.tonnage} tons</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatZAR(pkg.priceCents)}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{pkg.discountPercentage}%</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${pkg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {pkg.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pkg.isActive && (
                            <button
                              onClick={() => handleDeactivatePackage(pkg.packageId)}
                              disabled={actionLoading === pkg.packageId}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === pkg.packageId ? (
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                              ) : (
                                <XCircle className="w-3 h-3 inline mr-1" />
                              )}
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ─── Section 3: Transaction List ────────────────────────────────────── */}
        <section aria-labelledby="transactions-heading">
          <h2 id="transactions-heading" className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-purple-500" />
            Purchase Transactions
          </h2>

          {transactionsLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-6 w-16 bg-gray-200 rounded-full" />
                  <div className="h-8 w-20 bg-gray-200 rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : transactionsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
              <p className="text-sm text-red-700">{transactionsError}</p>
              <button onClick={fetchTransactions} className="px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100">
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Retry
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-center py-12">
              <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-foreground">No transactions yet</p>
              <p className="text-sm text-foreground/60 mt-1">Purchase transactions will appear here when funders buy carbon credits.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Funder</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Quantity</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Projects</th>
                      <th className="text-center px-4 py-3 font-medium text-foreground/70">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => (
                      <tr key={txn.transactionId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-foreground/70 whitespace-nowrap">
                          {new Date(txn.createdAt).toLocaleDateString('en-ZA')}
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          {txn.funderId.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-right text-foreground">
                          {txn.quantity.toFixed(2)} tons
                        </td>
                        <td className="px-4 py-3 text-right text-foreground font-medium">
                          {formatZAR(txn.totalAmountCents)}
                        </td>
                        <td className="px-4 py-3 text-foreground/70 max-w-[200px] truncate">
                          {txn.projectAllocations.map((a) => a.projectTitle).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[txn.status]}`}>
                            {txn.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {txn.status === 'pending' && (
                            <button
                              onClick={() => handleConfirmTransaction(txn.transactionId)}
                              disabled={actionLoading === txn.transactionId}
                              className="px-3 py-1.5 text-xs font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === txn.transactionId ? (
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                              )}
                              Confirm
                            </button>
                          )}
                          {txn.status === 'confirmed' && (
                            <span className="text-xs text-foreground/50">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function AdminCreditsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminCreditManagementContent />
    </ProtectedRoute>
  );
}
