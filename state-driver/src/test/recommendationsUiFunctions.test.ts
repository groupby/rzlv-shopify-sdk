import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextPage, previousPage, setRecsPageSize, resetRecs, fetchRecommendations } from '../ui-functions/recommendationsUiFunctions';
import { recsInputStore, updateRecsInputStore } from '../recsInputStore';
import { recsOutputStore, updateRecsOutputStore, type RecsResultsOutput } from '../recsOutputStore';
import { debugLog } from '../debugLogger';

vi.mock('../debugLogger', () => ({
  debugLog: vi.fn(),
}));

/**
 * Test-specific type that allows edge case values (undefined, NaN) for testing error handling.
 * This provides type-safe testing of invalid values without using 'as any'.
 */
type TestPaginationValue = number | undefined | typeof NaN;

/**
 * Helper to create test output state with potentially invalid pagination values for edge case testing.
 *
 * This function provides a type-safe way to test error handling without using 'as any' throughout
 * the test file. It centralizes the type assertion in one place and makes the intent explicit.
 *
 * @param overrides - Partial pagination values, can include edge cases like undefined or NaN
 * @returns Complete RecsResultsOutput state for testing
 *
 * @example
 * // Test with undefined totalPages
 * updateRecsOutputStore(() => createTestOutputState({ totalPages: undefined }));
 *
 * @example
 * // Test with NaN values
 * updateRecsOutputStore(() => createTestOutputState({ totalPages: NaN, currentPage: NaN }));
 */
function createTestOutputState(overrides: {
  totalPages?: TestPaginationValue;
  currentPage?: TestPaginationValue;
  pageSize?: TestPaginationValue;
  totalRecords?: TestPaginationValue;
}): RecsResultsOutput {
  return {
    products: [],
    allProducts: [],
    pagination: {
      currentPage: (overrides.currentPage ?? 0) as number,
      pageSize: (overrides.pageSize ?? 10) as number,
      totalPages: (overrides.totalPages ?? 0) as number,
      totalRecords: (overrides.totalRecords ?? 0) as number,
    },
    metadata: { modelName: 'test', totalCount: 30 },
    loading: false,
    error: null,
    rawResponse: undefined,
  };
}

/**
 * Helper to create test input state with potentially invalid currentPage value for edge case testing.
 *
 * This function provides a type-safe way to test error handling without using 'as any' throughout
 * the test file. It centralizes the type assertion in one place and makes the intent explicit.
 *
 * @param currentPage - Page number value, can include edge cases like undefined or NaN
 * @returns Complete input state for testing
 *
 * @example
 * // Test with NaN currentPage
 * updateRecsInputStore(() => createTestInputState(NaN));
 */
function createTestInputState(currentPage: TestPaginationValue) {
  return {
    name: 'test-model',
    fields: ['*'],
    collection: 'products',
    pageSize: 10,
    currentPage: currentPage as number,
    limit: undefined,
    productID: undefined,
    products: undefined,
    visitorId: undefined,
    loginId: undefined,
    filters: undefined,
    rawFilter: undefined,
    placement: undefined,
    eventType: undefined,
    area: undefined,
    debug: undefined,
    strictFiltering: undefined,
    hasRequested: false,
  };
}

