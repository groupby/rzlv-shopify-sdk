import {
  RefinementType,
  SortOrder,
  QueryParams,
  DefaultValues,
  AppEnv,
  AUTOCOMPLETE_PREFIX,
} from './searchUtils.types';

import type {
  SearchParams,
  Refinement,
  SortObject,
  FetchSearchResultsArgs,
  SearchResult,
  SearchBeaconType,
  ModifiedQueryResult,
  ProductRecord,
  Products,
  ProductDetail,
  ProductDetailsResult,
  ProductVariant,
} from './searchUtils.types';

import type { ShopifyConfig } from '../search-requester/fetchStorefrontProducts';
import { fetchStorefrontProducts } from '../search-requester/fetchStorefrontProducts';

/**
 * Handles the fetch response by throwing an error if the response is not OK,
 * otherwise parsing and returning the JSON data.
 *
 * @param response - The fetch Response object.
 * @returns The parsed JSON data.
 *
 * @throws Will throw an error if the response is not ok.
 */
async function handleFetchResponse(response: Response): Promise<any> {
  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Failed to fetch search results: ${errorMessage}`);
  }
  return response.json();
}

/**
 * Adjusts the first range refinement in the search results by subtracting 0.01 from its "high" value.
 *
 * @param products - The search results.
 */
function adjustRangeRefinements(products: SearchResult): void {
  products?.selectedNavigation?.forEach(navigation => {
    if (navigation.type === RefinementType.Range) {
      const firstRefinement = navigation.refinements?.[0];
      if (firstRefinement?.type === RefinementType.Range) {
        firstRefinement.high -= 0.01;
      }
    }
  });
}

/**
 * Fetches search results from the GBI Search API.
 *
 * @param shopTenant - The shop tenant identifier.
 * @param appEnv - The application environment.
 * @param gbiSearchArgs - The search arguments built by `buildSearchArguments`.
 * @returns A promise that resolves to the search results.
 *
 * @throws Will throw an error if the network response is not ok.
 */
export async function fetchSearchResults(
  shopTenant: string,
  appEnv: AppEnv,
  gbiSearchArgs: FetchSearchResultsArgs
): Promise<SearchResult> {
  const endpoint = `https://${appEnv === AppEnv.Production ? AppEnv.ProxyProd : AppEnv.ProxyDev}.groupbycloud.com/${shopTenant}/api/search`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Application-Type': 'search',
    'X-Groupby-Customer-Id': shopTenant,
    'Skip-Caching': 'true',
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(gbiSearchArgs),
    });

    const products = await handleFetchResponse(response);
    adjustRangeRefinements(products);
    return products;
  } catch (error) {
    throw error;
  }
}

/**
 * Parses the URL search parameters into a SearchParams object.
 *
 * @param urlParams - The URLSearchParams instance.
 * @returns The parsed search parameters.
 */
export function parseSearchParams(urlParams: URLSearchParams): SearchParams {
  const query = urlParams.get(QueryParams.Query);
  const pageSize = urlParams.get(QueryParams.PageSize);
  const sortBy = (urlParams.get(QueryParams.SortBy) as SortOrder) ?? DefaultValues.SortBy;
  const pageNumber = urlParams.get(QueryParams.PageNumber);
  const refinements = urlParams.getAll(QueryParams.Refinement).flatMap(refinement =>
    refinement.split(',').filter(r => r.includes(':'))
  );

  return { query, pageSize, sortBy, pageNumber, refinements };
}

/**
 * Formats an array of refinement strings into an array of refinement objects.
 *
 * @param refinements - An array of refinement strings.
 * @returns An array of formatted refinement objects.
 */
