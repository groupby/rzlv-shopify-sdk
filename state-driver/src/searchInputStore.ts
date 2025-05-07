import { createStore, createEvent } from 'effector';
import type { UpdateStateFn } from './types';
import { SearchSource, PaginationType } from './types';
import type { SearchParams } from './types';
import { debugLog } from './debugLogger';

const initialSearchParams: SearchParams = {
  gbi_query: '',
  pagesize: '12',
  refinements: [],
  page: 1,
  sort_by: 'relevance',
  type: 'product', // Default value for type
  source: SearchSource.SEARCH, // Default value for source
  collectionId: undefined,
  paginationType: PaginationType.PAGINATE, // Default to 'paginate'. Comes directly from Shopify's `block.settings.page_handling_type` and passed into URL Manager.
};

export type SearchParamsUpdater = UpdateStateFn<SearchParams>;

// Create an event that accepts an updater function for SearchParams.
export const updateSearchParams = createEvent<SearchParamsUpdater>();

// Create the Effector store using the initial state and handle updates via the updater event.
  export const searchInputStore = createStore<SearchParams>(initialSearchParams)
  .on(updateSearchParams, (state, updater: SearchParamsUpdater): SearchParams => {
    const newState = updater(state);
    debugLog('Input Store', 'Updated state:', newState);
    return newState;
  });

/**
 * A helper function that acts as an abstract updater for the Input Store.
 * This function can be passed to our UI functions (e.g., handleSearchInput, handlePageSizeChange)
 * so that they can update the store in a framework-agnostic way.
 *
 * @param updater - A callback that receives the current state and returns the new state.
 */
export const updateInputStore = (updater: SearchParamsUpdater): void => {
  updateSearchParams(updater);
};
