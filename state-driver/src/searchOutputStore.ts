import { createStore, createEvent } from 'effector';
import { debugLog } from './debugLogger';

/**
 * Defines the structure of the search results state.
 */
export interface SearchResultsOutput {
  /**
   * Array of product records or search result items.
   */
  products: any[]; // TODO: Define the product type
  /**
   * Query parameters used in the search request.
   */
  queryParams: {
    pageSize: number;
    sortBy: string;
    collectionId?: string;
    // Add other parameters if needed.
  };
  /**
   * Indicates whether a search request is currently in progress.
   */
  loading: boolean;
  /**
   * Error message if the search request failed.
   */
  error: string | null;
  /**
   * The total number of records returned by the search.
   */
  totalRecordCount: number;
  /**
   * The full raw response from the search API (for consistency and debugging).
   */
  rawResponse?: any; // TODO: Define the raw response type.
}

// Define the initial state for the Output Store.
const initialSearchResults: SearchResultsOutput = {
  products: [],
  queryParams: {
    pageSize: 12,
    sortBy: 'relevance',
    // collectionId is initially undefined.
  },
  loading: false,
  error: null,
  totalRecordCount: 0,
  rawResponse: undefined,
};

/**
 * Type for a function that updates the SearchResultsOutput state.
 */
export type SearchResultsOutputUpdater = (state: SearchResultsOutput) => SearchResultsOutput;

/**
 * Creates an Effector event that accepts an updater function for the SearchResultsOutput state.
 */
export const updateSearchResultsOutput = createEvent<SearchResultsOutputUpdater>();

/**
 * Creates the Effector store for search results output using the initial state and handles updates
 * via the updater event.
 */
export const searchOutputStore = createStore<SearchResultsOutput>(initialSearchResults)
  .on(updateSearchResultsOutput, (state, updater): SearchResultsOutput => updater(state));

// Test watch for the Output Store
searchOutputStore.watch((state) => {
  debugLog('Output Store', 'Updated state:', state);
});

  /**
 * A helper function to update the Output Store.
 * This function can be called by the Search Manager to update the store with new search results.
 *
 * @param updater - A callback that receives the current SearchResults state and returns the updated state.
 */
export const updateOutputStore = (updater: SearchResultsOutputUpdater): void => {
  updateSearchResultsOutput(updater);
};
