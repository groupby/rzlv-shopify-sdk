import { transformProductsForVariantRelevancy } from '../utils/searchUtils';
import { AppEnv } from '../utils/searchUtils.types';
import { ShopifyConfig } from '../search-requester/fetchStorefrontProducts';

export { AppEnv };

export interface RecsFilter {
  field: string;
  value: string;
  exclude: string;
  required: string;
}

export interface RequestRecsOptions {
  name: string;
  fields: string[];
  collection: string;
  pageSize: number;
  productID?: string;
  visitorId?: string;
  loginId?: string;
  filters?: RecsFilter[];
  eventType?: string;
}

export interface RecsProduct {
  id: string;
  name?: string;
  title?: string;
  categories?: string[];
  description?: string;
  uri?: string;
  images?: {
    uri: string;
    height?: number;
    width?: number;
  }[];
  price?: {
    value: number;
    currency?: string;
  };
  originalPrice?: {
    value: number;
    currency?: string;
  };
  attributes?: {
    [key: string]: {
      text?: string[];
      numbers?: number[];
    };
  };
  variants?: RecsProduct[];
  availableQuantity?: number;
  tags?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: {
    averageRating: number;
    ratingCount: number;
  };
  availableTime?: string;
}

export interface RecsMetadata {
  modelName: string;
  totalCount: number;
  requestId?: string;
}

export interface RequestRecsResponse {
  products: RecsProduct[];
  metadata: RecsMetadata;
  rawResponse: any;
}

async function handleRecsResponse(response: Response): Promise<any> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.message || await response.text();
    throw new Error(`Failed to fetch recommendations: ${errorMessage}`);
  }
  return response.json();
}

async function fetchRecommendations(
  shopTenant: string,
  appEnv: AppEnv,
  recsOptions: RequestRecsOptions
): Promise<any> {
  const endpoint = `https://${appEnv === AppEnv.Production ? AppEnv.ProxyProd : AppEnv.ProxyDev}.groupbycloud.com/${shopTenant}/api/recommendation`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Application-Type': 'recsapi',
    'X-Groupby-Customer-Id': shopTenant,
    'Skip-Caching': 'true',
  };

  const requestBody = {
    name: recsOptions.name,
    fields: recsOptions.fields && recsOptions.fields.length > 0 ? recsOptions.fields : ['*'],
    collection: recsOptions.collection,
    pageSize: recsOptions.pageSize,
    ...(recsOptions.productID && { productID: recsOptions.productID }),
    ...(recsOptions.visitorId && { visitorId: recsOptions.visitorId }),
    ...(recsOptions.loginId && { loginId: recsOptions.loginId }),
    ...(recsOptions.filters && { filters: recsOptions.filters }),
    ...(recsOptions.eventType && { eventType: recsOptions.eventType }),
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    return await handleRecsResponse(response);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }
}

export async function requestRecommendations(
  shopTenant: string,
  appEnv: AppEnv,
  recsOptions: RequestRecsOptions,
  mergeShopifyData: boolean = true,
  shopifyConfig?: ShopifyConfig
): Promise<RequestRecsResponse> {
  try {
    if (!recsOptions.name) {
      throw new Error('Recommendation model name is required');
    }

    if (!recsOptions.collection) {
      throw new Error('Collection name is required');
    }

    if (!recsOptions.pageSize || recsOptions.pageSize <= 0) {
      throw new Error('Page size must be a positive number');
    }

    const modelsRequiringProductID = ['similar-items', 'frequently-bought-together', 'others-you-may-like'];
    if (modelsRequiringProductID.includes(recsOptions.name.toLowerCase()) && !recsOptions.productID) {
      throw new Error(`Product ID is required for the "${recsOptions.name}" recommendation model`);
    }

    const recsResults = await fetchRecommendations(shopTenant, appEnv, recsOptions);

    // Phase 3: Fix API response mapping - API returns 'records' not 'products'
    const formattedResponse: RequestRecsResponse = {
      products: recsResults.records || recsResults.products || [],
      metadata: {
        modelName: recsOptions.name,
        totalCount: recsResults.totalCount || recsResults.records?.length || recsResults.products?.length || 0,
        requestId: recsResults.requestId,
      },
      rawResponse: recsResults,
    };

    if (mergeShopifyData) {
      try {
        const mergedProducts = await transformProductsForVariantRelevancy({
          records: formattedResponse.products.map(product => ({
            allMeta: {
              id: product.id,
              title: (product.title || product.name || ''),
              attributes: {
                handle: {
                  text: [product.uri?.split('/').pop() || product.id]
                }
              }
            }
          }))
        }, shopifyConfig!);

        return {
          products: mergedProducts as unknown as RecsProduct[],
          metadata: formattedResponse.metadata,
          rawResponse: recsResults
        };
      } catch (error) {
        console.warn('Error merging Shopify data, returning raw products:', error);
        return formattedResponse;
      }
    } else {
      return formattedResponse;
    }
  } catch (error) {
    console.error('Error in requestRecommendations:', error);
    throw error;
  }
}
