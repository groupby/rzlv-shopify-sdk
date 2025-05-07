import type { SearchParams } from '../types';
import { updateInputStore } from '../searchInputStore';

/**
 * Updates the search parameters to reflect a change in page size.
 *
 * This function updates the `pagesize` field with the new value and resets
 * the current page to 1 (which effectively resets any pagination offset).
 * This ensures that when the page size is modified, the search results start from the first page.
 *
 * @param newPageSize - The new page size to set (as a string for consistency).
 */
export function handlePageSizeChange(newPageSize: string): void {
  updateInputStore((current: SearchParams): SearchParams => ({
    ...current,
    pagesize: newPageSize,
    page: 1, // Reset the current page when the page size changes.
  }));
}
