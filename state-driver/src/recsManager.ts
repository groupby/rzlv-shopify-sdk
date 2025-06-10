import { createEffect, sample } from 'effector';
import { requestRecommendations, RequestRecsResponse, AppEnv, RecsProduct } from '../../public-api/src/recommendations-requester/requestRecommendations';
import { debugLog } from './debugLogger';

export interface RecsManagerConfig {
  shopTenant: string;
  appEnv: AppEnv;
  name: string;
  collection: string;
  fields?: string[];
  pageSize: number;
  productID?: string;
  visitorId?: string;
  loginId?: string;
  filters?: Array<{
    field: string;
    value: string;
    exclude: string;
    required: string;
  }>;
  mergeShopifyData?: boolean;
}

export interface RecsManagerState {
  products: RecsProduct[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  rawResponse: any;
}

// Initial state for the RecsManager
const initialState: RecsManagerState = {
  products: [],
  currentPage: 1,
  pageSize: 5, // Default page size
  totalPages: 0,
  loading: false,
  error: null,
  rawResponse: null,
};

// Module-level variables
let recsManagerState = { ...initialState };
let recsManagerConfig: RecsManagerConfig;

export const fetchRecsFx = createEffect(
  async (config: RecsManagerConfig): Promise<RequestRecsResponse> => {
    debugLog('Recs Manager', 'fetchRecsFx triggered with config', config);
    return await requestRecommendations(
      config.shopTenant,
      config.appEnv as AppEnv,
      {
        name: config.name,
        fields: config.fields || ['*'],
        collection: config.collection,
        pageSize: config.pageSize,
        productID: config.productID,
        visitorId: config.visitorId,
        loginId: config.loginId,
        filters: config.filters,
      },
      config.mergeShopifyData !== undefined ? config.mergeShopifyData : true
    );
  }
);

export function updateRecsManagerState(
  updater: (currentState: RecsManagerState) => RecsManagerState
): void {
  recsManagerState = updater(recsManagerState);
  debugLog('Recs Manager', 'State updated', recsManagerState);
}

export function getRecsManagerState(): RecsManagerState {
  return { ...recsManagerState };
}

export function initRecsManager(config: RecsManagerConfig): void {
  // Add a guard so this is only initialized once.
  if ((initRecsManager as any).initialized) {
    return;
  }

  // Validate required configuration fields
  if (!config.shopTenant) {
    throw new Error('Shop tenant is required for RecsManager');
  }

  if (!config.name) {
    throw new Error('Recommendation model name is required for RecsManager');
  }

  if (!config.collection) {
    throw new Error('Collection name is required for RecsManager');
  }

  if (!config.pageSize || config.pageSize <= 0) {
    throw new Error('Page size must be a positive number for RecsManager');
  }

  debugLog('Recs Manager', 'Initializing with config', config);

  recsManagerConfig = config;

  recsManagerState = {
    ...initialState,
    pageSize: config.pageSize || initialState.pageSize,
  };

  fetchRecsFx.pending.watch((isPending) => {
    debugLog('Recs Manager', 'fetchRecsFx pending:', isPending);
    if (isPending) {
      updateRecsManagerState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));
    }
  });

  fetchRecsFx.done.watch(({ result }) => {
    debugLog('Recs Manager', 'fetchRecsFx done:', result);
    updateRecsManagerState((current) => {
      const totalPages = Math.ceil(result.products.length / current.pageSize);

      return {
        ...current,
        products: result.products,
        totalPages,
        loading: false,
        error: null,
        rawResponse: result.rawResponse,
      };
    });
  });

  fetchRecsFx.fail.watch(({ error }) => {
    debugLog('Recs Manager', 'fetchRecsFx error:', error);
    updateRecsManagerState((current) => ({
      ...current,
      loading: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  });

  (initRecsManager as any).initialized = true;

  // Start loading recommendations but don't block initialization
  fetchRecommendations().catch(error => {
    console.error('Failed to load initial recommendations:', error);
  });
}

export async function fetchRecommendations(): Promise<RecsProduct[]> {
  if (!recsManagerConfig) {
    throw new Error('RecsManager is not initialized. Call initRecsManager() first.');
  }

  try {
    const result = await fetchRecsFx(recsManagerConfig);
    return result.products;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}

export function getCurrentPageProducts(): RecsProduct[] {
  const { products, currentPage, pageSize } = recsManagerState;

  if (!products || products.length === 0) {
    return [];
  }

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return products.slice(startIndex, endIndex);
}

export function nextPage(): void {
  if (recsManagerState.products.length === 0) {
    debugLog('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  updateRecsManagerState((current) => {
    const nextPageNum = current.currentPage >= current.totalPages ? 1 : current.currentPage + 1;
    return {
      ...current,
      currentPage: nextPageNum,
    };
  });

  debugLog('Recs Manager', 'Navigated to next page', recsManagerState.currentPage);
}

export function previousPage(): void {
  if (recsManagerState.products.length === 0) {
    debugLog('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  updateRecsManagerState((current) => {
    const prevPageNum = current.currentPage <= 1 ? current.totalPages : current.currentPage - 1;
    return {
      ...current,
      currentPage: prevPageNum,
    };
  });

  debugLog('Recs Manager', 'Navigated to previous page', recsManagerState.currentPage);
}

export function setPageSize(pageSize: number): void {
  if (pageSize <= 0) {
    throw new Error('Page size must be a positive number');
  }

  updateRecsManagerState((current) => {
    const totalPages = Math.ceil(current.products.length / pageSize);
    const adjustedCurrentPage = Math.min(current.currentPage, totalPages || 1);

    return {
      ...current,
      pageSize,
      totalPages,
      currentPage: adjustedCurrentPage,
    };
  });

  debugLog('Recs Manager', 'Page size updated', recsManagerState.pageSize);
}

export function goToPage(pageNumber: number): void {
  if (pageNumber <= 0) {
    throw new Error('Page number must be a positive number');
  }

  if (recsManagerState.products.length === 0) {
    debugLog('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  updateRecsManagerState((current) => {
    const validPageNumber = Math.min(Math.max(1, pageNumber), current.totalPages || 1);

    return {
      ...current,
      currentPage: validPageNumber,
    };
  });

  debugLog('Recs Manager', 'Navigated to page', recsManagerState.currentPage);
}
