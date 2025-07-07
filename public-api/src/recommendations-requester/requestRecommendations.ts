import { AppEnv } from '../utils/searchUtils.types';

export { AppEnv };

export interface RecsFilter {
  field: string;
  value: string;
  exclude?: string;
  required?: string;
}

export interface RecsManagerConfig {
  shopTenant: string;
  appEnv: string; // Changed to string to match searchManager pattern
  name: string;
  collection: string;
  area?: string; // Added area parameter as requested
  fields?: string[];
  pageSize: number;
  productID?: string | string[];
  visitorId?: string;
  loginId?: string;
  filters?: RecsFilter[];
  eventType?: string;
}

export interface RequestRecsOptions {
  name: string;
  fields?: string[];
  collection: string;
  pageSize: number;
  productID?: string | string[];
  visitorId?: string;
  loginId?: string;
  filters?: RecsFilter[];
  eventType?: string;
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
  const endpoint = `https://${appEnv === 'Production' ? 'proxy.shp-lo' : 'proxy-dev.shp-lo'}.groupbycloud.com/${shopTenant}/api/recommendation`;

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

  if (recsOptions.productID) {
    requestBody.productID = Array.isArray(recsOptions.productID) 
      ? recsOptions.productID 
      : [recsOptions.productID];
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

  if (recsOptions.eventType) {
    requestBody.eventType = recsOptions.eventType;
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