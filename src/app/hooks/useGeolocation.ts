import { useState, useCallback } from 'react';
import type { Location } from '../types';
import { reverseGeocode } from '../services/routing';

export function useGeolocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;
      const address = await reverseGeocode(latitude, longitude);

      const loc: Location = {
        lat: latitude,
        lng: longitude,
        address,
        name: 'Current Location',
      };

      setLocation(loc);
      setLoading(false);
      return loc;
    } catch (err: any) {
      setError(err.message || 'Failed to get location');
      setLoading(false);
      return null;
    }
  }, []);

  return { location, loading, error, requestLocation };
}