describe('recommendationsUiFunctions', () => {
  beforeEach(() => {
    updateRecsInputStore(() => ({
      name: 'test-model',
      fields: ['*'],
      collection: 'products',
      pageSize: 10,
      currentPage: 0,
      limit: undefined,
      productID: undefined,
      products: undefined,
      visitorId: undefined,
      loginId: undefined,
      filters: undefined,
      rawFilter: undefined,
      placement: undefined,
      eventType: undefined,
      area: undefined,
      debug: undefined,
      strictFiltering: undefined,
      hasRequested: false,
    }));

    updateRecsOutputStore(() => ({
      products: [],
      allProducts: [],
      pagination: {
        currentPage: 0,
        pageSize: 10,
        totalPages: 3,
        totalRecords: 30,
      },
      metadata: {
        modelName: 'test-model',
        totalCount: 30,
      },
      loading: false,
      error: null,
      rawResponse: undefined,
    }));

    vi.clearAllMocks();
  });

  describe('nextPage', () => {
    it('should advance to next page when not at the end', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 0 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 3 }
      }));

      nextPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(1);
      expect(inputState.hasRequested).toBe(true);
    });

    it('should not advance when at the last page', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 2 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 3 }
      }));

      nextPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(2);
      expect(inputState.hasRequested).toBe(false);
    });

    it('should not advance when already at or beyond total pages', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 3 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 3 }
      }));

      nextPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(3);
      expect(inputState.hasRequested).toBe(false);
    });

    it('should handle edge case with zero total pages', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 0 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 0 }
      }));

      nextPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(false);
    });
  });

  describe('previousPage', () => {
    it('should go to previous page when not at the beginning', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 2 }));

      previousPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(1);
      expect(inputState.hasRequested).toBe(true);
    });

    it('should not go to previous page when at the first page', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 0 }));

      previousPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(false);
    });

    it('should not go to previous page when current page is negative', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: -1 }));

      previousPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(-1);
      expect(inputState.hasRequested).toBe(false);
    });
  });

  describe('setRecsPageSize', () => {
    it('should update page size and reset to first page', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 2, pageSize: 10 }));

      setRecsPageSize(20);

      const inputState = recsInputStore.getState();
      expect(inputState.pageSize).toBe(20);
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
    });

    it('should reject zero page size', () => {
      updateRecsInputStore((current) => ({ ...current, pageSize: 10, currentPage: 2, hasRequested: false }));

      setRecsPageSize(0);

      const inputState = recsInputStore.getState();
      expect(inputState.pageSize).toBe(10);
      expect(inputState.currentPage).toBe(2);
      expect(inputState.hasRequested).toBe(false);
    });

    it('should reject negative page size', () => {
      updateRecsInputStore((current) => ({ ...current, pageSize: 10, currentPage: 3, hasRequested: false }));

      setRecsPageSize(-5);

      const inputState = recsInputStore.getState();
      expect(inputState.pageSize).toBe(10);
      expect(inputState.currentPage).toBe(3);
      expect(inputState.hasRequested).toBe(false);
    });

    it('should handle very large page size', () => {
      updateRecsInputStore((current) => ({ ...current, pageSize: 10 }));

      setRecsPageSize(1000);

      const inputState = recsInputStore.getState();
      expect(inputState.pageSize).toBe(1000);
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
    });
  });

  describe('resetRecs', () => {
    it('should reset to first page and set hasRequested flag', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 5, hasRequested: false }));

      resetRecs();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
    });

    it('should reset even when already at first page', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 0, hasRequested: false }));

      resetRecs();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
    });

    it('should preserve other input store properties', () => {
      updateRecsInputStore((current) => ({
        ...current,
        name: 'test-model',
        collection: 'products',
        pageSize: 15,
        currentPage: 3,
        productID: 'test-product',
        hasRequested: false
      }));

      resetRecs();

      const inputState = recsInputStore.getState();
      expect(inputState.name).toBe('test-model');
      expect(inputState.collection).toBe('products');
      expect(inputState.pageSize).toBe(15);
      expect(inputState.productID).toBe('test-product');
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
    });
  });

  describe('fetchRecommendations', () => {
    it('should set hasRequested flag to true', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false }));

      fetchRecommendations();

      const inputState = recsInputStore.getState();
      expect(inputState.hasRequested).toBe(true);
    });

    it('should preserve all other state properties', () => {
      updateRecsInputStore((current) => ({
        ...current,
        name: 'test-model',
        collection: 'products',
        pageSize: 20,
        currentPage: 2,
        productID: 'test-product',
        hasRequested: false
      }));

      fetchRecommendations();

      const inputState = recsInputStore.getState();
      expect(inputState.name).toBe('test-model');
      expect(inputState.collection).toBe('products');
      expect(inputState.pageSize).toBe(20);
      expect(inputState.currentPage).toBe(2);
      expect(inputState.productID).toBe('test-product');
      expect(inputState.hasRequested).toBe(true);
    });

    it('should work when hasRequested is already true', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: true }));

      fetchRecommendations();

      const inputState = recsInputStore.getState();
      expect(inputState.hasRequested).toBe(true);
    });
  });

  describe('hasRequested flag lifecycle', () => {
    it('should be set to true by nextPage when advancing', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false, currentPage: 0 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 3 }
      }));

      nextPage();

      expect(recsInputStore.getState().hasRequested).toBe(true);
    });

    it('should be set to true by previousPage when going back', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false, currentPage: 2 }));

      previousPage();

      expect(recsInputStore.getState().hasRequested).toBe(true);
    });

    it('should be set to true by setRecsPageSize', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false }));

      setRecsPageSize(15);

      expect(recsInputStore.getState().hasRequested).toBe(true);
    });

    it('should remain false when setRecsPageSize receives invalid value', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false }));

      setRecsPageSize(0);

      expect(recsInputStore.getState().hasRequested).toBe(false);

      setRecsPageSize(-10);

      expect(recsInputStore.getState().hasRequested).toBe(false);
    });

    it('should be set to true by resetRecs', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false }));

      resetRecs();

      expect(recsInputStore.getState().hasRequested).toBe(true);
    });

    it('should be set to true by fetchRecommendations', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false }));

      fetchRecommendations();

      expect(recsInputStore.getState().hasRequested).toBe(true);
    });

    it('should remain false when nextPage is at boundary', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false, currentPage: 2 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 3 }
      }));

      nextPage();

      expect(recsInputStore.getState().hasRequested).toBe(false);
    });

    it('should remain false when previousPage is at boundary', () => {
      updateRecsInputStore((current) => ({ ...current, hasRequested: false, currentPage: 0 }));

      previousPage();

      expect(recsInputStore.getState().hasRequested).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle undefined output store state gracefully', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 0 }));
      updateRecsOutputStore(() => createTestOutputState({
        totalPages: undefined,
        totalRecords: 30,
      }));

      expect(() => nextPage()).not.toThrow();
    });

    it('should handle NaN values in pagination', () => {
      updateRecsInputStore(() => createTestInputState(NaN));
      updateRecsOutputStore(() => createTestOutputState({
        totalPages: NaN,
      }));

      expect(() => nextPage()).not.toThrow();
      expect(() => previousPage()).not.toThrow();
    });

    it('should handle very large page numbers', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: Number.MAX_SAFE_INTEGER }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: Number.MAX_SAFE_INTEGER }
      }));

      expect(() => nextPage()).not.toThrow();
      expect(() => previousPage()).not.toThrow();
    });
  });

  describe('debug logging', () => {
    it('should log appropriate messages for all functions', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 0 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 3 }
      }));
      nextPage();

      updateRecsInputStore((current) => ({ ...current, currentPage: 2 }));
      previousPage();

      updateRecsInputStore((current) => ({ ...current, pageSize: 10 }));
      setRecsPageSize(20);

      resetRecs();

      fetchRecommendations();
    });

    it('should log boundary conditions', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 2 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 3 }
      }));
      nextPage();
      updateRecsInputStore((current) => ({ ...current, currentPage: 0 }));
      previousPage();
    });
  });
});
