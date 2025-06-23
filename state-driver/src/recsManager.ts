import { createStore, createEvent, createEffect, sample } from 'effector';
import { requestRecommendations, RequestRecsResponse, AppEnv, RecsProduct } from '../../public-api/src/recommendations-requester/requestRecommendations';
import { debugLog, sdkConfig } from './debugLogger';
import { ShopifyConfig } from '../../public-api/src/search-requester/fetchStorefrontProducts';

// Custom error classes for better error handling
export class RecsManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecsManagerError';
  }
}

export class RecsConfigError extends RecsManagerError {
  constructor(message: string) {
    super(message);
    this.name = 'RecsConfigError';
  }
}

export class RecsInstanceError extends RecsManagerError {
  constructor(message: string) {
    super(message);
    this.name = 'RecsInstanceError';
  }
}

export class RecsFetchError extends RecsManagerError {
  constructor(message: string) {
    super(message);
    this.name = 'RecsFetchError';
  }
}

export interface RecsManagerConfig {
  shopTenant: string;
  appEnv: AppEnv;
  name: string;
  collection: string;
  fields?: string[];
  uiPageSize: number;
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
  maxApiResults?: number;
  cacheTTL?: number;
  shopifyConfig?: ShopifyConfig;
  debug?: boolean;
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
  expiresAt: number;
}

// Cache management
const recsCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_API_RESULTS = 100;
const MAX_CACHE_SIZE = 20; // Maximum number of entries in cache

// Initial state for the RecsManager
const initialState: RecsManagerState = {
  products: [],
  currentPage: 1,
  uiPageSize: 5,
  totalPages: 0,
  loading: false,
  error: null,
  rawResponse: null,
  lastFetched: null,
  cacheKey: null,
  totalProducts: 0,
  hasNextPage: false,
  hasPreviousPage: false,
  pageStartIndex: 0,
  pageEndIndex: 0,
  isFirstPage: true,
  isLastPage: true,
};

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
    const hasDebugInstance = Array.from(recsManagerInstances.values()).some(instance => instance.config?.debug);
    if (hasDebugInstance) {
      debugLog('Recs Manager Store', 'State updated:', newState);
    }
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

  const now = Date.now();
  if (now >= cached.expiresAt) {
    recsCache.delete(cacheKey);
    return null;
  }

  return cached;
}

/**
 * Cleans up expired cache entries
 * @param debug Whether to log debug information
 */
function cleanupExpiredCache(debug: boolean = false): void {
  const log = logger(debug);
  const now = Date.now();
  let expiredCount = 0;
  
  recsCache.forEach((entry, key) => {
    if (now >= entry.expiresAt) {
      recsCache.delete(key);
      expiredCount++;
    }
  });
  
  if (expiredCount > 0) {
    log('Recs Manager', `Cache cleanup: removed ${expiredCount} expired entries. Remaining: ${recsCache.size}`);
  }
}

