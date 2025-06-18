/**
 * An abstract updater function type.
 * This function receives an updater callback that transforms the current state
 * into a new state.
 */
// export type UpdateStateFn<T> = (updater: (state: T) => T) => void;

export type UpdateStateFn<T> = (state: T) => T;

export enum PaginationType {
  PAGINATE = 'paginate',
  SHOW_MORE = 'show-more',
}

/**
 * Enum for the search source.
 */
export enum SearchSource {
  SEARCH = 'SEARCH',
  COLLECTION = 'COLLECTION',
  // Add other sources if needed. Do we need SEARCH_BAR?
}

/**
 * Defines the search parameters used throughout the SDK.
 */
export interface SearchParams {
  gbi_query: string;
  pagesize: string;
  refinements: string[];
  page: number;
  sort_by: string;
  type: string;
  source: SearchSource;
  collectionId?: string; // Optional, used for collection pages. Sourced from Shopify `collection` object.
  paginationType: PaginationType; // comes directly from Shopify's `block.settings.page_handling_type` passed into URL Manager.
  hasSubmitted?: boolean; // Flag to indicate an explicit search submission to prevent default Input Store state from trigger a search via the Search Manager on first load
}
