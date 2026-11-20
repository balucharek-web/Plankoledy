import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Church,
  ClipboardCheck,
  Eye,
  EyeOff,
  Home,
  ListOrdered,
  Navigation,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DayPlanSummary,
  MarkerLabelMode,
  PriestRouteResult,
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

export const MapDayRouteBar: React.FC<MapDayRouteBarProps> = ({
  plannedDays,
  selectedDate,
  nearestDayDate = null,
  selectedDaySummary,
  routes,
  isExactRoute,
  isComputingExact,
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

  const primaryStartStop = visibleRoutes[0]?.orderedStops[0]?.stop ?? null;
  const primaryEndStop =
    visibleRoutes[0] && visibleRoutes[0].orderedStops.length > 1
      ? visibleRoutes[0].orderedStops[visibleRoutes[0].orderedStops.length - 1]
          .stop
      : null;

  const activeStartAddress = primaryStartStop
    ? shortAddress(primaryStartStop.address, primaryStartStop.label)
    : '';
  const activeEndAddress = primaryEndStop
    ? shortAddress(primaryEndStop.address, primaryEndStop.label)
    : '';

  const streetHeadline = selectedDaySummary
    ? selectedDaySummary.streetNames.length > 0
      ? `${selectedDaySummary.streetNames.slice(0, 2).join(', ')}${
          selectedDaySummary.streetNames.length > 2
            ? ` +${selectedDaySummary.streetNames.length - 2}`
            : ''
        }`
      : 'Wybrane punkty'
    : 'Cały teren parafii';

  const displayTimeWindow = selectedDaySummary
    ? `${selectedDaySummary.startTime}–${
        selectedDaySummary.plannedEndTime || selectedDaySummary.estimatedEndTime
      }`
    : '';

  if (minimized) {
    return (
      <div className="no-print absolute bottom-3 left-2.5 sm:bottom-4 sm:left-4 z-[460] max-w-[calc(100%-24px)] sm:max-w-[calc(100%-76px)]">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="min-h-[44px] px-4 py-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg text-xs font-semibold text-slate-900 hover:bg-white inline-flex items-center gap-2 tabular-nums"
        >
          <ChevronUp className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="truncate">
            {selectedDaySummary
              ? `${formatPolishDateChip(selectedDaySummary.date)} · ${streetHeadline}`
              : 'Cała parafia'}
          </span>
          {routes.length > 0 && (
            <span className="text-slate-500 font-normal shrink-0">
              · {formatHousesLabel(totalStopsOnRoutes)}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="no-print absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-4 sm:left-4 sm:right-auto sm:w-[460px] lg:w-[490px] z-[460]">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden">
        {/* Clean Drag-Handle Affordance (toggles options drawer) */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Zwiń opcje trasy' : 'Rozwiń opcje trasy'}
          className="w-full pt-2 pb-1 flex items-center justify-center group focus:outline-none"
        >
          <span className="w-9 h-1 rounded-full bg-slate-300 group-hover:bg-slate-400 transition-colors" />
        </button>

        {/* Clean Non-Truncated Summary Header */}
        <div className="px-3.5 pb-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {selectedDaySummary ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm sm:text-[15px] font-bold tracking-tight text-slate-900">
                    <span className="sm:hidden">
                      {formatPolishDateChip(selectedDaySummary.date)}
                    </span>
                    <span className="hidden sm:inline">
                      {formatPolishDateFull(selectedDaySummary.date)}
                    </span>
                  </span>
                  {displayTimeWindow && (
                    <span className="text-xs font-semibold text-amber-800 tabular-nums">
                      {displayTimeWindow}
                    </span>
                  )}
                  {hasMultipleDays && selectedDayIdx >= 0 && (
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {selectedDayIdx + 1}/{plannedDays.length}
                    </span>
                  )}
                </div>

                <div className="mt-0.5 text-xs text-slate-600 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                  <span className="font-medium text-slate-800 truncate max-w-[200px] sm:max-w-[240px]">
                    {streetHeadline}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>
                    {formatHousesLabel(
                      totalStopsOnRoutes || selectedDaySummary.stops.length
                    )}
                  </span>
                  {totalDistMeters > 0 && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span>{formatDistance(totalDistMeters)}</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-bold tracking-tight text-slate-900">
                  Teren parafii
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Dotknij dowolną ulicę na mapie, aby zobaczyć domy
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {hasMultipleDays && (
              <>
                <button
                  type="button"
                  onClick={() => stepDay(-1)}
                  aria-label="Poprzedni dzień kolędy"
                  className="min-w-[38px] min-h-[38px] sm:min-w-[34px] sm:min-h-[34px] inline-flex items-center justify-center rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => stepDay(1)}
                  aria-label="Następny dzień kolędy"
                  className="min-w-[38px] min-h-[38px] sm:min-w-[34px] sm:min-h-[34px] inline-flex items-center justify-center rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
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
              className="min-w-[38px] min-h-[38px] sm:min-w-[34px] sm:min-h-[34px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean START -> META Strip & Multi-Priest Switcher */}
        {routes.length > 0 && (
          <div className="px-3.5 pb-2.5 space-y-2">
            {activeStartAddress && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">
                    {activeStartAddress}
                  </span>
                  {activeEndAddress && activeEndAddress !== activeStartAddress && (
                    <>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="w-2 h-2 rounded-full bg-slate-900 shrink-0" />
                      <span className="text-slate-600 truncate">
                        {activeEndAddress}
                      </span>
                    </>
                  )}
                </div>
                <span
                  className={`shrink-0 font-medium ${
                    isExactRoute ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {isExactRoute ? 'Po drogach' : 'Szacunkowo'}
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
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                          ? 'bg-slate-900 text-white border-slate-900'
                          : focusedPriestId !== null
                            ? 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
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
                className="min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <ListOrdered className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Rozpiska</span>
              </button>

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className={`min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  expanded
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-slate-100/90 border-slate-200/80 text-slate-800 hover:bg-slate-200/80'
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
          <div className="px-3.5 pb-3 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
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
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Opcje</span>
            </button>
          </div>
        )}

        {/* Expandable Options Drawer (Day Switcher, Exact Road Routing, Houses, Labels, Lines, Street Filter) */}
        {expanded && (
          <div className="px-3.5 py-3 bg-slate-50/95 border-t border-slate-200 space-y-2.5">
            {plannedDays.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDate ?? ''}
                  onChange={(e) => {
                    onSelectDate(e.target.value || null);
                    onFocusPriest(null);
                  }}
                  aria-label="Wybierz dzień kolędy na mapie"
                  className="flex-1 min-w-0 min-h-[40px] px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-900 tabular-nums focus:outline-none focus:border-amber-600"
                >
                  {plannedDays.map((d, idx) => (
                    <option key={d.date} value={d.date}>
                      {hasMultipleDays ? `${idx + 1}/${plannedDays.length} · ` : ''}
                      {formatPolishDateChip(d.date)} ({d.startTime}–
                      {d.plannedEndTime || d.estimatedEndTime}) ·{' '}
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
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 text-xs font-medium inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  >
                    <Church className="w-3.5 h-3.5 text-amber-700" />
                    <span>Parafia</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {routes.length > 0 && !isExactRoute && (
                <button
                  type="button"
                  disabled={isComputingExact}
                  onClick={onComputeExactDayRoute}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 disabled:opacity-50 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    {isComputingExact
                      ? 'Liczenie trasy...'
                      : 'Wyznacz dokładnie po drogach'}
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
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
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
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
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
                  className="inline-flex items-center rounded-xl bg-slate-200/80 p-0.5"
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
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
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
                  className={`min-h-[38px] px-2.5 py-1.5 text-xs font-medium border rounded-xl focus:outline-none max-w-[200px] ${
                    focusedStreet
                      ? 'bg-amber-50 border-amber-400 text-amber-950 font-semibold'
                      : 'bg-white border-slate-200 text-slate-800'
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
