import { createStore, createEvent } from 'effector';
import type { UpdateStateFn } from './types';
import type { RecsFilter, RecsRequestProduct } from '@rzlv/public-api-sdk';
import { debugLog } from './debugLogger';

/**
 * Interface defining the input parameters for recommendations requests.
 */
export interface RecsParams {
  name: string;
  fields: string[];
  collection: string;
  pageSize: number;
  currentPage: number;
  limit?: string;
  productID?: string | string[];
  products?: RecsRequestProduct[];
  visitorId?: string;
  loginId?: string;
  filters?: RecsFilter[];
  rawFilter?: string;
  placement?: string;
  eventType?: string;
  area?: string;
  debug?: boolean;
  strictFiltering?: boolean;
  hasRequested: boolean; // Flag to control when to actually fetch
}

const initialRecsParams: RecsParams = {
  name: '',
  fields: ['*'],
  collection: '',
  pageSize: 10,
  currentPage: 0,
  limit: undefined,
  productID: undefined,
  products: undefined,
  visitorId: undefined,
  loginId: undefined,
  filters: undefined,
  rawFilter: undefined,
  placement: undefined,
  eventType: undefined,
  area: undefined,
  debug: undefined,
  strictFiltering: undefined,
  hasRequested: false, // Initially false - no automatic fetching
};

export type RecsParamsUpdater = UpdateStateFn<RecsParams>;

// Create an event that accepts an updater function for RecsParams.
export const updateRecsParams = createEvent<RecsParamsUpdater>();

// Create the Effector store using the initial state and handle updates via the updater event.
export const recsInputStore = createStore<RecsParams>(initialRecsParams)
  .on(updateRecsParams, (state, updater: RecsParamsUpdater): RecsParams => {
    const newState = updater(state);
    debugLog('Recs Input Store', 'Updated state:', newState);
    return newState;
  });

/**
 * A helper function that acts as an abstract updater for the Recs Input Store.
 * This function can be passed to our UI functions so that they can update the store
 * in a framework-agnostic way.
 *
 * @param updater - A callback that receives the current state and returns the new state.
 */
export const updateRecsInputStore = (updater: RecsParamsUpdater): void => {
  updateRecsParams(updater);
};
