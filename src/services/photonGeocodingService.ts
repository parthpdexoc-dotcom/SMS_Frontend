/**
 * Photon Geocoding Service (powered by https://github.com/komoot/photon)
 * Provides open-source OSM address search and coordinates.
 */

import { PHOTON_API_URL, STATIC_PHOTON_API_URL } from '@/utils/apiClient';

export interface PhotonLocationResult {
  label: string;
  name: string;
  latitude: number;
  longitude: number;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

interface PhotonFeature {
  geometry?: {
    type?: string;
    coordinates?: [number, number]; // [lon, lat]
  };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface PhotonApiResponse {
  type: string;
  features: PhotonFeature[];
}

function parsePhotonFeatures(features: PhotonFeature[]): PhotonLocationResult[] {
  return features.flatMap((feat) => {
    const coords = feat.geometry?.coordinates;
    if (!coords || coords.length < 2) return [];

    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

    const p = feat.properties ?? {};
    const mainName = p.name?.trim() || '';
    const streetPart = [p.housenumber?.trim(), p.street?.trim()].filter(Boolean).join(' ');
    const cityPart = p.city?.trim() || p.locality?.trim() || p.district?.trim() || '';
    const statePart = p.state?.trim() || '';
    const zipPart = p.postcode?.trim() || '';
    const countryPart = p.country?.trim() || '';

    const parts = [
      streetPart || mainName,
      mainName && mainName !== streetPart ? mainName : null,
      cityPart,
      statePart,
      zipPart,
      countryPart,
    ].filter(Boolean) as string[];

    // Deduplicate adjacent words if any
    const uniqueParts: string[] = [];
    for (const part of parts) {
      if (!uniqueParts.includes(part)) {
        uniqueParts.push(part);
      }
    }

    const label = uniqueParts.join(', ') || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    return [
      {
        label,
        name: mainName || streetPart || label,
        latitude: lat,
        longitude: lon,
        street: streetPart || undefined,
        city: cityPart || undefined,
        state: statePart || undefined,
        postcode: zipPart || undefined,
        country: countryPart || undefined,
      },
    ];
  });
}

/**
 * Searches locations using the Photon API.
 * Uses PHOTON_API_URL from apiClient (environment), and automatically falls back to STATIC_PHOTON_API_URL
 * if fetching fails for any reason.
 * @param query Search query text (e.g. street, city, landmark)
 * @param limit Maximum results (default: 10)
 */
export async function searchPhotonLocations(
  query: string,
  limit = 10
): Promise<PhotonLocationResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const fetchWithEndpoint = async (endpoint: string): Promise<PhotonLocationResult[]> => {
    const normalizedBase = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
    const targetUrl = `${normalizedBase}?q=${encodeURIComponent(trimmed)}&limit=${limit}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Photon geocoding returned status ${response.status}`);
    }

    const data: PhotonApiResponse = await response.json();
    return parsePhotonFeatures(data?.features ?? []);
  };

  try {
    return await fetchWithEndpoint(PHOTON_API_URL);
  } catch (primaryError) {
    console.warn(`Failed to fetch from primary Photon URL (${PHOTON_API_URL}):`, primaryError);

    // If primary URL is different from static URL, retry using static fallback URL
    if (PHOTON_API_URL !== STATIC_PHOTON_API_URL) {
      try {
        console.info(`Retrying using static fallback Photon URL (${STATIC_PHOTON_API_URL})...`);
        return await fetchWithEndpoint(STATIC_PHOTON_API_URL);
      } catch (fallbackError) {
        console.warn('Failed to fetch from static fallback Photon URL:', fallbackError);
      }
    }

    return [];
  }
}
