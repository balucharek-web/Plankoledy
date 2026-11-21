import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Church,
  ClipboardCheck,
  Eye,
  EyeOff,
  Footprints,
  Home,
  ListOrdered,
  Navigation,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DayPlanSummary,
  MarkerLabelMode,
  PriestRouteResult,
  ReturnRouteTarget,
  RoadLegsLiveMetrics,
  TravelModeOption,
} from '../types/parish';
import {
  formatPolishDateChip,
  formatPolishDateFull,
} from '../utils/seasonScheduler';
import { formatDistance } from '../utils/spatial';

interface MapDayRouteBarProps {
  plannedDays: DayPlanSummary[];
  selectedDate: string | null;
  nearestDayDate?: string | null;
  selectedDaySummary: DayPlanSummary | null;
  routes: PriestRouteResult[];
  isExactRoute: boolean;
  isComputingExact: boolean;
  travelMode: TravelModeOption;
  onChangeTravelMode: (mode: TravelModeOption) => void;
  returnTarget: ReturnRouteTarget;
  onChangeReturnTarget: (target: ReturnRouteTarget) => void;
  liveRoadMetrics?: RoadLegsLiveMetrics | null;
  focusedPriestId: number | null;
  availableStreets: Array<{ name: string; count: number }>;
  focusedStreet: string | null;
  activeStopsCount: number;
  markerLabelMode: MarkerLabelMode;
  showRouteLines: boolean;
  showHousesOnMap: boolean;
  onSelectDate: (date: string | null) => void;
  onFocusPriest: (priestId: number | null) => void;
  onFocusStreet: (streetName: string | null) => void;
  onChangeMarkerLabelMode: (mode: MarkerLabelMode) => void;
  onToggleRouteLines: () => void;
  onToggleShowHouses: () => void;
  onComputeExactDayRoute: () => void;
  onOpenRouteList: () => void;
  onOpenFieldMode: () => void;
}

function shortAddress(address: string, fallback: string): string {
  const first = (address || fallback).split(',')[0]?.trim();
  return first || fallback;
}

