import { updateInputStore, searchInputStore } from './searchInputStore';
import { SearchSource, PaginationType } from './types';
import type { SearchParams } from './types';
import { sdkConfig, debugLog } from './debugLogger';
import { 
  isCollectionSource, 
  calculateHasSubmitted, 
  shouldUpdateBrowserUrl, 
  getUrlPathForSource,
  serializeSearchParamsToUrl,
  parseUrlToSearchParams,
  createPopstateHandler
} from './utils/urlManagerUtils';
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
 * @returns Cleanup function to remove event listeners and reset initialization state
 */
export function initUrlManager({ 
  defaultPagesize, 
  source,
  collectionId,
  paginationType,
  debug = false,
}: InitUrlManagerParams): () => void {
  // Prevent duplicate initialization.
  if (initUrlManager.initialized) {
    // Return no-op cleanup function if already initialized
    return () => {};
  }
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
  // Using an object so it can be mutated by reference in the popstate handler
  const isHandlingPopstateRef = { value: false };

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
    const shouldUpdate = shouldUpdateBrowserUrl(params, isHandlingPopstateRef.value);
    
    debugLog('URL Manager', 'URL update decision:', {
      shouldUpdate,
      isHandlingPopstate: isHandlingPopstateRef.value,
      source: params.source,
      hasSubmitted: params.hasSubmitted
    });

    if (shouldUpdate) {
      // Serialize search parameters to URL query string
      const urlParams = serializeSearchParamsToUrl(params);

      // Determine the new path based on the source
      const newPath = getUrlPathForSource(params.source);

      // Update the URL without reloading the page.
      window.history.pushState({}, '', `${newPath}?${urlParams.toString()}`);
      debugLog('URL Manager', 'Browser URL updated to', newPath, urlParams.toString());
      // Optionally dispatch a custom event signaling the URL update.
      document.dispatchEvent(new CustomEvent('searchParamsUpdated', { detail: params }));
    }
  });

  // Create and attach popstate event handler for browser back/forward navigation
  const popstateHandler = createPopstateHandler({
    defaultPagesize,
    source,
    cachedSearchParams,
    isHandlingPopstate: isHandlingPopstateRef,
    updateInputStore,
    debugLog,
  });
  
  window.addEventListener('popstate', popstateHandler);

  // Set the initialized flag to prevent duplicate initialization.
  initUrlManager.initialized = true;
  debugLog('URL Manager', 'Initialization complete');

  // Return cleanup function for proper teardown
  return () => {
    window.removeEventListener('popstate', popstateHandler);
    initUrlManager.initialized = false;
    debugLog('URL Manager', 'URL Manager cleaned up');
  };
}

// Initialize the flag.
initUrlManager.initialized = false;
