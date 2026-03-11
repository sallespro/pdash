import type { Location, CommuteEstimate } from '../types';

// Haversine distance in km
function haversine(a: Location, b: Location): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Average speeds by mode (km/h)
const SPEEDS: Record<string, number> = {
  cycling: 18,
  walking: 5,
  driving: 40,
};

export function estimateCommute(
  origin: Location,
  destination: Location,
  mode: 'cycling' | 'walking' | 'driving' = 'cycling'
): CommuteEstimate {
  const distance = haversine(origin, destination);
  // Add 30% for road routing vs straight line
  const routeDistance = distance * 1.3;
  const speed = SPEEDS[mode];
  const timeMinutes = Math.round((routeDistance / speed) * 60);

  return {
    to_dest: timeMinutes,
    from_dest: timeMinutes,
    distance_km: Math.round(routeDistance * 10) / 10,
    mode,
  };
}

export async function geocodeAddress(query: string): Promise<Location | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PDash/1.0' },
    });
    const data = await res.json();
    if (data.length === 0) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: data[0].display_name,
      name: query,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PDash/1.0' },
    });
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
