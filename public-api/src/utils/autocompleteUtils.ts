import { AppEnv } from './searchUtils.types';

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
    throw new Error(`Failed to fetch autocomplete results: ${errorMessage}`);
  }
  return response.json();
}

/**
 * Fetches autocomplete suggestions from the GBI Autocomplete API.
 *
 * @param shopTenant - The shop tenant identifier.
 * @param appEnv - The application environment.
 * @param options - The autocomplete request options.
 * @returns A promise that resolves to the autocomplete results.
 *
 * @throws Will throw an error if the network response is not ok.
 */
export async function fetchAutocompleteResults(
  shopTenant: string,
  appEnv: AppEnv,
  options: {
    query: string;
    collection: string;
    area: string;
    searchItems?: number;
    dataset?: string;
  }
): Promise<any> {
  const baseUrl = `https://${appEnv === AppEnv.Production ? AppEnv.ProxyProd : AppEnv.ProxyDev}.groupbycloud.com/${shopTenant}/api/request`;
  
  // Build URL parameters
  const urlParams = new URLSearchParams({
    collection: options.collection,
    area: options.area,
    searchItems: String(options.searchItems || 10),
    query: options.query
  });
  
  // Add optional dataset parameter if provided
  if (options.dataset) {
    urlParams.append('dataset', options.dataset);
  }
  
  const endpoint = `${baseUrl}?${urlParams.toString()}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Application-Type': 'autocomplete',
    'X-Groupby-Customer-ID': shopTenant
  };

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers
    });

    return handleFetchResponse(response);
  } catch (error) {
    console.error('Error fetching autocomplete results:', error);
    throw error;
  }
}