export function formatRefinements(refinements: string[]): Refinement[] {
  return refinements
    .map(refinement => {
      const [navigationName, value] = refinement.split(':');
      if (!navigationName || !value) return null;

      const isRange = value.includes('--to--');
      if (isRange) {
        const [low, high] = value.split('--to--').map(Number);
        return {
          navigationName: decodeURIComponent(navigationName),
          type: RefinementType.Range,
          displayName: "refinement",
          or: true,
          low,
          high: high + 0.01,
        } as Refinement;
      } else {
        return {
          navigationName: decodeURIComponent(navigationName),
          type: RefinementType.Value,
          displayName: "refinement",
          or: true,
          value: decodeURIComponent(value),
        } as Refinement;
      }
    })
    .filter((refinement): refinement is Refinement => refinement !== null);
}

/**
 * Parses the sort parameter string into an array of sort objects.
 *
 * @param sortString - The sort parameter string.
 * @returns An array of sort objects.
 */
export function parseSortParameter(sortString: string = ''): SortObject[] {
  const [field, order] = sortString.split('-');
  if (!field || !order) return [];

  const sortOrder = (order.toLowerCase() as SortOrder);

  return [{
    field,
    order: sortOrder,
  }];
}

/**
 * Modifies the query for autocomplete, stripping a known prefix if present.
 *
 * @param query - The original search query.
 * @returns An object containing the modified query and the corresponding search beacon type.
 */
export function modifyQueryForAutocomplete(query: string): ModifiedQueryResult {
  const initialSearchBeaconType: SearchBeaconType = {
    recommendations: false,
    navigation: false,
    dym: false,
    sayt: false,
    search: true,
  };

  if (!query) {
    return { modifiedQuery: query, searchBeaconType: initialSearchBeaconType };
  }

  const isAutocomplete = query.includes(AUTOCOMPLETE_PREFIX);
  const modifiedQuery = isAutocomplete ? query.replaceAll(AUTOCOMPLETE_PREFIX, '') : query;
  const searchBeaconType = {
    ...initialSearchBeaconType,
    search: !isAutocomplete,
    sayt: isAutocomplete,
  };

  return { modifiedQuery, searchBeaconType };
}

/**
 * Retrieves the next page number from the DOM element representing the "Show More" button.
 * (Note: This function uses direct DOM manipulation and should be refactored when the outer layer is data driven.)
 *
 * @param isMore - Whether there are more pages.
 * @param currentPageNumber - The current page number.
 * @returns The next page number as a string.
 */
export function getNextPageNumber(isMore: boolean, currentPageNumber: string): string {
  if (!isMore) {
    return currentPageNumber;
  }

  const pageButton = document.querySelector('.gbi-search-show-more > div > button')?.getAttribute('data-page');
  return pageButton ? (parseInt(pageButton, 10) + 1).toString() : currentPageNumber;
}

/**
 * Builds an array of product handles from the search results.
 *
 * @param products - The search results containing product records.
 * @returns An array of product handles.
 */
export function buildProductHandles(products: Products): string[] {
  return products.records.map((record: ProductRecord) => {
    if (record.allMeta?.attributes?.handle?.text?.length) {
      return record.allMeta.attributes.handle.text[0];
    }
    return record.allMeta?.title;
  });
}

/**
 * Fetches detailed product data from Shopify given an array of product handles.
 *
 * @param handles - An array of Shopify product handles.
 * @returns A promise that resolves to an object containing the fetched product details.
 */
