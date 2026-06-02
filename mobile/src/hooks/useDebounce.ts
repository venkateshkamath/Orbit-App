import { useEffect, useRef, useState } from 'react';

/**
 * `useDebounce` — returns a debounced copy of `value` that only updates
 * after `delayMs` milliseconds of inactivity.
 *
 * @example
 * const debouncedQuery = useDebounce(searchQuery, 300);
 * useEffect(() => {
 *   if (debouncedQuery) fetchResults(debouncedQuery);
 * }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * `useDebouncedCallback` — returns a stable debounced version of `callback`.
 * The timer resets every time the returned function is called.
 *
 * @example
 * const debouncedSearch = useDebouncedCallback((q: string) => fetchResults(q), 300);
 * <TextInput onChangeText={debouncedSearch} />
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback; // Always call the latest version

  return useRef((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delayMs);
  }).current;
}
