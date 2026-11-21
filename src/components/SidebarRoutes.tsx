import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  Map as MapIcon,
  Navigation,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { UNIT_STATUS_META } from './BlockUnitsModal';
import {
  DayPlanSummary,
  ParishCenter,
  PlanConfig,
  PriestRouteResult,
  UnitVisitStatus,
} from '../types/parish';
import {
  formatPolishDateChip,
  formatPolishDateFull,
} from '../utils/seasonScheduler';
import {
  buildGoogleMapsStageUrls,
  exportScheduleToCsv,
  extractStreetName,
  formatDistance,
  formatDurationMillis,
  formatMinutesLabel,
} from '../utils/spatial';

interface SidebarRoutesProps {
  parish: ParishCenter | null;
  config: PlanConfig;
  routes: PriestRouteResult[];
  plannedDays: DayPlanSummary[];
  selectedDate: string | null;
  effectiveStartTime: string;
  focusedPriestId: number | null;
  isComputing: boolean;
  progressLabel?: string | null;
  globalError: string | null;
  onSelectDate: (date: string | null) => void;
  onFocusPriestOnMap: (priestId: number | null) => void;
  onRecompute: () => void;
  onSelectStop: (stopId: string) => void;
  onOpenBlockUnits: (stopId: string) => void;
  onViewRouteOnMap: (priestId?: number | null) => void;
  onOpenSchedule: () => void;
  onMoveStopOrder: (
    priestId: number,
    stopId: string,
    direction: 'up' | 'down'
  ) => void;
  onSetRouteStartStop?: (priestId: number, stopId: string) => void;
  onDeleteRoute?: () => void;
  onGoToPlanner?: () => void;
  onOpenMapFieldMode?: () => void;
}

const STATUS_BADGE: Record<
  UnitVisitStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Do odwiedzenia',
    className:
      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  },
  accepted: {
    label: 'Przyjęto',
    className:
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70',
  },
  absent: {
    label: 'Nieobecni',
    className:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70',
  },
  declined: {
    label: 'Odmowa',
    className:
      'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/70',
  },
  invited: {
    label: 'Zaproszenie',
    className:
      'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70',
  },
};

