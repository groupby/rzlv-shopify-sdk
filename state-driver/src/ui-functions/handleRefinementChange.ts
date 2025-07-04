import type { SearchParams } from '../types';
import { updateInputStore } from '../searchInputStore';

/**
 * Handles changes to refinement filters.
 *
 * This function updates the search parameters by adding or removing a refinement,
 * and resets the current page to 1. It uses the updateInputStore helper to update the state.
 *
 * @param navigationName - The name of the refinement category (e.g., "brands").
 * @param refinementValue - The specific refinement value (e.g., "BALMAIN").
 * @param isChecked - True if the refinement is being added; false if removed.
 */
export function handleRefinementChange(
  navigationName: string,
  refinementValue: string,
  isChecked: boolean
): void {
  updateInputStore((currentParams: SearchParams): SearchParams => {
    // Create a set for easy addition and removal of refinements.
    const existingRefinements = new Set(currentParams.refinements);
    const formattedRefinement = `${navigationName}:${refinementValue}`;

    if (isChecked) {
      existingRefinements.add(formattedRefinement);
    } else {
      existingRefinements.delete(formattedRefinement);
    }

    // Reset page to 1 and set flag whenever refinements change.
    return {
      ...currentParams,
      refinements: Array.from(existingRefinements),
      page: 1,
      hasRefinementChanged: true,
    };
  });
}
