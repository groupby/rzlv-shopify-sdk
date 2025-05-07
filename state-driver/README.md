# Quick Start Guide

See below for important and common use cases of the State Driver SDK. Further documentation is available upon valid request to support@groupbyinc.com.

# Overview

This package is intended to be implemented within a Shopify Store to leverage GroupBy AI Search capabilities in place of Shopify's built-in Search.

The available SDK stateful functions can be used within a Shopify Theme or Custom Front-End that leverages a Shopify Backend.

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
// Example usage in a component
import React from "react";
import { useEffectorStore } from "./hooks/useEffectorStore";
import { searchInputStore, searchOutputStore } from "gbi-search-state-driver";

function MyComponent() {
  const inputState = useEffectorStore(searchInputStore);
  const outputState = useEffectorStore(searchOutputStore);
  
  return (
    <div>
      <p>Current query: {inputState.gbi_query}</p>
      <p>Total results: {outputState.totalRecordCount}</p>
    </div>
  );
}

export default MyComponent;
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
Thus, in our integration (both in React and non-module environments), we always call:
```
initSearchManager(searchManagerConfig);
initUrlManager(urlManagerConfig);
```
in that order.

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