export const SidebarRoutes: React.FC<SidebarRoutesProps> = ({
  parish,
  config,
  routes,
  plannedDays,
  selectedDate,
  effectiveStartTime,
  focusedPriestId,
  isComputing,
  progressLabel,
  globalError,
  onSelectDate,
  onFocusPriestOnMap,
  onRecompute,
  onSelectStop,
  onOpenBlockUnits,
  onViewRouteOnMap,
  onOpenSchedule,
  onMoveStopOrder,
  onSetRouteStartStop,
  onDeleteRoute,
  onGoToPlanner,
  onOpenMapFieldMode,
}) => {
  const [openGmapsMenuPriest, setOpenGmapsMenuPriest] = useState<number | null>(
    null
  );
  const [stopSearchQuery, setStopSearchQuery] = useState('');

  const totalStopsCount = useMemo(
    () => routes.reduce((acc, r) => acc + r.orderedStops.length, 0),
    [routes]
  );

  const normalizedQuery = stopSearchQuery.trim().toLowerCase();

  if (isComputing && routes.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
        <Loader2 className="w-6 h-6 text-amber-700 dark:text-amber-400 animate-spin" />
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Układanie kolejności odwiedzin...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {progressLabel ||
              'Algorytm układa najkrótsze trasy drogowe dla każdego księdza.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {isComputing && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/70 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 shrink-0">
          <Loader2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 animate-spin shrink-0" />
          <span className="truncate tabular-nums">
            {progressLabel || 'Dopasowywanie przebiegu po ulicach...'}
          </span>
        </div>
      )}

      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {selectedDate
                ? `Trasa · ${formatPolishDateFull(selectedDate)}`
                : 'Lista i kolejność odwiedzin'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              Start: {effectiveStartTime} ·{' '}
              {config.travelMode === 'WALKING' ? 'Pieszo' : 'Samochodem'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {routes.length > 0 && (
              <button
                type="button"
                onClick={onRecompute}
                disabled={!parish || isComputing}
                title="Przelicz kolejność i czasy po drogach"
                aria-label="Przelicz trasę"
                className="min-w-[36px] min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isComputing ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Przelicz</span>
              </button>
            )}
            {onDeleteRoute && (routes.length > 0 || Boolean(selectedDate)) && (
              <button
                type="button"
                onClick={onDeleteRoute}
                title={
                  selectedDate
                    ? 'Usuń trasę tego dnia'
                    : 'Usuń wyznaczoną trasę'
                }
                aria-label="Usuń trasę"
                className="min-w-[36px] min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950/80 border border-red-200 dark:border-red-900/70 rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Usuń</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-day switcher strip */}
        {plannedDays.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {plannedDays.map((day) => {
              const active = selectedDate === day.date;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => onSelectDate(day.date)}
                  className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 tabular-nums transition-colors ${
                    active
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {formatPolishDateChip(day.date)} ({day.stops.length})
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                selectedDate === null
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Wszystkie
            </button>
          </div>
        )}

        {/* Primary Unified Field Mode CTA + Secondary Map/Schedule Buttons */}
        {routes.length > 0 && (
          <div className="space-y-2">
            {onOpenMapFieldMode && (
              <button
                type="button"
                onClick={onOpenMapFieldMode}
                className="w-full min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl inline-flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span>Kolęda w terenie (mapa + odhaczanie)</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onViewRouteOnMap(null)}
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-amber-950 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/70 rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <MapIcon className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>Pokaż na mapie</span>
              </button>
              <button
                type="button"
                onClick={onOpenSchedule}
                className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span>Cały okres</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Search / Jump to Address or House Number */}
        {totalStopsCount > 5 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={stopSearchQuery}
              onChange={(e) => setStopSearchQuery(e.target.value)}
              placeholder="Znajdź adres lub numer domu (np. 14)..."
              className="w-full min-h-[40px] pl-8 pr-8 py-1.5 text-base sm:text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-amber-600"
            />
            {stopSearchQuery && (
              <button
                type="button"
                onClick={() => setStopSearchQuery('')}
                aria-label="Wyczyść szukanie adresu"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {globalError && (
        <div className="m-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/70 rounded-lg flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
        {routes.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Navigation className="w-6 h-6 text-slate-400 dark:text-slate-500 mx-auto" />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Brak zaplanowanej trasy
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Wybierz datę i ulice w zakładce „Planuj”, aby ułożyć kolejność
                odwiedzin.
              </p>
            </div>
            {onGoToPlanner && (
              <button
                type="button"
                onClick={onGoToPlanner}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                Zaplanuj dzień
              </button>
            )}
          </div>
        ) : (
          routes.map((route) => {
            const isFocused = focusedPriestId === route.priestId;
            const stages =
              parish && route.orderedStops.length > 0
                ? buildGoogleMapsStageUrls(
                    parish,
                    route.orderedStops.map((s) => s.stop),
                    config.returnToParish,
                    config.travelMode
                  )
                : [];
            const firstItem = route.orderedStops[0];
            const routeStreets = Array.from(
              new Set(route.orderedStops.map((s) => extractStreetName(s.stop)))
            );
            const gmapsOpen = openGmapsMenuPriest === route.priestId;

            const filteredItems = normalizedQuery
              ? route.orderedStops
                  .map((item, idx) => ({ item, idx }))
                  .filter(({ item }) => {
                    const hay =
                      `#${item.orderIndex} ${item.stop.address || ''} ${item.stop.label || ''} ${item.stop.notes || ''}`.toLowerCase();
                    return hay.includes(normalizedQuery);
                  })
              : route.orderedStops.map((item, idx) => ({ item, idx }));

            return (
              <section key={route.priestId} className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: route.color }}
                      />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {route.priestName}
                      </h3>
                    </div>
                    {firstItem && (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-700 dark:bg-emerald-600 text-white text-[10px] font-bold mr-1.5">
                          START
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {firstItem.stop.address || firstItem.stop.label}
                        </span>
                      </div>
                    )}
                    {routeStreets.length > 0 && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Ulice:{' '}
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {routeStreets.join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {route.orderedStops.length}{' '}
                      {route.orderedStops.length === 1
                        ? 'punkt'
                        : route.orderedStops.length < 5
                          ? 'punkty'
                          : 'punktów'}{' '}
                      · {formatDistance(route.totalDistanceMeters)} · Przejście:{' '}
                      {formatDurationMillis(route.totalTravelDurationMillis)} ·
                      Koniec ok. {route.endTime}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const nextFocus = isFocused ? null : route.priestId;
                        onFocusPriestOnMap(nextFocus);
                        onViewRouteOnMap(route.priestId);
                      }}
                      className={`min-h-[34px] px-2.5 py-1.5 text-xs font-medium rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                        isFocused
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Na mapie
                    </button>

                    {stages.length === 1 ? (
                      <a
                        href={stages[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[34px] px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/70 rounded-lg inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                      >
                        Nawiguj
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : stages.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGmapsMenuPriest(gmapsOpen ? null : route.priestId)
                        }
                        className="min-h-[34px] px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/70 rounded-lg inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        Nawiguj
                      </button>
                    ) : null}
                  </div>
                </div>

                {gmapsOpen && stages.length > 1 && (
                  <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl space-y-1.5">
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                      Zewnętrzna aplikacja Google Maps przyjmuje maks. 10 punktów
                      na jeden link (w Planerze cała ulica jest jedną ciągłą trasą):
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {stages.map((st) => (
                        <a
                          key={st.stageIndex}
                          href={st.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[30px] px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <span>
                            {st.isReturnLeg
                              ? 'Powrót pod kościół'
                              : `Nawiguj: pkt ${st.startStopNumber}–${st.endStopNumber}`}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {route.error && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                    {route.error}
                  </div>
                )}

                {route.orderedStops.length > 0 && (
                  <ol className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
                    {filteredItems.length === 0 ? (
                      <li className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                        Brak pasujących adresów w tej trasie.
                      </li>
                    ) : (
                      filteredItems.map(({ item, idx }) => {
                        const isFirst = idx === 0;
                        const isBlock = Boolean(
                          item.stop.isMultiUnit ||
                            (item.stop.units && item.stop.units.length > 0)
                        );
                        const unitsTotal =
                          item.stop.units?.length || item.stop.unitsCount || 0;
                        const st: UnitVisitStatus =
                          item.stop.visitStatus ?? 'pending';
                        return (
                          <li
                            key={item.stop.id}
                            className={`flex items-start justify-between gap-2 px-3 py-2.5 transition-colors ${
                              isFirst
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectStop(item.stop.id)}
                              className="flex-1 min-w-0 text-left flex items-start gap-2.5"
                            >
                              <span
                                className={`w-5 h-5 text-[11px] font-mono font-semibold text-white flex items-center justify-center shrink-0 mt-0.5 tabular-nums ${
                                  isBlock ? 'rounded-md' : 'rounded-full'
                                }`}
                                style={{
                                  backgroundColor: isFirst
                                    ? '#15803D'
                                    : route.color,
                                }}
                              >
                                {item.orderIndex}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate inline-flex items-center gap-1.5">
                                    {isFirst && (
                                      <span className="px-1 py-0.5 rounded bg-emerald-700 dark:bg-emerald-600 text-white text-[10px] font-extrabold shrink-0">
                                        START
                                      </span>
                                    )}
                                    <span className="truncate">
                                      {item.stop.address || item.stop.label}
                                    </span>
                                    {isBlock && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 text-[11px] font-semibold shrink-0 tabular-nums">
                                        <Building2 className="w-2.5 h-2.5" />
                                        Blok
                                        {unitsTotal > 0 ? ` (${unitsTotal})` : ''}
                                      </span>
                                    )}
                                    {!isBlock && st !== 'pending' && (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold shrink-0 ${STATUS_BADGE[st].className}`}
                                      >
                                        {STATUS_BADGE[st].label}
                                      </span>
                                    )}
                                    {!isBlock &&
                                      st === 'pending' &&
                                      item.stop.lastYearStatus &&
                                      item.stop.lastYearStatus !== 'pending' && (
                                        <span
                                          className={`px-1.5 py-0.5 rounded border text-[11px] font-medium shrink-0 ${
                                            UNIT_STATUS_META[
                                              item.stop.lastYearStatus
                                            ].badgeClass
                                          }`}
                                        >
                                          Rok temu:{' '}
                                          {
                                            UNIT_STATUS_META[
                                              item.stop.lastYearStatus
                                            ].shortLabel
                                          }
                                        </span>
                                      )}
                                  </span>
                                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                                    {item.arrivalTime}–{item.departureTime}
                                  </span>
                                </div>
                                {(item.stop.notes ||
                                  (item.stop.label &&
                                    item.stop.label !== item.stop.address)) && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    {item.stop.notes || item.stop.label}
                                  </div>
                                )}
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
                                  Dojazd: {formatDistance(item.legDistanceMeters)}{' '}
                                  · {formatDurationMillis(item.legDurationMillis)}{' '}
                                  · Wizyta: {item.stop.durationMinutes} min
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0 self-center">
                              {onSetRouteStartStop && !isFirst && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetRouteStartStop(
                                      route.priestId,
                                      item.stop.id
                                    )
                                  }
                                  title="Zacznij trasę od tego domu (ustaw jako START)"
                                  className="hidden lg:inline-flex px-1.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/70 rounded-md whitespace-nowrap"
                                >
                                  Start
                                </button>
                              )}
                              {isBlock && (
                                <button
                                  type="button"
                                  onClick={() => onOpenBlockUnits(item.stop.id)}
                                  className="px-2 py-1 text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/70 rounded-lg whitespace-nowrap"
                                >
                                  Lokale ({unitsTotal})
                                </button>
                              )}

                              {route.orderedStops.length > 1 &&
                                !normalizedQuery && (
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() =>
                                        onMoveStopOrder(
                                          route.priestId,
                                          item.stop.id,
                                          'up'
                                        )
                                      }
                                      aria-label="Przesuń wcześniej w kolejności"
                                      title="Przesuń wcześniej"
                                      className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-25 rounded"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        idx === route.orderedStops.length - 1
                                      }
                                      onClick={() =>
                                        onMoveStopOrder(
                                          route.priestId,
                                          item.stop.id,
                                          'down'
                                        )
                                      }
                                      aria-label="Przesuń później w kolejności"
                                      title="Przesuń później"
                                      className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-25 rounded"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                            </div>
                          </li>
                        );
                      })
                    )}
                    {config.returnToParish && parish && !normalizedQuery && (
                      <li className="px-3 py-2 bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between tabular-nums">
                        <span>Powrót: {parish.name}</span>
                        <span className="font-mono">
                          {formatDistance(route.returnLegDistanceMeters)} ·
                          finisz {route.endTime}
                        </span>
                      </li>
                    )}
                  </ol>
                )}

                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Łączny czas wizyt w domach:{' '}
                  {formatMinutesLabel(route.totalVisitMinutes)}
                </div>
              </section>
            );
          })
        )}
      </div>

      {routes.length > 0 && (
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exportScheduleToCsv(parish, routes)}
            className="min-h-[40px] py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Eksportuj CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const imgs = Array.from(
                document.querySelectorAll<HTMLImageElement>(
                  'img[data-print-map-tile="true"]'
                )
              );
              const pending = imgs.filter((img) => !img.complete);
              if (pending.length === 0) {
                window.print();
                return;
              }
              let printed = false;
              const finish = () => {
                if (printed) return;
                printed = true;
                window.print();
              };
              const timer = window.setTimeout(finish, 900);
              let remaining = pending.length;
              const onDone = () => {
                remaining -= 1;
                if (remaining <= 0) {
                  window.clearTimeout(timer);
                  finish();
                }
              };
              pending.forEach((img) => {
                img.addEventListener('load', onDone, { once: true });
                img.addEventListener('error', onDone, { once: true });
              });
            }}
            className="min-h-[40px] py-2 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Drukuj mapę i listę
          </button>
        </div>
      )}
    </div>
  );
};
