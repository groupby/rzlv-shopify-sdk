# Public API Layer - Development Instructions

## Documentation Maintenance Instructions for AI

When working on Public API files, validate documentation accuracy:

### Update Triggers:
- **Request Function Changes**: Modifications to `*-requester/*.ts` files (signatures, parameter handling, response formats)
- **Utility Changes**: Modifications to `utils/*.ts` files (transformation logic, validation, helper functions)
- **Type Changes**: Updates to interfaces, enums, or type definitions
- **Integration Changes**: Shopify integration patterns or API endpoint changes

### Validation Checkpoints:
1. **Function Signatures**: Do conceptual patterns match actual function signatures?
2. **Stateless Design**: Are request functions remaining pure and stateless?
3. **Response Consistency**: Are response formats staying consistent across functions?
4. **Error Handling**: Are error handling patterns consistent and comprehensive?

### Architecture Violations to Watch For:
- Request functions storing state or having side effects
- Inconsistent parameter order or naming across similar functions
- Framework-specific dependencies in utilities
- Missing validation or error handling in request functions

---

## Overview

The Public API layer provides stateless request functions for search, autocomplete, and recommendations. This layer handles API communication, data transformation, Shopify integration, and utility functions. It is designed to be consumed independently or as the foundation for the State Driver layer.

## Core Principles

### Stateless Design
- **Pure Functions**: Request functions have no side effects
- **No Global State**: Each function call is independent
- **Predictable Outputs**: Same inputs always produce same outputs
- **Framework Agnostic**: No dependencies on UI frameworks

### Consistent Interface Pattern
All request functions follow the same signature pattern:

```typescript
export async function requestFunction(
  shopTenant: string,
  appEnv: AppEnv,
  options: FunctionOptions,
  ...additionalParams?: OptionalParams
): Promise<FunctionResponse> {
  // Implementation
}
```

## Request Function Patterns

### Standard Request Structure
**Implementation Reference**: See `requestSearch()` in `public-api/src/search-requester/requestSearch.ts`

**Conceptual Pattern**:
```typescript
/**
 * Descriptive JSDoc comment explaining the function.
 * Include usage examples and parameter descriptions.
 */
export async function requestFunction(
  shopTenant: string,
  appEnv: AppEnv,
  options: FunctionOptions,
  optionalConfig?: OptionalParams
): Promise<FunctionResponse> {
  try {
    // 1. Validate and transform input parameters
    validateInputs(shopTenant, appEnv, options);
    const apiParams = transformInputs(options);
    
    // 2. Make API call to service
    const result = await makeApiCall(shopTenant, appEnv, apiParams);
    
    // 3. Transform/enhance data if needed
    const processedData = await processResponse(result, optionalConfig);
    
    // 4. Return consistent response format
    return createStandardResponse(processedData, result);
  } catch (error) {
    // 5. Consistent error handling
    throw new Error(`${operation} failed: ${error.message}`);
  }
}
```

### Options Interface Pattern
**Implementation Reference**: See option interfaces in `public-api/src/*-requester/*.ts` files

**Conceptual Pattern**:
```typescript
/**
 * Options interfaces should be descriptive and well-documented.
 */
export interface RequestFunctionOptions {
  /**
   * Primary parameter with clear description.
   */
  primaryParam: string;
  /**
   * Required configuration parameter.
   */
  requiredConfig: string;
  /**
   * Optional parameter with default behavior described.
   * @default defaultValue
   */
  optionalParam?: number;
  /**
   * Array parameter for multiple values.
   */
  arrayParam?: readonly string[];
}
```

### Response Interface Pattern
**Implementation Reference**: See response interfaces in `public-api/src/*-requester/*.ts` files

**Conceptual Pattern**:
```typescript
/**
 * Response interfaces should be consistent across functions.
 */
export interface RequestFunctionResponse {
  /**
   * Processed data, ready for consumption.
   */
  processedData: ProcessedItem[];
  /**
   * Raw response from API (for debugging/advanced use).
   */
  rawResponse: RawApiResponse;
  /**
   * Additional metadata from the response.
   */
  metadata: ResponseMetadata;
}
```

## Utility Function Patterns

### Data Transformation Functions
```typescript
/**
 * Pure transformation functions for data processing.
 */
export function formatRefinements(refinements: string[]): Refinement[] {
  return refinements.map(refinementString => {
    // Parse and transform refinement string
    const [navigationName, value] = refinementString.split(':');
    
    return {
      navigationName,
      value,
      type: determineRefinementType(value),
      displayName: formatDisplayName(navigationName),
      or: false
    };
  });
}

/**
 * Async transformation functions for enhanced data.
 */
export async function transformProductsForVariantRelevancy(
  siteSearchProducts: Products,
  shopifyConfig: ShopifyConfig
): Promise<ProductDetail[]> {
  // 1. Extract product handles
  const handles = buildProductHandles(siteSearchProducts);
  
  // 2. Fetch Shopify product details
  const productDetails = await fetchProductDetails(handles, shopifyConfig);
  
  // 3. Merge and reorder by relevancy
  return reorderVariantsByRelevancy(
    productDetails.products,
    siteSearchProducts.records
  );
}
```

