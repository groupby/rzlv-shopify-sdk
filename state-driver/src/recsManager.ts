import { createStore, createEvent, createEffect, sample } from 'effector';
import { requestRecommendations, RequestRecsResponse, AppEnv, RecsProduct } from '../../public-api/src/recommendations-requester/requestRecommendations';
import { debugLog } from './debugLogger';
import { ShopifyConfig } from '../../public-api/src/search-requester/fetchStorefrontProducts';

export interface RecsManagerConfig {
  shopTenant: string;
  appEnv: AppEnv;
  name: string;
  collection: string;
  fields?: string[];
  uiPageSize: number; // Client-side pagination page size
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
  maxApiResults?: number; // Maximum results to request from API
  cacheTTL?: number; // Cache time-to-live in milliseconds
  shopifyConfig?: ShopifyConfig;
}

export interface RecsManagerState {
  products: RecsProduct[];
  currentPage: number;
  uiPageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  rawResponse: any;
  lastFetched: number | null;
  cacheKey: string | null;
  // Phase 2: Enhanced pagination state
  totalProducts: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageStartIndex: number;
  pageEndIndex: number;
  isFirstPage: boolean;
  isLastPage: boolean;
}

export interface CacheEntry {
  data: RequestRecsResponse;
  timestamp: number;
  config: RecsManagerConfig;
}

// Cache management
const recsCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_API_RESULTS = 100; // Request up to 100 results from API

// Initial state for the RecsManager
const initialState: RecsManagerState = {
  products: [],
  currentPage: 1,
  uiPageSize: 5, // Default UI page size
  totalPages: 0,
  loading: false,
  error: null,
  rawResponse: null,
  lastFetched: null,
  cacheKey: null,
  // Phase 2: Enhanced pagination state
  totalProducts: 0,
  hasNextPage: false,
  hasPreviousPage: false,
  pageStartIndex: 0,
  pageEndIndex: 0,
  isFirstPage: true,
  isLastPage: true,
};

// Phase 2: Pagination calculation utilities
interface PaginationInfo {
  totalPages: number;
  totalProducts: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageStartIndex: number;
  pageEndIndex: number;
  isFirstPage: boolean;
  isLastPage: boolean;
}

function calculatePaginationInfo(
  currentPage: number,
  uiPageSize: number,
  totalProducts: number
): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(totalProducts / uiPageSize));
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

  const pageStartIndex = (validCurrentPage - 1) * uiPageSize;
  const pageEndIndex = Math.min(pageStartIndex + uiPageSize, totalProducts);

  const isFirstPage = validCurrentPage === 1;
  const isLastPage = validCurrentPage === totalPages;
  const hasNextPage = !isLastPage;
  const hasPreviousPage = !isFirstPage;

  return {
    totalPages,
    totalProducts,
    hasNextPage,
    hasPreviousPage,
    pageStartIndex,
    pageEndIndex,
    isFirstPage,
    isLastPage,
  };
}

// Effector store and events
export type RecsManagerStateUpdater = (state: RecsManagerState) => RecsManagerState;
export const updateRecsManagerState = createEvent<RecsManagerStateUpdater>();
export const recsManagerStore = createStore<RecsManagerState>(initialState)
  .on(updateRecsManagerState, (state, updater) => {
    const newState = updater(state);
    debugLog('Recs Manager Store', 'State updated:', newState);
    return newState;
  });

// Cache management functions
function generateCacheKey(config: RecsManagerConfig): string {
  const keyData = {
    shopTenant: config.shopTenant,
    name: config.name,
    collection: config.collection,
    productID: config.productID,
    visitorId: config.visitorId,
    loginId: config.loginId,
    filters: config.filters,
    fields: config.fields
  };
  return JSON.stringify(keyData);
}

function getCachedData(cacheKey: string, cacheTTL: number): CacheEntry | null {
  const cached = recsCache.get(cacheKey);
  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > cacheTTL;
  if (isExpired) {
    recsCache.delete(cacheKey);
    return null;
  }

  return cached;
}

function setCachedData(cacheKey: string, data: RequestRecsResponse, config: RecsManagerConfig): void {
  recsCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    config
  });

  // Clean up old cache entries (keep only last 10)
  if (recsCache.size > 10) {
    const oldestKey = recsCache.keys().next().value;
    if (oldestKey) {
      recsCache.delete(oldestKey);
    }
  }
}