function setCachedData(cacheKey: string, data: RequestRecsResponse, config: RecsManagerConfig): void {
  const now = Date.now();
  const cacheTTL = config.cacheTTL || DEFAULT_CACHE_TTL;
  
  recsCache.set(cacheKey, {
    data,
    timestamp: now,
    expiresAt: now + cacheTTL,
    config
  });

  // If cache exceeds max size, remove oldest entries
  if (recsCache.size > MAX_CACHE_SIZE) {
    // Sort entries by timestamp (oldest first)
    const entries = Array.from(recsCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries until we're back to the limit
    const entriesToRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    entriesToRemove.forEach(([key]) => recsCache.delete(key));
    
    const log = logger(config.debug || false);
    log('Recs Manager', `Cache size limit reached. Removed ${entriesToRemove.length} oldest entries. Current size: ${recsCache.size}`);
  }
  
  // Periodically clean up expired entries
  cleanupExpiredCache(config.debug || false);
}

const logger = (log: boolean) => (...params: Parameters<typeof debugLog>) => {
  if (log) {
    debugLog(...params);
  }
}

// API fetch effect with proper caching
export const fetchRecsFx = createEffect(
  async (config: RecsManagerConfig): Promise<RequestRecsResponse> => {
    const log = logger(config.debug || false);
    log('Recs Manager', 'fetchRecsFx triggered with config', config);

    const cacheKey = generateCacheKey(config);
    const cacheTTL = config.cacheTTL || DEFAULT_CACHE_TTL;

    const cached = getCachedData(cacheKey, cacheTTL);
    if (cached) {
      log('Recs Manager', 'Returning cached data', cached.data);
      return cached.data;
    }

    const maxResults = config.maxApiResults || DEFAULT_MAX_API_RESULTS;
    const apiResponse = await requestRecommendations(
      config.shopTenant,
      config.appEnv as AppEnv,
      {
        name: config.name,
        fields: config.fields || ['*'],
        collection: config.collection,
        pageSize: maxResults,
        productID: config.productID,
        visitorId: config.visitorId,
        loginId: config.loginId,
        filters: config.filters,
      },
      config.mergeShopifyData !== undefined ? config.mergeShopifyData : true,
      config.shopifyConfig
    );

    setCachedData(cacheKey, apiResponse, config);

    return apiResponse;
  }
);

// Multi-instance support
interface RecsManagerInstance {
  config: RecsManagerConfig;
  initialized: boolean;
  cacheKey: string;
  lastUsed: number;
  watchersInitialized: boolean;
}

const recsManagerInstances = new Map<string, RecsManagerInstance>();

function validateConfig(config: RecsManagerConfig): void {
  if (!config.shopTenant) {
    throw new RecsConfigError('Shop tenant is required for RecsManager');
  }

  if (!config.name) {
    throw new RecsConfigError('Recommendation model name is required for RecsManager');
  }

  if (!config.collection) {
    throw new RecsConfigError('Collection name is required for RecsManager');
  }

  if (!config.uiPageSize || config.uiPageSize <= 0) {
    throw new RecsConfigError('UI page size must be a positive number for RecsManager');
  }

  if (config.maxApiResults && config.maxApiResults <= 0) {
    throw new RecsConfigError('Max API results must be a positive number if specified');
  }

  if (config.cacheTTL && config.cacheTTL < 0) {
    throw new RecsConfigError('Cache TTL must be non-negative if specified');
  }
}

// Set up periodic cache cleanup
let cacheCleanupInterval: number | null = null;

/**
 * Initializes the RecsManager with the given configuration
 * @param config Configuration for the RecsManager
 * @param instanceId Optional instance ID for multi-instance support
 */
/**
 * Checks if a RecsManager instance exists
 * @param instanceId The instance ID to check
 * @returns True if the instance exists, false otherwise
 */
export function hasRecsManagerInstance(instanceId: string = 'default'): boolean {
  return recsManagerInstances.has(instanceId);
}

/**
 * Gets information about all RecsManager instances
 * @returns Array of instance IDs and their status
 */
export function getRecsManagerInstances(): Array<{ id: string; initialized: boolean; lastUsed: number }> {
  return Array.from(recsManagerInstances.entries()).map(([id, instance]) => ({
    id,
    initialized: instance.initialized,
    lastUsed: instance.lastUsed
  }));
}

/**
 * Initializes the RecsManager with the given configuration
 * @param config Configuration for the RecsManager
 * @param instanceId Optional instance ID for multi-instance support
 * @returns The instance ID
 */
export function initRecsManager(
  config: RecsManagerConfig, 
  instanceId: string = 'default',
): string {
  const log = logger(config.debug || false);
  log('Recs Manager', 'Initializing with config', { config, instanceId });

  validateConfig(config);
  
  const cacheKey = generateCacheKey(config);
  
  // Check if instance already exists
  if (recsManagerInstances.has(instanceId)) {
    const existingInstance = recsManagerInstances.get(instanceId)!;
    log('Recs Manager', `Instance '${instanceId}' already exists. Updating configuration.`);
    
    // Update the existing instance
    existingInstance.config = config;
    existingInstance.cacheKey = cacheKey;
    existingInstance.lastUsed = Date.now();
    
    recsManagerInstances.set(instanceId, existingInstance);
  } else {
    // Create a new instance
    recsManagerInstances.set(instanceId, {
      config,
      initialized: false,
      cacheKey,
      lastUsed: Date.now(),
      watchersInitialized: false
    });
  }

  updateRecsManagerState((current) => ({
    ...initialState,
    uiPageSize: config.uiPageSize,
    cacheKey,
  }));

  // Setup watchers for fetch effects if not already done
  if (typeof fetchRecsFx.pending.getState === 'function' && !fetchRecsFx.pending.getState()) {
    fetchRecsFx.pending.watch((isPending) => {
      log('Recs Manager', 'fetchRecsFx pending:', isPending);
      if (isPending) {
        updateRecsManagerState((current) => ({
          ...current,
          loading: true,
          error: null,
        }));
      }
    });

    fetchRecsFx.done.watch(({ result, params }) => {
      log('Recs Manager', 'fetchRecsFx done:', result);
      const resultCacheKey = generateCacheKey(params);

      updateRecsManagerState((current) => {
        if (current.cacheKey !== resultCacheKey) {
          return current;
        }

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
          ...paginationInfo,
        };
      });
    });

    fetchRecsFx.fail.watch(({ error, params }) => {
      log('Recs Manager', 'fetchRecsFx error:', error);
      const errorCacheKey = generateCacheKey(params);

      updateRecsManagerState((current) => {
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

  // Mark instance as initialized
  const instance = recsManagerInstances.get(instanceId)!;
  instance.initialized = true;
  instance.lastUsed = Date.now();
  
  // Setup watchers
  setupGlobalWatchers();
  setupWatchers(instanceId);
  
  fetchRecommendations(instanceId).catch(error => {
    const log = logger(config.debug || false);
    log('Recs Manager', 'Failed to load initial recommendations:', error);
    // Error state is already handled in fetchRecommendations
  });
  
  return instanceId;
}

/**
 * Validates that an instance exists and is initialized
 * @param instanceId The instance ID to validate
 * @returns The instance configuration
 * @throws RecsInstanceError if the instance doesn't exist or isn't initialized
 */
function validateInstance(instanceId: string): RecsManagerConfig {
  const instance = recsManagerInstances.get(instanceId);
  
  if (!instance) {
    throw new RecsInstanceError(`RecsManager instance '${instanceId}' does not exist. Call initRecsManager() first.`);
  }
  
  if (!instance.initialized) {
    throw new RecsInstanceError(`RecsManager instance '${instanceId}' exists but is not fully initialized.`);
  }
  
  // Update last used timestamp
  instance.lastUsed = Date.now();
  
  return instance.config;
}

/**
 * Fetches recommendations using the specified instance
 * @param instanceId The instance ID to use
 * @returns Promise resolving to an array of recommendation products
 */
export async function fetchRecommendations(instanceId: string = 'default'): Promise<RecsProduct[]> {
  const config = validateInstance(instanceId);

  try {
    const result = await fetchRecsFx(config);
    return result.products;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const recsFetchError = new RecsFetchError(`Failed to fetch recommendations: ${errorMessage}`);
    
    // Update store with error state
    updateRecsManagerState((current) => ({
      ...current,
      loading: false,
      error: recsFetchError.message,
    }));
    
    // Re-throw as a RecsFetchError for better error handling
    throw recsFetchError;
  }
}

/**
 * Gets the products for the current page
 * @param instanceId The instance ID to use
 * @returns Array of products for the current page
 */
export function getCurrentPageProducts(instanceId: string = 'default'): RecsProduct[] {
  const config = validateInstance(instanceId);
  const log = logger(config.debug || false);
  const state = recsManagerStore.getState();
  
  if (!state.products || state.products.length === 0) {
    log('Recs Manager', 'getCurrentPageProducts: No products available');
    return [];
  }

  log('Recs Manager', 'getCurrentPageProducts:', {
    currentPage: state.currentPage,
    uiPageSize: state.uiPageSize,
    totalProducts: state.products.length,
  });

  const startIndex = (state.currentPage - 1) * state.uiPageSize;
  const endIndex = startIndex + state.uiPageSize;
  return state.products.slice(startIndex, endIndex);
}

export function getRecsManagerState(): RecsManagerState {
  return recsManagerStore.getState();
}

/**
 * Navigates to the next page of recommendations
 * @param instanceId The instance ID to use
 */
export function nextPage(instanceId: string = 'default'): void {
  const config = validateInstance(instanceId);
  const log = logger(config.debug || false);
  const state = recsManagerStore.getState();
  
  if (!state.products || state.products.length === 0) {
    log('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  const totalPages = Math.ceil(state.products.length / state.uiPageSize);
  let newPage: number;
  
  if (state.currentPage >= totalPages) {
    newPage = 1;
  } else {
    newPage = state.currentPage + 1;
  }

  log('Recs Manager', 'nextPage navigation:', {
    currentPage: state.currentPage,
    newPage,
    totalPages,
    totalProducts: state.products.length,
  });

  updateRecsManagerState((current) => ({
    ...current,
    currentPage: newPage,
  }));

  log('Recs Manager', 'Navigated to next page', recsManagerStore.getState().currentPage);
}

/**
 * Navigates to the previous page of recommendations
 * @param instanceId The instance ID to use
 */
export function previousPage(instanceId: string = 'default'): void {
  const config = validateInstance(instanceId);
  const log = logger(config.debug || false);
  const state = recsManagerStore.getState();
  
  if (!state.products || state.products.length === 0) {
    log('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  const totalPages = Math.ceil(state.products.length / state.uiPageSize);
  let newPage: number;
  
  if (state.currentPage <= 1) {
    newPage = totalPages;
  } else {
    newPage = state.currentPage - 1;
  }

  log('Recs Manager', 'previousPage navigation:', {
    currentPage: state.currentPage,
    newPage,
    totalPages,
    totalProducts: state.products.length,
  });

  updateRecsManagerState((current) => ({
    ...current,
    currentPage: newPage,
  }));

  log('Recs Manager', 'Navigated to previous page', recsManagerStore.getState().currentPage);
}

/**
 * Sets the page size for recommendations
 * @param newPageSize The new page size
 * @param instanceId The instance ID to use
 */
export function setPageSize(newPageSize: number, instanceId: string = 'default'): void {
  const config = validateInstance(instanceId);
  const log = logger(config.debug || false);
  
  if (newPageSize <= 0) {
    throw new RecsConfigError('Page size must be a positive number');
  }

  log('Recs Manager', 'setPageSize:', {
    oldPageSize: recsManagerStore.getState().uiPageSize,
    newPageSize,
  });

  updateRecsManagerState((current) => ({
    ...current,
    uiPageSize: newPageSize,
    currentPage: 1,
  }));

  log('Recs Manager', 'Page size updated', recsManagerStore.getState().uiPageSize);
}

/**
 * Navigates to a specific page of recommendations
 * @param pageNumber The page number to navigate to
 * @param instanceId The instance ID to use
 */
export function goToPage(pageNumber: number, instanceId: string = 'default'): void {
  const config = validateInstance(instanceId);
  const log = logger(config.debug || false);
  const state = recsManagerStore.getState();
  
  if (!state.products || state.products.length === 0) {
    log('Recs Manager', 'Cannot navigate: no products loaded');
    return;
  }

  const totalPages = Math.ceil(state.products.length / state.uiPageSize);
  
  if (pageNumber < 1 || pageNumber > totalPages) {
    return;
  }

  log('Recs Manager', 'goToPage:', {
    currentPage: state.currentPage,
    targetPage: pageNumber,
    totalPages,
  });

  updateRecsManagerState((current) => ({
    ...current,
    currentPage: pageNumber,
  }));

  log('Recs Manager', 'Navigated to page', recsManagerStore.getState().currentPage);
}

/**
 * Clears the entire recommendations cache
 * @param instanceId The instance ID to use for debug settings
 */
export function clearCache(instanceId: string = 'default'): void {
  // Don't validate instance here, just get it if it exists
  const instance = recsManagerInstances.get(instanceId);
  const log = logger(instance?.config.debug || false);
  
  const cacheSize = recsCache.size;
  recsCache.clear();
  
  log('Recs Manager', `Cache cleared. Removed ${cacheSize} entries`);
}

/**
 * Removes expired entries from the cache
 * @param instanceId The instance ID to use for debug settings
 * @returns Number of expired entries removed
 */
export function cleanCache(instanceId: string = 'default'): number {
  // Don't validate instance here, just get it if it exists
  const instance = recsManagerInstances.get(instanceId);
  const log = logger(instance?.config.debug || false);
  
  const now = Date.now();
  let expiredCount = 0;
  
  recsCache.forEach((entry, key) => {
    if (now >= entry.expiresAt) {
      recsCache.delete(key);
      expiredCount++;
    }
  });
  
  log('Recs Manager', `Cache cleanup: removed ${expiredCount} expired entries. Remaining: ${recsCache.size}`);
  return expiredCount;
}

/**
 * Refreshes recommendations by clearing cache and fetching new data
 * @param instanceId The instance ID to use
 * @returns Promise resolving to an array of recommendation products
 */
export function refreshRecommendations(instanceId: string = 'default'): Promise<RecsProduct[]> {
  const config = validateInstance(instanceId);

  const cacheKey = generateCacheKey(config);
  recsCache.delete(cacheKey);

  return fetchRecommendations(instanceId);
}

/**
 * Destroys a RecsManager instance and cleans up resources
 * @param instanceId The instance ID to destroy
 * @returns True if the instance was destroyed, false if it didn't exist
 */
export function destroyRecsManager(instanceId: string = 'default'): boolean {
  if (!recsManagerInstances.has(instanceId)) {
    return false;
  }

  const instance = recsManagerInstances.get(instanceId)!;
  const log = logger(instance.config.debug || false);
  
  log('Recs Manager', `Destroying instance '${instanceId}'`);
  recsManagerInstances.delete(instanceId);

  // If this was the last instance, reset the store
  if (recsManagerInstances.size === 0) {
    updateRecsManagerState(() => initialState);
    log('Recs Manager', 'Last instance destroyed, reset store to initial state');
  }
  
  return true;
}

/**
 * Gets the configuration for a RecsManager instance
 * @param instanceId The instance ID to get the configuration for
 * @returns The configuration for the instance, or undefined if it doesn't exist
 */
export function getInstanceConfig(instanceId: string = 'default'): RecsManagerConfig | undefined {
  const instance = recsManagerInstances.get(instanceId);
  return instance?.config;
}

/**
 * Gets all instance IDs
 * @returns An array of instance IDs
 */
export function getAllInstances(): string[] {
  return Array.from(recsManagerInstances.keys());
}

/**
 * Sets up global watchers that are shared across all instances
 */
let globalWatchersInitialized = false;

function setupGlobalWatchers(): void {
  if (globalWatchersInitialized) return;
  
  // Watch for URL changes if in browser environment
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const page = parseInt(urlParams.get('page') || '1', 10);
      
      if (page !== recsManagerStore.getState().currentPage) {
        updateRecsManagerState(state => ({ ...state, currentPage: page }));
      }
    });
  }
  
  globalWatchersInitialized = true;
}

/**
 * Sets up watchers for a RecsManager instance
 * @param instanceId The instance ID to set up watchers for
 */
function setupWatchers(instanceId: string): void {
  const instance = recsManagerInstances.get(instanceId);
  if (!instance || instance.watchersInitialized) {
    return;
  }
  
  const log = logger(instance.config.debug || false);
  log('Recs Manager', `Setting up watchers for instance '${instanceId}'`);
  
  // Set up watchers for pagination
  recsManagerStore.watch(state => {
    const { currentPage, uiPageSize } = state;
    updateRecsManagerState(current => ({
      ...current,
      startIndex: (currentPage - 1) * uiPageSize,
      endIndex: currentPage * uiPageSize - 1
    }));
  });
  
  // Mark watchers as initialized
  instance.watchersInitialized = true;
  log('Recs Manager', `Watchers initialized for instance '${instanceId}'`);
}

// Advanced pagination functions

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

export function getPageProducts(pageNumber: number, pageSize: number, products: RecsProduct[]): RecsProduct[] {
  const hasDebugInstance = Array.from(recsManagerInstances.values()).some(instance => instance.config.debug);
  
  if (pageNumber < 1) {
    if (hasDebugInstance) {
      debugLog('Recs Manager', 'getPageProducts: Invalid page number', pageNumber);
    }
    return [];
  }

  const startIndex = (pageNumber - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return products.slice(startIndex, endIndex);
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
