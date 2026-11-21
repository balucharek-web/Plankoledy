import React, { useEffect } from 'react';
import {
  ArrowRight,
  Calendar,
  Eye,
  EyeOff,
  Home,
  Route,
  Users,
  X,
} from 'lucide-react';
import {
  StreetStatsSummary,
  formatMinutesLabel,
} from '../utils/spatial';
import { formatPolishDateChip } from '../utils/seasonScheduler';

interface StreetMapModalProps {
  summary: StreetStatsSummary;
  showHousesOnMap: boolean;
  onToggleShowHouses: () => void;
  onOpenStreetDetails: (streetName: string) => void;
  onViewScheduledDay?: (date: string) => void;
  onPlanStreet?: (streetName: string) => void;
  onClose: () => void;
}

function formatHousesLabel(count: number): string {
  if (count === 1) return 'dom';
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'domy';
  return 'domów';
}

function formatBlocksLabel(count: number): string {
  if (count === 1) return 'blok';
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'bloki';
  return 'bloków';
}

function formatResidentsNoun(count: number): string {
  if (count === 1) return 'mieszkaniec';
  return 'mieszkańców';
}

export const StreetMapModal: React.FC<StreetMapModalProps> = ({
  summary,
  showHousesOnMap,
  onToggleShowHouses,
  onOpenStreetDetails,
  onViewScheduledDay,
  onPlanStreet,
  onClose,
}) => {
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const hasResidentsData = summary.residentsKnownTotal > 0;
  const primaryScheduledDate = summary.scheduledDates[0] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="street-map-modal-title"
      className="no-print absolute inset-x-2.5 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-[400px] z-[520] animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="bg-white/98 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Blue Route Accent Hairline */}
        <div className="h-1 w-full bg-[#4285F4]" aria-hidden="true" />

        <div className="p-4 space-y-3.5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#1967D2] dark:text-sky-400">
                <Route className="w-3.5 h-3.5 shrink-0" />
                <span>Wybrana ulica</span>
                {summary.numberRangeLabel && (
                  <>
                    <span
                      aria-hidden="true"
                      className="text-slate-300 dark:text-slate-600"
                    >
                      ·
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-normal tabular-nums">
                      {summary.numberRangeLabel}
                    </span>
                  </>
                )}
              </div>
              <h2
                id="street-map-modal-title"
                className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate mt-0.5"
              >
                {summary.streetName}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij podgląd ulicy"
              className="min-w-[40px] min-h-[40px] -mr-1.5 -mt-1.5 inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2-Column KPI Summary: Domy & Mieszkańcy */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Home className="w-3.5 h-3.5 text-[#1967D2] dark:text-sky-400 shrink-0" />
                <span>Domy na ulicy</span>
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                {summary.totalBuildings}
              </div>
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug tabular-nums">
                {summary.blocksCount > 0 ? (
                  <>
                    {summary.singleHousesCount}{' '}
                    {formatHousesLabel(summary.singleHousesCount)} ·{' '}
                    {summary.blocksCount}{' '}
                    {formatBlocksLabel(summary.blocksCount)} (
                    {summary.totalUnitsInBlocks} lok.)
                  </>
                ) : (
                  <>
                    {summary.totalBuildings}{' '}
                    {formatHousesLabel(summary.totalBuildings)} jednorodzinnych
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Users className="w-3.5 h-3.5 text-[#1967D2] dark:text-sky-400 shrink-0" />
                <span>Mieszkańcy</span>
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                {hasResidentsData ? summary.residentsKnownTotal : '—'}
              </div>
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug tabular-nums">
                {hasResidentsData ? (
                  summary.residentsKnownBuildings < summary.totalBuildings ? (
                    <>
                      {formatResidentsNoun(summary.residentsKnownTotal)} (dane z{' '}
                      {summary.residentsKnownBuildings}/{summary.totalBuildings}{' '}
                      bud.)
                    </>
                  ) : (
                    <>
                      {formatResidentsNoun(summary.residentsKnownTotal)} wg
                      kartoteki
                    </>
                  )
                ) : (
                  <>
                    Brak danych z kartoteki · {summary.totalHouseholds}{' '}
                    {summary.blocksCount > 0 ? 'lok./domów' : 'rodzin/domów'}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Unboxed Context Metadata Line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums pt-0.5">
            {summary.scheduledDates.length > 0 ? (
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Kolęda:{' '}
                {summary.scheduledDates
                  .slice(0, 3)
                  .map((d) => formatPolishDateChip(d))
                  .join(', ')}
                {summary.scheduledDates.length > 3
                  ? ` (+${summary.scheduledDates.length - 3})`
                  : ''}
              </span>
            ) : (
              <span>Bez wyznaczonego terminu kolędy</span>
            )}
            <span
              aria-hidden="true"
              className="text-slate-300 dark:text-slate-600"
            >
              ·
            </span>
            <span>
              Szac. czas: {formatMinutesLabel(summary.estimatedVisitMinutes)}
            </span>
            {summary.declinedCount > 0 && (
              <>
                <span
                  aria-hidden="true"
                  className="text-slate-300 dark:text-slate-600"
                >
                  ·
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Pominięte: {summary.declinedCount}
                </span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenStreetDetails(summary.streetName)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1967D2] hover:bg-[#1557B0] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span>Otwórz szczegóły ulicy</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleShowHouses}
                aria-pressed={showHousesOnMap}
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  showHousesOnMap
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {showHousesOnMap ? (
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{showHousesOnMap ? 'Ukryj domy' : 'Pokaż domy'}</span>
              </button>

              {primaryScheduledDate && onViewScheduledDay ? (
                <button
                  type="button"
                  onClick={() => onViewScheduledDay(primaryScheduledDate)}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>Trasa dnia</span>
                </button>
              ) : onPlanStreet ? (
                <button
                  type="button"
                  onClick={() => onPlanStreet(summary.streetName)}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-950 dark:text-amber-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>Zaplanuj dzień</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
