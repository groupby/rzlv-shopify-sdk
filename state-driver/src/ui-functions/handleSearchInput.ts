import type { SearchParams } from '../types';
import { updateInputStore } from '../searchInputStore';

/**
 * Updates the search parameters to reflect a new search query.
 *
 * When a user performs a new search via a search input (e.g., a Shopify search bar),
 * this function updates the Input Store by setting the new query value (`gbi_query`)
 * and resetting the page number to 1 (which effectively resets any pagination offset).
 *
 * This function is framework agnostic and works with our Effector-based store.
 *
 * @param newQuery - The new search query string entered by the user.
 */
export function handleSearchInput(newQuery: string): void {
  updateInputStore((current: SearchParams): SearchParams => ({
    ...current,
    gbi_query: newQuery,
    page: 1, // Reset the page number to ensure the new search starts from page 1.
    hasSubmitted: true, // Mark tht the user has actively submitted a search.
  }));
}
