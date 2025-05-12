import {
  buildSearchArguments,
  fetchSearchResults,
  transformProductsForVariantRelevancy,
} from '../utils/searchUtils';

import type { SearchResult, ProductDetail, AppEnv } from '../utils/searchUtils.types';
import type { ShopifyConfig } from './fetchStorefrontProducts';
/**
 * Options for the search request.
 */
export interface RequestSearchOptions {
  /**
   * Optional search ID for the autoSearch beacon.
   */
  searchId?: string;
  /**
   * The search query string.
   */
  query?: string;
  /**
   * The collection name.
   */
  collection: string;
  /**
   * The area to search.
   */
  area: string;
  /**
   * The page number to request.
   */
  page: number;
  /**
   * The number of results per page.
   */
  pageSize: number;
  /**
   * Optional sort order (default is "relevance").
   */
  sortBy?: string;
  /**
   * Optional array of refinement strings.
   */
  refinements?: string[];
  /**
   * Optional collection ID.
   */
  collectionId?: string;
}

/**
 * Defines the shape of the search response returned by requestSearch.
 * In both cases (merging enabled or not) we return an object with the same keys.
 */
export interface RequestSearchResponse {
  mergedProducts: ProductDetail[]; // merged products when merging is enabled,
                                   // or the raw API products when merging is not enabled
  rawResponse: SearchResult;       // the complete raw response from the API
}

/**
 * Sends a search request to GBI Search and returns the search response.
 *
 * This function wraps our existing search functions to provide a simple API for submitting search requests.
 * It also enables automatic integration with our Shopify Beacons by attaching a searchId to a known global variable.
 *
 * @param shopTenant - The shop tenant identifier.
 * @param appEnv - The application environment.
 * @param searchOptions - Options for the search request (see {@link RequestSearchOptions}).
 * @param mergeShopifyData - If true, merges Shopify data for variant relevancy. Defaults to true.
 * @returns A promise that resolves to the search response (always with the same shape).
 *
 * @example
 * // Get merged Shopify data (default):
 * const response = await requestSearch("shop123", AppEnv.Production, {
 *   query: "sneakers",
 *   collection: "Footwear",
 *   area: "Retail",
 *   sortBy: "relevance",
 *   refinements: ["color:red", "size:10"]
 * });
 *
 * // Get raw search results (without merging Shopify data):
 * const response = await requestSearch("shop123", AppEnv.Production, {
 *   query: "sneakers",
 *   collection: "Footwear",
 *   area: "Retail",
 *   sortBy: "relevance",
 *   refinements: ["color:red", "size:10"]
 * }, false);
 */
export async function requestSearch(
  shopTenant: string,
  appEnv: AppEnv,
  searchOptions: RequestSearchOptions,
  mergeShopifyData = true,
  shopifyConfig?: ShopifyConfig
): Promise<RequestSearchResponse> {
  try {
    // If searchId is provided, set the global GBI_SEARCH_ID.
    if (searchOptions.searchId) {
      (globalThis as any).GBI_SEARCH_ID = searchOptions.searchId;
    }

    // Build the search arguments using our helper.
    const gbiSearchArgs = buildSearchArguments({
      query: searchOptions.query || '',
      collection: searchOptions.collection,
      area: searchOptions.area,
      page: searchOptions.page,
      pageSize: searchOptions.pageSize,
      sortBy: searchOptions.sortBy || 'relevance',
      refinements: searchOptions.refinements || [],
      collectionId: searchOptions.collectionId,
    });

    // Fetch search results from the API.
    const searchResults = await fetchSearchResults(shopTenant, appEnv, gbiSearchArgs);

    // If merging is enabled, merge the Shopify data.
    if (mergeShopifyData) {
      if (!shopifyConfig) {
        throw new Error('Shopify configuration is not set. Please check that shopifyConfig is passed in requestSearch.');
      } 

      const mergedProducts = await transformProductsForVariantRelevancy(searchResults, shopifyConfig);

      // Return the merged products along with the raw response.
      return { mergedProducts, rawResponse: searchResults };
    } else {
      // Even when merging is disabled, for consistency we return the products under 'mergedProducts'
      // (using the raw API response's products) and also return the full raw response.
      // (Assuming the raw response has a 'products' property.)
      return { mergedProducts: searchResults.records, rawResponse: searchResults };
    }
  } catch (error) {
    console.error("Error in requestSearch:", error);
    throw error;
  }
}
