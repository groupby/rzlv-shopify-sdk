import { ProductDetail, ProductDetailsResult, ProductVariant } from "../utils/searchUtils.types";

/**
 * Fetches Shopify product details using the Storefront API with GraphQL.
 *
 * @param handles - An array of Shopify product handles.
 * @returns A promise that resolves to an object containing the fetched product details.
 * @throws Will throw an error if the Shopify configuration is missing or if the API request fails.
 *
 * @example
 * const result = await fetchStorefrontProducts(["gift-card", "shirt"]);
 * console.log(result.products); // Array of ProductDetail objects
 */

export interface ShopifyConfig {
  domain: string;
  token: string;
}

export async function fetchStorefrontProducts(handles: string[], shopifyConfig: ShopifyConfig): Promise<ProductDetailsResult> {

  const { domain, token } = shopifyConfig;
  const endpoint = `https://${domain}/api/2025-01/graphql.json`;

  if (!handles.length) {
    return { products: [] };
  }

  const handleQuery = handles.map(handle => `handle:${handle}`).join(' OR ');
  const query = `
    query GetProductsByHandles($query: String!) {
      products(first: 250, query: $query) {
        edges {
          node {
            id
            title
            handle
            description
            vendor
            productType
            tags
            availableForSale
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            compareAtPriceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            variants(first: 250) {
              edges {
                node {
                  id
                  title
                  sku
                  availableForSale
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                }
              }
            }
            images(first: 10) {
              edges {
                node { url altText }
              }
            }
            featuredImage { url altText }
          }
        }
      }
    }
  `;

  const variables = { query: handleQuery };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      throw new Error(`Failed to fetch Storefront API: ${errorMessage}`);
    }

    const data = await response.json();
    const products = data.data?.products?.edges?.map((edge: any) => edge.node) || [];

    // Map to ProductDetail type
    const mappedProducts = handles.map(handle => {
      const product = products.find((p: any) => p.handle === handle);
      if (!product) return null;

      const variants = product.variants.edges.map((v: any) => ({
        ...v.node,
        id: parseInt(v.node.id.split('/').pop() || '0', 10), // Convert GID to number
        price: parseFloat(v.node.price.amount),
        compareAtPrice: v.node.compareAtPrice ? parseFloat(v.node.compareAtPrice.amount) : null,
        // Add missing fields with defaults if needed
        option1: null,
        option2: null,
        option3: null,
        requires_shipping: true,
        taxable: true,
        featured_image: null,
        options: [],
        quantity_rule: { min: 1, max: null, increment: 1 },
        quantity_price_breaks: [],
        requires_selling_plan: false,
        selling_plan_allocations: [],
      })) as ProductVariant[];

      return {
        id: parseInt(product.id.split('/').pop() || '0', 10),
        title: product.title,
        handle: product.handle,
        description: product.description,
        published_at: 'published_placeholder',
        created_at: 'created_placeholder',
        vendor: product.vendor,
        type: product.productType,
        tags: product.tags,
        price: parseFloat(product.priceRange.minVariantPrice.amount),
        price_min: parseFloat(product.priceRange.minVariantPrice.amount),
        price_max: parseFloat(product.priceRange.maxVariantPrice.amount),
        available: product.availableForSale,
        price_varies: product.priceRange.minVariantPrice.amount !== product.priceRange.maxVariantPrice.amount,
        compare_at_price: product.compareAtPriceRange.maxVariantPrice.amount ? parseFloat(product.compareAtPriceRange.maxVariantPrice.amount) : null,
        compare_at_price_min: parseFloat(product.compareAtPriceRange.minVariantPrice.amount),
        compare_at_price_max: parseFloat(product.compareAtPriceRange.maxVariantPrice.amount),
        compare_at_price_varies: product.compareAtPriceRange.minVariantPrice.amount !== product.compareAtPriceRange.maxVariantPrice.amount,
        variants,
        images: product.images.edges.map((i: any) => i.node.url),
        featured_image: product.featuredImage?.url || (product.images.edges[0]?.node.url || ''),
        options: [], // Not fetched; add if needed
        url: `/products/${product.handle}`,
        media: product.images.edges.map((i: any) => ({
          alt: i.node.altText || null,
          id: 0, // Placeholder; adjust if needed
          position: 0,
          preview_image: { aspect_ratio: 1, height: 0, width: 0, src: i.node.url },
          aspect_ratio: 1,
          height: 0,
          media_type: 'image',
          src: i.node.url,
          width: 0,
        })),
        requires_selling_plan: false,
        selling_plan_groups: [],
      } as ProductDetail;
    });

    return { products: mappedProducts };

  } catch (error) {
    console.error('Error fetching storefront products:', error);
    throw error;
  }
}