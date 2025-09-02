# State Driver Layer - Development Instructions

## Overview

The State Driver provides reactive state management for the Shopify SDK using Effector. This layer manages application state, coordinates API calls, handles URL synchronization, and provides framework-agnostic UI interaction functions.

## Core Architecture

### Manager-Store-UI Function Pattern
```
UI Functions → Input Stores → Managers → API Calls → Output Stores → UI Updates
```

The State Driver follows a strict data flow:
1. **UI Functions** update **Input Stores** via updater functions
2. **Managers** react to Input Store changes using Effector `sample`
3. **Managers** trigger API calls via Effector `effects`
4. **API responses** update **Output Stores** with normalized data
5. **UI Components** subscribe to Output Stores for reactive updates

## Store Patterns

### Critical Input/Output Store Separation

**INPUT STORES contain state THAT TRIGGERS requests - these are parameters:**
```typescript
// CORRECT: Input Store contains trigger parameters
export interface SearchParams {
  gbi_query: string;            // Parameter that triggers search
  page: number;                 // Parameter that triggers pagination
  pagesize: string;             // Parameter that triggers page size change
  refinements: string[];        // Parameter that triggers filtering
  sort_by: string;              // Parameter that triggers sorting
  hasSubmitted: boolean;        // Flag that triggers explicit search
  collectionId?: string;        // Parameter that triggers collection search
  
  // These are ALL parameters that cause API calls to be made
  // When these change, the Manager reacts and makes requests
}
```

**OUTPUT STORES contain state THAT IS THE RESULT of requests - these are responses:**
```typescript
// CORRECT: Output Store contains API results
export interface SearchResultsOutput {
  products: ProductDetail[];       // RESULT from API call
  totalRecordCount: number;        // RESULT from API call
  loading: boolean;                // RESULT state (request pending)
  error: string | null;            // RESULT state (request failed)
  rawResponse: any;                // RESULT for debugging
  queryParams: {                   // ECHO of parameters used
    pageSize: number;
    sortBy: string;
    collectionId?: string;
  };
  
  // These are ALL results from API calls
  // UI components READ these, never write to them
  // Only Managers update these via effects
}
```

### Input/Output Store Anti-Patterns

**NEVER mix trigger state with result state:**
```typescript
// BAD: Mixed store violates separation of concerns
export interface BadMixedStore {
  // Trigger parameters (should be in Input Store)
  query: string;
  page: number;
  
  // Result data (should be in Output Store)  
  products: ProductDetail[];
  loading: boolean;
  
  // This violates the principle and creates confusion
}
```

**NEVER put result data in Input Stores:**
```typescript
// BAD: Input Store should not contain results
export interface BadInputStore {
  query: string;                // OK - triggers search
  products: ProductDetail[];    // BAD - this is a result
  loading: boolean;             // BAD - this is a result
}
```

**NEVER put trigger parameters in Output Stores:**
```typescript
// BAD: Output Store should not contain mutable parameters  
export interface BadOutputStore {
  query: string;                // BAD - this triggers searches
  page: number;                 // BAD - this triggers pagination
  products: ProductDetail[];    // OK - this is a result
}
```

### Proper Data Flow Pattern
```
1. UI Function updates Input Store (trigger parameters)
   ↓
2. Manager reacts to Input Store changes (via Effector sample)
   ↓  
3. Manager triggers API call (via Effector effect)
   ↓
4. API responds with data
   ↓
5. Manager updates Output Store (result data)
   ↓
6. UI components read Output Store (reactive updates)
```

### Input/Output Store Structure
Every domain (search, recommendations) has paired input/output stores:

