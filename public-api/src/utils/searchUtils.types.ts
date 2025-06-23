export enum RefinementType {
  Range = 'Range',
  Value = 'Value',
}

export enum SortOrder {
  Ascending = 'ascending',
  Descending = 'descending',
  Relevance = 'relevance',
}

export enum QueryParams {
  Query = 'gbi-query',
  PageSize = 'pagesize',
  SortBy = 'sort_by',
  PageNumber = 'page',
  Refinement = 'refinement',
}

export enum DefaultValues {
  SortBy = SortOrder.Relevance,
  Fields = '*',
  PreFilter = 'availability:ANY(\"IN_STOCK\")',
}

export enum AppEnv {
  Production = 'PRODUCTION',
  ProxyProd = 'proxy.shp',
  ProxyDev = 'proxy.shp-lo',
}

export interface SearchParams {
  query: string | null;
  pageSize: string | null;
  sortBy: SortOrder;
  pageNumber: string | null;
  refinements: string[];
}

export interface Refinement {
  navigationName: string;
  type: RefinementType;
  displayName: string;
  or: boolean;
  low?: number;
  high?: number;
  value?: string;
}

export interface SortObject {
  field: string;
  order: SortOrder;
}

export interface FetchSearchResultsArgs {
  query: string;
  collection?: string;
  area?: string;
  pageSize: number;
  sorts: SortObject[];
  fields?: string[];
  dynamicFacet?: boolean;
  preFilter?: string;
  skip: number;
  refinements: Refinement[];
}

export interface SearchResult {
  records: any[];
  totalRecordCount: number;
  originalRequest: any;
  selectedNavigation?: any[];
}

export interface SearchBeaconType {
  recommendations: boolean;
  navigation: boolean;
  dym: boolean;
  sayt: boolean;
  search: boolean;
}

export interface ModifiedQueryResult {
  modifiedQuery: string;
  searchBeaconType: SearchBeaconType;
}

export interface ProductRecord {
  allMeta: {
    id?: string;
    attributes: {
      handle: {
        text: string[];
      };
    };
    title: string;
    variants?: Array<{ id: string }>;
  };
}

export interface Products {
  records: ProductRecord[];
}

export const AUTOCOMPLETE_PREFIX = 'autocomplete:';

// For fetchProductDetails
export interface ProductVariant {
  id: number;
  title: string;
  option1: string;
  option2: string | null;
  option3: string | null;
  sku: string;
  requires_shipping: boolean;
  taxable: boolean;
  featured_image: string | null;
  available: boolean;
  name: string;
  public_title: string;
  options: string[];
  price: number;
  weight: number;
  compare_at_price: number | null;
  inventory_management: string;
  barcode: string;
  quantity_rule: {
    min: number;
    max: number | null;
    increment: number;
  };
  quantity_price_breaks: any[];
  requires_selling_plan: boolean;
  selling_plan_allocations: any[];
}

export interface ProductImage {
  src: string;
}

export interface ProductMedia {
  alt: string | null;
  id: number;
  position: number;
  preview_image: {
    aspect_ratio: number;
    height: number;
    width: number;
    src: string;
  };
  aspect_ratio: number;
  height: number;
  media_type: string;
  src: string;
  width: number;
}

export interface ProductOption {
  name: string;
  position: number;
  values: string[];
}

export interface ProductDetail {
  id: number;
  title: string;
  handle: string;
  description: string;
  published_at: string;
  created_at: string;
  vendor: string;
  type: string;
  tags: string[];
  price: number;
  price_min: number;
  price_max: number;
  available: boolean;
  price_varies: boolean;
  compare_at_price: number | null;
  compare_at_price_min: number;
  compare_at_price_max: number;
  compare_at_price_varies: boolean;
  variants: ProductVariant[];
  images: string[];
  featured_image: string;
  options: ProductOption[];
  url: string;
  media: ProductMedia[];
  requires_selling_plan: boolean;
  selling_plan_groups: any[];
}

export interface ProductDetailsResult {
  products: (ProductDetail | null)[];
}
