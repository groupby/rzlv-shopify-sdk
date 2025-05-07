import type { SearchParams } from '../types';
import { updateInputStore } from '../searchInputStore';

/**
 * Advances the search to the next page.
 *
 * This function updates the Input Store by incrementing the page number.
 * The Search Manager will detect this change and trigger a search request for the next page.
 */
export function handleNextPage(): void {
  updateInputStore((current: SearchParams): SearchParams => ({
    ...current,
    page: current.page + 1,
  }));
}
