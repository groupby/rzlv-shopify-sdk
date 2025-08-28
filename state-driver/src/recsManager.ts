import { createEffect, sample } from 'effector';
import { recsInputStore, updateRecsInputStore, type RecsParams } from './recsInputStore';
import { recsOutputStore, updateRecsOutputStore } from './recsOutputStore';
import { requestRecommendations, type RequestRecsResponse, type RecsManagerConfig, type RecsFilter, type RecsRequestProduct } from '@rzlv/public-api-sdk';
import {debugLog, sdkConfig} from './debugLogger';

/**
 * Interface defining the parameters required to trigger a recommendations request.
 * (Values for shopTenant, appEnv, etc. come from static configuration stored via init.)
 */
interface RecsManagerParams {
  shopTenant: string;
  appEnv: string;
  recsOptions: {
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
  };
}

// RecsManagerConfig is now imported from @rzlv/public-api-sdk

// Create the effect that triggers the recommendations API call.
export const recsFx = createEffect(
  async (params: RecsManagerParams): Promise<RequestRecsResponse> => {
    debugLog('Recs Manager', 'recsFx triggered with params', params);
    debugLog('Recs Manager', 'Making recommendations request to:', {
      shopTenant: params.shopTenant,
      appEnv: params.appEnv,
      recsOptions: params.recsOptions
    });

    return await requestRecommendations(
      params.shopTenant,
      params.appEnv,
      params.recsOptions
    );
  }
);

// Module-level variable to hold the static configuration.
let recsManagerConfig: RecsManagerConfig;

/**
 * Explicitly initializes the Recs Manager.
 *
 * This function stores static configuration and wires up an Effector sample operator
 * that watches the recsInputStore. When the input store changes (and passes the guard/filter),
 * it triggers the recsFx effect. The done and fail handlers update the recsOutputStore.
 *
 * @param config - The static configuration values.
 */
export function initRecsManager(config: RecsManagerConfig): void {
  sdkConfig.debug = config.debug;
  // Add a guard so this is only initialized once.
  if ((initRecsManager as { initialized?: boolean }).initialized) {
    debugLog('Recs Manager', 'Already initialized, skipping');
    return;
  }

  debugLog('Recs Manager', 'Initializing with config', config);
  // Store the configuration for use in every recommendations request.
  recsManagerConfig = config;

  // Set our global debug flag
  if (config.debug !== undefined) {
    sdkConfig.debug = config.debug;
  }

  // Wire up the sample operator so that changes to the recsInputStore can trigger recommendations.
  sample({
    source: recsInputStore,
    clock: recsInputStore,
    // Only trigger the recommendations effect when the user has explicitly requested it
    filter: (inputState: RecsParams) =>
      inputState.hasRequested && inputState.name !== '',
    fn: (inputState: RecsParams): RecsManagerParams => ({
      shopTenant: recsManagerConfig.shopTenant,
      appEnv: recsManagerConfig.appEnv,
      recsOptions: {
        name: inputState.name,
        fields: inputState.fields,
        collection: inputState.collection,
        pageSize: inputState.pageSize,
        currentPage: inputState.currentPage,
        limit: inputState.limit,
        productID: inputState.productID,
        products: inputState.products,
        visitorId: inputState.visitorId,
        loginId: inputState.loginId,
        filters: inputState.filters,
        rawFilter: inputState.rawFilter,
        placement: inputState.placement,
        eventType: inputState.eventType,
        area: inputState.area,
        debug: inputState.debug,
        strictFiltering: inputState.strictFiltering,
      },
    }),
    target: recsFx,
  });

  // When the recommendations effect is pending, update the Output Store to indicate loading.
  recsFx.pending.watch((isPending) => {
    debugLog('Recs Manager', 'recsFx pending:', isPending);
    if (isPending) {
      updateRecsOutputStore((current) => ({
        ...current,
        loading: true,
        error: null,
      }));
    }
  });

  // When the recommendations effect is done, update the Output Store with the returned data.
  recsFx.done.watch(({ result, params }) => {
    debugLog('Recs Manager', 'recsFx done, received products:', result.products.length);

    updateRecsOutputStore((current) => {
      const totalRecords = result.products.length;
      const pageSize = params.recsOptions.pageSize;
      const totalPages = Math.ceil(totalRecords / pageSize);
      const currentPage = params.recsOptions.currentPage || 0;

      // Calculate slice based on actual currentPage
      const startIndex = currentPage * pageSize;
      const endIndex = startIndex + pageSize;
      const currentPageProducts = result.products.slice(startIndex, endIndex);

      return {
        ...current,
        products: currentPageProducts,  // UI consumes this (current page)
        allProducts: result.products,   // Internal use (all products)
        pagination: {
          currentPage,
          pageSize,
          totalPages,
          totalRecords,
        },
        metadata: result.metadata,
        loading: false,
        error: null,
        rawResponse: result.rawResponse,
      };
    });

    // Reset hasRequested flag
    updateRecsInputStore((current) => ({
      ...current,
      hasRequested: false
    }));
  });

  // When the recommendations effect fails, update the Output Store with an error state.
  recsFx.fail.watch(({ error }) => {
    debugLog('Recs Manager', 'recsFx error:', error);
    updateRecsOutputStore((current) => ({
      ...current,
      loading: false,
      error: error instanceof Error ? error.message : String(error),
    }));

    // Clear the request flag even on failure
    updateRecsInputStore((current) => ({
      ...current,
      hasRequested: false
    }));
  });

  (initRecsManager as { initialized?: boolean }).initialized = true;
  debugLog('Recs Manager', 'Initialization complete - ready for explicit requests');
}

/**
 * Sets up the recommendations parameters and triggers a fetch.
 * This follows the same pattern as search manager where parameters are set via helper functions.
 */
export function setupRecommendations(params: Partial<RecsParams>): void {
  updateRecsInputStore((current) => ({
    ...current,
    ...params,
    hasRequested: true
  }));
}

// Export stores for external access
export { recsInputStore };
export { recsOutputStore };
