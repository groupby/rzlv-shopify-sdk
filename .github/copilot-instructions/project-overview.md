# RZLV Shopify SDK - Project Instructions for AI

## Project Overview

This is a TypeScript-based SDK that provides search, autocomplete, and recommendations functionality for Shopify stores. The SDK is architected with two distinct layers: a **State Driver** for reactive state management and a **Public API** for stateless request functions. This separation allows for flexible integration patterns - consumers can use the full stateful experience or just the request functions.

## Repository Structure

```
├── state-driver/              # Reactive state management layer
│   ├── src/
│   │   ├── *Manager.ts       # Orchestration layer (searchManager, recsManager)
│   │   ├── *Store.ts         # Effector stores (input/output pattern)
│   │   ├── ui-functions/     # Framework-agnostic UI interaction helpers
│   │   ├── urlManager.ts     # URL synchronization utilities
│   │   ├── debugLogger.ts    # Centralized debug logging
│   │   └── types.ts          # Shared type definitions
│   └── dist-state-driver/    # Built distribution files
├── public-api/               # Stateless request functions layer
│   ├── src/
│   │   ├── *-requester/      # Request function modules
│   │   ├── utils/            # Data transformation utilities
│   │   └── index.ts          # Public API exports
│   └── dist-public/          # Built distribution files
└── .github/
    └── copilot-instructions/ # AI development guidelines
```

## Technology Stack

### Core Technologies
- **Language**: TypeScript (strict mode)
- **State Management**: Effector (for State Driver layer)
- **Build Tools**: Vite, Rollup
- **Package Management**: npm workspaces
- **Testing**: Jest/Vitest (configured per package)

### Integration Technologies
- **Shopify**: Storefront API integration
- **Search API**: Custom search service integration
- **Framework Support**: Framework-agnostic design (Svelte, React, Vue compatible)

## Core Development Principles

### 1. SOLID Principles
Apply SOLID principles rigorously throughout the codebase:

**Single Responsibility Principle (SRP)**
- **Files**: Each file should have one clear purpose
- **Functions**: Each function should do one thing well
- **Classes/Modules**: Each should have a single reason to change

```typescript
// BAD: Manager doing too much
export function initRecsManager(config) {
  // Setup reactive pipeline
  // Handle pagination logic  
  // Transform API responses
  // Update multiple stores
  // Reset state flags
}

// GOOD: Separate concerns
export function initRecsManager(config) {
  setupReactivePipeline(config);
}

function setupReactivePipeline(config) { /* focused on pipeline setup */ }
function calculatePagination(data, params) { /* focused on pagination */ }
function transformApiResponse(response) { /* focused on transformation */ }
```

**Open/Closed Principle (OCP)**
- Open for extension, closed for modification
- Use interfaces and composition over inheritance

**Liskov Substitution Principle (LSP)**
- Subtypes must be substitutable for their base types
- Maintain consistent interfaces across similar functions

**Interface Segregation Principle (ISP)**
- Many client-specific interfaces are better than one general-purpose interface
- Don't force clients to depend on interfaces they don't use

**Dependency Inversion Principle (DIP)**
- Depend on abstractions, not concretions
- High-level modules should not depend on low-level modules

### 2. DRY (Don't Repeat Yourself)
- **Extract Common Logic**: If you write it twice, extract it
- **Utility Functions**: Create reusable utility functions
- **Configuration Objects**: Use configuration over duplication
- **Generic Types**: Use TypeScript generics for reusable patterns

```typescript
// BAD: Repeated pagination logic
// In recsManager.ts - complex pagination calculation
// In searchManager.ts - similar pagination calculation

// GOOD: Extracted utility
export function calculatePagination(totalRecords: number, pageSize: number, currentPage: number) {
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  
  return { totalPages, startIndex, endIndex };
}
```

### 3. Small, Focused Modules
- **Maximum 200 lines per file** (guideline, not hard rule)
- **Single purpose per file**
- **Clear, descriptive names**
- **Minimal dependencies**

```typescript
// BAD: recsManager.ts doing too much (200+ lines)
// - API orchestration
// - Pagination logic  
// - State transformation
// - Error handling
// - Debug logging

// GOOD: Split into focused modules
// recsManager.ts - orchestration only
// recsPagination.ts - pagination utilities
// recsTransformers.ts - data transformation
// recsEffects.ts - effect definitions
```

### 4. Two-Layer Architecture
- **State Driver**: Reactive, stateful layer using Effector
- **Public API**: Stateless request functions with pure functions
- **Clear Separation**: State Driver depends on Public API, never vice versa
- **Independent Deployment**: Each layer can be consumed independently

### 5. Input/Output Store Separation (Critical Pattern)
**Input Stores contain state THAT TRIGGERS requests:**
```typescript
// Input Store - Parameters that trigger API calls
export interface SearchParams {
  gbi_query: string;        // TRIGGERS search
  page: number;             // TRIGGERS pagination
  refinements: string[];    // TRIGGERS filtering
  hasSubmitted: boolean;    // TRIGGERS explicit search
  // These are parameters that cause API requests
}
```

