import { createEffect, sample } from 'effector';
import { searchInputStore, updateInputStore } from './searchInputStore';
import { requestSearch, RequestSearchResponse } from '@rzlv/public-api-sdk/search-requester/requestSearch';
import { updateOutputStore } from './searchOutputStore';
import type { SearchParams } from './types';
import { PaginationType } from './types';
import { debugLog } from './debugLogger';

/**
 * Interface defining the parameters required to trigger a search request.
 * (Values for shopTenant, appEnv, etc. come from static configuration stored via init.)
 */
interface SearchManagerParams {
  shopTenant: string;
  appEnv: string;
  searchOptions: {
    query?: string;
    collection: string;
    area: string;
    page: number;
    pageSize: number;
    sortBy?: string;
    refinements?: readonly string[];
    collectionId?: string;
    paginationType: PaginationType;
  };
}

/**
 * Config for static configuration values not subject to change via user interaction.
 * Now includes an optional collectionId as a fallback and a flag for merging Shopify data.
 */
export interface SearchManagerConfig {
  shopTenant: string;
  appEnv: string;
  collection: string;
  area: string;
  collectionId?: string;
  mergeShopifyData?: boolean;  // Setting for merging Shopify data on init
}

// Create the effect that triggers the search API call.
export const searchFx = createEffect(
  async (params: SearchManagerParams): Promise<RequestSearchResponse> => {
    debugLog('Search Manager', 'searchFx triggered with params', params);
    return await requestSearch(
      params.shopTenant,
      params.appEnv,
      params.searchOptions,
      (searchManagerConfig.mergeShopifyData !== undefined ? searchManagerConfig.mergeShopifyData : true)
    );
  }
);

// Module-level variable to hold the static configuration.
let searchManagerConfig: SearchManagerConfig;

/**
 * Explicitly initializes the Search Manager.
 *
 * This function stores static configuration (shopTenant, appEnv, collection, area, and optionally collectionId)
 * and then wires up an Effector sample operator that watches the searchInputStore.
 * When the input store changes (and passes the guard/filter), it triggers the searchFx effect.
 * The done and fail handlers update the searchOutputStore with a consistent data shape.
 *
 * @param config - The static configuration values.
 */
export function initSearchManager(config: SearchManagerConfig): void {
  // Add a guard so this is only initialized once.
  if ((initSearchManager as any).initialized) {
    return;
  }
  debugLog('Search Manager', 'Initializing with config', config);
  // Store the configuration for use in every search request.
  searchManagerConfig = config;

  // Wire up the sample operator so that every change to the searchInputStore triggers a search.
  sample({
    source: searchInputStore,
    clock: searchInputStore,
    // Only trigger the search effect when one of the following is true:
    // - The user has explicitly submitted a search (hasSubmitted flag), OR
    // - There are any refinements, OR
    // - The page number is greater than 1.
    // This allows an empty search to be triggered if the user has submitted it.
    filter: (inputState: SearchParams) =>
      inputState.hasSubmitted === true ||
      inputState.refinements.length > 0 ||
      inputState.page > 1,
    fn: (inputState: SearchParams): SearchManagerParams => {
      return {
        shopTenant: searchManagerConfig.shopTenant,
        appEnv: searchManagerConfig.appEnv,
        searchOptions: {
          query: inputState.gbi_query,
          collection: searchManagerConfig.collection,
          area: searchManagerConfig.area,
          page: inputState.page,
          pageSize: parseInt(inputState.pagesize, 10),
          sortBy: inputState.sort_by,
          refinements: inputState.refinements,
          // Use inputState.collectionId if available; otherwise fallback to static config.
          collectionId: inputState.collectionId || searchManagerConfig.collectionId,
          paginationType: inputState.paginationType,
        },
      };
    },
    target: searchFx,
  });

  // When the search effect is pending, update the Output Store to indicate loading.
  searchFx.pending.watch((isPending) => {
    debugLog('Search Manager', 'searchFx pending:', isPending);
    if (isPending) {
      updateOutputStore((current) => ({
        ...current,
        loading: true,
        error: null,
      }));
    }
  });

  // When the search effect is done, update the Output Store with the returned data.
  searchFx.done.watch(({ result, params }) => {
    debugLog('Search Manager', 'searchFx done:', result);
    updateOutputStore((current) => {
      // Use the mergedProducts from the response (which is always present now)
      const newProducts = result.mergedProducts;
      // If the pagination type is 'show-more' and page > 1, append products; otherwise, replace.
      const mergedProducts =
        params.searchOptions.paginationType === PaginationType.SHOW_MORE && params.searchOptions.page > 1
          ? [...current.products, ...newProducts]
          : newProducts;

      return {
        ...current,
        products: mergedProducts,
        queryParams: {
          ...current.queryParams,
          collectionId: params.searchOptions.collectionId,
        },
        loading: false,
        error: null,
        totalRecordCount: result.rawResponse.totalRecordCount || current.totalRecordCount,
        rawResponse: result.rawResponse,
      };
    });

    // **Immediately clear the "I just submitted" flag so we don’t re-fire**
    updateInputStore((current) => ({
      ...current,
      hasSubmitted: false
    }));
  });

  // When the search effect fails, update the Output Store with an error state.
  searchFx.fail.watch(({ error }) => {
    debugLog('Search Manager', 'searchFx error:', error);
    updateOutputStore((current) => ({
      ...current,
      loading: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  });

  (initSearchManager as any).initialized = true;
}
