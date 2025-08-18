import { AppEnv } from '../utils/searchUtils.types';

export { AppEnv };

// TODO: abstract types to a shared location
export interface RecsFilter {
  field: string;
  value: string;
  exclude?: boolean;
  derivedFromProduct?: boolean;
}

export interface RecsManagerConfig {
  shopTenant: string;
  appEnv: AppEnv;
  name: string;
  collection: string;
  area?: string;
  fields?: string[];
  pageSize: number;
  limit?: string;
  productID?: string | string[];
  products?: RecsRequestProduct[];
  visitorId?: string;
  loginId?: string;
  filters?: RecsFilter[];
  rawFilter?: string;
  placement?: string;
  eventType?: string;
  debug?: boolean;
  strictFiltering?: boolean;
}

export interface RequestRecsOptions {
  name: string;
  fields?: string[];
  collection: string;
  pageSize: number;
  limit?: string;
  productID?: string | string[];
  products?: RecsRequestProduct[];
  visitorId?: string;
  loginId?: string;
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

export interface RecsProduct {
  id: string;
  title?: string;
  handle?: string;
  [key: string]: unknown;
}

export interface RequestRecsResponse {
  products: RecsProduct[];
  metadata: {
    modelName: string;
    totalCount: number;
  };
  rawResponse: unknown;
}

export async function requestRecommendations(
  shopTenant: string,
  appEnv: string,
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