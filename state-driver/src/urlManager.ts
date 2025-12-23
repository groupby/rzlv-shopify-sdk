import { updateInputStore, searchInputStore } from './searchInputStore';
import { SearchSource, PaginationType } from './types';
import type { SearchParams } from './types';
import { sdkConfig, debugLog } from './debugLogger';
import { isCollectionSource, calculateHasSubmitted, shouldUpdateBrowserUrl } from './utils/urlManagerUtils';
import { DEFAULT_SORT_BY, SEARCH_PATH, DEFAULT_TYPE } from './constants/searchConstants';

interface InitUrlManagerParams {
  /**
   * The default page size to use if not provided in the URL.
   */
  defaultPagesize: string;
  /**
   * The search source, which helps determine the URL path (e.g., SEARCH_BAR, SEARCH, or COLLECTION).
   */
  source: SearchSource;
  /**
   * The collection ID, if the source is a collection page. Supplied by the Shopify global `collection`
   * object in a Liquid environment.
   */
  collectionId?: string;
  /**
   * The pagination type to use.
   */
  paginationType: PaginationType;
  /**
   * Optional debug flag to enable or disable debug logging.
   */
  debug?: boolean;
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
function parseUrlToSearchParams({ defaultPagesize, source }: Pick<InitUrlManagerParams, 'defaultPagesize' | 'source'>): Omit<SearchParams, 'paginationType'> {
  const urlParams = new URLSearchParams(window.location.search);

  const gbi_query = urlParams.get('gbi-query') || '';
  const pagesize = urlParams.get('pagesize') || defaultPagesize;
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
    source, // Use the provided source.
  };
}

/**
 * Initializes the URL Manager.
 *
 * On initialization, this function:
 * - Parses the current URL parameters and updates the Input Store.
 * - Subscribes to changes in the Input Store and updates the browser URL accordingly,
 *   but only if an actual search is performed.
 *
 * This establishes a two-way binding: direct URL navigation updates the store, and
 * subsequent changes to the store update the URL. However, if no search action is taken
 * (i.e. all values remain at their defaults), the URL will not be updated.
 *
 * The `initialized` flag prevents duplicate initialization.
 *
 * @param config - The initialization configuration including defaultPagesize and source.
 */
