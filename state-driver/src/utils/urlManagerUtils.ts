/**
 * URL Manager utility functions
 */

import { SearchSource } from '../types';
import type { SearchParams } from '../types';
import { COLLECTION_SOURCE_LOWERCASE, SEARCH_PATH } from '../constants/searchConstants';

/**
 * Checks if the given source represents a collection search.
 * Handles both the SearchSource enum value and the backwards-compatible string 'collection'.
 *
 * @param source - The search source to check (can be SearchSource enum or string)
 * @returns true if the source is a collection, false otherwise
 */
export function isCollectionSource(source: SearchSource | string): boolean {
  return source === SearchSource.COLLECTION || (source as string) === COLLECTION_SOURCE_LOWERCASE;
}

/**
 * Determines whether hasSubmitted should be set to true based on search parameters.
 * This is used to trigger the SearchManager's search effect when the store is updated.
 * 
 * hasSubmitted should be true when:
 * - There's an actual search query
 * - There are refinements applied
 * - The user is on a page beyond page 1
 * - The user is on a collection page (which always needs to search)
 *
 * @param params - Partial search parameters to evaluate
 * @param collectionId - Optional collection ID from the cached state (can be string or number)
 * @returns true if the SearchManager should trigger a search, false otherwise
 */
export function calculateHasSubmitted(
  params: Pick<SearchParams, 'gbi_query' | 'refinements' | 'page'>,
  collectionId?: number | string
): boolean {
  return (
    params.gbi_query.trim() !== '' ||
    params.refinements.length > 0 ||
    params.page > 1 ||
    // Collection pages should always trigger search on navigation
    collectionId !== undefined
  );
}

/**
 * Determines whether the browser URL should be updated based on search parameters.
 * 
 * URL should be updated when:
 * - We're on a collection page (always keep URL in sync with state)
 * - There's search activity (query, refinements, or pagination)
 * - On non-collection pages when hasSubmitted is true (explicit search action)
 * 
 * This prevents unnecessary URL updates for default/empty states while ensuring
 * all meaningful search states are reflected in the URL for bookmarking and sharing.
 *
 * @param params - Search parameters to evaluate
 * @param isHandlingPopstate - Whether we're currently handling a popstate event (prevents infinite loops)
 * @returns true if the browser URL should be updated, false otherwise
 */
export function shouldUpdateBrowserUrl(
  params: Pick<SearchParams, 'gbi_query' | 'refinements' | 'page' | 'source' | 'hasSubmitted'>,
  isHandlingPopstate: boolean
): boolean {
  // Skip URL update if we're currently handling a popstate event
  // This prevents infinite loop: popstate → store update → pushState → popstate
  if (isHandlingPopstate) {
    return false;
  }

  // Check if there's any search activity
  const hasSearchActivity = 
    params.gbi_query.trim() !== '' ||
    params.refinements.length > 0 ||
    params.page > 1;
    
  const isCollectionPage = isCollectionSource(params.source);
  const shouldUpdateUrlForNonCollection = !isCollectionPage && params.hasSubmitted === true;
  
  // For collection pages, always update URL to keep it in sync with state
  // For non-collection pages, update URL based on hasSubmitted or search activity
  return isCollectionPage || hasSearchActivity || shouldUpdateUrlForNonCollection;
}

/**
 * Determines the URL path based on the search source.
 * 
 * - For collection pages: Preserves the current collection URL path (e.g., /collections/shirts)
 * - For search pages: Uses the standard search path (e.g., /search)
 * 
 * This ensures that collection searches maintain their collection context in the URL,
 * while regular searches use the search page path.
 *
 * @param source - The search source (SEARCH, COLLECTION, etc.)
 * @returns The URL path to use for the search
 */
export function getUrlPathForSource(source: SearchSource | string): string {
  if (isCollectionSource(source)) {
    return window.location.pathname;
  }
  return SEARCH_PATH;
}
