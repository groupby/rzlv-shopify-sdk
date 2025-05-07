import { modifyQueryForAutocomplete } from '../utils/searchUtils';
import { fetchAutocompleteResults } from '../utils/autocompleteUtils';
import type { AppEnv, SearchResult, ProductDetail } from '../utils/searchUtils.types';
import { requestSearch } from '../search-requester/requestSearch';
import type { RequestSearchOptions, RequestSearchResponse } from '../search-requester/requestSearch';

/**
 * Options for the autocomplete request.
 */
export type RequestAutocompleteSearchOptions = {
  /**
   * The search query string.  Should include the `autocomplete:` prefix.
   */
  query: string;
  /**
   * The collection name.
   */
  collection: string;
  /**
   * The area to search.
   */
  area: string;
  /**
    * Optional, number of search items to return
    */
  searchItems?: number;
  /**
   * Optional dataset parameter
   */
  dataset?: string;
  /**
   * Choose how many products to return in the search results.
   */
  pageSize?: number;
  /**
   * Choose whether to merge search results with Shopify product data.
   */
  mergeShopifyData?: boolean;
  /**
   * If true, the first autocomplete suggestion will be used as the query for search results.
   * If false or not provided, the original query will be used.
   */
  useFirstSuggestion?: boolean;
}

/**
 * Sends an autocomplete request to GBI Search and returns the response.
 *
 * @param shopTenant - The shop tenant identifier.
 * @param appEnv - The application environment.
 * @param options - Options for the autocomplete request.
 * @returns A promise that resolves to the GBI Search response.
 * @throws Throws an error if the request fails.
 *
 * @example
 * const results = await requestAutocompleteWithSearch("shop123", AppEnv.Production, {
 *   query: "autocomplete:sh",
 *   collection: "products",
 *   area: "navigation",
 *   searchOptions: {}
 * });
 */
export async function requestAutocompleteWithSearch(
  shopTenant: string,
  appEnv: AppEnv,
  options: RequestAutocompleteSearchOptions
): Promise<{ autocomplete: SearchResult, search: RequestSearchResponse }> {
  try {
    const { modifiedQuery } = modifyQueryForAutocomplete(options.query);

    // Fetch autocomplete results using the dedicated autocomplete endpoint
    const autocompleteResults = await fetchAutocompleteResults(shopTenant, appEnv, {
      query: modifiedQuery,
      collection: options.collection,
      area: options.area,
      searchItems: options.searchItems,
      dataset: options.dataset
    });

    // Determine the search query to use
    let searchQuery = options.query;
    
    // If useFirstSuggestion is enabled and there are autocomplete suggestions,
    // use the first suggestion as the search query
    if (options.useFirstSuggestion && 
        autocompleteResults?.results?.length > 0 && 
        autocompleteResults.results[0]?.term) {
      searchQuery = autocompleteResults.results[0].term;
    }

    const searchOptions: RequestSearchOptions = {
      query: searchQuery,
      collection: options.collection,
      area: options.area,
      page: 1,
      pageSize: options.pageSize || 5
    };

    const searchResults = await requestSearch(shopTenant, appEnv, searchOptions, options.mergeShopifyData ?? true);

    // Return the results.
    return { autocomplete: autocompleteResults, search: searchResults };
  } catch (error) {
    console.error("Error in requestAutocomplete:", error);
    throw error;
  }
}
