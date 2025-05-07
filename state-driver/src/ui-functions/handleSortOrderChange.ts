import type { SearchParams } from '../types';
import { updateInputStore } from '../searchInputStore';

/**
 * Updates the search parameters to reflect a change in sort order.
 *
 * When a user selects a new sort order (e.g., switching from "relevance" to "price descending"),
 * this function updates the Input Store by setting the `sort_by` field to the new value and resetting
 * the page number to 1 (ensuring that the search results start from the first page).
 *
 * This function is framework-agnostic and leverages the Effector-based updateInputStore helper.
 *
 * @param newSortOrder - The new sort order to set (e.g., "price descending").
 */
export function handleSortOrderChange(newSortOrder: string): void {
  updateInputStore((current: SearchParams): SearchParams => ({
    ...current,
    sort_by: newSortOrder,
    page: 1, // Reset the page number when the sort order changes.
  }));
}
