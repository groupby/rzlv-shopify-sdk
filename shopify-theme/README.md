# GroupBy AI Recommendations Carousel for Shopify

This implementation provides a production-ready Liquid template for displaying product recommendations using the GroupBy AI Recommendations API with client-side pagination. **Fully tested and validated** using a comprehensive React testing environment.

## ✅ Testing & Validation

This carousel has been thoroughly tested using a custom React testing application that validates:

- **SDK Integration**: All `GBISearchStateDriver` functions tested with mock data
- **Pagination Logic**: Page size changes, navigation, and state management  
- **Error Handling**: Network failures, empty states, and malformed data
- **Responsive Behavior**: Desktop/mobile layouts and touch interactions
- **Data Scenarios**: Happy path, large datasets, minimal data, and error states

The React testing environment ensures that this Liquid implementation will work reliably in production Shopify stores.

## Features

- **Responsive carousel** with configurable items per page (desktop: 2-6, mobile: 1-3)
- **Multiple integration methods**: App blocks, theme sections, or direct snippet inclusion
- **Client-side pagination** using the RecsManager SDK
- **Touch/swipe support** for mobile devices with gesture recognition
- **Configurable recommendation models** (similar-items, frequently-bought-together, etc.)
- **Enhanced error handling** with user-friendly messages and retry options
- **Debug mode support** for development and troubleshooting
- **Accessibility features** including reduced motion and high contrast support
- **Asset loading protection** with automatic script inclusion

## Files Included

```
shopify-theme/
├── assets/
│   └── gbi-recommendations-carousel.js    # Enhanced JavaScript component with logging
├── blocks/
│   └── gbi-recommendations-carousel.liquid # App block for theme customizer
├── sections/
│   └── gbi-recommendations-carousel.liquid # Theme section
└── snippets/
    ├── gbi-recommendations-carousel.liquid # Core liquid template (enhanced)
    └── gbi-debug.liquid                    # Debug mode enabler
```

## Integration Methods

### 1. App Block (Recommended)
Add the app block to any section that supports app blocks:
1. Go to **Online Store > Themes > Customize**
2. Navigate to a product page
3. Click **Add block** and select **GBI Recommendations Carousel**
4. Configure settings as needed

### 2. Theme Section
Add as a standalone section:
1. Go to **Online Store > Themes > Customize**
2. Click **Add section** and select **GBI Recommendations Carousel**
3. Configure and position as needed

### 3. Direct Snippet Include
Include directly in any template:
```liquid
{% render 'gbi-recommendations-carousel',
   model_name: 'similar-items',
   collection: 'products',
   page_size: 12,
   items_per_page_desktop: 4,
   items_per_page_mobile: 2,
   header_text: 'Related Products',
   product_id: product.id %}
```

## Configuration Parameters

### Core Settings
- **model_name**: Recommendation model ('similar-items', 'frequently-bought-together', 'others-you-may-like')
- **collection**: GroupBy collection name (default: 'products')
- **page_size**: Total products to fetch (4-24, default: 12)
- **product_id**: Current product ID for context-aware recommendations

### Display Settings
- **items_per_page_desktop**: Products visible on desktop (2-6, default: 4)
- **items_per_page_mobile**: Products visible on mobile (1-3, default: 2)
- **header_text**: Carousel title (default: 'Related Products')

## Requirements

1. **GBI Search State Driver SDK** must be loaded on the page
2. **Valid shop configuration** with GroupBy AI integration
3. **Product context** (product.id) for product-specific recommendations

## How It Works

1. **Initialization**: JavaScript component initializes the RecsManager with configuration
2. **Data Fetching**: Uses `initRecsManager()` to fetch recommendations from GroupBy API
3. **Pagination**: Uses `setPageSize()` for UI pagination and `getCurrentPageProducts()` for display
4. **Navigation**: Uses `nextPage()`, `previousPage()`, and `goToPage()` for carousel navigation
5. **Responsive**: Automatically adjusts items per page based on screen size
6. **Error Recovery**: Graceful handling of API failures with retry mechanisms