export function initUrlManager({ 
  defaultPagesize, 
  source,
  collectionId,
  paginationType,
  debug = false,
}: InitUrlManagerParams): void {
  // Prevent duplicate initialization.
  if (initUrlManager.initialized) return;
  // Set our global debug flag
  sdkConfig.debug = debug;
  debugLog('URL Manager', 'Initializing URL Manager');

  // Cache to track current state for popstate handler
  // We need this because Effector stores don't expose a public getState() method
  let cachedSearchParams: SearchParams = {
    gbi_query: '',
    pagesize: defaultPagesize,
    refinements: [],
    page: 1,
    sort_by: DEFAULT_SORT_BY,
    type: DEFAULT_TYPE,
    source,
    collectionId,
    paginationType,
  };

  // Flag to prevent infinite loop: popstate → store update → pushState → popstate
  let isHandlingPopstate = false;

  // Parse URL parameters and update the Input Store.
  const initialParams = parseUrlToSearchParams({ defaultPagesize, source });
  const completeInitialParams: SearchParams = {
    ...initialParams,
    paginationType,
    collectionId,
  };

  // Check if there are actual URL parameters that need to be applied
  const hasUrlSearchParams = 
    initialParams.gbi_query.trim() !== '' ||
    initialParams.refinements.length > 0 ||
    initialParams.page > 1 ||
    initialParams.sort_by !== DEFAULT_SORT_BY ||
    initialParams.pagesize !== defaultPagesize;

  // Only update Input Store if there are URL parameters to parse
  // This prevents unnecessary state updates on clean collection URLs
  if (hasUrlSearchParams) {
    // Merge initialParams into the current Input Store state.
    // Set hasSubmitted to true only if the URL indicates an actual search action.
    updateInputStore((current: SearchParams): SearchParams => ({
      ...current,
      ...completeInitialParams,
      hasSubmitted: calculateHasSubmitted(initialParams, collectionId),
    }));
    debugLog('URL Manager', 'Input store updated with URL parameters', completeInitialParams);
  } else {
    debugLog('URL Manager', 'No URL parameters to parse, skipping state update');
  }

  // Subscribe to changes in the Input Store and update the URL accordingly.
  searchInputStore.watch((params) => {
    // Update cached state for popstate handler
    cachedSearchParams = params;
    debugLog('URL Manager', 'URL watcher triggered with params:', params);
    
    // Determine if we should update the browser URL
    const shouldUpdate = shouldUpdateBrowserUrl(params, isHandlingPopstate);
    
    debugLog('URL Manager', 'URL update decision:', {
      shouldUpdate,
      isHandlingPopstate,
      source: params.source,
      hasSubmitted: params.hasSubmitted
    });

    if (shouldUpdate) {
      const urlParams = new URLSearchParams();

      // Map our search state to URL parameters.
      urlParams.set('type', params.type);
      urlParams.set('refinement', params.refinements.join(','));
      urlParams.set('sort_by', params.sort_by);
      urlParams.set('page', params.page.toString());
      urlParams.set('gbi-query', params.gbi_query);
      urlParams.set('pagesize', params.pagesize);

      // Determine the new path based on the source.
      let newPath = SEARCH_PATH;
      if (isCollectionSource(params.source)) {
        newPath = window.location.pathname;
      }

      // Update the URL without reloading the page.
      window.history.pushState({}, '', `${newPath}?${urlParams.toString()}`);
      debugLog('URL Manager', 'Browser URL updated to', newPath, urlParams.toString());
      // Optionally dispatch a custom event signaling the URL update.
      document.dispatchEvent(new CustomEvent('searchParamsUpdated', { detail: params }));
    }
  });

  /**
   * Handle browser back/forward navigation (popstate events)
   * 
   * This is critical for syncing the UI when users click back/forward buttons.
   * Without this handler, the URL updates but the search state remains stale.
   * 
   * Key behaviors:
   * - Re-parses URL parameters and updates the input store
   * - Preserves collectionId and paginationType (not stored in URL)
   * - Sets hasSubmitted to ensure SearchManager filter passes
   * - Prevents infinite loops via isHandlingPopstate flag
   */
  window.addEventListener('popstate', () => {
    debugLog('URL Manager', 'popstate event detected - browser back/forward navigation');
    
    // Set flag to prevent the store.watch() from pushing state back to URL
    isHandlingPopstate = true;
    
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
          // Preserve collectionId - it's set during init and shouldn't change via URL navigation
          // This is critical for collection pages to maintain their context
          collectionId: cachedSearchParams.collectionId,
          // Preserve paginationType - it's a UI configuration, not a URL parameter
          paginationType: cachedSearchParams.paginationType,
          // Calculate hasSubmitted to ensure SearchManager filter passes
          // We need this because the user navigated to a valid search state
          hasSubmitted: calculateHasSubmitted(newParams, cachedSearchParams.collectionId),
        };
        
        debugLog('URL Manager', 'Updating store with popstate params:', updatedParams);
        return updatedParams;
      });
      
    } finally {
      // Clear the flag after a microtask to ensure store.watch() has completed
      // Using setTimeout with 0 ensures this runs after the current call stack
      setTimeout(() => {
        isHandlingPopstate = false;
        debugLog('URL Manager', 'popstate handling complete');
      }, 0);
    }
  });

  // Set the initialized flag to prevent duplicate initialization.
  initUrlManager.initialized = true;
  debugLog('URL Manager', 'Initialization complete');
}

// Initialize the flag.
initUrlManager.initialized = false;
