# Quick Start Guide

See below for important and common use cases of the State Driver SDK. Further documentation is available upon valid request to support@groupbyinc.com.

# Overview

This package is intended to be implemented within a Shopify Store to leverage GroupBy AI Search and Recommendations capabilities in place of Shopify's built-in Search.

The available SDK stateful functions can be used within a Shopify Theme or Custom Front-End that leverages a Shopify Backend.

**Key Features:**
- **Search**: Full-text search with filtering, sorting, and pagination
- **Recommendations**: Product recommendations (similar products, trending, related items)
- **Autocomplete**: Search suggestions and autocomplete functionality
- **Framework Agnostic**: Works with React, Vue, vanilla JavaScript, and Shopify Liquid
- **State Management**: Built-in state management with reactive updates

# Pre-requisites

Usage of this SDK requires installation of the Shopify App within your Shopify Store: https://apps.shopify.com/groupby-ai-search-discovery

App installation will load your product catalog to GroupBy AI Search and provision a Search service instance for your store to be interacted with by the methods within this package.

# 1. Installing Our SDK
We publish our SDK as a UMD bundle so that it works as both an ES module and via the global window object. You can install it using either npm or yarn.
Using npm:

`npm install gbi-search-state-driver`

Using yarn:

`yarn add gbi-search-state-driver`


# 2. Global Exposure


When built in UMD format (using Rollup, Webpack, etc.), our SDK is automatically attached to the global object as window.GBISearchStateDriver. This is especially useful in non-module environments (such as Shopify Liquid assets). In a Shopify theme, you might include the UMD bundle like this:


```
{{ 'gbi-search-state-driver.umd.js' | asset_url | script_tag }}

<script>
  document.addEventListener("DOMContentLoaded", function() {
    // IMPORTANT: We initiate the Search Manager before the URL Manager.
    // This ensures that our static configuration is set up and our input store
    // is wired to trigger search requests. If the URL Manager initializes first,
    // it might read an uninitialized state or apply URL parameters prematurely.
    window.GBISearchStateDriver.initSearchManager({
      shopTenant: "yourShopTenant",
      appEnv: "Production",
      collection: "YourCollection",
      area: "YourArea",
      collectionId: "",
      mergeShopifyData: false,
    });
    
    // Initialize recommendations manager
    window.GBISearchStateDriver.recommendations.initRecsManager({
      shopTenant: "yourShopTenant",
      appEnv: "Production",
    });
    
    window.GBISearchStateDriver.initUrlManager({
      defaultPagesize: "12",
      source: "SEARCH",
      collectionId: "",
      paginationType: "paginate",
    });
  });
</script>
```

# 3. Using Our SDK in React
When using our SDK in a React application, we import functions directly from our package. (We no longer need to access the SDK via the window object.) Below are two examples: one using a custom hook to subscribe to Effector stores, and another showing how you could use the effector-react package.
## 3.1. Using a Custom React Hook
Below is our custom hook (we call it useEffectorStore) that subscribes to any Effector store. This hook lets our components automatically update when the store’s state changes.


```
// src/hooks/useEffectorStore.js
import { useState, useEffect } from "react";

export function useEffectorStore(store) {
  const [state, setState] = useState(store.getState());
  
  useEffect(() => {
    // Subscribe to the store updates.
    const unsubscribe = store.watch((newState) => {
      setState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, [store]);
  
  return state;
}
```

In our React components we can now use this hook to access the SDK stores. For example:

```
// Search component example
import React from "react";
import { useEffectorStore } from "./hooks/useEffectorStore";
import { searchInputStore, searchOutputStore } from "gbi-search-state-driver";

function SearchComponent() {
  const inputState = useEffectorStore(searchInputStore);
  const outputState = useEffectorStore(searchOutputStore);
  
  return (
    <div>
      <p>Current query: {inputState.gbi_query}</p>
      <p>Total results: {outputState.totalRecordCount}</p>
    </div>
  );
}

// Recommendations component example
import { recommendations } from "gbi-search-state-driver";

function RecommendationsComponent() {
  const recsState = useEffectorStore(recommendations.recsOutputStore);
  
  return (
    <div>
      {recsState.loading ? (
        <p>Loading recommendations...</p>
      ) : (
        <div>
          {recsState.products.map(product => (
            <div key={product.id}>{product.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```
## 3.2. Using the effector-react Package
If preferred, we can use the effector-react package. (Make sure to install it via npm or yarn.)
Using npm:

`npm install effector-react`