**Output Stores contain state THAT IS THE RESULT of requests:**
```typescript
// Output Store - Results from API calls
export interface SearchResultsOutput {
  products: ProductDetail[];     // RESULT of search
  totalRecordCount: number;      // RESULT of search
  loading: boolean;              // RESULT state (pending/done)
  error: string | null;          // RESULT state (error)
  rawResponse: any;              // RESULT for debugging
  // These are outputs, never trigger new requests
}
```

**Never mix trigger state with result state in the same store!**

### 6. Immutable State Updates
```typescript
// Always use updater functions for state changes
updateInputStore((current) => ({
  ...current,
  query: newQuery,
  page: 1
}));
```

### 7. Framework-Agnostic Design
- **No Framework Dependencies**: UI functions work with any framework
- **Pure Functions**: Business logic separated from framework concerns
- **Dependency Injection**: Configuration passed to initialization functions

### 8. Type Safety First
- **Strict TypeScript**: No `any` types in new code
- **Interface-First**: Define interfaces before implementation
- **Generic Types**: Use generics for reusable patterns
- **Gradual Improvement**: Replace existing `any` types incrementally

### 9. Effect-Based Architecture
```typescript
// Manager pattern: Effect + Sample + Store updates
const searchFx = createEffect(async (params) => {
  return await requestSearch(params);
});

sample({
  source: inputStore,
  filter: (state) => state.hasSubmitted,
  target: searchFx
});
```

## Architecture Patterns

### Manager Pattern (State Driver)
Managers orchestrate data flow between input stores, API calls, and output stores:

```typescript
export function initSearchManager(config: SearchManagerConfig): void {
  // Store static configuration
  searchManagerConfig = config;
  
  // Set up reactive pipeline
  sample({
    source: searchInputStore,
    filter: (state) => state.hasSubmitted,
    fn: (state) => transformStateToParams(state),
    target: searchFx
  });
  
  // Handle success/error states
  searchFx.done.watch(({ result }) => {
    updateOutputStore((current) => ({
      ...current,
      products: result.mergedProducts,
      loading: false
    }));
  });
}
```

### Store Pattern (State Driver)
All stores follow input/output pattern with updater functions:

```typescript
// Input Store Pattern
export type StateUpdater = (state: State) => State;
export const updateStore = createEvent<StateUpdater>();
export const store = createStore(initialState)
  .on(updateStore, (state, updater) => updater(state));

// Helper function for external use
export const updateStoreHelper = (updater: StateUpdater): void => {
  updateStore(updater);
};
```

### Request Function Pattern (Public API)
Stateless functions with consistent interfaces:

```typescript
export async function requestSearch(
  shopTenant: string,
  appEnv: AppEnv,
  searchOptions: RequestSearchOptions,
  mergeShopifyData = true,
  shopifyConfig?: ShopifyConfig
): Promise<RequestSearchResponse> {
  // Implementation
}
```

### UI Function Pattern (State Driver)
Framework-agnostic functions that update stores:

```typescript
export function handleSearchInput(newQuery: string): void {
  updateInputStore((current) => ({
    ...current,
    gbi_query: newQuery,
    page: 1,
    hasSubmitted: true
  }));
}
```

## Error Handling Standards

### Consistent Error Patterns
```typescript
// Manager error handling
searchFx.fail.watch(({ error }) => {
  debugLog('Search Manager', 'searchFx error:', error);
  updateOutputStore((current) => ({
    ...current,
    loading: false,
    error: error instanceof Error ? error.message : String(error)
  }));
});

// Request function error handling
try {
  const result = await apiCall();
  return { success: true, data: result };
} catch (error) {
  debugLog('RequestFunction', 'API error:', error);
  throw new Error(`Request failed: ${error.message}`);
}
```

### Debug Logging
```typescript
// Centralized debug logging with module identification
debugLog('Module Name', 'Description', additionalData);

// Configure debug mode globally
export let sdkConfig = { debug: false };
```

## Configuration Management

### Static Configuration Pattern
```typescript
// Module-level configuration storage
let managerConfig: ManagerConfig;

export function initManager(config: ManagerConfig): void {
  if (initialized) return; // Prevent double initialization
  managerConfig = config;
  // Setup reactive pipeline
  initialized = true;
}
```

### Environment Configuration
```typescript
export enum AppEnv {
  Production = 'PRODUCTION',
  ProxyProd = 'proxy.shp',
  ProxyDev = 'proxy.shp-lo'
}
```

## Testing Standards

### Unit Testing Focus
- **Pure Functions**: Test all utility functions
- **Store Updates**: Test updater functions in isolation
- **Type Safety**: Ensure proper TypeScript coverage

### Integration Testing Focus
- **Manager Workflows**: Test complete effect pipelines
- **API Integration**: Test request functions with mocked responses
- **Cross-Layer Communication**: Test State Driver → Public API interactions

## Common Anti-Patterns to Avoid

