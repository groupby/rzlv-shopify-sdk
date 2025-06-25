# RecsManager Usage Guide

## Quick Start

```typescript
import { 
  initRecsManager, 
  nextPage, 
  previousPage, 
  reset,
  setPageSize,
  recsCurrentPageStore, 
  recsLoadingStore, 
  recsErrorStore 
} from 'gbi-shopify-sdk';
import { AppEnv } from 'gbi-shopify-sdk';
```

## Initialize

```typescript
initRecsManager({
  shopTenant: "your-shop-id",
  appEnv: AppEnv.Production, // or AppEnv.ProxyDev for testing
  name: "recently_viewed_kx", // your recommendation model
  collection: "Production",
  pageSize: 5,
  productID: "12345", // optional: current product ID
  visitorId: "visitor-123", // optional: visitor identifier
  eventType: "detail-page-view" // optional: event type
});
```

## Subscribe to Data

```typescript
// Current page products
recsCurrentPageStore.watch(products => {
  console.log('Products for current page:', products);
  // Update your UI with products
});

// Loading state
recsLoadingStore.watch(isLoading => {
  // Show/hide loading spinner
});

// Error state  
recsErrorStore.watch(error => {
  if (error) console.error('Recs error:', error);
});
```

## Navigation

```typescript
// Move between pages
nextPage();     // Go to next page (no wrap-around)
previousPage(); // Go to previous page (no wrap-around)
reset();        // Go back to first page

// Change page size
setPageSize(10); // Automatically resets to first page
```

## Complete Example

```typescript
// Initialize for product detail page
initRecsManager({
  shopTenant: "my-shop",
  appEnv: AppEnv.Production,
  name: "similar-items",
  collection: "Production", 
  pageSize: 4,
  productID: currentProduct.id,
  eventType: "detail-page-view"
});

// React component example
function RecommendationsCarousel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    recsCurrentPageStore.watch(setProducts);
    recsLoadingStore.watch(setLoading);
  }, []);

  return (
    <div>
      {loading ? <Spinner /> : (
        <div className="carousel">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
      <button onClick={previousPage}>←</button>
      <button onClick={nextPage}>→</button>
    </div>
  );
}
```

## Notes

- Call `initRecsManager()` once per page/component
- All navigation functions are safe (no errors if at boundaries)
- Page size changes automatically reset to first page
- Products are cached - navigation is instant after initial load 