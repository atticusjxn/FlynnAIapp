import { apiRequest } from './apiClient';

export interface BusinessProfile {
  placeId: string;
  name: string;
  formattedAddress: string;
  phoneNumber?: string | null;
  website?: string | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  mapUrl?: string | null;
  photoUrl?: string | null;
  types?: string[];
  openingHours?: string[];
  description?: string | null;
  businessStatus?: string | null;
  source?: 'google_places';
}

export interface BusinessSearchResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating?: number | null;
  userRatingsTotal?: number | null;
  photoUrl?: string | null;
}

const buildQueryString = (params: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const BusinessProfileService = {
  async searchBusinesses(query: string, locationHint?: string): Promise<BusinessSearchResult[]> {
    const queryString = buildQueryString({
      q: query,
      location: locationHint,
    });

    const response = await apiRequest<{ results: BusinessSearchResult[] }>(
      `/business/search${queryString}`,
      {
        method: 'GET',
      }
    );

    return response.results || [];
  },

  async getBusinessDetails(placeId: string): Promise<BusinessProfile> {
    const queryString = buildQueryString({ placeId });

    const response = await apiRequest<{ profile: BusinessProfile }>(
      `/business/details${queryString}`,
      {
        method: 'GET',
      }
    );

    if (!response.profile) {
      throw new Error('No business profile found for that place.');
    }

    return response.profile;
  },
};

export default BusinessProfileService;
