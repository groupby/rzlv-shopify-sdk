# GBI Shopify SDK

This SDK provides integration between Shopify and GroupBy services.

## Components

The SDK consists of two main components:

1. **Public API** - Provides direct access to GroupBy services
2. **State Driver** - Manages state and provides higher-level functionality

## Public API

### Search

- `requestSearch` - Performs a search request
- `lazyLoadMore` - Loads more search results

### Autocomplete

- `requestAutocomplete` - Performs an autocomplete request
- `requestAutocompleteWithSearch` - Performs an autocomplete request with search

### Recommendations

- `requestRecommendations` - Performs a recommendations request

Example:
```typescript
import { requestRecommendations, AppEnv } from 'gbi-shopify-sdk';

// Request recommendations
const response = await requestRecommendations(
  "shop123",
  AppEnv.Production,
  {
    name: "similar-items",
    fields: ["*"],
    collection: "products",
    pageSize: 10,
    productID: "12345"
  }
);
```

## State Driver

### Search Manager

- `initSearchManager` - Initializes the search manager
- `searchInputStore` - Store for search input parameters
- `searchOutputStore` - Store for search results

### Recommendations Manager

- `initRecsManager` - Initializes the recommendations manager
- `fetchRecommendations` - Fetches recommendations
- `getCurrentPageProducts` - Gets products for the current page
- `nextPage` - Navigates to the next page of recommendations
- `previousPage` - Navigates to the previous page of recommendations
- `setPageSize` - Sets the page size for client-side pagination
- `goToPage` - Navigates to a specific page

Example:
```typescript
import { initRecsManager, getCurrentPageProducts, nextPage, previousPage } from 'gbi-shopify-sdk';

// Initialize the recommendations manager
initRecsManager({
  shopTenant: "shop123",
  appEnv: AppEnv.Production,
  name: "similar-items",
  collection: "products",
  pageSize: 10,
  productID: "12345"
});

// Get current page of recommendations
const products = getCurrentPageProducts();

// Navigate between pages
nextPage();
previousPage();
```

Note: The RecsManager handles client-side pagination of recommendations, as the recommendations API does not support server-side pagination.
