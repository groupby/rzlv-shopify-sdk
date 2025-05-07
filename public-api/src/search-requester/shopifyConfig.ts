// src/public-api/config.ts

let storeDomain: string | undefined;
let storefrontAccessToken: string | undefined;

/**
 * Sets the Shopify store domain and Storefront API access token for the SDK.
 * This configuration is required if you intend to merge Shopify product data
 * using the Storefront API. Call this function before using search functions
 * with mergeShopifyData enabled.
 *
 * @param domain - The Shopify store domain (e.g., "mystore.myshopify.com").
 * @param token - The Storefront API access token.
 * @throws {Error} If domain or token is missing or empty.
 */
export function setShopifyConfig(domain: string, token: string): void {
  if (!domain || !token) {
    throw new Error("Store domain and access token are required.");
  }
  storeDomain = domain;
  storefrontAccessToken = token;
}

/**
 * Internal utility to retrieve the current Shopify configuration.
 * Returns undefined if not set.
 * @internal
 */
export function getShopifyConfig(): { domain: string; token: string } | undefined {
  if (!storeDomain || !storefrontAccessToken) {
    return undefined;
  }
  return { domain: storeDomain, token: storefrontAccessToken };
}
