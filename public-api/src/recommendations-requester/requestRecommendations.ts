import { AppEnv } from '../utils/searchUtils.types';

export { AppEnv };

// TODO: abstract types to a shared location
/**
 * A filter to apply to the recommendations request.
 */
export interface RecsFilter {
  field: string;
  value: string;
  exclude?: boolean;
  derivedFromProduct?: boolean;
}

/**
 * Configuration options for the Recommendations Manager.
 */
export interface RecsManagerConfig {
  shopTenant: string;
  /** Application environment (e.g., Production, ProxyDev) */
  appEnv: AppEnv;
  name: string;
  collection: string;
  area?: string;
  fields?: string[];
  pageSize: number;
  limit?: string;
  productID?: string | string[];
  /** List of products for context-based recommendations */
  products?: RecsRequestProduct[];
  visitorId?: string;
  loginId?: string;
  /** List of filters to apply */
  filters?: RecsFilter[];
  rawFilter?: string;
  placement?: string;
  eventType?: string;
  debug?: boolean;
  strictFiltering?: boolean;
  initialized?: boolean;
}

export interface RequestRecsOptions {
  name: string;
  fields?: string[];
  collection: string;
  pageSize: number;
  limit?: string;
  productID?: string | string[];
  /** List of products for context-based recommendations */
  products?: RecsRequestProduct[];
  visitorId?: string;
  loginId?: string;
  /** List of filters to apply */
  filters?: RecsFilter[];
  rawFilter?: string;
  placement?: string;
  eventType?: string;
  debug?: boolean;
  strictFiltering?: boolean;
}

export interface RecsRequestProduct {
  id: string;
  quantity?: number;
}

/**
 * A product returned in the recommendations response.
 */
export interface RecsProduct {
  id: string;
  title?: string;
  handle?: string;
  /** Additional dynamic fields */
  [key: string]: unknown;
}

/**
 * The response from the recommendations API.
 */
export interface RequestRecsResponse {
  /** Array of recommended products */
  products: RecsProduct[];
  metadata: {
    modelName: string;
    totalCount: number;
  };
  rawResponse: unknown;
}

/**
 * @param shopTenant
 * @param appEnv
 * @param recsOptions
 */
export async function requestRecommendations(
  shopTenant: string,
  appEnv: AppEnv,
  recsOptions: RequestRecsOptions
): Promise<RequestRecsResponse> {
  const endpoint = `https://${appEnv === AppEnv.Production ? AppEnv.ProxyProd : AppEnv.ProxyDev}.groupbycloud.com/${shopTenant}/api/recommendation`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Application-Type': 'recsapi',
    'X-Groupby-Customer-Id': shopTenant,
  };

  const requestBody: Record<string, unknown> = {
    name: recsOptions.name,
    fields: recsOptions.fields ?? ['*'],
    collection: recsOptions.collection,
    pageSize: String(recsOptions.pageSize),
  };

  if (recsOptions.limit) {
    requestBody.limit = recsOptions.limit;
  }

  if (recsOptions.productID) {
    requestBody.productID = Array.isArray(recsOptions.productID)
      ? recsOptions.productID
      : [recsOptions.productID];
  }

  if (recsOptions.products) {
    requestBody.products = recsOptions.products;
  }

  if (recsOptions.visitorId) {
    requestBody.visitorId = recsOptions.visitorId;
  }

  if (recsOptions.loginId) {
    requestBody.loginId = recsOptions.loginId;
  }

  if (recsOptions.filters) {
    requestBody.filters = recsOptions.filters;
  }

  if (recsOptions.rawFilter) {
    requestBody.rawFilter = recsOptions.rawFilter;
  }

  if (recsOptions.placement) {
    requestBody.placement = recsOptions.placement;
  }

  if (recsOptions.eventType) {
    requestBody.eventType = recsOptions.eventType;
  }

  if (recsOptions.debug !== undefined) {
    requestBody.debug = recsOptions.debug;
  }

  if (recsOptions.strictFiltering !== undefined) {
    requestBody.strictFiltering = recsOptions.strictFiltering;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    products: data.records || data.products || [],
    metadata: {
      modelName: recsOptions.name,
      totalCount: data.totalCount || (data.records?.length || data.products?.length || 0),
    },
    rawResponse: data,
  };
}
