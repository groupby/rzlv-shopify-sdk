import { createStore, createEvent, createEffect } from 'effector';
import { requestRecommendations, RequestRecsResponse, RecsProduct } from '@rzlv/public-api-sdk';
import { RecsManagerConfig } from '@rzlv/public-api-sdk';
import { debugLog } from './debugLogger';

let recsManagerConfig: RecsManagerConfig;

export const recordsStore = createStore<RecsProduct[]>([]);
export const currentPageStore = createStore<RecsProduct[]>([]);
export const loadingStore = createStore<boolean>(false);
export const errorStore = createStore<string | null>(null);
export const pageIndexStore = createStore<number>(0);
export const pageSizeStore = createStore<number>(10);
export const totalPagesStore = createStore<number>(0);

const updatePageIndex = createEvent<number>();
const updatePageSize = createEvent<number>();
const updateRecords = createEvent<RecsProduct[]>();
const updateCurrentPage = createEvent<RecsProduct[]>();
const updateLoading = createEvent<boolean>();
const updateError = createEvent<string | null>();
const updateTotalPages = createEvent<number>();

recordsStore.on(updateRecords, (_, records) => records);
currentPageStore.on(updateCurrentPage, (_, products) => products);
loadingStore.on(updateLoading, (_, loading) => loading);
errorStore.on(updateError, (_, error) => error);
pageIndexStore.on(updatePageIndex, (_, index) => index);
pageSizeStore.on(updatePageSize, (_, size) => size);
totalPagesStore.on(updateTotalPages, (_, total) => total);

export const fetchRecsFx = createEffect(
  async (config: RecsManagerConfig): Promise<RequestRecsResponse> => {
    debugLog('Recs Manager', 'fetchRecsFx triggered with config', config);
    
    return await requestRecommendations(
      config.shopTenant,
      config.appEnv,
      {
        name: config.name,
        fields: config.fields || ['*'],
        collection: config.collection,
        pageSize: 100,
        productID: config.productID,
        visitorId: config.visitorId,
        loginId: config.loginId,
        filters: config.filters,
        eventType: config.eventType,
      }
    );
  }
);

function updateCurrentPageProducts() {
  const records = recordsStore.getState();
  const pageIndex = pageIndexStore.getState();
  const pageSize = pageSizeStore.getState();
  
  const startIndex = pageIndex * pageSize;
  const endIndex = startIndex + pageSize;
  const currentProducts = records.slice(startIndex, endIndex);
  
  updateCurrentPage(currentProducts);
  
  const totalPages = Math.ceil(records.length / pageSize);
  updateTotalPages(totalPages);
}

recordsStore.watch(updateCurrentPageProducts);
pageIndexStore.watch(updateCurrentPageProducts);
pageSizeStore.watch(() => {
  updatePageIndex(0);
  updateCurrentPageProducts();
});

export function initRecsManager(config: RecsManagerConfig): void {
  if ((initRecsManager as any).initialized) {
    debugLog('Recs Manager', 'Already initialized, skipping');
    return;
  }
  
  debugLog('Recs Manager', 'Initializing with config', config);
  recsManagerConfig = config;
  
  updatePageSize(config.pageSize);
  
  fetchRecsFx.pending.watch((isPending) => {
    debugLog('Recs Manager', 'fetchRecsFx pending:', isPending);
    updateLoading(isPending);
    if (isPending) {
      updateError(null);
    }
  });
  
  fetchRecsFx.done.watch(({ result }) => {
    debugLog('Recs Manager', 'fetchRecsFx done, received products:', result.products.length);
    updateRecords(result.products);
    updatePageIndex(0);
  });
  
  fetchRecsFx.fail.watch(({ error }) => {
    debugLog('Recs Manager', 'fetchRecsFx error:', error);
    updateError(error instanceof Error ? error.message : String(error));
  });
  
  fetchRecommendations();
  
  (initRecsManager as any).initialized = true;
}

export function fetchRecommendations(): void {
  if (!recsManagerConfig) {
    throw new Error('RecsManager not initialized. Call initRecsManager() first.');
  }
  fetchRecsFx(recsManagerConfig);
}

export function nextPage(): void {
  const currentIndex = pageIndexStore.getState();
  const totalPages = totalPagesStore.getState();
  const nextIndex = currentIndex + 1;
  
  if (nextIndex < totalPages) {
    debugLog('Recs Manager', 'Moving to next page:', nextIndex);
    updatePageIndex(nextIndex);
  }
}

export function previousPage(): void {
  const currentIndex = pageIndexStore.getState();
  const prevIndex = currentIndex - 1;
  
  if (prevIndex >= 0) {
    debugLog('Recs Manager', 'Moving to previous page:', prevIndex);
    updatePageIndex(prevIndex);
  }
}

export function reset(): void {
  debugLog('Recs Manager', 'Resetting to first page');
  updatePageIndex(0);
}

export function setPageSize(size: number): void {
  if (size <= 0) {
    throw new Error('Page size must be positive');
  }
  debugLog('Recs Manager', 'Setting page size:', size);
  updatePageSize(size);
} 