// API fetch effect with proper caching
export const fetchRecsFx = createEffect(
  async (config: RecsManagerConfig): Promise<RequestRecsResponse> => {
    debugLog('Recs Manager', 'fetchRecsFx triggered with config', config);

    const cacheKey = generateCacheKey(config);
    const cacheTTL = config.cacheTTL || DEFAULT_CACHE_TTL;

    // Check cache first
    const cached = getCachedData(cacheKey, cacheTTL);
    if (cached) {
      debugLog('Recs Manager', 'Returning cached data', cached.data);
      return cached.data;
    }

    // Request ALL results from API (not paginated)
    const maxResults = config.maxApiResults || DEFAULT_MAX_API_RESULTS;
    const apiResponse = await requestRecommendations(
      config.shopTenant,
      config.appEnv as AppEnv,
      {
        name: config.name,
        fields: config.fields || ['*'],
        collection: config.collection,
        pageSize: maxResults, // Request maximum results
        productID: config.productID,
        visitorId: config.visitorId,
        loginId: config.loginId,
        filters: config.filters,
      },
      config.mergeShopifyData !== undefined ? config.mergeShopifyData : true,
      config.shopifyConfig
    );

    // Cache the response
    setCachedData(cacheKey, apiResponse, config);

    return apiResponse;
  }
);

// Multi-instance support
const recsManagerInstances = new Map<string, RecsManagerConfig>();

function validateConfig(config: RecsManagerConfig): void {
  if (!config.shopTenant) {
    throw new Error('Shop tenant is required for RecsManager');
  }

  if (!config.name) {
    throw new Error('Recommendation model name is required for RecsManager');
  }

  if (!config.collection) {
    throw new Error('Collection name is required for RecsManager');
  }

  if (!config.uiPageSize || config.uiPageSize <= 0) {
    throw new Error('UI page size must be a positive number for RecsManager');
  }

  if (config.maxApiResults && config.maxApiResults <= 0) {
    throw new Error('Max API results must be a positive number if specified');
  }

  if (config.cacheTTL && config.cacheTTL < 0) {
    throw new Error('Cache TTL must be non-negative if specified');
  }
}

export function initRecsManager(config: RecsManagerConfig, instanceId: string = 'default'): void {
  debugLog('Recs Manager', 'Initializing with config', { config, instanceId });

  validateConfig(config);

  // Store instance configuration
  recsManagerInstances.set(instanceId, config);

  const cacheKey = generateCacheKey(config);

  // Initialize store state for this instance
  updateRecsManagerState((current) => ({
    ...initialState,
    uiPageSize: config.uiPageSize,
    cacheKey,
  }));

  // Set up effect watchers (these are global but handle multiple instances)
  if (!fetchRecsFx.pending.getState) {
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

    fetchRecsFx.done.watch(({ result, params }) => {
      debugLog('Recs Manager', 'fetchRecsFx done:', result);
      const resultCacheKey = generateCacheKey(params);

      updateRecsManagerState((current) => {
        // Only update if this result is for the current instance
        if (current.cacheKey !== resultCacheKey) {
          return current;
        }

        // Phase 2: Enhanced pagination calculation
        const paginationInfo = calculatePaginationInfo(
          current.currentPage,
          current.uiPageSize,
          result.products.length
        );

        return {
          ...current,
          products: result.products,
          loading: false,
          error: null,
          rawResponse: result.rawResponse,
          lastFetched: Date.now(),
          // Update all pagination fields
          ...paginationInfo,
        };
      });
    });

    fetchRecsFx.fail.watch(({ error, params }) => {
      debugLog('Recs Manager', 'fetchRecsFx error:', error);
      const errorCacheKey = generateCacheKey(params);

      updateRecsManagerState((current) => {
        // Only update if this error is for the current instance
        if (current.cacheKey !== errorCacheKey) {
          return current;
        }

        return {
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        };
      });
    });
  }

  // Start loading recommendations
  fetchRecommendations(instanceId).catch(error => {
    console.error('Failed to load initial recommendations:', error);
  });
}

