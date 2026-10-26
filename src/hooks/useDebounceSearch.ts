import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Example usage:
/*
import { useState, useEffect } from "react";
import { useDebounce } from "./useDebounceSearch";

export default function SearchComponent() {
  const [search, setSearch] = useState("");

  // waits 1000ms after user stops typing
  const debouncedSearch = useDebounce(search, 1000);

  useEffect(() => {
    if (!debouncedSearch) return;

    // ✅ API call happens only after 1 second pause
    callSearchAPI(debouncedSearch);
  }, [debouncedSearch]);

  return (
    <input
      type="text"
      placeholder="Search..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  );
}

*/
