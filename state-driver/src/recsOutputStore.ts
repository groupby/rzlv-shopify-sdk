import { createStore, createEvent } from 'effector';
import { debugLog } from './debugLogger';
import type { RecsProduct } from '@rzlv/public-api-sdk';

/**
 * Defines the structure of the recommendations results state.
 */
export interface RecsResultsOutput {
  /**
   * Array of current page products (what UI displays).
   * This is the main field that UI components should consume.
   */
  products: RecsProduct[];
  /**
   * Array of all recommendation product records (for internal pagination).
   * UI components typically don't need this - use `products` instead.
   */
  allProducts: RecsProduct[];
  /**
   * Pagination state.
   */
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalRecords: number;
  };
  /**
   * Metadata from the recommendations response.
   */
  metadata: {
    modelName: string;
    totalCount: number;
  };
  /**
   * Indicates whether a recommendations request is currently in progress.
   */
  loading: boolean;
  /**
   * Error message if the recommendations request failed.
   */
  error: string | null;
  /**
   * The full raw response from the recommendations API (for consistency and debugging).
   */
  rawResponse?: unknown;
}

// Define the initial state for the Output Store.
const initialRecsResults: RecsResultsOutput = {
  products: [],
  allProducts: [],
  pagination: {
    currentPage: 0,
    pageSize: 10,
    totalPages: 0,
    totalRecords: 0,
  },
  metadata: {
    modelName: '',
    totalCount: 0,
  },
  loading: false,
  error: null,
  rawResponse: undefined,
};

/**
 * Type for a function that updates the RecsResultsOutput state.
 */
export type RecsResultsOutputUpdater = (state: RecsResultsOutput) => RecsResultsOutput;

/**
 * Creates an Effector event that accepts an updater function for the RecsResultsOutput state.
 */
export const updateRecsResultsOutput = createEvent<RecsResultsOutputUpdater>();

/**
 * Creates the Effector store for recommendations results output using the initial state and handles updates
 * via the updater event.
 */
export const recsOutputStore = createStore<RecsResultsOutput>(initialRecsResults)
  .on(updateRecsResultsOutput, (state, updater): RecsResultsOutput => updater(state));

// Test watch for the Output Store
recsOutputStore.watch((state) => {
  debugLog('Recs Output Store', 'Updated state:', state);
});

/**
 * A helper function to update the Output Store.
 * This function can be called by the Recs Manager to update the store with new recommendations results.
 *
 * @param updater - A callback that receives the current RecsResults state and returns the updated state.
 */
export const updateRecsOutputStore = (updater: RecsResultsOutputUpdater): void => {
  updateRecsResultsOutput(updater);
};
