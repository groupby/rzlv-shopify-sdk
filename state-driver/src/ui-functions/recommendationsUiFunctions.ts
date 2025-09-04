import { recsOutputStore } from '../recsOutputStore';
import { updateRecsInputStore } from '../recsInputStore';
import { debugLog } from '../debugLogger';

/**
 * Navigation functions for recommendations pagination.
 * These are intended to be called directly from UI components.
 * NOTE: API does nto currently support pagination and that is to be handled by local component state for now.
 */

export function nextPage(): void {
  const outputState = recsOutputStore.getState();

  updateRecsInputStore((current) => {
    const nextPageIndex = current.currentPage + 1;
    if (nextPageIndex >= outputState.pagination.totalPages) {
      debugLog('UI:Recs', 'nextPage at end, ignoring', {
        currentPage: current.currentPage,
        totalPages: outputState.pagination.totalPages
      });
      return current;
    }
    debugLog('UI:Recs', 'nextPage', { prevPage: current.currentPage, nextPage: nextPageIndex });
    return {
      ...current,
      currentPage: nextPageIndex,
      hasRequested: true
    };
  });
}

export function previousPage(): void {
  updateRecsInputStore((current) => {
    if (current.currentPage <= 0) {
      debugLog('UI:Recs', 'previousPage at start, ignoring', { currentPage: current.currentPage });
      return current;
    }

    const prevPageIndex = current.currentPage - 1;
    debugLog('UI:Recs', 'previousPage', { prevPage: current.currentPage, nextPage: prevPageIndex });
    return {
      ...current,
      currentPage: prevPageIndex,
      hasRequested: true
    };
  });
}

export function setRecsPageSize(size: number): void {
  updateRecsInputStore((current) => {
    if (size <= 0) {
      debugLog('UI:Recs', 'setRecsPageSize rejected invalid size', { size });
      return current;
    }

    const newState = {
      ...current,
      pageSize: size,
      currentPage: 0,
      hasRequested: true
    };
    debugLog('UI:Recs', 'setRecsPageSize', { prevSize: current.pageSize, newSize: size });
    return newState;
  });
}

export function resetRecs(): void {
  updateRecsInputStore((current) => {
    const newState = {
      ...current,
      currentPage: 0,
      hasRequested: true
    };
    debugLog('UI:Recs', 'resetRecs', { prevPage: current.currentPage, newPage: 0 });
    return newState;
  });
}

/**
 * Convenience function to fetch recommendations with current parameters.
 * Useful for "Refresh" buttons or manual triggers.
 */
export function fetchRecommendations(): void {
  updateRecsInputStore((current) => {
    const newState = {
      ...current,
      hasRequested: true
    };
    debugLog('UI:Recs', 'fetchRecommendations');
    return newState;
  });
}

// TODO: tests for these functions
