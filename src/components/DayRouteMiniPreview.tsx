import React, { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  DayPlanSummary,
  LatLng,
  PRIEST_PALETTE,
  ParishCenter,
} from '../types/parish';
import { computeManualOrderForStops } from '../utils/seasonScheduler';
import {
  buildCleanRouteCorridor,
  sampleRouteDirectionArrows,
} from '../utils/spatial';

interface DayRouteMiniPreviewProps {
  parish: ParishCenter | null;
  boundary: LatLng[];
  day: DayPlanSummary;
  onOpenMap: () => void;
}

function shortStopLabel(address: string, fallback: string): string {
  const first = (address || fallback).split(',')[0]?.trim();
  return first || fallback;
}

/**
 * Clean, modern cartographic schematic preview of a single kolęda day.
 * Displays the smoothed street corridor with directional chevrons, START/META markers,
 * and a crisp address summary strip below — zero graph-paper noise or pill clutter.
 */
export const DayRouteMiniPreview: React.FC<DayRouteMiniPreviewProps> = ({
  parish,
  boundary,
  day,
  onOpenMap,
}) => {
  const geometry = useMemo(() => {
    const width = 340;
    const height = 132;
    const padX = 24;
    const padY = 18;

    // Prefer already-estimated day routes if available so START/META match the map 1:1
    const priestPaths: Array<{
      priestId: number;
      color: string;
      points: LatLng[];
      approachLeg: [LatLng, LatLng] | null;
      startLabel: string;
      endLabel: string;
    }> = [];

    if (day.estimatedRoutes && day.estimatedRoutes.length > 0) {
      for (const route of day.estimatedRoutes) {
        const ordered = route.orderedStops.map((i) => i.stop);
        if (ordered.length === 0) continue;
        const corridor = buildCleanRouteCorridor(
          ordered,
          parish?.location,
          false
        );
        const firstStop = ordered[0];
        const lastStop = ordered[ordered.length - 1];
        priestPaths.push({
          priestId: route.priestId,
          color: route.color,
          points:
            corridor.mainCorridorPoints.length >= 2
              ? corridor.mainCorridorPoints
              : ordered.map((s) => s.location),
          approachLeg: corridor.approachLeg,
          startLabel: shortStopLabel(firstStop.address, firstStop.label),
          endLabel: shortStopLabel(lastStop.address, lastStop.label),
        });
      }
    } else {
      const byPriest = new Map<number, typeof day.stops>();
      for (const s of day.stops) {
        const list = byPriest.get(s.priestId);
        if (list) list.push(s);
        else byPriest.set(s.priestId, [s]);
      }

      for (const [priestId, list] of Array.from(byPriest.entries()).sort(
        (a, b) => a[0] - b[0]
      )) {
        const hasManual = list.some((s) => (s.manualOrder ?? 0) > 0);
        const ordered = [...list];
        if (hasManual) {
          ordered.sort(
            (a, b) => (a.manualOrder ?? 99999) - (b.manualOrder ?? 99999)
          );
        } else if (ordered.length > 1) {
          const orderMap = computeManualOrderForStops(ordered, 'auto');
          ordered.sort(
            (a, b) =>
              (orderMap.get(a.id) ?? 99999) - (orderMap.get(b.id) ?? 99999)
          );
        }
        const palette =
          PRIEST_PALETTE.find((p) => p.id === priestId) ?? PRIEST_PALETTE[0];
        const corridor = buildCleanRouteCorridor(
          ordered,
          parish?.location,
          false
        );
        const firstStop = ordered[0];
        const lastStop = ordered[ordered.length - 1];
        priestPaths.push({
          priestId,
          color: palette.color,
          points:
            corridor.mainCorridorPoints.length >= 2
              ? corridor.mainCorridorPoints
              : ordered.map((s) => s.location),
          approachLeg: corridor.approachLeg,
          startLabel: shortStopLabel(firstStop.address, firstStop.label),
          endLabel: shortStopLabel(lastStop.address, lastStop.label),
        });
      }
    }

    // Focus tightly on the day's street corridor (fallback to church/boundary for single-stop day)
    const focusPts: LatLng[] = [];
    for (const p of priestPaths) {
      for (const pt of p.points) focusPts.push(pt);
    }
    if (focusPts.length < 2 && parish) focusPts.push(parish.location);
    if (focusPts.length < 2 && boundary.length >= 3) {
      for (const b of boundary) focusPts.push(b);
    }
    if (focusPts.length === 0) return null;

    const avgLat =
      focusPts.reduce((acc, p) => acc + p.lat, 0) / focusPts.length;
    const cosLat = Math.max(0.2, Math.cos((avgLat * Math.PI) / 180));

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const pt of focusPts) {
      const x = pt.lng * cosLat;
      const y = -pt.lat;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const spanX = Math.max(0.00075, maxX - minX);
    const spanY = Math.max(0.00075, maxY - minY);
    const scale = Math.min(
      (width - padX * 2) / spanX,
      (height - padY * 2) / spanY
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const project = (pt: LatLng) => ({
      x: width / 2 + (pt.lng * cosLat - cx) * scale,
      y: height / 2 + (-pt.lat - cy) * scale,
    });

    const boundaryStr =
      boundary.length >= 3
        ? boundary
            .map((p) => {
              const pr = project(p);
              return `${pr.x.toFixed(1)},${pr.y.toFixed(1)}`;
            })
            .join(' ')
        : '';

    const projectedRoutes = priestPaths.map((r) => {
      const pts = r.points.map(project);
      const arrows = sampleRouteDirectionArrows(r.points, 3).map((a) => ({
        ...project({ lat: a.lat, lng: a.lng }),
        bearingDeg: a.bearingDeg,
      }));
      const approach = r.approachLeg
        ? [project(r.approachLeg[0]), project(r.approachLeg[1])]
        : null;
      return {
        priestId: r.priestId,
        color: r.color,
        polylineStr: pts
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' '),
        approach,
        arrows,
        start: pts[0] ?? null,
        end: pts.length > 1 ? pts[pts.length - 1] : null,
      };
    });

    const churchPt = parish ? project(parish.location) : null;
    const primary = priestPaths[0] ?? null;

    return {
      width,
      height,
      boundaryStr,
      projectedRoutes,
      churchPt,
      startLabel: primary?.startLabel ?? '',
      endLabel: primary?.endLabel ?? '',
      priestCount: priestPaths.length,
    };
  }, [boundary, day.estimatedRoutes, day.stops, parish]);

  if (!geometry) return null;

  return (
    <button
      type="button"
      onClick={onOpenMap}
      aria-label={`Otwórz pełną mapę dnia ${day.shortDateLabel}`}
      className="group w-full rounded-xl overflow-hidden border border-slate-200/90 bg-slate-50 hover:border-amber-400 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
    >
      {/* Crisp clean schematic viewport — zero cluttered overlays */}
      <div className="relative bg-gradient-to-b from-slate-50 to-slate-100/70">
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          className="w-full h-[116px] block select-none"
          role="img"
          aria-hidden="true"
        >
          {/* Subtle parish boundary silhouette */}
          {geometry.boundaryStr && (
            <polygon
              points={geometry.boundaryStr}
              fill="#FFFFFF"
              fillOpacity="0.85"
              stroke="#CBD5E1"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
          )}

          {/* Subtle dotted church approach leg */}
          {geometry.projectedRoutes.map(
            (route) =>
              route.approach && (
                <line
                  key={`app-${route.priestId}`}
                  x1={route.approach[0].x}
                  y1={route.approach[0].y}
                  x2={route.approach[1].x}
                  y2={route.approach[1].y}
                  stroke="#94A3B8"
                  strokeWidth="1.6"
                  strokeDasharray="3 4"
                  strokeLinecap="round"
                  opacity="0.7"
                />
              )
          )}

          {/* Clean corridor paths with white halo + directional chevrons */}
          {geometry.projectedRoutes.map((route) => (
            <g key={route.priestId}>
              {route.polylineStr && (
                <>
                  <polyline
                    points={route.polylineStr}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.96"
                  />
                  <polyline
                    points={route.polylineStr}
                    fill="none"
                    stroke={route.color}
                    strokeWidth="4.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {/* Crisp directional chevrons */}
              {route.arrows.map((arrow, idx) => (
                <g
                  key={idx}
                  transform={`translate(${arrow.x.toFixed(1)}, ${arrow.y.toFixed(1)}) rotate(${arrow.bearingDeg.toFixed(1)})`}
                >
                  <circle
                    r="6"
                    fill={route.color}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M -2.5 1.3 L 0 -2.1 L 2.5 1.3"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}

              {/* META anchor */}
              {route.end && (
                <circle
                  cx={route.end.x}
                  cy={route.end.y}
                  r="5"
                  fill="#0F172A"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              )}

              {/* START anchor */}
              {route.start && (
                <circle
                  cx={route.start.x}
                  cy={route.start.y}
                  r="6"
                  fill="#15803D"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                />
              )}
            </g>
          ))}

          {/* Church icon */}
          {geometry.churchPt &&
            geometry.churchPt.x >= -10 &&
            geometry.churchPt.x <= geometry.width + 10 &&
            geometry.churchPt.y >= -10 &&
            geometry.churchPt.y <= geometry.height + 10 && (
              <g
                transform={`translate(${geometry.churchPt.x.toFixed(1)}, ${geometry.churchPt.y.toFixed(1)})`}
              >
                <circle
                  r="7"
                  fill="#B45309"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <path
                  d="M 0 -3.4 L 0 3.4 M -2.4 -1 L 2.4 -1"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            )}
        </svg>
      </div>

      {/* Integrated Start → Meta address footer strip (clean, scannable, zero floating pills) */}
      <div className="bg-white border-t border-slate-200/80 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0 text-slate-700">
          {geometry.startLabel ? (
            <>
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-900 truncate">
                  {geometry.startLabel}
                </span>
              </span>
              {geometry.endLabel && geometry.endLabel !== geometry.startLabel && (
                <>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-slate-900 shrink-0" />
                    <span className="text-slate-600 truncate">
                      {geometry.endLabel}
                    </span>
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-slate-500">Podgląd trasy dnia</span>
          )}
        </div>
        <span className="text-amber-800 font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
          <span>Pełna mapa</span>
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
};
