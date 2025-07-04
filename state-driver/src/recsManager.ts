import { createEffect, sample } from 'effector';
import { recsInputStore, updateRecsInputStore, type RecsParams } from './recsInputStore';
import { recsOutputStore, updateRecsOutputStore } from './recsOutputStore';
import { requestRecommendations, type RequestRecsResponse, type RecsManagerConfig } from '@rzlv/public-api-sdk';
import { debugLog } from './debugLogger';

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
    productID?: string | string[];
    visitorId?: string;
    loginId?: string;
    filters?: {
      field: string;
      value: string;
      exclude?: string;
      required?: string;
    }[];
    eventType?: string;
    area?: string;
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
  // Add a guard so this is only initialized once.
  if ((initRecsManager as { initialized?: boolean }).initialized) {
    debugLog('Recs Manager', 'Already initialized, skipping');
    return;
  }
  
  debugLog('Recs Manager', 'Initializing with config', config);
  // Store the configuration for use in every recommendations request.
  recsManagerConfig = config;

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
        productID: inputState.productID,
        visitorId: inputState.visitorId,
        loginId: inputState.loginId,
        filters: inputState.filters,
        eventType: inputState.eventType,
        area: inputState.area,
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
  recsFx.done.watch(({ result }) => {
    debugLog('Recs Manager', 'recsFx done, received products:', result.products.length);
    
    updateRecsOutputStore((current) => {
      const totalRecords = result.products.length;
      const pageSize = current.pagination.pageSize;
      const totalPages = Math.ceil(totalRecords / pageSize);
      const currentPageProducts = result.products.slice(0, pageSize);

      return {
        ...current,
        products: result.products,
        currentPageProducts,
        pagination: {
          currentPage: 0,
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

    // **Clear the "I just requested" flag so we don't re-fire**
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

/**
 * Triggers a recommendations fetch with current input store values.
 * This is the controlled way to fetch recommendations - no automatic fetching.
 */
export function fetchRecommendations(): void {
  updateRecsInputStore((current) => ({
    ...current,
    hasRequested: true
  }));
}

/**
 * Navigation functions for pagination
 */
export function nextPage(): void {
  updateRecsOutputStore((current) => {
    const nextPageIndex = current.pagination.currentPage + 1;
    if (nextPageIndex < current.pagination.totalPages) {
      const startIndex = nextPageIndex * current.pagination.pageSize;
      const endIndex = startIndex + current.pagination.pageSize;
      const newCurrentPageProducts = current.products.slice(startIndex, endIndex);
      
      debugLog('Recs Manager', 'Moving to next page:', nextPageIndex);
      return {
        ...current,
        currentPageProducts: newCurrentPageProducts,
        pagination: {
          ...current.pagination,
          currentPage: nextPageIndex,
        },
      };
    }
    return current;
  });
}

export function previousPage(): void {
  updateRecsOutputStore((current) => {
    const prevPageIndex = current.pagination.currentPage - 1;
    if (prevPageIndex >= 0) {
      const startIndex = prevPageIndex * current.pagination.pageSize;
      const endIndex = startIndex + current.pagination.pageSize;
      const newCurrentPageProducts = current.products.slice(startIndex, endIndex);
      
      debugLog('Recs Manager', 'Moving to previous page:', prevPageIndex);
      return {
        ...current,
        currentPageProducts: newCurrentPageProducts,
        pagination: {
          ...current.pagination,
          currentPage: prevPageIndex,
        },
      };
    }
    return current;
  });
}

export function resetRecs(): void {
  debugLog('Recs Manager', 'Resetting to first page');
  updateRecsOutputStore((current) => {
    const newCurrentPageProducts = current.products.slice(0, current.pagination.pageSize);
    return {
      ...current,
      currentPageProducts: newCurrentPageProducts,
      pagination: {
        ...current.pagination,
        currentPage: 0,
      },
    };
  });
}

export function setRecsPageSize(size: number): void {
  if (size <= 0) {
    throw new Error('Page size must be positive');
  }
  debugLog('Recs Manager', 'Setting page size:', size);
  
  updateRecsInputStore((current) => ({
    ...current,
    pageSize: size
  }));
  
  updateRecsOutputStore((current) => {
    const totalPages = Math.ceil(current.pagination.totalRecords / size);
    const newCurrentPageProducts = current.products.slice(0, size);
    
    return {
      ...current,
      currentPageProducts: newCurrentPageProducts,
      pagination: {
        ...current.pagination,
        currentPage: 0,
        pageSize: size,
        totalPages,
      },
    };
  });
}

// Export stores for external access
export { recsInputStore };
export { recsOutputStore };

// Create derived stores for backward compatibility  
export const recsCurrentPageStore = recsOutputStore.map(state => state.currentPageProducts);
export const recsLoadingStore = recsOutputStore.map(state => state.loading);
export const recsErrorStore = recsOutputStore.map(state => state.error);
export const recsRecordsStore = recsOutputStore.map(state => state.products); 