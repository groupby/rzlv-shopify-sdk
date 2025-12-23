/**
 * URL Manager utility functions
 */

import { SearchSource } from '../types';
import { COLLECTION_SOURCE_LOWERCASE } from '../constants/searchConstants';

/**
 * Checks if the given source represents a collection search.
 * Handles both the SearchSource enum value and the backwards-compatible string 'collection'.
 *
 * @param source - The search source to check (can be SearchSource enum or string)
 * @returns true if the source is a collection, false otherwise
 */
export function isCollectionSource(source: SearchSource | string): boolean {
  return source === SearchSource.COLLECTION || (source as string) === COLLECTION_SOURCE_LOWERCASE;
}
