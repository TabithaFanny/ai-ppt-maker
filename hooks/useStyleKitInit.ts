'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { styleKitService } from '@/lib/db';

/**
 * Hook to initialize StyleKit data from IndexedDB on mount.
 * Call this in your root layout or main page.
 */
export function useStyleKitInit() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { hydrateStyleKits } = useStore();

  useEffect(() => {
    async function loadStyleKits() {
      try {
        const styleKits = await styleKitService.getAll();
        hydrateStyleKits(styleKits);
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to load StyleKits from IndexedDB:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsInitialized(true); // Still mark as initialized to not block UI
      }
    }

    loadStyleKits();
  }, [hydrateStyleKits]);

  return { isInitialized, error };
}
