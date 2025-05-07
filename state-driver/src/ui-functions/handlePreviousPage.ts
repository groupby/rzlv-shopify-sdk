import type { SearchParams } from '../types';
import { updateInputStore } from '../searchInputStore';

/**
 * Moves the search to the previous page.
 *
 * This function updates the Input Store by decrementing the page number,
 * ensuring that the page number does not fall below 1.
 */
export function handlePreviousPage(): void {
  updateInputStore((current: SearchParams): SearchParams => ({
    ...current,
    page: current.page > 1 ? current.page - 1 : 1,
  }));
}
