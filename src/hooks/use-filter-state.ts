import { useState, useCallback } from "react";

export function useFilterState() {
    const [filterValues, setFilterValues] = useState<string[]>([]);
    const [searchFilterValue, setSearchFilterValue] = useState("");
  
    const handleFilterValues = useCallback((fValue: string) => {
      setFilterValues((prev) => {
        const filterSet = new Set(prev);
        if (filterSet.has(fValue)) {
          filterSet.delete(fValue);
        } else {
          filterSet.add(fValue);
        }
        return Array.from(filterSet);
      });
    }, []);
  
    const clearSearch = useCallback(() => {
      setSearchFilterValue("");
    }, []);
  
    return {
      filterValues,
      searchFilterValue,
      setSearchFilterValue,
      handleFilterValues,
      clearSearch,
    };
  }