## Debug Mode

Enable detailed logging for development and troubleshooting:

```liquid
{% comment %} Add to theme.liquid head section {% endcomment %}
{% render 'gbi-debug' %}
```

This enables console logging only on staging/development environments:
- Carousel initialization steps
- SDK state changes
- Navigation events
- Error conditions
- Touch/swipe interactions

## Design Specifications

- **Desktop**: 2-6 products per carousel page (configurable)
- **Mobile**: 1-3 products per carousel page (configurable)
- **Total Products**: 4-24 products configurable (multiple carousel pages)
- **Product Display**: Image with hover effects, title, price
- **Navigation**: Arrow buttons (hidden on small mobile), pagination dots
- **Loading States**: Animated spinner during data fetch
- **Error Handling**: User-friendly messages with retry options
- **Touch Support**: Swipe gestures with threshold detection

## Example Usage

### Product Page Integration
```liquid
<!-- In templates/product.liquid -->
<div class="product-recommendations">
  {% render 'gbi-recommendations-carousel',
     model_name: 'similar-items',
     page_size: 12,
     items_per_page_desktop: 4,
     items_per_page_mobile: 2,
     header_text: 'You might also like',
     product_id: product.id %}
</div>
```

### Collection Page Integration
```liquid
<!-- In templates/collection.liquid -->
{% render 'gbi-recommendations-carousel',
   model_name: 'others-you-may-like',
   page_size: 8,
   items_per_page_desktop: 4,
   items_per_page_mobile: 2,
   header_text: 'Popular Products' %}
```

### Multiple Carousels on Same Page
```liquid
<!-- Multiple recommendation types -->
{% render 'gbi-recommendations-carousel',
   model_name: 'similar-items',
   header_text: 'Similar Products',
   page_size: 8 %}

{% render 'gbi-recommendations-carousel',
   model_name: 'frequently-bought-together',
   header_text: 'Frequently Bought Together',
   page_size: 6 %}
```

## Browser Support

- **Modern browsers**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile browsers**: iOS Safari, Chrome Mobile, Samsung Internet
- **Touch devices**: Full swipe/gesture support
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation
- **Graceful degradation**: Fallbacks for older browsers and disabled JavaScript

## Performance Optimizations

- **Lazy image loading**: Native `loading="lazy"` support
- **Asset optimization**: Automatic script loading with duplication prevention
- **Efficient DOM updates**: Minimal re-renders during navigation
- **Touch optimization**: Throttled resize handlers and optimized touch events
- **Memory management**: Proper event listener cleanup

## Troubleshooting

### Common Issues

1. **No products showing**:
   - Enable debug mode to check SDK initialization
   - Verify product ID is being passed correctly
   - Check browser console for API errors

2. **Navigation not working**:
   - Ensure GBI Search State Driver is loaded
   - Check network connectivity to GroupBy API
   - Verify shop configuration in GroupBy Admin

3. **Styling issues**:
   - Check for CSS conflicts with theme styles
   - Verify responsive breakpoints match theme
   - Test with different screen sizes

### Debug Console Commands

When debug mode is enabled, you can inspect carousel state:

```javascript
// Check current carousel state
window.GBISearchStateDriver.getRecsManagerState()

// Get current products
window.GBISearchStateDriver.getCurrentPageProducts()

// Navigate programmatically
window.GBISearchStateDriver.goToPage(2)
```

## Updates & Testing

This implementation is actively maintained and tested using a comprehensive React testing environment that validates:

- All SDK integration points
- Navigation and pagination logic
- Error states and recovery mechanisms
- Responsive behavior across device sizes
- Touch interactions and accessibility features

For the latest updates and testing procedures, see the project repository.

---

**Version**: 2.0.0 (Enhanced with comprehensive testing & error handling)  
**Last Updated**: Current  
**Compatibility**: GroupBy AI Recommendations API v2+, Modern Shopify themes
