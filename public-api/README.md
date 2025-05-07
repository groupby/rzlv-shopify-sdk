# Installation

We install our SDK via npm or yarn:
```
# Using npm:
npm install gbi-search-state-driver gbi-search-public-api
```

# Overview

This package is intended to be implemented within a Shopify Store to leverage GroupBy AI Search capabilities in place of Shopify's built-in Search.

The available SDK functions can be used within a Shopify Theme or Custom Front-End that leverages a Shopify Backend.

# Pre-requisites

Usage of this SDK requires installation of the Shopify App within your Shopify Store: https://apps.shopify.com/groupby-ai-search-discovery

App installation will load your product catalog to GroupBy AI Search and provision a Search service instance for your store to be interacted with by the methods within this package.

# Supported functions
Common search functions wrapped around search API requests to the GroupBy Search engine include:
- `requestSearch` - Fundamental search request builder and requester that will return a Search Response.
- `lazyLoadMore` - Fetches additional search results for lazy loading functionality.
- `requestAutocomplete` - Sends an Autocomplete request to GBI Search and returns only the Autocomplete response.
- `requestAutocompleteWithSearch` - Sends an Autocomplete request to GBI Search and returns the Autocomplete + Search Products response. 

*Further documentation is available upon valid request to support@groupbyinc.com*