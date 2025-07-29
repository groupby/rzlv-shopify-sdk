import { updateInputStore, searchInputStore } from './searchInputStore';
import { SearchSource, PaginationType } from './types';
import type { SearchParams } from './types';
import { sdkConfig, debugLog } from './debugLogger';

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
 * Parses the current URL parameters and returns a SearchParams object.
 *
 * This function reads URL parameters such as 'gbi-query', 'pagesize', 'page', 'sort_by',
 * 'refinement', and 'type', and maps them to the SearchParams structure.
 *
 * @param config - An object containing defaultPagesize and source.
 * @returns The parsed search parameters.
 */
function parseUrlToSearchParams({ defaultPagesize, source }: InitUrlManagerParams): SearchParams {
  const urlParams = new URLSearchParams(window.location.search);

  const gbi_query = urlParams.get('gbi-query') || '';
  const pagesize = urlParams.get('pagesize') || defaultPagesize;
  const page = urlParams.has('page') ? parseInt(urlParams.get('page')!, 10) : 1;
  const sort_by = urlParams.get('sort_by') || 'relevance';
  const type = urlParams.get('type') || 'product';
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

  // Parse URL parameters and update the Input Store.
  const initialParams = parseUrlToSearchParams({ defaultPagesize, source });
  if (collectionId) {
    initialParams.collectionId = collectionId;
  }
  initialParams.paginationType = paginationType;

  // Merge initialParams into the current Input Store state.
  // Set hasSubmitted to true only if the URL indicates an actual search action.
  updateInputStore((current: SearchParams): SearchParams => ({
    ...current,
    ...initialParams,
    hasSubmitted:
      initialParams.gbi_query.trim() !== '' ||
      initialParams.refinements.length > 0 ||
      initialParams.page > 1,
  }));
  debugLog('URL Manager', 'Input store updated with URL parameters', initialParams);

  // Subscribe to changes in the Input Store and update the URL accordingly.
  searchInputStore.watch((params) => {
    // Only update the URL if at least one search parameter indicates a search action.
    if (
      params.gbi_query.trim() !== '' ||
      params.hasSubmitted === true ||
      params.refinements.length > 0 ||
      params.page > 1
    ) {
      const urlParams = new URLSearchParams();

      // Map our search state to URL parameters.
      urlParams.set('type', params.type);
      urlParams.set('refinement', params.refinements.join(','));
      urlParams.set('sort_by', params.sort_by);
      urlParams.set('page', params.page.toString());
      urlParams.set('gbi-query', params.gbi_query);
      urlParams.set('pagesize', params.pagesize);

      // Determine the new path based on the source.
      let newPath = '/search';
      if (params.source === SearchSource.COLLECTION) {
        newPath = window.location.pathname;
      }

      // Update the URL without reloading the page.
      window.history.pushState({}, '', `${newPath}?${urlParams.toString()}`);
      debugLog('URL Manager', 'Browser URL updated to', newPath, urlParams.toString());
      // Optionally dispatch a custom event signaling the URL update.
      document.dispatchEvent(new CustomEvent('searchParamsUpdated', { detail: params }));
    }
  });

  // Set the initialized flag to prevent duplicate initialization.
  initUrlManager.initialized = true;
  debugLog('URL Manager', 'Initialization complete');
}

// Initialize the flag.
initUrlManager.initialized = false;