```typescript
// Input Store Pattern - Parameters that trigger requests
export interface DomainParams {
  // Core trigger parameters
  parameterThatTriggersRequest: string;
  anotherTriggerParameter: number;
  
  // Control flags
  hasSubmitted?: boolean;        // Explicit action trigger
  hasRequested?: boolean;        // Generic request trigger
  
  // All fields here should answer: "Does changing this trigger an API call?"
}

const initialParams: DomainParams = {
  parameterThatTriggersRequest: '',
  anotherTriggerParameter: 0,
  hasSubmitted: false
};

export type DomainParamsUpdater = (state: DomainParams) => DomainParams;
export const updateDomainParams = createEvent<DomainParamsUpdater>();
export const domainInputStore = createStore(initialParams)
  .on(updateDomainParams, (state, updater) => updater(state));

// Helper for external use
export const updateDomainStore = (updater: DomainParamsUpdater): void => {
  updateDomainParams(updater);
};
```

```typescript
// Output Store Pattern - Results from requests
export interface DomainOutput {
  // Core result data
  data: ResponseData[];          // Primary result from API
  metadata: any;                 // Secondary result data
  
  // Request state
  loading: boolean;              // Is request in progress?
  error: string | null;          // Did request fail?
  
  // Debugging/Advanced use
  rawResponse?: any;             // Full API response
  
  // Echo of parameters (read-only reference)
  lastRequestParams?: {          // Parameters that generated this result
    // Only include key parameters for reference
    // These should NEVER be modified directly
  };
  
  // All fields here should answer: "Is this a result of an API call?"
}

const initialOutput: DomainOutput = {
  data: [],
  metadata: {},
  loading: false,
  error: null,
  rawResponse: undefined
};

export type DomainOutputUpdater = (state: DomainOutput) => DomainOutput;
export const updateDomainOutput = createEvent<DomainOutputUpdater>();
export const domainOutputStore = createStore(initialOutput)
  .on(updateDomainOutput, (state, updater) => updater(state));

// Helper for external use
export const updateDomainOutputStore = (updater: DomainOutputUpdater): void => {
  updateDomainOutput(updater);
};
```

### Store Update Principles
```typescript
// CORRECT: Always use updater functions
updateInputStore((current) => ({
  ...current,
  query: newQuery,
  page: 1, // Reset page on new search
  hasSubmitted: true
}));

// INCORRECT: Never mutate state directly
// inputStore.setState({ query: newQuery }); // DON'T DO THIS
```

## Manager Patterns

### Manager Refactoring Guidelines

The current `recsManager.ts` exemplifies areas needing improvement based on SOLID principles:

**Current Issues in recsManager.ts:**
```typescript
// PROBLEMS:
// 1. Single file doing too much (200+ lines)
// 2. Complex pagination logic embedded in effect handler
// 3. Manual mapping of 15+ parameters
// 4. Mixed concerns (API + pagination + state management)
// 5. Duplicated logic between search and recs managers

export function initRecsManager(config: RecsManagerConfig): void {
  // ... initialization code
  
  // PROBLEM: Complex inline parameter mapping
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
  
  // PROBLEM: Complex pagination logic in effect handler
  recsFx.done.watch(({ result, params }) => {
    updateRecsOutputStore((current) => {
      const totalRecords = result.products.length;
      const pageSize = params.recsOptions.pageSize;
      const totalPages = Math.ceil(totalRecords / pageSize);
      const currentPage = params.recsOptions.currentPage || 0;
      const startIndex = currentPage * pageSize;
      const endIndex = startIndex + pageSize;
      const currentPageProducts = result.products.slice(startIndex, endIndex);
      // ... more complex logic
    });
  });
}
```

