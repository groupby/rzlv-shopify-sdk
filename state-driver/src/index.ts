// entry point for the state driver SDK for vite bundler.
// We will import and re-export all SDK functionality from this file similar to the `src/public-api.ts` file
// that we use for the "stateless" SDK

import { handleRefinementChange } from './ui-functions/handleRefinementChange';
import { handlePageSizeChange } from './ui-functions/handlePageSizeChange';
import { handleSearchInput } from './ui-functions/handleSearchInput';
import { handleSortOrderChange } from './ui-functions/handleSortOrderChange';
import { initUrlManager } from './urlManager';
import { searchOutputStore, updateOutputStore } from './searchOutputStore';
import { updateInputStore, searchInputStore } from './searchInputStore';
import { initSearchManager } from './searchManager';
import { requestSearch } from '@rzlv/public-api-sdk/requestSearch';
import { handleNextPage } from './ui-functions/handleNextPage';
import { handlePreviousPage } from './ui-functions/handlePreviousPage';
import { applyRange } from './ui-functions/applyRange';
// autocomplete from public API
import { requestAutocomplete, requestAutocompleteWithSearch } from '@rzlv/public-api-sdk';

export {
  handleRefinementChange,
  handlePageSizeChange,
  handleSearchInput,
  handleSortOrderChange,
  initUrlManager,
  searchOutputStore,
  updateOutputStore,
  updateInputStore,
  searchInputStore,
  initSearchManager,
  requestSearch, // NOTE: This comes from Public SDK and is here because of the legacy code in our search app
  handleNextPage,
  handlePreviousPage,
  applyRange,
  requestAutocomplete,
  requestAutocompleteWithSearch,
}
