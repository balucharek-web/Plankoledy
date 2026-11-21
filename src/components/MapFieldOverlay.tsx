import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  BellRing,
  Building2,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  List,
  RotateCcw,
  Search,
  StickyNote,
  UserX,
  X,
} from 'lucide-react';
import {
  ParishCenter,
  PlanConfig,
  PriestRouteResult,
  ScheduledStopItem,
  UnitVisitStatus,
  VisitStop,
} from '../types/parish';
import { buildGoogleMapsStageUrls } from '../utils/spatial';
import { UNIT_STATUS_META } from './BlockUnitsModal';

interface MapFieldOverlayProps {
  parish: ParishCenter | null;
  config: PlanConfig;
  routes: PriestRouteResult[];
  fieldPriestId: number;
  activeFieldStopId: string | null;
  onChangePriest: (priestId: number) => void;
  onSelectActiveStop: (stopId: string) => void;
  onUpdateStopStatus: (stopId: string, status: UnitVisitStatus) => void;
  onUpdateStopDetails: (stopId: string, patch: Partial<VisitStop>) => void;
  onOpenBlockUnits: (stopId: string) => void;
  onCenterOnStop: (stopId: string) => void;
  onClose: () => void;
}

function isStopCompletedInField(item: ScheduledStopItem): boolean {
  const isBlock = Boolean(
    item.stop.isMultiUnit || (item.stop.units && item.stop.units.length > 0)
  );
  if (isBlock && item.stop.units && item.stop.units.length > 0) {
    return item.stop.units.every((u) => u.status !== 'pending');
  }
  return (item.stop.visitStatus ?? 'pending') !== 'pending';
}

