/**
 * URL Manager utility functions
 */

import { SearchSource } from '../types';
import type { SearchParams } from '../types';
import { COLLECTION_SOURCE_LOWERCASE, SEARCH_PATH, DEFAULT_SORT_BY, DEFAULT_TYPE } from '../constants/searchConstants';

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
 * - The user is on an active collection page (collectionId exists AND source is COLLECTION)
 *
 * @param params - Partial search parameters to evaluate (must include source)
 * @param collectionId - Optional collection ID from the cached state (can be string or number)
 * @returns true if the SearchManager should trigger a search, false otherwise
 */
export function calculateHasSubmitted(
  params: Pick<SearchParams, 'gbi_query' | 'refinements' | 'page' | 'source'>,
  collectionId?: number | string
): boolean {
  const hasSearchActivity =
    params.gbi_query.trim() !== '' ||
    params.refinements.length > 0 ||
    params.page > 1;

  // Only trigger search for collection if both collectionId exists AND source is COLLECTION
  // This prevents stale collectionId from triggering searches when navigating to regular search
  const isActiveCollection =
    collectionId !== undefined && isCollectionSource(params.source);

  return hasSearchActivity || isActiveCollection;
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

/**
 * Serializes search parameters into URL query parameters.
 * 
 * Maps SearchParams object to URLSearchParams for use in the browser URL.
 * Note: This does NOT include collectionId or paginationType as those are not
 * stored in the URL (they're internal state).
 *
 * @param params - The search parameters to serialize
 * @returns URLSearchParams object ready to be appended to a URL
 */
export function serializeSearchParamsToUrl(
  params: Pick<SearchParams, 'type' | 'refinements' | 'sort_by' | 'page' | 'gbi_query' | 'pagesize'>
): URLSearchParams {
  const urlParams = new URLSearchParams();
  
  urlParams.set('type', params.type);
  urlParams.set('refinement', params.refinements.join(','));
  urlParams.set('sort_by', params.sort_by);
  urlParams.set('page', params.page.toString());
  urlParams.set('gbi-query', params.gbi_query);
  urlParams.set('pagesize', params.pagesize);
  
  return urlParams;
}

/**
 * Parses the current URL parameters and returns a SearchParams object (without paginationType).
 *
 * This function reads URL parameters such as 'gbi-query', 'pagesize', 'page', 'sort_by',
 * 'refinement', and 'type', and maps them to the SearchParams structure.
 * 
 * Note: paginationType is not stored in the URL and must be provided separately.
 *
 * @param config - An object containing defaultPagesize and source.
 * @returns The parsed search parameters (excluding paginationType which must be added by caller).
 */
export function parseUrlToSearchParams(config: {
  defaultPagesize: string;
  source: SearchSource;
}): Omit<SearchParams, 'paginationType'> {
  const urlParams = new URLSearchParams(window.location.search);

  const gbi_query = urlParams.get('gbi-query') || '';
  const pagesize = urlParams.get('pagesize') || config.defaultPagesize;
  const page = urlParams.has('page') ? parseInt(urlParams.get('page')!, 10) : 1;
  const sort_by = urlParams.get('sort_by') || DEFAULT_SORT_BY;
  const type = urlParams.get('type') || DEFAULT_TYPE;
  const refinementParam = urlParams.get('refinement');
  const refinements = refinementParam ? refinementParam.split(',') : [];

  return {
    gbi_query,
    pagesize,
    refinements,
    page,
    sort_by,
    type,
    source: config.source,
  };
}

/**
 * Creates a popstate event handler for browser back/forward navigation.
 * 
 * This is critical for syncing the UI when users click back/forward buttons.
 * Without this handler, the URL updates but the search state remains stale.
 * 
 * Key behaviors:
 * - Re-parses URL parameters and updates the input store
 * - Preserves collectionId only when source is COLLECTION (clears on source change)
 * - Preserves paginationType (not stored in URL)
 * - Sets hasSubmitted to ensure SearchManager filter passes
 * - Prevents infinite loops via isHandlingPopstate flag
 * - Handles errors gracefully and dispatches error events for monitoring
 * 
 * Browser Compatibility:
 * - History API: Chrome 5+, Firefox 4+, Safari 5+, Edge (all versions)
 * - popstate event: Universally supported in all modern browsers
 * - setTimeout(0): Reliable across all JavaScript engines
 *
 * @param config - Configuration object for the popstate handler
 * @returns The popstate event handler function
 */
export function createPopstateHandler(config: {
  defaultPagesize: string;
  source: SearchSource;
  cachedSearchParams: SearchParams;
  isHandlingPopstate: { value: boolean };
  updateInputStore: (updater: (current: SearchParams) => SearchParams) => void;
  debugLog: (context: string, ...args: any[]) => void;
}): () => void {
  const { defaultPagesize, source, cachedSearchParams, isHandlingPopstate, updateInputStore, debugLog } = config;
  
  return () => {
    debugLog('URL Manager', 'popstate event detected - browser back/forward navigation');
    
    // Set flag to prevent the store.watch() from pushing state back to URL
    isHandlingPopstate.value = true;
    
    try {
      // Re-parse URL parameters to get the new state
      const newParams = parseUrlToSearchParams({ defaultPagesize, source });
      
      debugLog('URL Manager', 'Parsed URL params from popstate:', newParams);
      debugLog('URL Manager', 'Current cached params:', cachedSearchParams);
      
      // Update the input store with new URL parameters
      // Preserve values that aren't in the URL (collectionId, paginationType)
      updateInputStore((current: SearchParams): SearchParams => {
        const updatedParams = {
          ...current,
          ...newParams,
          // Preserve collectionId only if source is still COLLECTION
          // Clear it when navigating from collection to search to prevent stale state
          collectionId: isCollectionSource(newParams.source)
            ? cachedSearchParams.collectionId
            : undefined,
          // Preserve paginationType - it's a UI configuration, not a URL parameter
          paginationType: cachedSearchParams.paginationType,
          // Calculate hasSubmitted to ensure SearchManager filter passes
          // We need this because the user navigated to a valid search state
          hasSubmitted: calculateHasSubmitted(newParams, cachedSearchParams.collectionId),
        };
        
        debugLog('URL Manager', 'Updating store with popstate params:', updatedParams);
        return updatedParams;
      });
      
    } catch (error) {
      debugLog('URL Manager', 'Error handling popstate:', error);
      // Dispatch error event for monitoring/telemetry
      document.dispatchEvent(new CustomEvent('urlManagerError', {
        detail: { error, url: window.location.href, context: 'popstate' }
      }));
    } finally {
      // Clear the flag after a microtask to ensure store.watch() has completed
      // Using setTimeout with 0 ensures this runs after the current call stack
      setTimeout(() => {
        isHandlingPopstate.value = false;
        debugLog('URL Manager', 'popstate handling complete');
      }, 0);
    }
  };
}
