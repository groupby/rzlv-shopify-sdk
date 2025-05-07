import type { SearchParams } from '../types';
import { updateInputStore } from '../searchInputStore';

/**
 * Updates the search parameters to apply a range refinement.
 *
 * This function updates the Input Store by:
 * - Removing any existing range refinement for the specified navigation field.
 * - Adding a new range refinement string based on the provided low and high values.
 * - Resetting the current page to 1 so that the search results start from the first page.
 *
 * @param rangeNav - The name of the navigation field (e.g., 'price').
 * @param lowValue - The lower bound of the range.
 * @param highValue - The upper bound of the range.
 *
 * @example
 * // Example usage for applying a price range:
 * //
 * // In a Svelte component, you might import and use the function as follows:
 * //
 * // <script lang="ts">
 * //   import { applyRange } from 'gbi-search-state-driver';
 * //
 * //   let minPrice = 10; // Assume these values are set by the user
 * //   let maxPrice = 100;
 * //
 * //   function handleApplyClick() {
 * //     // This call will update the Input Store by setting a price range refinement
 * //     // in the format "price:10--to--100" and reset the page number to 1.
 * //     applyRange('price', minPrice, maxPrice);
 * //   }
 * // </script>
 * //
 * // <button on:click={handleApplyClick}>Apply Price Range</button>
 * //
 * // When the button is clicked, the state will be updated with the new price range,
 * // triggering the Search Manager to perform a new search with the updated parameters.
 */

export function applyRange(
  rangeNav: string,
  lowValue: number,
  highValue: number,
): void {
  updateInputStore((current: SearchParams): SearchParams => {
    // Filter out any existing range refinement for the given navigation field.
    const existingRangeRefinements = current.refinements.filter((refinement) => !refinement.startsWith(`${rangeNav}`));

    // Construct the new range refinment string.
    const newRangeRefinement = `${rangeNav}:${lowValue}--to--${highValue}`;

    // Return the updated state with the new refinements array and reset the page.
    return {
      ...current,
      refinements: [...existingRangeRefinements, newRangeRefinement],
      page: 1,
    };
  });
}
