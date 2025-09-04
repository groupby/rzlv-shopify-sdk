import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextPage, previousPage, setRecsPageSize, resetRecs, fetchRecommendations } from '../ui-functions/recommendationsUiFunctions';
import { recsInputStore, updateRecsInputStore } from '../recsInputStore';
import { recsOutputStore, updateRecsOutputStore } from '../recsOutputStore';
import { debugLog } from '../debugLogger';

vi.mock('../debugLogger', () => ({
  debugLog: vi.fn(),
}));

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
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'nextPage', { prevPage: 0, nextPage: 1 });
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
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'nextPage at end, ignoring', {
        currentPage: 2,
        totalPages: 3
      });
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
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'nextPage at end, ignoring', {
        currentPage: 3,
        totalPages: 3
      });
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
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'nextPage at end, ignoring', {
        currentPage: 0,
        totalPages: 0
      });
    });
  });

  describe('previousPage', () => {
    it('should go to previous page when not at the beginning', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 2 }));

      previousPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(1);
      expect(inputState.hasRequested).toBe(true);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'previousPage', { prevPage: 2, nextPage: 1 });
    });

    it('should not go to previous page when at the first page', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 0 }));

      previousPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(false);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'previousPage at start, ignoring', { currentPage: 0 });
    });

    it('should not go to previous page when current page is negative', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: -1 }));

      previousPage();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(-1);
      expect(inputState.hasRequested).toBe(false);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'previousPage at start, ignoring', { currentPage: -1 });
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
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'setRecsPageSize', { prevSize: 10, newSize: 20 });
    });

    it('should handle zero page size', () => {
      updateRecsInputStore((current) => ({ ...current, pageSize: 10 }));

      setRecsPageSize(0);

      const inputState = recsInputStore.getState();
      expect(inputState.pageSize).toBe(0);
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'setRecsPageSize', { prevSize: 10, newSize: 0 });
    });

    it('should handle negative page size', () => {
      updateRecsInputStore((current) => ({ ...current, pageSize: 10 }));

      setRecsPageSize(-5);

      const inputState = recsInputStore.getState();
      expect(inputState.pageSize).toBe(-5);
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'setRecsPageSize', { prevSize: 10, newSize: -5 });
    });

    it('should handle very large page size', () => {
      updateRecsInputStore((current) => ({ ...current, pageSize: 10 }));

      setRecsPageSize(1000);

      const inputState = recsInputStore.getState();
      expect(inputState.pageSize).toBe(1000);
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'setRecsPageSize', { prevSize: 10, newSize: 1000 });
    });
  });

  describe('resetRecs', () => {
    it('should reset to first page and set hasRequested flag', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 5, hasRequested: false }));

      resetRecs();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'resetRecs');
    });

    it('should reset even when already at first page', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 0, hasRequested: false }));

      resetRecs();

      const inputState = recsInputStore.getState();
      expect(inputState.currentPage).toBe(0);
      expect(inputState.hasRequested).toBe(true);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'resetRecs');
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
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'fetchRecommendations');
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
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'fetchRecommendations');
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
      updateRecsOutputStore(() => ({
        products: [],
        allProducts: [],
        pagination: {
          currentPage: 0,
          pageSize: 10,
          totalPages: undefined as any,
          totalRecords: 30,
        },
        metadata: { modelName: 'test', totalCount: 30 },
        loading: false,
        error: null,
        rawResponse: undefined,
      }));

      expect(() => nextPage()).not.toThrow();
    });

    it('should handle NaN values in pagination', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: NaN as any }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: NaN as any }
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
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'nextPage', { prevPage: 0, nextPage: 1 });

      updateRecsInputStore((current) => ({ ...current, currentPage: 2 }));
      previousPage();
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'previousPage', { prevPage: 2, nextPage: 1 });

      updateRecsInputStore((current) => ({ ...current, pageSize: 10 }));
      setRecsPageSize(20);
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'setRecsPageSize', { prevSize: 10, newSize: 20 });

      resetRecs();
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'resetRecs');

      fetchRecommendations();
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'fetchRecommendations');
    });

    it('should log boundary conditions', () => {
      updateRecsInputStore((current) => ({ ...current, currentPage: 2 }));
      updateRecsOutputStore((current) => ({
        ...current,
        pagination: { ...current.pagination, totalPages: 3 }
      }));
      nextPage();
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'nextPage at end, ignoring', {
        currentPage: 2,
        totalPages: 3
      });
      updateRecsInputStore((current) => ({ ...current, currentPage: 0 }));
      previousPage();
      expect(debugLog).toHaveBeenCalledWith('UI:Recs', 'previousPage at start, ignoring', { currentPage: 0 });
    });
  });
});