export async function fetchProductDetails(handles: string[], shopifyConfig: ShopifyConfig): Promise<ProductDetailsResult> {

  if (shopifyConfig) {
    return fetchStorefrontProducts(handles, shopifyConfig);
  } else {
    const promises = handles.map(async handle => {
      try {
        const url = `/products/${handle}.js`;
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Could not find ${handle}`);
          return null;
        }
        const data = await response.json() as ProductDetail;
        return data;
      } catch (e) {
        console.warn(`Error fetching ${handle}`, e);
        return null;
      }
    });

    const products = await Promise.all(promises);

    // Filter out any null or undefined products
    const validProducts = products.filter(product => product !== null && product !== undefined);

    return { products: validProducts };
  }
}

/**
 * Reorders Shopify product variants based on the relevancy ordering provided by the site search API.
 *
 * @param shopifyProducts - Array of detailed Shopify products.
 * @param siteSearchProducts - Array of site search product records.
 * @returns The array of Shopify products with reordered variants.
 */
export function reorderVariantsByRelevancy(shopifyProducts: ProductDetail[], siteSearchProducts: ProductRecord[]): ProductDetail[] {
  return shopifyProducts.map(product => {
    // Find the corresponding product in the Site Search API response by ID
    const siteSearchProduct = siteSearchProducts.find(ssProduct => {
      return ssProduct?.allMeta?.id === product.id.toString();
    });

    if (!siteSearchProduct) {
      // If no matching product is found, return the product as is
      return product;
    }

    // Extract the relevant variant IDs from the Site Search product
    const relevantVariantIds = siteSearchProduct.allMeta?.variants?.map((variant: { id: string }) => variant.id.toString());

    if (!relevantVariantIds) {
      // If no relevant variant IDs are found, return the product as is
      return product;
    }

    // Reorder variants so that they match the order of relevant variant IDs from the Site Search product
    const reorderedVariants = relevantVariantIds
      .map((id: string) => product.variants.find(variant => variant.id.toString() === id))
      .filter((variant: ProductVariant | undefined): variant is ProductVariant => Boolean(variant));

    // Include the remaining variants that were not in the relevant list
    const remainingVariants = product.variants.filter(variant => !relevantVariantIds.includes(variant.id.toString()));

    return {
      ...product,
      ...siteSearchProduct,
      variants: [...reorderedVariants, ...remainingVariants],
    };
  });
}

/**
 * Transforms the site search products by merging with Shopify product details and reordering product variants for relevancy.
 *
 * @param siteSearchProducts - The products data from the site search API.
 * @returns A promise that resolves to an array of Shopify products with reordered variants.
 */
export async function transformProductsForVariantRelevancy(siteSearchProducts: Products, shopifyConfig: ShopifyConfig): Promise<ProductDetail[]> {
  const handles = buildProductHandles(siteSearchProducts);

  // Fetch product details from Shopify
  const { products: shopifyProducts } = await fetchProductDetails(handles, shopifyConfig);

  if (!shopifyProducts || shopifyProducts.length === 0) {
    return [];
  }

  // Reorder variants within each product based on relevancy from Site Search API
  const validShopifyProducts = shopifyProducts.filter((product): product is ProductDetail => product !== null);
  const reorderedProducts = reorderVariantsByRelevancy(validShopifyProducts, siteSearchProducts.records);
  return reorderedProducts;
}

/**
 * Builds the preFilter string used in the search arguments.
 *
 * @param collectionId - The optional collection ID.
 * @returns The preFilter string for a 'standard' or 'collections' page, respectively.
 */
export function buildPreFilter(collectionId: string | undefined): string {
  const availabilityFilter = 'availability:ANY("IN_STOCK")'; // TODO: move to constants
  if (collectionId) {
    return `attributes.collections:ANY("${collectionId}") AND ${availabilityFilter}`;
  }
  return availabilityFilter;
}

/**
 * Builds the search arguments for the GBI Search API request.
 *
 * @param options - An object containing search parameters.
 * @returns The formatted search arguments for the API request.
 */
interface BuildSearchArgsOptions {
  query: string;
  collection: string;   // e.g. "Production"
  area: string;         // e.g. "Production"
  page: number;         // 1,2,3
  pageSize: number;     // 12,24,...
  sortBy: string;       // 'relevance','price-asc', etc
  refinements: string[];
  collectionId?: string;
}

export function buildSearchArguments(options: BuildSearchArgsOptions): FetchSearchResultsArgs {
  const skip = (options.page - 1) * options.pageSize;

  return {
    query: options.query || '',
    collection: options.collection,
    area: options.area,
    pageSize: options.pageSize,
    sorts: parseSortParameter(options.sortBy),
    fields: ["*"],
    dynamicFacet: false,
    preFilter: buildPreFilter(options.collectionId),
    skip,
    refinements: formatRefinements(options.refinements),
  };
}