export async function fetchRecommendations(instanceId: string = 'default'): Promise<RecsProduct[]> {
  const config = recsManagerInstances.get(instanceId);
  if (!config) {
    throw new Error(`RecsManager instance '${instanceId}' is not initialized. Call initRecsManager() first.`);
  }

  try {
    const result = await fetchRecsFx(config);
    return result.products;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}

export function getCurrentPageProducts(instanceId: string = 'default'): RecsProduct[] {
  const state = recsManagerStore.getState();

  if (!state.products || state.products.length === 0) {
    debugLog('Recs Manager', 'getCurrentPageProducts: No products available');
    return [];
  }

  // Phase 2: Use calculated pagination indices for better accuracy
  const products = state.products.slice(state.pageStartIndex, state.pageEndIndex);

  debugLog('Recs Manager', 'getCurrentPageProducts:', {
    currentPage: state.currentPage,
    pageSize: state.uiPageSize,
    startIndex: state.pageStartIndex,
    endIndex: state.pageEndIndex,
    productsReturned: products.length,
    totalProducts: state.totalProducts
  });

  return products;
}

export function getRecsManagerState(): RecsManagerState {
  return recsManagerStore.getState();
}

export function nextPage(): void {
  const state = recsManagerStore.getState();

  if (state.totalProducts === 0) {
    debugLog('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  updateRecsManagerState((current) => {
    // Phase 2: Enhanced wraparound logic with better state management
    const nextPageNum = current.isLastPage ? 1 : current.currentPage + 1;
    const paginationInfo = calculatePaginationInfo(
      nextPageNum,
      current.uiPageSize,
      current.totalProducts
    );

    debugLog('Recs Manager', 'nextPage navigation:', {
      from: current.currentPage,
      to: nextPageNum,
      isWraparound: current.isLastPage,
      totalPages: paginationInfo.totalPages
    });

    return {
      ...current,
      currentPage: nextPageNum,
      ...paginationInfo,
    };
  });

  debugLog('Recs Manager', 'Navigated to next page', recsManagerStore.getState().currentPage);
}

export function previousPage(): void {
  const state = recsManagerStore.getState();

  if (state.totalProducts === 0) {
    debugLog('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  updateRecsManagerState((current) => {
    // Phase 2: Enhanced wraparound logic with better state management
    const prevPageNum = current.isFirstPage ? current.totalPages : current.currentPage - 1;
    const paginationInfo = calculatePaginationInfo(
      prevPageNum,
      current.uiPageSize,
      current.totalProducts
    );

    debugLog('Recs Manager', 'previousPage navigation:', {
      from: current.currentPage,
      to: prevPageNum,
      isWraparound: current.isFirstPage,
      totalPages: paginationInfo.totalPages
    });

    return {
      ...current,
      currentPage: prevPageNum,
      ...paginationInfo,
    };
  });

  debugLog('Recs Manager', 'Navigated to previous page', recsManagerStore.getState().currentPage);
}

export function setPageSize(pageSize: number): void {
  if (pageSize <= 0) {
    throw new Error('Page size must be a positive number');
  }

  updateRecsManagerState((current) => {
    // Phase 2: Enhanced page size change with position preservation
    const currentProductIndex = (current.currentPage - 1) * current.uiPageSize;
    const newPageForCurrentPosition = Math.floor(currentProductIndex / pageSize) + 1;

    const paginationInfo = calculatePaginationInfo(
      newPageForCurrentPosition,
      pageSize,
      current.totalProducts
    );

    debugLog('Recs Manager', 'setPageSize:', {
      oldPageSize: current.uiPageSize,
      newPageSize: pageSize,
      oldPage: current.currentPage,
      newPage: newPageForCurrentPosition,
      currentProductIndex,
      totalProducts: current.totalProducts
    });

    return {
      ...current,
      uiPageSize: pageSize,
      currentPage: newPageForCurrentPosition,
      ...paginationInfo,
    };
  });

  debugLog('Recs Manager', 'Page size updated', recsManagerStore.getState().uiPageSize);
}

export function goToPage(pageNumber: number): void {
  if (pageNumber <= 0) {
    throw new Error('Page number must be a positive number');
  }

  const state = recsManagerStore.getState();
  if (state.totalProducts === 0) {
    debugLog('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  updateRecsManagerState((current) => {
    // Phase 2: Enhanced page validation and state calculation
    const validPageNumber = Math.min(Math.max(1, pageNumber), current.totalPages || 1);
    const paginationInfo = calculatePaginationInfo(
      validPageNumber,
      current.uiPageSize,
      current.totalProducts
    );

    debugLog('Recs Manager', 'goToPage:', {
      requestedPage: pageNumber,
      validPage: validPageNumber,
      totalPages: current.totalPages,
      totalProducts: current.totalProducts
    });

    return {
      ...current,
      currentPage: validPageNumber,
      ...paginationInfo,
    };
  });

  debugLog('Recs Manager', 'Navigated to page', recsManagerStore.getState().currentPage);
}

// Cache management utilities
export function clearRecsCache(): void {
  recsCache.clear();
  debugLog('Recs Manager', 'Cache cleared');
}

export function refreshRecommendations(instanceId: string = 'default'): Promise<RecsProduct[]> {
  const config = recsManagerInstances.get(instanceId);
  if (!config) {
    throw new Error(`RecsManager instance '${instanceId}' is not initialized.`);
  }

  // Clear cache for this instance
  const cacheKey = generateCacheKey(config);
  recsCache.delete(cacheKey);

  // Fetch fresh data
  return fetchRecommendations(instanceId);
}

export function getInstanceConfig(instanceId: string = 'default'): RecsManagerConfig | undefined {
  return recsManagerInstances.get(instanceId);
}

export function getAllInstances(): string[] {
  return Array.from(recsManagerInstances.keys());
}

// Phase 2: Advanced pagination functions

export function getPageInfo(): {
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
  pageStartIndex: number;
  pageEndIndex: number;
  productsOnCurrentPage: number;
} {
  const state = recsManagerStore.getState();
  return {
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    totalProducts: state.totalProducts,
    pageSize: state.uiPageSize,
    hasNextPage: state.hasNextPage,
    hasPreviousPage: state.hasPreviousPage,
    isFirstPage: state.isFirstPage,
    isLastPage: state.isLastPage,
    pageStartIndex: state.pageStartIndex,
    pageEndIndex: state.pageEndIndex,
    productsOnCurrentPage: state.pageEndIndex - state.pageStartIndex,
  };
}

export function getPageProducts(pageNumber: number): RecsProduct[] {
  const state = recsManagerStore.getState();

  if (!state.products || state.products.length === 0) {
    return [];
  }

  if (pageNumber < 1 || pageNumber > state.totalPages) {
    debugLog('Recs Manager', 'getPageProducts: Invalid page number', pageNumber);
    return [];
  }

  const startIndex = (pageNumber - 1) * state.uiPageSize;
  const endIndex = Math.min(startIndex + state.uiPageSize, state.totalProducts);

  return state.products.slice(startIndex, endIndex);
}

export function getAllProducts(): RecsProduct[] {
  const state = recsManagerStore.getState();
  return [...(state.products || [])];
}

export function getProductsInRange(startIndex: number, endIndex: number): RecsProduct[] {
  const state = recsManagerStore.getState();

  if (!state.products || state.products.length === 0) {
    return [];
  }

  const validStartIndex = Math.max(0, Math.min(startIndex, state.totalProducts - 1));
  const validEndIndex = Math.max(validStartIndex, Math.min(endIndex, state.totalProducts));

  return state.products.slice(validStartIndex, validEndIndex);
}

export function jumpToFirstPage(): void {
  goToPage(1);
}

export function jumpToLastPage(): void {
  const state = recsManagerStore.getState();
  goToPage(state.totalPages);
}

export function canNavigateNext(): boolean {
  const state = recsManagerStore.getState();
  return state.hasNextPage;
}

export function canNavigatePrevious(): boolean {
  const state = recsManagerStore.getState();
  return state.hasPreviousPage;
}

export function getPageRange(currentPage?: number): { start: number; end: number } {
  const state = recsManagerStore.getState();
  const page = currentPage || state.currentPage;

  const startIndex = (page - 1) * state.uiPageSize;
  const endIndex = Math.min(startIndex + state.uiPageSize, state.totalProducts);

  return { start: startIndex, end: endIndex };
}

export function validatePageNumber(pageNumber: number): boolean {
  const state = recsManagerStore.getState();
  return pageNumber >= 1 && pageNumber <= state.totalPages;
}
