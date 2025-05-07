import { 
  buildSearchArguments, 
  fetchSearchResults, 
  transformProductsForVariantRelevancy 
} from '../utils/searchUtils';

import type { SearchResult, ProductDetail, AppEnv } from '../utils/searchUtils.types';

/**
 * Options for lazy loading more search results.
 */
export interface LazyLoadMoreOptions {
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
 * Fetches additional search results for lazy loading functionality.
 *
 * This function increments the current page, keeps the page size constant, and returns either the raw search results
 * or the merged Shopify data for the next page based on the `mergeShopifyData` flag.
 *
 * @param shopTenant - The shop tenant identifier.
 * @param appEnv - The application environment.
 * @param currentPage - The current page number.
 * @param pageSize - The number of results per page.
 * @param searchOptions - Options for the search request (see {@link LazyLoadMoreOptions}).
 * @param mergeShopifyData - Optional flag indicating whether Shopify data should be merged. Defaults to true.
 * @returns A promise that resolves to the GBI Search response or merged Shopify products.
 *
 * @example
 * // Get merged Shopify data (default):
 * const moreResults = await lazyLoadMore("shop123", AppEnv.Production, 1, 12, {
 *   query: "sneakers",
 *   collection: "Footwear",
 *   area: "Retail",
 *   sortBy: "relevance",
 *   refinements: ["color:red", "size:10"]
 * });
 *
 * // Get raw search results (without merging Shopify data):
 * const rawResults = await lazyLoadMore("shop123", AppEnv.Production, 1, 12, {
 *   query: "sneakers",
 *   collection: "Footwear",
 *   area: "Retail",
 *   sortBy: "relevance",
 *   refinements: ["color:red", "size:10"]
 * }, false);
 */
export async function lazyLoadMore(
  shopTenant: string,
  appEnv: AppEnv,
  currentPage: number,
  pageSize: number,
  searchOptions: LazyLoadMoreOptions,
  mergeShopifyData: boolean = true
): Promise<SearchResult | ProductDetail[]> {
  try {
    const nextPage = currentPage + 1;

    const gbiSearchArgs = buildSearchArguments({
      query: searchOptions.query || '',
      collection: searchOptions.collection,
      area: searchOptions.area,
      page: nextPage,
      pageSize,
      sortBy: searchOptions.sortBy || 'relevance',
      refinements: searchOptions.refinements || [],
      collectionId: searchOptions.collectionId,
    });

    const searchResults = await fetchSearchResults(shopTenant, appEnv, gbiSearchArgs);

    if (mergeShopifyData) {
      const mergedProducts = await transformProductsForVariantRelevancy(searchResults);
      return mergedProducts;
    } else {
      return searchResults;
    }
  } catch (error) {
    console.error("Error in lazyLoadMore:", error);
    throw error;
  }
}