Using yarn:

`yarn add effector-react`

Then in your component:

```
// ExampleComponent.js
import React from "react";
import { useStore } from "effector-react";
import { searchInputStore, searchOutputStore } from "gbi-search-state-driver";

function ExampleComponent() {
  const inputState = useStore(searchInputStore);
  const outputState = useStore(searchOutputStore);
  
  return (
    <div>
      <p>Query: {inputState.gbi_query}</p>
      <p>Total Results: {outputState.totalRecordCount}</p>
    </div>
  );
}

export default ExampleComponent;
```

# 4. Ensuring Proper Initialization Order
Important: We must initialize the Search Manager before the URL Manager.
 The Search Manager sets up our static configuration (such as shopTenant, appEnv, etc.) and wires the input store to trigger search requests whenever it changes. The URL Manager reads the state from the input store to update the URL parameters. If the URL Manager initializes first, it may capture an uninitialized state and apply URL parameters that are not in sync with our configuration.

For recommendations, the Recommendations Manager can be initialized independently and doesn't affect the search initialization order.

Thus, in our integration (both in React and non-module environments), we initialize in this order:
```
// 1. Initialize Search Manager first
initSearchManager(searchManagerConfig);

// 2. Initialize Recommendations Manager (independent)
recommendations.initRecsManager(recsManagerConfig);

// 3. Initialize URL Manager last
initUrlManager(urlManagerConfig);
```

# 5. Handling Search State and Loading
When a new search is performed, we want to start fresh—clearing any previously applied refinements and resetting the page number to ensure the results aren’t affected by old filters. Instead of calling handleSearchInput directly, we use the updateInputStore method to update the input store. This gives us full control over the search state and decouples the initiation of a new search from the default Search Manager behavior.
Resetting Search State with updateInputStore
By using the SDK’s updateInputStore function, we can explicitly reset the input state. This ensures that even if the same query is submitted, the search will be performed as a fresh search (without previous filters). For example:

```
// In our React component
import { useCallback } from 'react';
import { updateInputStore } from 'gbi-search-state-driver';
import { debounce } from './debounce'; // Assume a simple debounce implementation

const debouncedSearch = useCallback(
  debounce((q) => {
    updateInputStore((currentState) => ({
      ...currentState,
      gbi_query: q,
      hasSubmitted: true, // Flag that a search has been submitted
      refinements: [],    // Clear any previously applied refinements
      page: 1,            // Reset pagination to the first page
    }));
  }, 300),
  []
);
```
Using this approach, every new search starts with a clean state, ensuring consistent and predictable search results. This method is especially useful when we want to reset the search state without relying on the default behavior of the Search Manager. We can then maintain a decoupling from the Search Manager being required to manage this behavior since we might not want that in some scenarios (and `handleSearchInput()` can be called directly in that case).

## 5.1. Displaying a Loading State
Our SDK maintains a loading state in the output store. This state can be used to show a loading indicator (such as a spinner) while the search request is in progress. In our components, we can subscribe to the output store and conditionally render a loading spinner.
```
// src/components/SearchResults.js
import React from 'react';
import { useEffectorStore } from '../hooks/useEffectorStore'; // or `effector-react`
import { searchOutputStore } from 'gbi-search-state-driver';
import Spinner from './Spinner';
import SearchResultsGrid from './SearchResultsGrid';

const SearchResults = () => {
  const outputState = useEffectorStore(searchOutputStore);

  return (
    <div>
      {outputState.loading ? (
        <Spinner />
      ) : (
        <SearchResultsGrid data={outputState.products} />
      )}
    </div>
  );
};

export default SearchResults;
```




# 6. Using UI Functions
Our SDK provides UI functions to handle common interactions. A full list of currently available UI Functions are (TSDoc will be released for each):
- `applyRange`
- `handleNextPage`
- `handlePageSizeChange`
- `handlePreviousPage`
- `handleRefinementChange`
- `handleSearchInput`
- `handleSortOrderChange`

Below are some examples in action:
## 6.1. Pagination
To handle pagination, we use the UI function handleNextPage. In React, we simply import and call it:
```
import { handleNextPage } from "gbi-search-state-driver";

function PaginationButton() {
  const handleNext = () => {
    console.log("Next page requested");
    handleNextPage();
  };

  return (
    <button onClick={handleNext}>Next Page</button>
  );
}
```