### State Management
- **Direct Store Mutation**: Always use updater functions
- **Imperative Updates**: Use reactive patterns with Effector
- **Cross-Layer Dependencies**: Public API should never import State Driver
- **Mixed Input/Output Concerns**: Never put trigger parameters in Output Stores or result data in Input Stores

### Code Organization
- **God Classes/Files**: Files should not exceed 200 lines or handle multiple responsibilities
- **Inline Complex Logic**: Extract complex transformations, pagination, and validations into utilities
- **Repeated Logic**: If you write it twice, extract it into a shared utility
- **Deep Nesting**: Prefer early returns and guard clauses over deep if/else chains

### Type Safety
- **Using `any`**: Always define proper interfaces  
- **Optional Chaining Abuse**: Use proper null checking and validation
- **Type Assertions**: Prefer type guards and validation functions
- **Missing Interface Documentation**: All public interfaces should have JSDoc comments

### Architecture
- **Manager Bypassing**: UI should interact through managers, not directly with stores
- **Stateful Public API**: Keep request functions pure and stateless  
- **Framework Coupling**: Maintain framework-agnostic design
- **Tight Coupling**: Modules should depend on abstractions, not implementations

## Common Patterns to Follow

### Clean Code Practices
```typescript
// GOOD: Small, focused functions with clear names
export function calculateRecommendationsPagination(
  totalProducts: number,
  pageSize: number,
  currentPage: number
): PaginationResult {
  // Single responsibility: calculate pagination
  const totalPages = Math.ceil(totalProducts / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  
  return { totalPages, startIndex, endIndex };
}

// GOOD: Early returns to reduce nesting
export function shouldTriggerSearch(state: SearchParams): boolean {
  if (state.hasSubmitted) return true;
  if (state.page > 1) return true;
  if (state.refinements.length > 0) return true;
  if (state.gbi_query.trim() !== '') return true;
  
  return false;
}

// GOOD: Guard clauses for validation
export function validateSearchConfig(config: SearchManagerConfig): void {
  if (!config.shopTenant?.trim()) {
    throw new Error('shopTenant is required');
  }
  if (!config.collection?.trim()) {
    throw new Error('collection is required');
  }
  if (!config.area?.trim()) {
    throw new Error('area is required');
  }
}
```

### Namespace Organization
```typescript
// State Driver exports with namespace separation
export const recommendations = {
  initRecsManager,
  setupRecommendations,
  recsInputStore,
  recsOutputStore,
  // UI functions
  nextPage,
  previousPage
};
```

### Pagination Handling
```typescript
// Support multiple pagination types
export enum PaginationType {
  PAGINATE = 'paginate',      // Traditional page-based
  SHOW_MORE = 'show-more'     // Infinite scroll
}
```

### Data Transformation
```typescript
// Consistent transformation pattern
fn: (inputState: InputType): OutputType => 
  transformInputToApiParams(inputState, staticConfig)

// Extract to dedicated transformer function
function transformInputToApiParams(
  inputState: InputType, 
  config: ManagerConfig
): OutputType {
  return {
    shopTenant: config.shopTenant,
    appEnv: config.appEnv,
    options: buildOptionsFromInput(inputState)
  };
}
```

## Development Workflow Enhancements

### Before Making Changes
1. **Identify the Layer**: Determine if changes belong in State Driver or Public API
2. **Check Store Separation**: Ensure Input/Output store separation is maintained
3. **Consider Reusability**: Can this logic be extracted into a utility?
4. **Validate Dependencies**: Are you introducing any improper dependencies?

### Refactoring Guidelines
1. **Extract Before Adding**: If a file is approaching 200 lines, extract utilities first
2. **Test Extraction**: Ensure extracted utilities have unit tests
3. **Update Documentation**: Update relevant instruction files for significant changes
4. **Consider Breaking Changes**: How will changes affect existing consumers?

### Code Review Focus Areas
1. **Store Separation**: Are Input/Output stores properly separated?
2. **File Size**: Are files focused and reasonably sized?
3. **Extracted Logic**: Is complex logic extracted into testable utilities?
4. **Type Safety**: Are proper types used throughout?
5. **Framework Agnostic**: Does the State Driver remain framework-agnostic?

## Performance Considerations

### State Management Performance
- **Minimize Store Updates**: Batch related updates when possible
- **Avoid Unnecessary Triggers**: Use proper filtering in reactive pipelines
- **Optimize Large Data Sets**: Consider virtualization for large product lists
- **Memory Management**: Clean up subscriptions and avoid memory leaks

### API Request Optimization
- **Debounce Search Inputs**: Prevent excessive API calls during typing
- **Cache Responses**: Consider caching strategies for repeated requests
- **Pagination Strategy**: Use appropriate pagination for data size
- **Error Recovery**: Implement retry logic for transient failures

---

*For detailed layer-specific instructions, refer to:*
- [State Driver Instructions](state-driver.md)
- [Public API Instructions](public-api.md)

*Last Updated: September 2025*
