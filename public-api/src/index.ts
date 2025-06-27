// Will act as "barrel file" to export publicly available functions
import { requestSearch } from './search-requester/requestSearch';
import { lazyLoadMore } from './search-requester/lazyLoadMore';
import { requestAutocomplete } from './autocomplete-requester/requestAutocomplete';
import { requestAutocompleteWithSearch } from './autocomplete-requester/requestAutocompleteWithSearch';
import { AUTOCOMPLETE_PREFIX } from './utils/searchUtils.types';
import { fetchStorefrontProducts } from './search-requester/fetchStorefrontProducts';
import { requestRecommendations } from './recommendations-requester/requestRecommendations';

export {
  requestSearch,
  lazyLoadMore,
  requestAutocomplete,
  requestAutocompleteWithSearch,
  AUTOCOMPLETE_PREFIX,
  fetchStorefrontProducts,
  requestRecommendations
}

export type { RecsProduct, RequestRecsResponse, RecsManagerConfig } from './recommendations-requester/requestRecommendations';