**Improved Approach - Split into Focused Modules:**
```typescript
// recsManager.ts - Orchestration only (~50 lines)
export function initRecsManager(config: RecsManagerConfig): void {
  if (isInitialized()) return;
  
  storeConfig(config);
  setupReactivePipeline();
  setupEffectHandlers();
  
  markAsInitialized();
}

// recsTransformers.ts - Data transformation utilities
export function transformInputToParams(
  inputState: RecsParams, 
  config: RecsManagerConfig
): RecsManagerParams {
  return {
    shopTenant: config.shopTenant,
    appEnv: config.appEnv,
    recsOptions: mapInputToOptions(inputState)
  };
}

function mapInputToOptions(input: RecsParams): RecsOptions {
  // Focused parameter mapping logic
}

// recsPagination.ts - Reusable pagination utilities  
export function calculatePagination(
  totalRecords: number,
  pageSize: number, 
  currentPage: number
): PaginationResult {
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  
  return { totalPages, startIndex, endIndex };
}

export function paginateProducts<T>(
  products: T[],
  pagination: PaginationResult
): T[] {
  return products.slice(pagination.startIndex, pagination.endIndex);
}

// recsEffects.ts - Effect definitions and handlers
export const recsFx = createEffect(async (params: RecsManagerParams) => {
  return await requestRecommendations(/* params */);
});

export function setupRecsEffectHandlers(): void {
  recsFx.pending.watch(handlePendingState);
  recsFx.done.watch(handleSuccessState);
  recsFx.fail.watch(handleErrorState);
}

function handleSuccessState({ result, params }): void {
  const pagination = calculatePagination(
    result.products.length,
    params.recsOptions.pageSize,
    params.recsOptions.currentPage
  );
  
  const currentPageProducts = paginateProducts(result.products, pagination);
  
  updateRecsOutputStore((current) => ({
    ...current,
    products: currentPageProducts,
    allProducts: result.products,
    pagination: buildPaginationState(pagination, result.products.length),
    loading: false,
    error: null,
    rawResponse: result.rawResponse
  }));
}
```

### Manager Initialization
```typescript
export interface ManagerConfig {
  shopTenant: string;
  appEnv: string;
  // Static configuration that doesn't change
  collection: string;
  area: string;
  // Optional configuration
  debug?: boolean;
}

let managerConfig: ManagerConfig;

export function initManager(config: ManagerConfig): void {
  // Prevent double initialization
  if (isManagerInitialized()) {
    debugLog('Manager', 'Already initialized, skipping');
    return;
  }
  
  debugLog('Manager', 'Initializing with config', config);
  storeManagerConfig(config);
  
  // Set up reactive pipeline
  setupReactivePipeline();
  
  markManagerAsInitialized();
}

// Helper functions for cleaner code
function isManagerInitialized(): boolean {
  return (initManager as any).initialized === true;
}

function markManagerAsInitialized(): void {
  (initManager as any).initialized = true;
}

function storeManagerConfig(config: ManagerConfig): void {
  managerConfig = config;
}
```

### Effect and Sample Pattern
```typescript
// GOOD: Extract complex logic into separate functions
function setupReactivePipeline(): void {
  sample({
    source: inputStore,
    clock: inputStore,
    filter: shouldTriggerRequest,
    fn: transformInputToApiParams,
    target: domainFx
  });
}

// GOOD: Focused filter function
function shouldTriggerRequest(state: InputParams): boolean {
  return state.hasSubmitted || 
         state.page > 1 || 
         state.refinements.length > 0;
}

// GOOD: Focused transformation function  
function transformInputToApiParams(state: InputParams): ApiParams {
  return {
    shopTenant: managerConfig.shopTenant,
    appEnv: managerConfig.appEnv,
    options: buildOptionsFromState(state)
  };
}

// GOOD: Separate effect handlers
function setupEffectHandlers(): void {
  domainFx.pending.watch(handlePendingState);
  domainFx.done.watch(handleSuccessState);
  domainFx.fail.watch(handleErrorState);
}

function handlePendingState(isPending: boolean): void {
  if (isPending) {
    updateOutputStore((current) => ({
      ...current,
      loading: true,
      error: null
    }));
  }
}

function handleSuccessState({ result, params }): void {
  // GOOD: Extract complex pagination logic
  const paginatedData = processPaginatedResponse(result, params);
  
  updateOutputStore((current) => ({
    ...current,
    ...paginatedData,
    loading: false,
    error: null,
    rawResponse: result.rawResponse
  }));
}

function handleErrorState({ error }): void {
  debugLog('Manager', 'Effect error', error);
  updateOutputStore((current) => ({
    ...current,
    loading: false,
    error: formatErrorMessage(error)
  }));
}
```