### Validation and Parsing Functions
```typescript
/**
 * Input validation and parsing utilities.
 */
export function parseSearchParams(urlParams: URLSearchParams): SearchParams {
  return {
    query: urlParams.get(QueryParams.Query),
    pageSize: urlParams.get(QueryParams.PageSize),
    sortBy: (urlParams.get(QueryParams.SortBy) as SortOrder) || SortOrder.Relevance,
    pageNumber: urlParams.get(QueryParams.PageNumber),
    refinements: urlParams.getAll(QueryParams.Refinement)
  };
}

export function parseSortParameter(sortString: string = ''): SortObject[] {
  return sortString.split(',').map(sortPart => {
    const [field, order] = sortPart.split(':');
    return {
      field: field.trim(),
      order: (order?.trim() as SortOrder) || SortOrder.Ascending
    };
  });
}
```

## Type Definition Patterns

### Comprehensive Type Coverage
```typescript
// Enums for constrained values
export enum AppEnv {
  Production = 'PRODUCTION',
  ProxyProd = 'proxy.shp',
  ProxyDev = 'proxy.shp-lo'
}

export enum SortOrder {
  Ascending = 'ascending',
  Descending = 'descending',
  Relevance = 'relevance'
}

// Interfaces for structured data
export interface ShopifyConfig {
  storefrontUrl: string;
  accessToken: string;
}

export interface ProductDetail {
  id: string;
  title: string;
  handle: string;
  variants: ProductVariant[];
  images: ProductImage[];
  // Include all necessary Shopify product fields
}

// Generic types for reusability
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
}
```

### Type Export Strategy
```typescript
// Export all types that consumers might need
export type {
  // Request option types
  RequestSearchOptions,
  RequestRecsOptions,
  LazyLoadMoreOptions,
  
  // Response types
  RequestSearchResponse,
  RequestRecsResponse,
  
  // Data types
  ProductDetail,
  ProductVariant,
  RecsProduct,
  RecsFilter,
  
  // Configuration types
  ShopifyConfig,
  RecsManagerConfig
};

// Export enums directly
export { AppEnv, SortOrder, RefinementType };
```

## Shopify Integration Patterns

### Storefront API Integration
```typescript
/**
 * Shopify-specific functionality should be isolated and optional.
 */
export async function fetchStorefrontProducts(
  handles: string[],
  shopifyConfig: ShopifyConfig
): Promise<ProductDetail[]> {
  // 1. Build GraphQL query
  const query = buildProductQuery(handles);
  
  // 2. Make Storefront API request
  const response = await fetch(shopifyConfig.storefrontUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': shopifyConfig.accessToken
    },
    body: JSON.stringify({ query })
  });
  
  // 3. Process and validate response
  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return transformShopifyResponse(data);
}

/**
 * Product handle extraction from search results.
 */
export function buildProductHandles(products: Products): string[] {
  return products.records
    .map(product => product.allMeta?.attributes?.handle?.text?.[0])
    .filter(Boolean);
}
```

### Data Merging Patterns
```typescript
/**
 * Merge search relevancy with Shopify product data.
 */
export function reorderVariantsByRelevancy(
  shopifyProducts: ProductDetail[],
  siteSearchProducts: ProductRecord[]
): ProductDetail[] {
  // Create relevancy map from search results
  const relevancyMap = new Map(
    siteSearchProducts.map((product, index) => [
      product.allMeta.attributes.handle.text[0],
      index
    ])
  );
  
  // Sort Shopify products by search relevancy
  return shopifyProducts.sort((a, b) => {
    const aRelevancy = relevancyMap.get(a.handle) ?? Infinity;
    const bRelevancy = relevancyMap.get(b.handle) ?? Infinity;
    return aRelevancy - bRelevancy;
  });
}
```

## Error Handling Patterns

### Consistent Error Handling
```typescript
/**
 * Standardized error handling across all request functions.
 */
export async function requestWithErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Log error with context
    console.error(`[${context}] Request failed:`, error);
    
    // Throw normalized error
    throw new Error(
      error instanceof Error 
        ? `${context}: ${error.message}`
        : `${context}: Unknown error occurred`
    );
  }
}

// Usage in request functions
export async function requestSearch(...params): Promise<RequestSearchResponse> {
  return requestWithErrorHandling(async () => {
    // Request implementation
  }, 'Search Request');
}
```