function formatHousesLabel(count: number): string {
  if (count === 1) return '1 dom';
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} domy`;
  }
  return `${count} domów`;
}

function shiftTimeMinutes(hhmm: string, deltaMinutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return hhmm;
  const baseMin = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  const nextMin = ((baseMin + deltaMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(nextMin / 60);
  const m = nextMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const MapDayRouteBar: React.FC<MapDayRouteBarProps> = ({
  plannedDays,
  selectedDate,
  nearestDayDate = null,
  selectedDaySummary,
  routes,
  isExactRoute,
  isComputingExact,
  travelMode,
  onChangeTravelMode,
  returnTarget,
  onChangeReturnTarget,
  liveRoadMetrics = null,
  focusedPriestId,
  availableStreets,
  focusedStreet,
  activeStopsCount,
  markerLabelMode,
  showRouteLines,
  showHousesOnMap,
  onSelectDate,
  onFocusPriest,
  onFocusStreet,
  onChangeMarkerLabelMode,
  onToggleRouteLines,
  onToggleShowHouses,
  onComputeExactDayRoute,
  onOpenRouteList,
  onOpenFieldMode,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const selectedDayIdx = selectedDate
    ? plannedDays.findIndex((d) => d.date === selectedDate)
    : -1;

  const hasMultipleDays = plannedDays.length > 1;

  const stepDay = (delta: number) => {
    if (plannedDays.length === 0) return;
    if (selectedDayIdx < 0) {
      onSelectDate(nearestDayDate ?? plannedDays[0].date);
      onFocusPriest(null);
      return;
    }
    const nextIdx =
      (selectedDayIdx + delta + plannedDays.length) % plannedDays.length;
    onSelectDate(plannedDays[nextIdx].date);
    onFocusPriest(null);
  };

  const visibleRoutes =
    focusedPriestId !== null
      ? routes.filter((r) => r.priestId === focusedPriestId)
      : routes;

  const totalStopsOnRoutes = visibleRoutes.reduce(
    (acc, r) => acc + r.orderedStops.length,
    0
  );
  const totalDistMeters = visibleRoutes.reduce(
    (acc, r) => acc + r.totalDistanceMeters,
    0
  );

  const primaryRoute = visibleRoutes[0] ?? null;
  const primaryFirstItem = primaryRoute?.orderedStops[0] ?? null;
  const primaryStartStop = primaryFirstItem?.stop ?? null;
  const primaryEndStop =
    primaryRoute && primaryRoute.orderedStops.length > 1
      ? primaryRoute.orderedStops[primaryRoute.orderedStops.length - 1].stop
      : null;

  const activeStartAddress = primaryStartStop
    ? shortAddress(primaryStartStop.address, primaryStartStop.label)
    : '';
  const activeEndAddress = primaryEndStop
    ? shortAddress(primaryEndStop.address, primaryEndStop.label)
    : '';

  const estApproachMeters = primaryFirstItem?.legDistanceMeters ?? 0;
  const estApproachMs = primaryFirstItem?.legDurationMillis ?? 0;
  const approachMeters =
    liveRoadMetrics?.approach?.distanceMeters ?? estApproachMeters;
  const approachMs =
    liveRoadMetrics?.approach?.durationMillis ?? estApproachMs;
  const approachMinutes =
    approachMeters >= 30 ? Math.max(1, Math.round(approachMs / 60000)) : 0;

  const estReturnMeters = primaryRoute?.returnLegDistanceMeters ?? 0;
  const estReturnMs = primaryRoute?.returnLegDurationMillis ?? 0;
  const returnMeters =
    returnTarget === 'none'
      ? 0
      : liveRoadMetrics?.returnLeg?.distanceMeters ??
        (returnTarget === 'parish' ? estReturnMeters : 0);
  const returnMs =
    returnTarget === 'none'
      ? 0
      : liveRoadMetrics?.returnLeg?.durationMillis ??
        (returnTarget === 'parish' ? estReturnMs : 0);
  const returnMinutes =
    returnMeters >= 30 ? Math.max(1, Math.round(returnMs / 60000)) : 0;

  const distDeltaMeters =
    (approachMeters - estApproachMeters) + (returnMeters - estReturnMeters);
  const adjustedTotalDistMeters = Math.max(
    0,
    totalDistMeters + distDeltaMeters
  );
  const durationDeltaMinutes = Math.round(
    (approachMs - estApproachMs + (returnMs - estReturnMs)) / 60000
  );

  const hasLiveRoadGeometry = Boolean(
    isExactRoute || liveRoadMetrics?.approach || liveRoadMetrics?.returnLeg
  );
  const firstArrivalTime = primaryFirstItem?.arrivalTime ?? '';

  const streetHeadline = selectedDaySummary
    ? selectedDaySummary.streetNames.length > 0
      ? `${selectedDaySummary.streetNames.slice(0, 2).join(', ')}${
          selectedDaySummary.streetNames.length > 2
            ? ` +${selectedDaySummary.streetNames.length - 2}`
            : ''
        }`
      : 'Wybrane punkty'
    : 'Cały teren parafii';

  const rawEndTime =
    primaryRoute?.endTime ||
    selectedDaySummary?.estimatedEndTime ||
    selectedDaySummary?.plannedEndTime ||
    '';
  const adjustedEndTime =
    rawEndTime && durationDeltaMinutes !== 0
      ? shiftTimeMinutes(rawEndTime, durationDeltaMinutes)
      : rawEndTime;

  const displayTimeWindow = selectedDaySummary
    ? `${selectedDaySummary.startTime}–${adjustedEndTime}`
    : '';

  if (minimized) {
    return (
      <div className="no-print absolute bottom-3 left-2.5 sm:bottom-4 sm:left-4 z-[460] max-w-[calc(100%-24px)] sm:max-w-[calc(100%-76px)]">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="min-h-[44px] px-4 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700 rounded-2xl shadow-lg text-xs font-semibold text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-900 inline-flex items-center gap-2 tabular-nums"
        >
          <ChevronUp className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          <span className="truncate">
            {selectedDaySummary
              ? `${formatPolishDateChip(selectedDaySummary.date)} · ${streetHeadline}`
              : 'Cała parafia'}
          </span>
          {routes.length > 0 && (
            <span className="text-slate-500 dark:text-slate-400 font-normal shrink-0">
              · {formatHousesLabel(totalStopsOnRoutes)}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="no-print absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-4 sm:left-4 sm:right-auto sm:w-[468px] lg:w-[500px] z-[460]">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden">
        {/* Clean Drag-Handle Affordance */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Zwiń opcje trasy' : 'Rozwiń opcje trasy'}
          className="w-full pt-2 pb-1 flex items-center justify-center group focus:outline-none"
        >
          <span className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500 transition-colors" />
        </button>

        {/* Instant 1-Click Map View Switcher: Mapa dnia <-> Cała parafia */}
        {plannedDays.length > 0 && (
          <div className="px-3.5 pb-2 flex items-center justify-between gap-2">
            <div
              role="group"
              aria-label="Tryb widoku mapy"
              className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 flex-1 sm:flex-initial"
            >
              <button
                type="button"
                onClick={() => {
                  if (!selectedDate) {
                    onSelectDate(nearestDayDate ?? plannedDays[0].date);
                    onFocusPriest(null);
                  }
                }}
                aria-pressed={Boolean(selectedDate)}
                className={`flex-1 sm:flex-initial min-h-[32px] px-3 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  selectedDate
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Mapa dnia</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectDate(null);
                  onFocusPriest(null);
                  onFocusStreet(null);
                }}
                aria-pressed={!selectedDate}
                className={`flex-1 sm:flex-initial min-h-[32px] px-3 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  !selectedDate
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Church className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Cała parafia</span>
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {hasMultipleDays && selectedDate && (
                <>
                  <button
                    type="button"
                    onClick={() => stepDay(-1)}
                    aria-label="Poprzedni dzień kolędy"
                    className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepDay(1)}
                    aria-label="Następny dzień kolędy"
                    className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Zwiń kartę podglądu"
                title="Zwiń kartę podglądu"
                className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Clean Non-Truncated Summary Header */}
        <div className="px-3.5 pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {selectedDaySummary ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm sm:text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                    <span className="sm:hidden">
                      {formatPolishDateChip(selectedDaySummary.date)}
                    </span>
                    <span className="hidden sm:inline">
                      {formatPolishDateFull(selectedDaySummary.date)}
                    </span>
                  </span>
                  {displayTimeWindow && (
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 tabular-nums">
                      {displayTimeWindow}
                    </span>
                  )}
                  {hasMultipleDays && selectedDayIdx >= 0 && (
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                      {selectedDayIdx + 1}/{plannedDays.length}
                    </span>
                  )}
                </div>

                <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                  <span className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[190px] sm:max-w-[230px]">
                    {streetHeadline}
                  </span>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <span>
                    {formatHousesLabel(
                      totalStopsOnRoutes || selectedDaySummary.stops.length
                    )}
                  </span>
                  {adjustedTotalDistMeters > 0 && (
                    <>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span>{formatDistance(adjustedTotalDistMeters)}</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Teren parafii
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Dotknij dowolną ulicę na mapie, aby zobaczyć domy
                </div>
              </>
            )}
          </div>

          {plannedDays.length === 0 && (
            <button
              type="button"
              onClick={() => setMinimized(true)}
              aria-label="Zwiń kartę podglądu"
              title="Zwiń kartę podglądu"
              className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Compact START -> META Summary + Priest Filter + Primary Action Row */}
        {routes.length > 0 && (
          <div className="px-3.5 pb-2.5 space-y-2">
            {activeStartAddress && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-900 dark:text-white truncate">
                    {activeStartAddress}
                  </span>
                  {activeEndAddress && activeEndAddress !== activeStartAddress && (
                    <>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-slate-200 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300 truncate">
                        {activeEndAddress}
                      </span>
                    </>
                  )}
                </div>
                <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {isComputingExact || liveRoadMetrics?.isLoading
                    ? 'Układanie trasy...'
                    : approachMeters >= 30
                      ? `${travelMode === 'DRIVING' ? 'Dojazd' : 'Dojście'} ${approachMinutes} min`
                      : firstArrivalTime
                        ? `Start ${firstArrivalTime}`
                        : hasLiveRoadGeometry
                          ? 'Po drogach'
                          : ''}
                </span>
              </div>
            )}

            {/* Priest filter strip — only shown when 2+ priests walk this day */}
            {routes.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => onFocusPriest(null)}
                  className={`min-h-[36px] sm:min-h-[32px] px-2.5 py-1 text-[11px] font-semibold rounded-xl whitespace-nowrap shrink-0 tabular-nums transition-colors ${
                    focusedPriestId === null
                      ? 'bg-slate-900 dark:bg-amber-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Wszyscy ({routes.reduce((a, r) => a + r.orderedStops.length, 0)})
                </button>
                {routes.map((r) => {
                  const active = focusedPriestId === r.priestId;
                  return (
                    <button
                      key={r.priestId}
                      type="button"
                      onClick={() => onFocusPriest(active ? null : r.priestId)}
                      className={`min-h-[36px] sm:min-h-[32px] px-2.5 py-1 text-[11px] font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 tabular-nums border transition-colors ${
                        active
                          ? 'bg-slate-900 dark:bg-amber-700 text-white border-slate-900 dark:border-amber-700'
                          : focusedPriestId !== null
                            ? 'bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: r.color }}
                      />
                      <span>Ks. {r.priestId}</span>
                      <span className="opacity-75 font-mono">
                        {r.orderedStops.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Primary Thumb-Zone Action Row */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={onOpenFieldMode}
                className="min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                <span>W teren</span>
              </button>

              <button
                type="button"
                onClick={onOpenRouteList}
                className="min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <ListOrdered className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Rozpiska</span>
              </button>

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className={`min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  expanded
                    ? 'bg-slate-900 dark:bg-amber-700 border-slate-900 dark:border-amber-700 text-white'
                    : 'bg-slate-100/90 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>{expanded ? 'Zamknij' : 'Opcje'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick 1-tap Jump into Kolęda Day when viewing Whole Parish */}
        {!selectedDate && nearestDayDate && plannedDays.length > 0 && (
          <div className="px-3.5 pb-3 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectDate(nearestDayDate);
                onFocusPriest(null);
              }}
              className="flex-1 min-h-[42px] px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>Otwórz dzień: {formatPolishDateChip(nearestDayDate)}</span>
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                expanded
                  ? 'bg-slate-900 dark:bg-amber-700 border-slate-900 dark:border-amber-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Opcje</span>
            </button>
          </div>
        )}

        {/* Expandable Options Drawer */}
        {expanded && (
          <div className="px-3.5 py-3 bg-slate-50/95 dark:bg-slate-950/85 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            {plannedDays.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDate ?? ''}
                  onChange={(e) => {
                    onSelectDate(e.target.value || null);
                    onFocusPriest(null);
                  }}
                  aria-label="Wybierz dzień kolędy na mapie"
                  className="flex-1 min-w-0 min-h-[42px] px-2.5 py-1.5 text-base sm:text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:border-amber-600"
                >
                  {plannedDays.map((d, idx) => (
                    <option key={d.date} value={d.date}>
                      {hasMultipleDays ? `${idx + 1}/${plannedDays.length} · ` : ''}
                      {formatPolishDateChip(d.date)} ({d.startTime}–
                      {d.estimatedEndTime || d.plannedEndTime}) ·{' '}
                      {formatHousesLabel(d.stops.length)}
                    </option>
                  ))}
                  <option value="">Teren całej parafii</option>
                </select>

                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate(null);
                      onFocusPriest(null);
                      onFocusStreet(null);
                    }}
                    className="min-h-[42px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  >
                    <Church className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    <span>Parafia</span>
                  </button>
                )}
              </div>
            )}

            {/* Travel Mode + Return Target inside Options */}
            {routes.length > 0 && (
              <div className="space-y-2 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div
                    role="group"
                    aria-label="Sposób dotarcia na kolędę"
                    className="inline-flex items-center rounded-xl bg-slate-200/70 dark:bg-slate-800 p-0.5 shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeTravelMode('WALKING')}
                      aria-pressed={travelMode === 'WALKING'}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                        travelMode === 'WALKING'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Footprints className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                      <span>Piechotą</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTravelMode('DRIVING')}
                      aria-pressed={travelMode === 'DRIVING'}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                        travelMode === 'DRIVING'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Car className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                      <span>Autem</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums truncate">
                    {approachMeters >= 30
                      ? `${travelMode === 'DRIVING' ? 'Dojazd' : 'Dojście'}: ${approachMinutes} min (${formatDistance(approachMeters)})`
                      : 'Start na miejscu'}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div
                    role="group"
                    aria-label="Trasa powrotna z mety"
                    className="inline-flex items-center rounded-xl bg-slate-200/70 dark:bg-slate-800 p-0.5 shrink-0"
                  >
                    {(
                      [
                        { id: 'start', label: 'Na START' },
                        { id: 'parish', label: 'Kościół' },
                        { id: 'none', label: 'Brak' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeReturnTarget(opt.id)}
                        aria-pressed={returnTarget === opt.id}
                        className={`min-h-[30px] px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          returnTarget === opt.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums truncate">
                    {returnTarget === 'none'
                      ? 'Bez powrotu'
                      : returnMeters >= 30
                        ? `Powrót: ${returnMinutes} min (${formatDistance(returnMeters)})`
                        : 'Powrót po drogach'}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {routes.length > 0 && (
                <button
                  type="button"
                  disabled={isComputingExact}
                  onClick={onComputeExactDayRoute}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-amber-950 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 disabled:opacity-50 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>
                    {isComputingExact ? 'Przeliczanie...' : 'Przelicz trasę'}
                  </span>
                </button>
              )}

              {activeStopsCount > 0 && (
                <button
                  type="button"
                  onClick={onToggleShowHouses}
                  aria-pressed={showHousesOnMap}
                  className={`min-h-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap border ${
                    showHousesOnMap
                      ? 'bg-slate-900 dark:bg-amber-700 text-white border-slate-900 dark:border-amber-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>{showHousesOnMap ? 'Domy: widoczne' : 'Pokaż domy'}</span>
                </button>
              )}

              {routes.length > 0 && (
                <button
                  type="button"
                  onClick={onToggleRouteLines}
                  className={`min-h-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap border ${
                    showRouteLines
                      ? 'bg-slate-900 dark:bg-amber-700 text-white border-slate-900 dark:border-amber-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {showRouteLines ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                  <span>Linia trasy</span>
                </button>
              )}

              {activeStopsCount > 0 && showHousesOnMap && (
                <div
                  role="group"
                  aria-label="Sposób wyświetlania punktów na mapie"
                  className="inline-flex items-center rounded-xl bg-slate-200/80 dark:bg-slate-800 p-0.5"
                >
                  {(
                    [
                      { id: 'auto', label: 'Auto' },
                      { id: 'numbers', label: 'Numery' },
                      { id: 'dots', label: 'Kropki' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeMarkerLabelMode(opt.id)}
                      className={`min-h-[34px] px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        markerLabelMode === opt.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {availableStreets.length > 1 && (
                <select
                  value={focusedStreet ?? ''}
                  onChange={(e) => onFocusStreet(e.target.value || null)}
                  aria-label="Filtruj ulicę na mapie"
                  className={`min-h-[40px] px-2.5 py-1.5 text-base sm:text-xs font-medium border rounded-xl focus:outline-none max-w-[220px] ${
                    focusedStreet
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200 font-semibold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <option value="">
                    Wszystkie ulice ({availableStreets.length})
                  </option>
                  {availableStreets.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name} ({st.count})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