## Code Organization Principles

### File Size and Module Focus
- **Maximum 150-200 lines per file** (guideline for maintainability)
- **Single responsibility per file**
- **Extract utilities into separate modules**
- **Clear, descriptive file names**

### Utility Function Extraction
When you see repeated logic or complex inline code, extract it:

```typescript
// BAD: Repeated pagination logic in multiple managers
// searchManager.ts - line 45
const newData = params.options.page > 1 && params.options.paginationType === 'show-more'
  ? [...current.data, ...result.data]
  : result.data;

// recsManager.ts - line 89  
const totalRecords = result.products.length;
const pageSize = params.recsOptions.pageSize;
const totalPages = Math.ceil(totalRecords / pageSize);
const currentPage = params.recsOptions.currentPage || 0;
const startIndex = currentPage * pageSize;
const endIndex = startIndex + pageSize;
const currentPageProducts = result.products.slice(startIndex, endIndex);

// GOOD: Extract to shared utilities
// utils/paginationUtils.ts
export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  paginationType: PaginationType;
}

export interface PaginationResult {
  totalPages: number;
  startIndex: number;
  endIndex: number;
  currentPageData: any[];
}

export function calculatePagination<T>(
  allData: T[],
  config: PaginationConfig
): PaginationResult {
  const totalRecords = allData.length;
  const totalPages = Math.ceil(totalRecords / config.pageSize);
  const startIndex = config.currentPage * config.pageSize;
  const endIndex = startIndex + config.pageSize;
  
  return {
    totalPages,
    startIndex, 
    endIndex,
    currentPageData: allData.slice(startIndex, endIndex)
  };
}

export function mergePageData<T>(
  currentData: T[],
  newData: T[],
  config: PaginationConfig
): T[] {
  return config.paginationType === PaginationType.SHOW_MORE && config.currentPage > 1
    ? [...currentData, ...newData]
    : newData;
}
```

### Parameter Transformation Utilities
Extract complex parameter mapping into focused functions:

```typescript
// BAD: Inline parameter mapping (from recsManager.ts)
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

// GOOD: Extract to focused transformer
// transformers/recsTransformers.ts
export function transformRecsInputToParams(
  inputState: RecsParams,
  config: RecsManagerConfig
): RecsManagerParams {
  return {
    shopTenant: config.shopTenant,
    appEnv: config.appEnv,
    recsOptions: buildRecsOptions(inputState)
  };
}

function buildRecsOptions(input: RecsParams): RecsOptions {
  return {
    // Core parameters
    name: input.name,
    collection: input.collection,
    pageSize: input.pageSize,
    currentPage: input.currentPage,
    
    // Optional parameters
    ...buildOptionalParams(input),
    
    // User parameters  
    ...buildUserParams(input),
    
    // Filter parameters
    ...buildFilterParams(input)
  };
}

function buildOptionalParams(input: RecsParams) {
  const optional: Partial<RecsOptions> = {};
  
  if (input.limit) optional.limit = input.limit;
  if (input.placement) optional.placement = input.placement;
  if (input.eventType) optional.eventType = input.eventType;
  if (input.area) optional.area = input.area;
  if (input.debug !== undefined) optional.debug = input.debug;
  if (input.strictFiltering !== undefined) optional.strictFiltering = input.strictFiltering;
  
  return optional;
}

function buildUserParams(input: RecsParams) {
  const user: Partial<RecsOptions> = {};
  
  if (input.visitorId) user.visitorId = input.visitorId;
  if (input.loginId) user.loginId = input.loginId;
  
  return user;
}

function buildFilterParams(input: RecsParams) {
  const filters: Partial<RecsOptions> = {};
  
  if (input.filters?.length) filters.filters = input.filters;
  if (input.rawFilter) filters.rawFilter = input.rawFilter;
  
  return filters;
}
```

