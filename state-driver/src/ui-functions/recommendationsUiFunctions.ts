import { recsOutputStore } from '../recsOutputStore';
import { updateRecsInputStore } from '../recsInputStore';

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
      return current;
    }
    
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
      return current;
    }
    
    const prevPageIndex = current.currentPage - 1;
    return {
      ...current,
      currentPage: prevPageIndex,
      hasRequested: true
    };
  });
}

export function setRecsPageSize(size: number): void {
  updateRecsInputStore((current) => ({
    ...current,
    pageSize: size,
    currentPage: 0,
    hasRequested: true
  }));
}

export function resetRecs(): void {
  updateRecsInputStore((current) => ({
    ...current,
    currentPage: 0,
    hasRequested: true
  }));
}

/**
 * Convenience function to fetch recommendations with current parameters.
 * Useful for "Refresh" buttons or manual triggers.
 */
export function fetchRecommendations(): void {
  updateRecsInputStore((current) => ({
    ...current,
    hasRequested: true
  }));
}

// TODO: tests for these functions
