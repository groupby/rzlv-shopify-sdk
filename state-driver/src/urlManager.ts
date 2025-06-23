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
   * Optional debug flag to enable or disable debug logging.
   */
  debug?: boolean;
}

/**
 * Parses URL parameters and maps them to SearchParams structure.
 *
 * This function extracts URL parameters such as 'gbi-query', 'pagesize', 'page',
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
  const refinements = refinementParam ? decodeRefinements(refinementParam) : [];

  return {
    gbi_query,
    pagesize,
    refinements,
    page,
    sort_by,
    type,
    source, // Use the provided source.
    paginationType: PaginationType.PAGINATE, // Default value, not parsed from URL
  };
}

/**
 * Initializes the URL Manager and sets up URL parameter parsing.
 *
 * This function initializes the URL Manager, parses URL parameters, and updates
 * the Input Store with the parsed values. It also sets up a listener to update
 * the URL when the Input Store changes.
 *
 * @param config - The initialization configuration including defaultPagesize and source.
 */
export function initUrlManager({ 
  defaultPagesize, 
  source,
  collectionId,
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
      urlParams.set('refinement', encodeRefinements(params.refinements));
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

/**
 * Encodes an array of refinements into a URL-safe string
 * Uses a custom separator and encoding to ensure special characters are handled properly
 * 
 * @param refinements - Array of refinement strings to encode
 * @returns URL-safe string representation of refinements
 */
function encodeRefinements(refinements: ReadonlyArray<string>): string {
  if (!refinements.length) return '';
  
  // Use base64 encoding to safely handle any special characters
  return refinements.map(refinement => {
    // First encode as URI component to handle special chars
    const encoded = encodeURIComponent(refinement);
    return encoded;
  }).join('|'); // Use pipe as separator instead of comma
}

/**
 * Decodes a URL-safe string into an array of refinements
 * 
 * @param encodedRefinements - URL-safe string representation of refinements
 * @returns Array of decoded refinement strings
 */
function decodeRefinements(encodedRefinements: string): string[] {
  if (!encodedRefinements) return [];
  
  // Split by pipe character and decode each refinement
  return encodedRefinements.split('|').map(encoded => {
    try {
      return decodeURIComponent(encoded);
    } catch (e) {
      // Fallback if decoding fails
      return encoded;
    }
  });
}