### Error Handling Utilities
Standardize error handling across managers:

```typescript
// utils/errorUtils.ts
export function formatManagerError(error: unknown, context: string): string {
  if (error instanceof Error) {
    return `${context}: ${error.message}`;
  }
  
  if (typeof error === 'string') {
    return `${context}: ${error}`;
  }
  
  return `${context}: Unknown error occurred`;
}

export function createErrorState<T>(currentState: T, error: unknown, context: string): T {
  return {
    ...currentState,
    loading: false,
    error: formatManagerError(error, context)
  } as T;
}

// Usage in managers
domainFx.fail.watch(({ error }) => {
  debugLog('Manager', 'Effect error', error);
  updateOutputStore((current) => 
    createErrorState(current, error, 'Search Request')
  );
});
```

### Configuration Utilities  
Standardize manager configuration handling:

```typescript
// utils/configUtils.ts
export function validateManagerConfig(config: any, requiredFields: string[]): void {
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Missing required configuration field: ${field}`);
    }
  }
}

export function createInitializationGuard(managerName: string) {
  const initKey = `${managerName}_initialized`;
  
  return {
    isInitialized(): boolean {
      return (globalThis as any)[initKey] === true;
    },
    
    markAsInitialized(): void {
      (globalThis as any)[initKey] = true;
    },
    
    requireNotInitialized(): void {
      if (this.isInitialized()) {
        throw new Error(`${managerName} is already initialized`);
      }
    }
  };
}

// Usage in managers
const initGuard = createInitializationGuard('RecsManager');

export function initRecsManager(config: RecsManagerConfig): void {
  initGuard.requireNotInitialized();
  
  validateManagerConfig(config, ['shopTenant', 'appEnv', 'name']);
  
  // ... rest of initialization
  
  initGuard.markAsInitialized();
}
```

### Framework-Agnostic Design
UI functions should work with any framework by only updating stores:

```typescript
/**
 * Framework-agnostic search input handler.
 * Works with Svelte, React, Vue, or any other framework.
 */
export function handleSearchInput(newQuery: string): void {
  updateInputStore((current) => ({
    ...current,
    gbi_query: newQuery,
    page: 1, // Reset pagination
    hasSubmitted: true // Mark as explicit submission
  }));
}

/**
 * Framework-agnostic refinement handler.
 */
export function handleRefinementChange(
  refinementString: string, 
  isSelected: boolean
): void {
  updateInputStore((current) => {
    const refinements = isSelected
      ? [...current.refinements, refinementString]
      : current.refinements.filter(r => r !== refinementString);
    
    return {
      ...current,
      refinements,
      page: 1, // Reset to first page
      hasSubmitted: true
    };
  });
}
```

### Pagination UI Functions
```typescript
export function handleNextPage(): void {
  updateInputStore((current) => ({
    ...current,
    page: current.page + 1
    // hasSubmitted not needed - page change should always trigger
  }));
}

export function handlePageSizeChange(newSize: string): void {
  updateInputStore((current) => ({
    ...current,
    pagesize: newSize,
    page: 1, // Reset to first page
    hasSubmitted: true
  }));
}
```

## URL Management

### URL Synchronization Pattern
```typescript
export function initUrlManager(config: UrlManagerConfig): void {
  // Parse initial URL state
  const initialParams = parseUrlToSearchParams(config);
  
  // Update input store with URL state
  updateInputStore((current) => ({
    ...current,
    ...initialParams
  }));
  
  // Set up bidirectional URL sync
  setupUrlWatchers();
}

