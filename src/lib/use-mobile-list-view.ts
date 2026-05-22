import { useEffect, useMemo, useState } from "react";

export type MobileListViewMode = "table" | "cards";

export function useMobileListView(routeKey: string) {
  const storageKey = useMemo(() => `mobile-view:${routeKey}`, [routeKey]);
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<MobileListViewMode>("table");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey) as MobileListViewMode | null;
    if (saved === "table" || saved === "cards") {
      setViewMode(saved);
      return;
    }
    setViewMode("cards");
  }, [storageKey]);

  const updateViewMode = (next: MobileListViewMode) => {
    setViewMode(next);
    window.localStorage.setItem(storageKey, next);
  };

  return { isMobile, viewMode, setViewMode: updateViewMode };
}
