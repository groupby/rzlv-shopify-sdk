// src/public-api/autocomplete-requester/requestAutocomplete.ts
import { modifyQueryForAutocomplete } from '../utils/searchUtils';
import { fetchAutocompleteResults } from '../utils/autocompleteUtils';
import type { AppEnv, SearchResult } from '../utils/searchUtils.types';

/**
 * Options for the autocomplete request.
 */
export interface RequestAutocompleteOptions {
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
 * const results = await requestAutocomplete("shop123", AppEnv.Production, {
 *   query: "autocomplete:sh",
 *   collection: "products",
 *   area: "navigation",
 * });
 */
export async function requestAutocomplete(
  shopTenant: string,
  appEnv: AppEnv,
  options: RequestAutocompleteOptions
): Promise<{autocomplete: SearchResult}> {
  try {
    // Modify the query for autocomplete.
    const { modifiedQuery } = modifyQueryForAutocomplete(options.query);

    // Fetch autocomplete results using the dedicated autocomplete endpoint
    const autocompleteResults = await fetchAutocompleteResults(shopTenant, appEnv, {
      query: modifiedQuery,
      collection: options.collection,
      area: options.area,
      searchItems: options.searchItems,
      dataset: options.dataset
    });

    // Set the global autocomplete ID for beaconing.
    (globalThis as any).GBI_AUTOCOMPLETE_ID = options.query; // or some other unique ID

    // Return the results.
    return { autocomplete: autocompleteResults};
  } catch (error) {
    console.error("Error in requestAutocomplete:", error);
    throw error; 
  }
}