## 6.2. Refinement Change
When a user toggles a filter, we call handleRefinementChange to update the input store and trigger a new search:
```
import { handleRefinementChange } from "gbi-search-state-driver";

function FilterCheckbox({ navigationName, refinementValue }) {
  const handleChange = (e) => {
    handleRefinementChange(navigationName, refinementValue, e.target.checked);
  };

  return (
    <label>
      <input type="checkbox" onChange={handleChange} />
      {refinementValue}
    </label>
  );
}
```

# 7. Conditional Rendering Using hasSubmitted
We include a hasSubmitted property in our input store to determine if a search has been performed. This allows us to conditionally render components (such as search results, navigation, and pagination) only after the first search. For example, in our React component:
```
function MainContainer() {
  const inputState = useEffectorStore(searchInputStore);
  const hasSubmitted = inputState.hasSubmitted;

  return (
    <div>
      {/* Header and search input always visible */}
      <Header /* ... */ />

      {/* Only show the following if a search has been submitted */}
      {hasSubmitted ? (
        <>
          <NavigationPanel />
          <SearchSummary />
          <SearchResultsContainer />
          <Pagination />
        </>
      ) : (
        <p>Please perform a search.</p>
      )}
    </div>
  );
}
```

# 8. Recommendations

The SDK includes a comprehensive recommendations system for displaying product recommendations (similar products, trending, related items, etc.). All recommendations functionality is namespaced under `GBISearchStateDriver.recommendations` to avoid conflicts with search functionality.

## 8.1. Initializing the Recommendations Manager

Before using recommendations, you must initialize the recommendations manager with your configuration:

```javascript
// Initialize the recommendations manager
GBISearchStateDriver.recommendations.initRecsManager({
  shopTenant: "yourShopTenant",
  appEnv: "Production", // or "Development"
});
```

## 8.2. Setting Up and Fetching Recommendations

To fetch recommendations, use the `setupRecommendations` function with your desired parameters:

```javascript
// Set up recommendations parameters and fetch
GBISearchStateDriver.recommendations.setupRecommendations({
  name: "similar-products",           // Recommendation model name
  collection: "your-collection",      // Shopify collection
  pageSize: 5,                       // Number of recommendations per page
  productID: "12345",                // Current product ID (for related/similar products)
  visitorId: "visitor-123",          // Optional: visitor identification
  loginId: "user-456",               // Optional: logged-in user identification
  eventType: "detail-page-view",     // Optional: event type context
  area: "pdp",                       // Optional: area context
  filters: [                         // Optional: additional filters
    {
      field: "brand",
      value: "Nike",
      exclude: "false"
    }
  ]
});
```

## 8.3. Accessing Recommendations State

The recommendations system provides a single output store that contains everything your UI needs:

### Using a Custom React Hook (Recommended)

```javascript
// Using the same useEffectorStore hook from the search examples
import { useEffectorStore } from "./hooks/useEffectorStore";

function RecommendationsCarousel() {
  const recsState = useEffectorStore(GBISearchStateDriver.recommendations.recsOutputStore);
  
  // Everything you need is in one object
  const { 
    products,     // Current page products (what UI displays)
    loading,      // Loading state
    error,        // Error state
    pagination,   // Pagination info
    metadata      // Response metadata
  } = recsState;

  if (loading) return <div>Loading recommendations...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!products.length) return <div>No recommendations found</div>;

  return (
    <div className="recommendations-carousel">
      <h3>You might also like</h3>
      <div className="products-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {pagination.totalPages > 1 && (
        <PaginationControls 
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
        />
      )}
    </div>
  );
}
```

### Using Vanilla JavaScript (Non-Module Environment)

```javascript
// Subscribe to recommendations state changes
const unsubscribe = window.GBISearchStateDriver.recommendations.recsOutputStore.watch((state) => {
  if (state.loading) {
    document.getElementById('recs-container').innerHTML = '<div>Loading...</div>';
  } else if (state.error) {
    document.getElementById('recs-container').innerHTML = `<div>Error: ${state.error}</div>`;
  } else {
    renderRecommendations(state.products);
  }
});

// Get current state
const currentState = window.GBISearchStateDriver.recommendations.recsOutputStore.getState();
```

## 8.4. Pagination Controls

The recommendations system includes built-in pagination functions:

