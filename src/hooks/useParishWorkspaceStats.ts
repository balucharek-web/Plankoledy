import { useMemo } from 'react';
import {
  LatLng,
  ParishCenter,
  PlanConfig,
  PriestRouteResult,
  SeasonPlanConfig,
  VisitStop,
} from '../types/parish';
import {
  buildSeasonDaySummaries,
  formatIsoDateLocal,
  getDayEndTime,
  getDayStartTime,
} from '../utils/seasonScheduler';
import { extractStreetName, summarizeStreetStats } from '../utils/spatial';

export interface ExactRouteCacheEntry<TRouteObject> {
  routes: PriestRouteResult[];
  routeObjects: TRouteObject[];
}

export interface ParishWorkspaceStatsParams<TRouteObject> {
  stops: VisitStop[];
  parish: ParishCenter | null;
  boundary: LatLng[];
  config: PlanConfig;
  seasonConfig: SeasonPlanConfig;
  selectedDate: string | null;
  focusedPriestId: number | null;
  inspectedStreet: string | null;
  editingBlockStopId: string | null;
  lassoSelectedStopIds: string[];
  exactRoutesCache: Record<string, ExactRouteCacheEntry<TRouteObject>>;
}

export function useParishWorkspaceStats<TRouteObject>({
  stops,
  parish,
  boundary,
  config,
  seasonConfig,
  selectedDate,
  focusedPriestId,
  inspectedStreet,
  editingBlockStopId,
  lassoSelectedStopIds,
  exactRoutesCache,
}: ParishWorkspaceStatsParams<TRouteObject>) {
  const outsideBoundaryCount = useMemo(
    () =>
      boundary.length < 3
        ? 0
        : stops.filter((s) => s.inBoundary === false).length,
    [boundary.length, stops]
  );

  const validLassoSelectedIds = useMemo(() => {
    if (lassoSelectedStopIds.length === 0) return [];
    const existing = new Set(stops.map((s) => s.id));
    return lassoSelectedStopIds.filter((id) => existing.has(id));
  }, [lassoSelectedStopIds, stops]);

  const activeStopsCount = useMemo(
    () => stops.filter((s) => s.included !== false).length,
    [stops]
  );

  const exactRoutesOnlyByDay = useMemo(() => {
    const out: Record<string, PriestRouteResult[]> = {};
    for (const [key, entry] of Object.entries(exactRoutesCache)) {
      if (key !== 'current') out[key] = entry.routes;
    }
    return out;
  }, [exactRoutesCache]);

  const seasonSummary = useMemo(
    () =>
      buildSeasonDaySummaries(
        stops,
        parish,
        config,
        seasonConfig,
        exactRoutesOnlyByDay
      ),
    [stops, parish, config, seasonConfig, exactRoutesOnlyByDay]
  );

  const plannedDays = seasonSummary.days;
  const unscheduledStops = seasonSummary.unscheduledStops;

  const selectedDaySummary = useMemo(
    () => plannedDays.find((d) => d.date === selectedDate) ?? null,
    [plannedDays, selectedDate]
  );

  const activeDayStreetNames = useMemo(
    () => selectedDaySummary?.streetNames ?? [],
    [selectedDaySummary]
  );

  const inspectedStreetSummary = useMemo(() => {
    if (!inspectedStreet) return null;
    const summary = summarizeStreetStats(inspectedStreet, stops);
    return summary.totalBuildings > 0 ? summary : null;
  }, [inspectedStreet, stops]);

  const activeRouteCacheKey = selectedDate ?? 'current';
  const cachedExact = exactRoutesCache[activeRouteCacheKey];
  const isExactRoute = Boolean(cachedExact && cachedExact.routes.length > 0);

  const displayedRoutes = useMemo(() => {
    if (cachedExact && cachedExact.routes.length > 0) {
      return cachedExact.routes;
    }
    if (selectedDaySummary) {
      return selectedDaySummary.estimatedRoutes;
    }
    return [];
  }, [cachedExact, selectedDaySummary]);

  const nearestPlannedDayDate = useMemo(() => {
    if (plannedDays.length === 0) return null;
    const todayIso = formatIsoDateLocal(new Date());
    const exact = plannedDays.find((d) => d.date === todayIso);
    if (exact) return exact.date;
    const upcoming = plannedDays.find((d) => d.date > todayIso);
    if (upcoming) return upcoming.date;
    return plannedDays[plannedDays.length - 1].date;
  }, [plannedDays]);

  const blockNextStopCandidate = useMemo(() => {
    if (!editingBlockStopId || displayedRoutes.length === 0) return null;
    for (const r of displayedRoutes) {
      const idx = r.orderedStops.findIndex(
        (i) => i.stop.id === editingBlockStopId
      );
      if (idx >= 0) {
        return r.orderedStops[idx + 1]?.stop ?? null;
      }
    }
    return null;
  }, [editingBlockStopId, displayedRoutes]);

  const displayedRouteObjects = useMemo(
    () => (cachedExact ? cachedExact.routeObjects : []),
    [cachedExact]
  );

  const exactDayKeys = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(exactRoutesCache)) {
      if (v.routes.length > 0) out[k] = true;
    }
    return out;
  }, [exactRoutesCache]);

  const effectiveStartTime = useMemo(
    () => getDayStartTime(selectedDate, seasonConfig, config.startTime),
    [selectedDate, seasonConfig, config.startTime]
  );

  const effectiveEndTime = useMemo(
    () => getDayEndTime(selectedDate, seasonConfig),
    [selectedDate, seasonConfig]
  );

  const availableMapStreets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const stop of stops) {
      const isActive = selectedDate
        ? (stop.visitDate ?? '').trim() === selectedDate
        : stop.included !== false;
      if (!isActive) continue;
      if (focusedPriestId !== null && stop.priestId !== focusedPriestId) {
        continue;
      }
      const street = extractStreetName(stop);
      counts.set(street, (counts.get(street) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pl'));
  }, [stops, selectedDate, focusedPriestId]);

  return {
    outsideBoundaryCount,
    validLassoSelectedIds,
    activeStopsCount,
    exactRoutesOnlyByDay,
    seasonSummary,
    plannedDays,
    unscheduledStops,
    selectedDaySummary,
    activeDayStreetNames,
    inspectedStreetSummary,
    activeRouteCacheKey,
    isExactRoute,
    displayedRoutes,
    nearestPlannedDayDate,
    blockNextStopCandidate,
    displayedRouteObjects,
    exactDayKeys,
    effectiveStartTime,
    effectiveEndTime,
    availableMapStreets,
  };
}
