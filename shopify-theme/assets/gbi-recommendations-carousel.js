class GBIRecommendationsCarousel {
  constructor(element) {
    this.element = element;
    this.currentPage = 0;
    this.totalPages = 0;
    this.isLoading = false;
    this.debugMode = window.GBI_DEBUG || false; // Enable debug logging

    this.config = {
      modelName: element.dataset.modelName || 'similar-items',
      collection: element.dataset.collection || 'products',
      pageSize: parseInt(element.dataset.pageSize) || 12,
      itemsPerPageDesktop: parseInt(element.dataset.itemsPerPageDesktop) || 4,
      itemsPerPageMobile: parseInt(element.dataset.itemsPerPageMobile) || 2,
      productId: element.dataset.productId || '',
      shopTenant: element.dataset.shopTenant || ''
    };

    this.log = (message, data = null) => {
      if (this.debugMode) {
        console.log(`[GBI Carousel] ${message}`, data || '');
      }
    };

    this.getCurrentItemsPerPage = () => {
      return window.innerWidth >= 750 ? this.config.itemsPerPageDesktop : this.config.itemsPerPageMobile;
    };

    this.init();
  }

  async init() {
    try {
      this.log('Initializing carousel with config:', this.config);

      if (typeof window.GBISearchStateDriver === 'undefined') {
        console.error('GBI Search State Driver not found. Please ensure the SDK is loaded.');
        this.showError('SDK not loaded. Please contact support.');
        return;
      }

      this.loadingElement = this.element.querySelector('.gbi-carousel-loading');
      this.wrapperElement = this.element.querySelector('.gbi-carousel-wrapper');
      this.trackElement = this.element.querySelector('.gbi-carousel-track');
      this.prevButton = this.element.querySelector('.gbi-carousel-prev');
      this.nextButton = this.element.querySelector('.gbi-carousel-next');
      this.dotsContainer = this.element.querySelector('.gbi-carousel-dots');
      this.errorElement = this.element.querySelector('.gbi-carousel-error');

      this.setupEventListeners();
      await this.initializeRecsManager();

    } catch (error) {
      console.error('Error initializing GBI Recommendations Carousel:', error);
      this.showError('Initialization failed. Please refresh the page.');
    }
  }

  setupEventListeners() {
    // Navigation buttons
    this.prevButton?.addEventListener('click', () => this.goToPreviousPage());
    this.nextButton?.addEventListener('click', () => this.goToNextPage());

    // Resize handler for responsive behavior
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.log('Updating layout due to resize');
        this.updateLayout();
      }, 250);
    });

    // Touch/swipe support for mobile
    this.setupTouchEvents();
  }

  setupTouchEvents() {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    this.trackElement?.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      this.log('Touch start:', startX);
    });

    this.trackElement?.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
    });

    this.trackElement?.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;

      const diff = startX - currentX;
      const threshold = 50;

      this.log('Touch end:', { diff, threshold });

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          this.log('Swipe left - next page');
          this.goToNextPage();
        } else {
          this.log('Swipe right - previous page');
          this.goToPreviousPage();
        }
      }
    });
  }

  async initializeRecsManager() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try {
      this.log('Initializing RecsManager with config:', {
        shopTenant: this.config.shopTenant,
        modelName: this.config.modelName,
        collection: this.config.collection,
        pageSize: this.config.pageSize,
        productId: this.config.productId
      });

      // Phase 3: Initialize the RecsManager with updated configuration
      window.GBISearchStateDriver.initRecsManager({
        shopTenant: this.config.shopTenant,
        appEnv: window.GBI_APP_ENV || 'PRODUCTION',
        name: this.config.modelName,
        collection: this.config.collection,
        uiPageSize: this.config.pageSize, // Phase 2: Updated parameter name
        productID: this.config.productId || undefined,
        mergeShopifyData: true,
        maxApiResults: this.config.maxResults || 100, // Phase 1: Request more results from API
        cacheTTL: 5 * 60 * 1000 // Phase 1: 5 minute cache
      }, this.config.instanceId || 'default'); // Phase 1: Instance support

      // Set the UI page size for carousel pagination
      const itemsPerPage = this.getCurrentItemsPerPage();
      this.log('Setting UI page size:', itemsPerPage);
      window.GBISearchStateDriver.setPageSize(itemsPerPage);

      // Wait for initial fetch with better retry logic
      this.waitForInitialData();

    } catch (error) {
      console.error('Error initializing RecsManager:', error);
      this.showError('Unable to initialize recommendations. Please try refreshing the page.');
    } finally {
      this.isLoading = false;
    }
  }

  waitForInitialData(attempt = 1, maxAttempts = 10) {
    this.log(`Waiting for initial data, attempt ${attempt}/${maxAttempts}`);

    try {
      const state = window.GBISearchStateDriver.getRecsManagerState();
      this.log('Current state:', state);

      if (state.loading && attempt < maxAttempts) {
        // Still loading, try again
        setTimeout(() => this.waitForInitialData(attempt + 1, maxAttempts), 500);
        return;
      }

      if (state.error) {
        this.log('Error in state:', state.error);
        this.showError('Failed to load recommendations. Please try again.');
        return;
      }

      this.loadCurrentPage();

    } catch (error) {
      console.error('Error checking initial data:', error);
      if (attempt < maxAttempts) {
        setTimeout(() => this.waitForInitialData(attempt + 1, maxAttempts), 500);
      } else {
        this.showError('Timeout loading recommendations. Please refresh the page.');
      }
    }
  }

  loadCurrentPage() {
    try {
      // Phase 3: Enhanced loading with instance support and better error handling
      const instanceId = this.config.instanceId || 'default';

      // Get current page products from RecsManager with instance support
      const products = window.GBISearchStateDriver.getCurrentPageProducts(instanceId);
      const state = window.GBISearchStateDriver.getRecsManagerState();

      // Phase 3: Use new Phase 2 pagination info
      const pageInfo = window.GBISearchStateDriver.getPageInfo();

      this.log('Loading current page:', {
        productsCount: products?.length || 0,
        currentPage: pageInfo.currentPage,
        totalPages: pageInfo.totalPages,
        totalProducts: pageInfo.totalProducts,
        hasNextPage: pageInfo.hasNextPage,
        hasPreviousPage: pageInfo.hasPreviousPage,
        isFirstPage: pageInfo.isFirstPage,
        isLastPage: pageInfo.isLastPage
      });

      if (products && products.length > 0) {
        this.renderProducts(products);
        this.totalPages = pageInfo.totalPages || 1;
        this.currentPage = (pageInfo.currentPage || 1) - 1; // Convert to 0-based
        this.renderDots();
        this.showCarousel();
        this.updateDebugInfo(pageInfo);
        this.log('Carousel rendered successfully');
      } else if (state.loading) {
        // Still loading, try again in a moment
        this.log('Still loading, retrying...');
        setTimeout(() => this.loadCurrentPage(), 500);
      } else {
        // Phase 3: Better error handling - check if we have products but wrong page
        const allProducts = window.GBISearchStateDriver.getAllProducts();
        if (allProducts && allProducts.length > 0) {
          this.log('Products available but current page is empty, jumping to first page');
          window.GBISearchStateDriver.jumpToFirstPage();
          setTimeout(() => this.loadCurrentPage(), 100); // Retry after jump
        } else {
          this.log('No products found');
          this.showError('No recommendations found for this product.');
        }
      }

    } catch (error) {
      console.error('Error loading current page:', error);
      this.showError('Unable to load recommendations. Please try refreshing the page.');
    }
  }

  renderProducts(products) {
    if (!this.trackElement) {
      this.log('Track element not found');
      return;
    }

    this.log('Rendering products:', products.length);
    this.trackElement.innerHTML = '';

    products.forEach((product, index) => {
      const productCard = this.createProductCard(product, index);
      this.trackElement.appendChild(productCard);
    });

    this.updateLayout();
  }

  createProductCard(product, index) {
    const card = document.createElement('a');
    card.className = 'gbi-product-card';
    card.href = product.uri || `/products/${this.sanitizeHandle(product.handle || product.id)}`;
    card.style.width = `${100 / this.getCurrentItemsPerPage()}%`;

    // Get product image with better fallbacks
    const imageUrl = this.getProductImage(product);

    // Get product price with better formatting
    const formattedPrice = this.formatProductPrice(product);

    // Sanitize product title
    const title = this.sanitizeText(product.title || product.name || 'Product');

    card.innerHTML = `
      <div class="gbi-product-image">
        <img src="${imageUrl}"
             alt="${title}"
             loading="lazy"
             onerror="this.src='/assets/placeholder.svg'">
      </div>
      <div class="gbi-product-info">
        <h3 class="gbi-product-title">${title}</h3>
        <div class="gbi-product-price">${formattedPrice}</div>
      </div>
    `;

    this.log(`Created product card for: ${title}`);
    return card;
  }

  getProductImage(product) {
    // Try multiple image sources
    if (product.images?.[0]?.uri) return product.images[0].uri;
    if (product.featured_image) return product.featured_image;
    if (product.image) return product.image;
    
    // Fallback to placeholder
    return '/assets/placeholder.svg';
  }

  formatProductPrice(product) {
    try {
      const price = product.price?.value || product.price || 0;
      const currency = product.price?.currency || 'USD';
      
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(price);
    } catch (error) {
      this.log('Error formatting price:', error);
      return 'Price unavailable';
    }
  }

  sanitizeText(text) {
    if (!text) return 'Product';
    return String(text).replace(/[<>]/g, '').substring(0, 100); // Basic XSS protection and length limit
  }

  sanitizeHandle(handle) {
    if (!handle) return 'product';
    return String(handle).toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  // Legacy method - kept for compatibility
  formatPrice(price) {
    return this.formatProductPrice({ price: { value: price } });
  }

  renderDots() {
    if (!this.dotsContainer || this.totalPages <= 1) return;

    this.log('Rendering dots for', this.totalPages, 'pages');
    this.dotsContainer.innerHTML = '';

    for (let i = 0; i < this.totalPages; i++) {
      const dot = document.createElement('button');
      dot.className = `gbi-carousel-dot ${i === this.currentPage ? 'active' : ''}`;
      dot.addEventListener('click', () => this.goToPage(i));
      this.dotsContainer.appendChild(dot);
    }
  }

  updateLayout() {
    const itemsPerPage = this.getCurrentItemsPerPage();
    this.log('Updating layout for', itemsPerPage, 'items per page');

    // Update product card widths
    const cards = this.trackElement?.querySelectorAll('.gbi-product-card');
    cards?.forEach(card => {
      card.style.width = `${100 / itemsPerPage}%`;
    });

    // Update RecsManager page size if it changed
    try {
      const state = window.GBISearchStateDriver.getRecsManagerState();
      if (state.pageSize !== itemsPerPage) {
        this.log('Page size changed from', state.pageSize, 'to', itemsPerPage);
        window.GBISearchStateDriver.setPageSize(itemsPerPage);
        this.loadCurrentPage(); // Reload with new page size
        return;
      }
    } catch (error) {
      console.error('Error updating page size:', error);
    }

    this.updateNavigationState();
  }

  updateNavigationState() {
    if (this.prevButton) {
      this.prevButton.disabled = this.currentPage === 0;
    }

    if (this.nextButton) {
      this.nextButton.disabled = this.currentPage >= this.totalPages - 1;
    }

    // Update dots
    const dots = this.dotsContainer?.querySelectorAll('.gbi-carousel-dot');
    dots?.forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentPage);
    });
  }

  goToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.totalPages) return;

    this.log('Going to page:', pageIndex + 1);

    try {
      // Convert to 1-based page number for RecsManager
      window.GBISearchStateDriver.goToPage(pageIndex + 1);
      this.currentPage = pageIndex;
      this.loadCurrentPage();
    } catch (error) {
      console.error('Error navigating to page:', error);
      this.showError('Navigation failed. Please try again.');
    }
  }

  goToNextPage() {
    this.log('Going to next page');
    try {
      // Phase 3: Enhanced navigation with validation
      if (window.GBISearchStateDriver.canNavigateNext()) {
        window.GBISearchStateDriver.nextPage();
        const pageInfo = window.GBISearchStateDriver.getPageInfo();
        this.currentPage = (pageInfo.currentPage || 1) - 1; // Convert to 0-based
        this.loadCurrentPage();
      } else {
        this.log('Cannot navigate to next page');
      }
    } catch (error) {
      console.error('Error navigating to next page:', error);
    }
  }

  goToPreviousPage() {
    this.log('Going to previous page');
    try {
      // Phase 3: Enhanced navigation with validation
      if (window.GBISearchStateDriver.canNavigatePrevious()) {
        window.GBISearchStateDriver.previousPage();
        const pageInfo = window.GBISearchStateDriver.getPageInfo();
        this.currentPage = (pageInfo.currentPage || 1) - 1; // Convert to 0-based
        this.loadCurrentPage();
      } else {
        this.log('Cannot navigate to previous page');
      }
    } catch (error) {
      console.error('Error navigating to previous page:', error);
    }
  }

  // Phase 3: New debug info update method
  updateDebugInfo(pageInfo = null) {
    if (!this.config.debug) return;

    try {
      const info = pageInfo || window.GBISearchStateDriver.getPageInfo();
      const debugElement = this.element?.querySelector('.gbi-debug-state');

      if (debugElement) {
        debugElement.innerHTML = `
          <div>Page: ${info.currentPage}/${info.totalPages}</div>
          <div>Products: ${info.productsOnCurrentPage}/${info.totalProducts}</div>
          <div>Range: ${info.pageStartIndex}-${info.pageEndIndex - 1}</div>
          <div>Navigation: ${info.hasPreviousPage ? '←' : '⊗'} ${info.hasNextPage ? '→' : '⊗'}</div>
          <div>State: ${info.isFirstPage ? 'First' : info.isLastPage ? 'Last' : 'Middle'}</div>
        `;
      }
    } catch (error) {
      console.error('Error updating debug info:', error);
    }
  }

  showLoading() {
    this.log('Showing loading state');
    this.loadingElement?.style.setProperty('display', 'flex');
    this.wrapperElement?.style.setProperty('display', 'none');
    this.errorElement?.style.setProperty('display', 'none');
  }

  showCarousel() {
    this.log('Showing carousel');
    this.loadingElement?.style.setProperty('display', 'none');
    this.wrapperElement?.style.setProperty('display', 'flex');
    this.errorElement?.style.setProperty('display', 'none');
  }

  showError(message = 'Unable to load recommendations at this time.') {
    console.error('Showing error:', message);
    this.loadingElement?.style.setProperty('display', 'none');
    this.wrapperElement?.style.setProperty('display', 'none');

    if (this.errorElement) {
      this.errorElement.style.setProperty('display', 'block');
      const errorText = this.errorElement.querySelector('p');
      if (errorText) {
        errorText.textContent = message;
      }

      // Phase 3: Add retry button for better UX
      const retryBtn = this.errorElement.querySelector('.gbi-retry-btn');
      if (retryBtn) {
        retryBtn.onclick = () => {
          this.showLoading();
          setTimeout(() => this.initializeRecsManager(), 1000);
        };
      }
    }
  }

  // Phase 3: Enhanced error recovery
  async retryInitialization() {
    try {
      this.log('Retrying initialization...');
      await this.initializeRecsManager();
    } catch (error) {
      this.log('Retry failed:', error);
      this.showError('Retry failed. Please refresh the page.');
    }
  }
}

// Make the class globally available
window.GBIRecommendationsCarousel = GBIRecommendationsCarousel;