```javascript
// Navigation functions
GBISearchStateDriver.recommendations.nextPage();        // Go to next page
GBISearchStateDriver.recommendations.previousPage();   // Go to previous page
GBISearchStateDriver.recommendations.resetRecs();      // Reset to first page

// Change page size
GBISearchStateDriver.recommendations.setRecsPageSize(10);

// Example pagination component
function PaginationControls({ currentPage, totalPages }) {
  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      GBISearchStateDriver.recommendations.nextPage();
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      GBISearchStateDriver.recommendations.previousPage();
    }
  };

  return (
    <div className="pagination">
      <button onClick={handlePrevious} disabled={currentPage === 0}>
        Previous
      </button>
      <span>Page {currentPage + 1} of {totalPages}</span>
      <button onClick={handleNext} disabled={currentPage >= totalPages - 1}>
        Next
      </button>
    </div>
  );
}
```

## 8.5. Common Recommendation Use Cases

### Product Detail Page (Similar Products)
```javascript
// On product detail page
GBISearchStateDriver.recommendations.setupRecommendations({
  name: "similar-products",
  collection: "all-products",
  pageSize: 4,
  productID: currentProduct.id,
  eventType: "detail-page-view"
});
```

### Cart Page (Frequently Bought Together)
```javascript
// On cart page
GBISearchStateDriver.recommendations.setupRecommendations({
  name: "frequently-bought-together",
  collection: "all-products",
  pageSize: 3,
  productID: cartItems.map(item => item.id), // Array of product IDs
  eventType: "cart-view"
});
```

### Homepage (Trending Products)
```javascript
// On homepage
GBISearchStateDriver.recommendations.setupRecommendations({
  name: "trending",
  collection: "featured-products",
  pageSize: 8,
  visitorId: getVisitorId(),
  eventType: "homepage-view"
});
```

## 8.6. Output Store Structure

The `recsOutputStore` provides a comprehensive state object:

```typescript
interface RecsResultsOutput {
  products: RecsProduct[];          // Current page products (what UI displays)
  allProducts: RecsProduct[];       // All products (for internal pagination)
  pagination: {
    currentPage: number;            // Current page index (0-based)
    pageSize: number;               // Number of products per page
    totalPages: number;             // Total number of pages
    totalRecords: number;           // Total number of products
  };
  metadata: {
    modelName: string;              // Name of the recommendation model used
    totalCount: number;             // Total count from API response
  };
  loading: boolean;                 // Whether a request is in progress
  error: string | null;             // Error message if request failed
  rawResponse?: unknown;            // Full API response for debugging
}
```

## 8.7. Advanced Usage

### Conditional Rendering Based on State
```javascript
function SmartRecommendations() {
  const recsState = useEffectorStore(GBISearchStateDriver.recommendations.recsOutputStore);
  
  // Don't render anything if no recommendations were requested yet
  if (!recsState.metadata.modelName) return null;
  
  return (
    <div>
      {recsState.loading && <LoadingSpinner />}
      
      {!recsState.loading && recsState.error && (
        <ErrorMessage message={recsState.error} />
      )}
      
      {!recsState.loading && !recsState.error && recsState.products.length > 0 && (
        <RecommendationsGrid products={recsState.products} />
      )}
      
      {!recsState.loading && !recsState.error && recsState.products.length === 0 && (
        <EmptyState message="No recommendations available" />
      )}
    </div>
  );
}
```

### Multiple Recommendation Sections
```javascript
// You can reinitialize with different parameters for different sections
function setupRelatedProducts() {
  GBISearchStateDriver.recommendations.setupRecommendations({
    name: "related-products",
    collection: "all-products",
    pageSize: 6,
    productID: currentProduct.id
  });
}

function setupTrendingProducts() {
  GBISearchStateDriver.recommendations.setupRecommendations({
    name: "trending",
    collection: "featured-products",
    pageSize: 8
  });
}
```

## 8.8. Best Practices

1. **Initialize Once**: Call `initRecsManager` once during app initialization
2. **Single Store**: Use the unified `recsOutputStore` for all UI state needs
3. **Error Handling**: Always handle loading and error states in your UI
4. **Pagination**: Use built-in pagination functions for consistent behavior
5. **Performance**: The `products` field contains only current page items for optimal rendering
6. **Debugging**: Use `rawResponse` field for debugging API responses

## 8.9. Migration from Individual Stores

If you were previously using individual stores, here's how to migrate:

```javascript
// OLD (multiple stores)
const products = useEffectorStore(recsCurrentPageStore);
const loading = useEffectorStore(recsLoadingStore);
const error = useEffectorStore(recsErrorStore);

// NEW (single store)
const { products, loading, error } = useEffectorStore(GBISearchStateDriver.recommendations.recsOutputStore);
```