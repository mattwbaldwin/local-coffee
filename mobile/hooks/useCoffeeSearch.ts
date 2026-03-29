import { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { milesToMeters } from '../lib/distance';
import type { CoffeeItem } from '../types/coffee';

const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'http://localhost:3000';

export type SearchStatus = 'idle' | 'locating' | 'loading' | 'error' | 'ready';

export function useCoffeeSearch() {
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<CoffeeItem[]>([]);
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [radiusMiles, setRadiusMiles] = useState<number>(3);

  const radiusMeters = useMemo(() => milesToMeters(radiusMiles), [radiusMiles]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchCoffee(lat: number, lng: number, radiusM: number) {
    setStatus('loading');
    setError(null);
    setView('list');

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/coffee?lat=${lat}&lng=${lng}&radiusMeters=${radiusM}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Request failed');
      setItems(data.items ?? []);
      setStatus('ready');
    } catch (e: unknown) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  async function useMyLocation() {
    setStatus('locating');
    setError(null);

    const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
    if (permStatus !== 'granted') {
      setStatus('error');
      setError('Location permission denied.');
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setCoords({ lat, lng });
      fetchCoffee(lat, lng, radiusMeters);
    } catch (e: unknown) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not get location.');
    }
  }

  // Debounced refetch when radius changes (only after first location is set)
  useEffect(() => {
    if (!coords) return;
    if (status === 'locating') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCoffee(coords.lat, coords.lng, radiusMeters);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusMeters]);

  const sortedItems = useMemo(() => {
    const arr = [...items];

    if (sortBy === 'distance') {
      arr.sort((a, b) => (a.distanceMeters ?? 9e15) - (b.distanceMeters ?? 9e15));
      return arr;
    }

    arr.sort((a, b) => {
      const ar = a.rating ?? 0;
      const br = b.rating ?? 0;
      if (br !== ar) return br - ar;
      const av = a.ratingsTotal ?? 0;
      const bv = b.ratingsTotal ?? 0;
      if (bv !== av) return bv - av;
      return (a.distanceMeters ?? 9e15) - (b.distanceMeters ?? 9e15);
    });

    return arr;
  }, [items, sortBy]);

  return {
    status,
    error,
    coords,
    items,
    sortedItems,
    sortBy,
    setSortBy,
    view,
    setView,
    radiusMiles,
    setRadiusMiles,
    radiusMeters,
    useMyLocation,
  };
}