export const MapFieldOverlay: React.FC<MapFieldOverlayProps> = ({
  parish,
  config,
  routes,
  fieldPriestId,
  activeFieldStopId,
  onChangePriest,
  onSelectActiveStop,
  onUpdateStopStatus,
  onUpdateStopDetails,
  onOpenBlockUnits,
  onCenterOnStop,
  onClose,
}) => {
  const [noteOpen, setNoteOpen] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [jumpListOpen, setJumpListOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');

  const activeRoute = useMemo(
    () =>
      routes.find((r) => r.priestId === fieldPriestId) ?? routes[0] ?? null,
    [routes, fieldPriestId]
  );

  const currentIdx = useMemo(() => {
    if (!activeRoute || activeRoute.orderedStops.length === 0) return -1;
    const exact = activeRoute.orderedStops.findIndex(
      (i) => i.stop.id === activeFieldStopId
    );
    if (exact >= 0) return exact;
    const firstPending = activeRoute.orderedStops.findIndex(
      (i) => !isStopCompletedInField(i)
    );
    return firstPending >= 0 ? firstPending : 0;
  }, [activeRoute, activeFieldStopId]);

  const activeItem =
    activeRoute && currentIdx >= 0
      ? activeRoute.orderedStops[currentIdx] ?? null
      : null;

  useEffect(() => {
    if (!activeItem) return;
    setDraftNote(activeItem.stop.notes ?? '');
    setNoteOpen(false);
  }, [activeItem?.stop.id, activeItem?.stop.notes]);

  const completedCount = useMemo(() => {
    if (!activeRoute) return 0;
    return activeRoute.orderedStops.filter(isStopCompletedInField).length;
  }, [activeRoute]);

  const filteredJumpStops = useMemo(() => {
    if (!activeRoute) return [];
    const q = jumpQuery.trim().toLowerCase();
    if (!q) return activeRoute.orderedStops;
    return activeRoute.orderedStops.filter((item) => {
      const hay =
        `#${item.orderIndex} ${item.stop.address || ''} ${item.stop.label || ''} ${item.stop.notes || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeRoute, jumpQuery]);

  if (!activeRoute || !activeItem) return null;

  const totalStops = activeRoute.orderedStops.length;
  const prevItem = currentIdx > 0 ? activeRoute.orderedStops[currentIdx - 1] : null;
  const nextItem =
    currentIdx + 1 < totalStops ? activeRoute.orderedStops[currentIdx + 1] : null;

  const isBlock = Boolean(
    activeItem.stop.isMultiUnit ||
      (activeItem.stop.units && activeItem.stop.units.length > 0)
  );
  const unitsTotal =
    activeItem.stop.units?.length || activeItem.stop.unitsCount || 0;
  const currentStatus: UnitVisitStatus = activeItem.stop.visitStatus ?? 'pending';

  const navUrl =
    parish &&
    buildGoogleMapsStageUrls(
      parish,
      activeRoute.orderedStops.slice(currentIdx).map((s) => s.stop),
      false,
      config.travelMode
    )[0]?.url;

  const advanceToNext = (afterStopId: string) => {
    const idx = activeRoute.orderedStops.findIndex(
      (i) => i.stop.id === afterStopId
    );
    if (idx < 0) return;
    const nextCandidate =
      activeRoute.orderedStops
        .slice(idx + 1)
        .find((i) => !isStopCompletedInField(i)) ??
      activeRoute.orderedStops[idx + 1];
    if (nextCandidate) {
      onSelectActiveStop(nextCandidate.stop.id);
      onCenterOnStop(nextCandidate.stop.id);
    }
  };

  const handleMark = (status: UnitVisitStatus) => {
    onUpdateStopStatus(activeItem.stop.id, status);
    advanceToNext(activeItem.stop.id);
  };

  const handleSaveNote = () => {
    onUpdateStopDetails(activeItem.stop.id, { notes: draftNote.trim() });
    setNoteOpen(false);
  };

  return (
    <div className="no-print absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-2.5 right-2.5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[448px] sm:max-w-[calc(100%-24px)] z-[490] rounded-2xl border border-amber-300 dark:border-slate-700 bg-white/95 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 shadow-2xl backdrop-blur-md transition-colors overflow-hidden">
      {/* Top strip: Priest tabs + progress + Quick Jump List + Close */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto">
          {routes.length > 1 ? (
            routes.map((r) => {
              const active = r.priestId === activeRoute.priestId;
              return (
                <button
                  key={r.priestId}
                  type="button"
                  onClick={() => onChangePriest(r.priestId)}
                  className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-slate-900 dark:bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span>Ks. {r.priestId}</span>
                </button>
              );
            })
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-400">
              Kolęda w terenie
            </span>
          )}
          <span className="text-[11px] font-mono tabular-nums whitespace-nowrap text-slate-500 dark:text-slate-400">
            {completedCount}/{totalStops}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setJumpListOpen((v) => !v);
              setNoteOpen(false);
            }}
            aria-expanded={jumpListOpen}
            title="Skocz do adresu lub numeru domu"
            className={`min-h-[32px] px-2 py-1 inline-flex items-center gap-1 rounded-lg text-[11px] font-semibold transition-colors ${
              jumpListOpen
                ? 'bg-slate-900 dark:bg-amber-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Szukaj</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij tryb w terenie"
            className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Quick Jump-to-House Drawer */}
      {jumpListOpen && (
        <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={jumpQuery}
              onChange={(e) => setJumpQuery(e.target.value)}
              placeholder="Skocz do numeru domu lub ulicy (np. 14)..."
              autoFocus
              className="w-full min-h-[38px] pl-8 pr-8 py-1 text-base sm:text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-600"
            />
            {jumpQuery && (
              <button
                type="button"
                onClick={() => setJumpQuery('')}
                aria-label="Wyczyść szukanie"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute right-1 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredJumpStops.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                Brak pasującego adresu na dzisiejszej trasie.
              </div>
            ) : (
              filteredJumpStops.map((item) => {
                const active = item.stop.id === activeItem.stop.id;
                const st: UnitVisitStatus = item.stop.visitStatus ?? 'pending';
                const itemIsBlock = Boolean(
                  item.stop.isMultiUnit ||
                    (item.stop.units && item.stop.units.length > 0)
                );
                return (
                  <button
                    key={item.stop.id}
                    type="button"
                    onClick={() => {
                      onSelectActiveStop(item.stop.id);
                      onCenterOnStop(item.stop.id);
                      setJumpListOpen(false);
                      setJumpQuery('');
                    }}
                    className={`w-full min-h-[40px] px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition-colors ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-950/50'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 text-[11px] font-mono font-bold text-white flex items-center justify-center shrink-0 tabular-nums ${
                          itemIsBlock ? 'rounded-md' : 'rounded-full'
                        }`}
                        style={{ backgroundColor: activeRoute.color }}
                      >
                        {item.orderIndex}
                      </span>
                      <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.stop.address || item.stop.label}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[11px] font-semibold shrink-0 ${UNIT_STATUS_META[st].badgeClass}`}
                    >
                      {itemIsBlock
                        ? `Blok ${item.stop.units?.filter((u) => u.status === 'accepted').length ?? 0}/${item.stop.units?.length || item.stop.unitsCount || 0}`
                        : UNIT_STATUS_META[st].shortLabel}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main Active House Info */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onCenterOnStop(activeItem.stop.id)}
            className="flex items-start gap-2.5 min-w-0 text-left flex-1"
            title="Wycentruj ten dom na mapie"
          >
            <span
              className={`w-7 h-7 text-xs font-mono font-bold text-white flex items-center justify-center shrink-0 tabular-nums ${
                isBlock ? 'rounded-lg' : 'rounded-full'
              }`}
              style={{ backgroundColor: activeRoute.color }}
            >
              {activeItem.orderIndex}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono tabular-nums text-amber-800 dark:text-amber-300 font-semibold">
                  ~{activeItem.arrivalTime}
                </span>
                {activeItem.stop.permanentDecline && (
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[11px] font-semibold">
                    Stała odmowa
                  </span>
                )}
                {!activeItem.stop.permanentDecline &&
                  activeItem.stop.lastYearStatus &&
                  activeItem.stop.lastYearStatus !== 'pending' && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                        UNIT_STATUS_META[activeItem.stop.lastYearStatus]
                          .badgeClass
                      }`}
                    >
                      Rok temu:{' '}
                      {UNIT_STATUS_META[activeItem.stop.lastYearStatus].shortLabel}
                    </span>
                  )}
              </div>
              <div className="text-sm sm:text-base font-bold leading-snug truncate">
                {activeItem.stop.address || activeItem.stop.label}
              </div>
              {activeItem.stop.notes && (
                <div className="text-xs truncate mt-0.5 text-slate-600 dark:text-slate-300">
                  {activeItem.stop.notes}
                </div>
              )}
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onCenterOnStop(activeItem.stop.id)}
              title="Pokaż dom na środku mapy"
              aria-label="Wycentruj na mapie"
              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setNoteOpen((v) => !v);
                setJumpListOpen(false);
              }}
              title="Notatka lub stała odmowa"
              aria-label="Notatka lub stała odmowa"
              className={`min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg border ${
                noteOpen || activeItem.stop.notes || activeItem.stop.permanentDecline
                  ? 'border-amber-300 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <StickyNote className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline quick note + permanent decline drawer */}
        {noteOpen && (
          <div className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveNote();
                  }
                }}
                placeholder="Notatka (np. rodzina, chory, po 18:00)..."
                className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1 text-base sm:text-xs rounded-lg border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-600"
              />
              <button
                type="button"
                onClick={handleSaveNote}
                className="min-h-[38px] px-3 py-1 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-600 rounded-lg shrink-0"
              >
                Zapisz
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(activeItem.stop.permanentDecline)}
                onChange={(e) =>
                  onUpdateStopDetails(activeItem.stop.id, {
                    permanentDecline: e.target.checked,
                    ...(e.target.checked
                      ? { visitStatus: 'declined', included: false }
                      : {}),
                  })
                }
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-red-600"
              />
              <span className="text-red-800 dark:text-red-300 font-medium">
                Stała odmowa (pomiń w planach w kolejnych latach)
              </span>
            </label>
          </div>
        )}

        {/* Primary Action Buttons */}
        {isBlock ? (
          <button
            type="button"
            onClick={() => onOpenBlockUnits(activeItem.stop.id)}
            className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-amber-700 hover:bg-amber-600 rounded-xl inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            <span>Otwórz lokale bloku ({unitsTotal})</span>
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => handleMark('accepted')}
              className={`min-h-[46px] px-1.5 py-1.5 text-[11px] font-semibold rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                currentStatus === 'accepted'
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Przyjęto</span>
            </button>
            <button
              type="button"
              onClick={() => handleMark('absent')}
              className={`min-h-[46px] px-1.5 py-1.5 text-[11px] font-semibold rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                currentStatus === 'absent'
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900'
              }`}
            >
              <UserX className="w-4 h-4" />
              <span>Nieob.</span>
            </button>
            <button
              type="button"
              onClick={() => handleMark('declined')}
              className={`min-h-[46px] px-1.5 py-1.5 text-[11px] font-semibold rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                currentStatus === 'declined'
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-red-50 dark:bg-red-950/70 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900'
              }`}
            >
              <Ban className="w-4 h-4" />
              <span>Odmowa</span>
            </button>
            <button
              type="button"
              onClick={() => handleMark('invited')}
              className={`min-h-[46px] px-1.5 py-1.5 text-[11px] font-semibold rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                currentStatus === 'invited'
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-sky-50 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900'
              }`}
            >
              <BellRing className="w-4 h-4" />
              <span>Zaprosz.</span>
            </button>
          </div>
        )}

        {/* Bottom Prev / Undo / Navigate / Next bar */}
        <div className="flex items-center justify-between gap-1.5 text-[11px]">
          <button
            type="button"
            disabled={!prevItem}
            onClick={() => {
              if (!prevItem) return;
              onSelectActiveStop(prevItem.stop.id);
              onCenterOnStop(prevItem.stop.id);
            }}
            className="min-h-[36px] px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1 disabled:opacity-35 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 dark:border dark:border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Poprzedni</span>
          </button>

          {currentStatus !== 'pending' && !isBlock && (
            <button
              type="button"
              onClick={() => onUpdateStopStatus(activeItem.stop.id, 'pending')}
              title="Przywróć status Oczekuje"
              className="min-h-[36px] px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 dark:border dark:border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1 border bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/70"
            >
              <span>Nawiguj</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            type="button"
            disabled={!nextItem}
            onClick={() => {
              if (!nextItem) return;
              onSelectActiveStop(nextItem.stop.id);
              onCenterOnStop(nextItem.stop.id);
            }}
            className="min-h-[36px] px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1 disabled:opacity-35 ml-auto bg-slate-900 dark:bg-amber-700 text-white hover:bg-slate-800 dark:hover:bg-amber-600"
          >
            <span>
              {nextItem ? `Następny #${nextItem.orderIndex}` : 'Koniec'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