### Validation Patterns
```typescript
/**
 * Input validation for request functions.
 */
function validateRequestParams(
  shopTenant: string,
  appEnv: AppEnv,
  options: any
): void {
  if (!shopTenant?.trim()) {
    throw new Error('shopTenant is required');
  }
  
  if (!Object.values(AppEnv).includes(appEnv)) {
    throw new Error(`Invalid appEnv: ${appEnv}`);
  }
  
  if (!options?.collection?.trim()) {
    throw new Error('collection is required in options');
  }
}
```

## Testing Patterns

### Unit Testing Request Functions
```typescript
describe('requestSearch', () => {
  it('should make search request with correct parameters', async () => {
    // Mock dependencies
    const mockFetchSearchResults = jest.fn().mockResolvedValue(mockSearchResult);
    
    // Test the function
    const result = await requestSearch(
      'test-shop',
      AppEnv.Production,
      { collection: 'test', area: 'test' }
    );
    
    // Verify behavior
    expect(mockFetchSearchResults).toHaveBeenCalledWith(
      'test-shop',
      AppEnv.Production,
      expect.objectContaining({
        collection: 'test',
        area: 'test'
      })
    );
    
    expect(result).toHaveProperty('mergedProducts');
    expect(result).toHaveProperty('rawResponse');
  });
});
```

### Integration Testing with Shopify
```typescript
describe('Shopify Integration', () => {
  it('should fetch and merge product details', async () => {
    const handles = ['product-1', 'product-2'];
    const shopifyConfig = {
      storefrontUrl: 'https://test.myshopify.com/api/2023-01/graphql',
      accessToken: 'test-token'
    };
    
    // Mock Shopify response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShopifyResponse)
    });
    
    const result = await fetchStorefrontProducts(handles, shopifyConfig);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('handle', 'product-1');
  });
});
```

## Export Organization

### Barrel Export Pattern
```typescript
// Main index.ts - organized by functionality
export {
  // Search functionality
  requestSearch,
  lazyLoadMore,
  fetchStorefrontProducts,
  
  // Autocomplete functionality
  requestAutocomplete,
  requestAutocompleteWithSearch,
  
  // Recommendations functionality
  requestRecommendations
} from './specific-modules';

// Utility exports
export {
  // Search utilities
  parseSearchParams,
  formatRefinements,
  buildProductHandles,
  
  // Autocomplete utilities
  modifyQueryForAutocomplete,
  
  // Constants
  AUTOCOMPLETE_PREFIX
} from './utils';

// Type exports
export type {
  // Main interfaces
  RequestSearchOptions,
  RequestSearchResponse,
  RequestRecsOptions,
  RequestRecsResponse,
  
  // Supporting types
  ProductDetail,
  ShopifyConfig,
  RecsProduct,
  RecsFilter
} from './types';
```

## Common Anti-Patterns to Avoid

### API Design
- **Inconsistent Signatures**: Keep function signatures consistent
- **Hidden Dependencies**: Make all dependencies explicit parameters
- **Stateful Behavior**: Avoid global state or side effects
- **Poor Error Messages**: Provide descriptive error messages

### Type Safety
- **Using `any`**: Always define proper interfaces
- **Missing Validation**: Validate inputs at function boundaries
- **Inconsistent Naming**: Use consistent naming conventions
- **Missing JSDoc**: Document all public functions

### Data Handling
- **Mutating Parameters**: Never modify input parameters
- **Inconsistent Transformations**: Use consistent data transformation patterns
- **Missing Error Handling**: Handle all potential failure cases
- **Poor Performance**: Consider performance implications of data operations

## Performance Considerations

### Efficient Data Processing
```typescript
// Use efficient array methods
export function buildProductHandles(products: Products): string[] {
  // GOOD: Efficient filtering and mapping
  return products.records
    .map(product => product.allMeta?.attributes?.handle?.text?.[0])
    .filter(Boolean);
}

// AVOID: Inefficient nested loops
function inefficientHandleBuilding(products: Products): string[] {
  const handles = [];
  for (const product of products.records) {
    for (const attr in product.allMeta.attributes) {
      if (attr === 'handle') {
        handles.push(product.allMeta.attributes[attr].text[0]);
      }
    }
  }
  return handles;
}
```

### Lazy Loading Support
```typescript
/**
 * Support for incremental data loading.
 */
export async function lazyLoadMore(
  shopTenant: string,
  appEnv: AppEnv,
  currentPage: number,
  pageSize: number,
  searchOptions: LazyLoadMoreOptions,
  mergeShopifyData = true
): Promise<SearchResult | ProductDetail[]> {
  // Increment page for next set of results
  const nextPage = currentPage + 1;
  
  // Use same search logic but with updated pagination
  return requestSearch(
    shopTenant,
    appEnv,
    { ...searchOptions, page: nextPage, pageSize },
    mergeShopifyData
  );
}
```

---

*This layer should remain stateless and framework-agnostic to support both direct consumption and State Driver layer integration.*
