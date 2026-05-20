/**
 * Determines whether a statically generated category landing page exists
 * for a given category ID based on the set of active categories.
 *
 * In the Next.js static generation model:
 * - `generateStaticParams` produces pages for all active categories
 * - `dynamicParams = false` ensures any non-matching ID returns 404
 *
 * This helper encapsulates that logic for testability.
 */

import type { TaxonomyCategory } from '../../../shared/types';

/**
 * Returns true if a category landing page exists at `/categories/{categoryId}`.
 * A page exists if and only if the categoryId matches an active category.
 *
 * @param categoryId - The category ID from the URL path
 * @param categories - The full list of taxonomy categories (active and inactive)
 * @returns true if a page exists (200 response), false if 404
 */
export function categoryPageExists(
  categoryId: string,
  categories: TaxonomyCategory[]
): boolean {
  const category = categories.find((c) => c.id === categoryId);
  return category !== undefined && category.isActive === true;
}

/**
 * Returns the set of category IDs that have statically generated pages.
 * This mirrors the behavior of `generateStaticParams` in the category page.
 *
 * @param categories - The full list of taxonomy categories
 * @returns Array of category IDs with generated pages
 */
export function getGeneratedCategoryPages(
  categories: TaxonomyCategory[]
): string[] {
  return categories.filter((c) => c.isActive).map((c) => c.id);
}