function setupUrlWatchers(): void {
  // Watch store changes and update URL
  inputStore.watch((state) => {
    const newUrl = buildUrlFromState(state);
    window.history.replaceState({}, '', newUrl);
  });
  
  // Listen for browser navigation
  window.addEventListener('popstate', () => {
    const params = parseUrlToSearchParams(config);
    updateInputStore((current) => ({ ...current, ...params }));
  });
}
```

## Debug Logging

### Consistent Logging Pattern
```typescript
// Always use the centralized debug logger
debugLog('Module Name', 'Action description', dataObject);

// Examples:
debugLog('Search Manager', 'Effect triggered', params);
debugLog('Input Store', 'State updated', newState);
debugLog('URL Manager', 'URL synchronized', newUrl);

// Configure debug mode globally
import { sdkConfig } from './debugLogger';
sdkConfig.debug = true;
```

## Type Definitions

### Shared Types Location
Common types should be defined in `types.ts`:

```typescript
// Enums for consistent values
export enum PaginationType {
  PAGINATE = 'paginate',
  SHOW_MORE = 'show-more'
}

export enum SearchSource {
  SEARCH = 'SEARCH',
  COLLECTION = 'COLLECTION'
}

// Generic updater type
export type UpdateStateFn<T> = (state: T) => T;

// Common interfaces
export interface SearchParams {
  gbi_query: string;
  pagesize: string;
  page: number;
  sort_by: string;
  refinements: ReadonlyArray<string>;
  paginationType: PaginationType;
  hasSubmitted?: boolean;
}
```

## Error Handling

### Store Error State
```typescript
// Always include error handling in output stores
export interface OutputState {
  loading: boolean;
  error: string | null;
  // ... other fields
}

// Clear errors on new requests
updateOutputStore((current) => ({
  ...current,
  loading: true,
  error: null // Clear previous errors
}));

// Set errors on failure
updateOutputStore((current) => ({
  ...current,
  loading: false,
  error: error instanceof Error ? error.message : String(error)
}));
```

## Export Patterns

### Barrel Exports with Namespacing
```typescript
// Main index.ts should organize exports by domain
export const recommendations = {
  // Manager functions
  initRecsManager,
  setupRecommendations,
  // Stores
  recsInputStore,
  recsOutputStore,
  // UI functions
  nextPage,
  previousPage,
  setRecsPageSize
};

// Export search functionality at top level for backward compatibility
export {
  initSearchManager,
  searchInputStore,
  searchOutputStore,
  handleSearchInput,
  handleRefinementChange
};
```

## Testing Guidelines

### Store Testing
```typescript
describe('Input Store', () => {
  test('should update query and reset page', () => {
    const updater = (current) => ({
      ...current,
      query: 'new query',
      page: 1
    });
    
    // Test the updater function in isolation
    const result = updater(initialState);
    expect(result.query).toBe('new query');
    expect(result.page).toBe(1);
  });
});
```

### Manager Testing
```typescript
describe('Search Manager', () => {
  test('should trigger effect when hasSubmitted is true', () => {
    // Test the filter function
    const shouldTrigger = filterFunction({
      query: '',
      hasSubmitted: true,
      refinements: [],
      page: 1
    });
    
    expect(shouldTrigger).toBe(true);
  });
});
```

## Common Patterns Summary

### Required Patterns
1. **Input/Output Store Pairs**: Every domain needs both
2. **Updater Functions**: All state changes via updater pattern
3. **Manager Initialization**: One-time setup with configuration
4. **Effect-Based API Calls**: Use Effector effects for async operations
5. **Framework-Agnostic UI Functions**: No framework dependencies
6. **Centralized Debug Logging**: Use `debugLog` consistently

### Anti-Patterns to Avoid
1. **Direct Store Mutations**: Never modify store state directly
2. **Manager Bypassing**: UI should use managers, not direct API calls
3. **Framework Dependencies**: Keep UI functions framework-agnostic
4. **Missing Error Handling**: Always handle effect failures
5. **Inconsistent Typing**: Avoid `any` types, define proper interfaces

---

*This layer depends on Public API layer for request functions but should never expose Effector concepts to consumers.*
