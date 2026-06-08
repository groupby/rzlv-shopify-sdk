import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchSource, PaginationType } from '../types';

// Mock window.location and document for node environment
const mockLocation = {
  search: '',
  pathname: '/search',
  href: 'http://localhost/search',
};

const mockHistory = {
  pushState: vi.fn(),
  replaceState: vi.fn(),
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: mockLocation,
      history: mockHistory,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      URLSearchParams,
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
  mockLocation.search = '';
  mockLocation.pathname = '/search';
});

describe('initUrlManager - defaultPagesize sync', () => {
  let initUrlManager: typeof import('../urlManager').initUrlManager;
  let searchInputStore: typeof import('../searchInputStore').searchInputStore;

  beforeEach(async () => {
    // Reset modules so we get fresh Effector stores each time
    vi.resetModules();
    const urlMod = await import('../urlManager');
    const storeMod = await import('../searchInputStore');
    initUrlManager = urlMod.initUrlManager;
    searchInputStore = storeMod.searchInputStore;
  });

  afterEach(() => {
    if (initUrlManager?.initialized) {
      initUrlManager.initialized = false;
    }
  });

  it('should sync defaultPagesize into Input Store when no URL params are present', () => {
    // Arrange: no URL params, admin configured pagesize = '24'
    mockLocation.search = '';

    // Act: initialize with defaultPagesize '24'
    const cleanup = initUrlManager({
      defaultPagesize: '24',
      source: SearchSource.SEARCH,
      paginationType: PaginationType.PAGINATE,
    });

    // Assert: store should have pagesize '24', not the hardcoded '12'
    const state = searchInputStore.getState();
    expect(state.pagesize).toBe('24');
    expect(state.paginationType).toBe(PaginationType.PAGINATE);

    cleanup();
  });

  it('should sync defaultPagesize 48 into Input Store when no URL params are present', () => {
    mockLocation.search = '';

    const cleanup = initUrlManager({
      defaultPagesize: '48',
      source: SearchSource.SEARCH,
      paginationType: PaginationType.PAGINATE,
    });

    const state = searchInputStore.getState();
    expect(state.pagesize).toBe('48');

    cleanup();
  });

  it('should use URL pagesize over defaultPagesize when URL param is present', () => {
    // URL has explicit pagesize=12, admin default is 24
    mockLocation.search = '?gbi-query=shirts&pagesize=12&sort_by=relevance&page=1&type=product';

    const cleanup = initUrlManager({
      defaultPagesize: '24',
      source: SearchSource.SEARCH,
      paginationType: PaginationType.PAGINATE,
    });

    // URL param should win
    const state = searchInputStore.getState();
    expect(state.pagesize).toBe('12');

    cleanup();
  });

  it('should still work correctly when defaultPagesize is 12 (matching hardcoded default)', () => {
    mockLocation.search = '';

    const cleanup = initUrlManager({
      defaultPagesize: '12',
      source: SearchSource.SEARCH,
      paginationType: PaginationType.PAGINATE,
    });

    const state = searchInputStore.getState();
    expect(state.pagesize).toBe('12');

    cleanup();
  });

  it('should sync collectionId into Input Store on collection pages without URL params', () => {
    mockLocation.search = '';
    mockLocation.pathname = '/collections/shirts';

    const cleanup = initUrlManager({
      defaultPagesize: '24',
      source: SearchSource.COLLECTION,
      paginationType: PaginationType.SHOW_MORE,
      collectionId: '12345',
    });

    const state = searchInputStore.getState();
    expect(state.pagesize).toBe('24');
    expect(state.paginationType).toBe(PaginationType.SHOW_MORE);
    expect(state.collectionId).toBe('12345');

    cleanup();
  });
});
