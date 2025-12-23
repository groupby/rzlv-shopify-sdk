/**
 * URL Manager utility functions
 */

import { SearchSource } from '../types';
import type { SearchParams } from '../types';
import { COLLECTION_SOURCE_LOWERCASE } from '../constants/searchConstants';

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
