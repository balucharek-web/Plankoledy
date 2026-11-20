import React, { useMemo } from 'react';
import { Maximize2 } from 'lucide-react';
import {
  DayPlanSummary,
  LatLng,
  PRIEST_PALETTE,
  ParishCenter,
} from '../types/parish';
import { computeManualOrderForStops } from '../utils/seasonScheduler';
import { buildCleanRouteCorridor } from '../utils/spatial';

interface DayRouteMiniPreviewProps {
  parish: ParishCenter | null;
  boundary: LatLng[];
  day: DayPlanSummary;
  onOpenMap: () => void;
}

/**
 * Ultra-lightweight, real-coordinate SVG mini-map preview of a single kolęda day.
 * Shows the parish boundary silhouette, church location, and that day's route path(s)
 * with clear START and META markers — zero heavy tile overhead and 1-tap open to full map.
 */
export const DayRouteMiniPreview: React.FC<DayRouteMiniPreviewProps> = ({
  parish,
  boundary,
  day,
  onOpenMap,
}) => {
  const geometry = useMemo(() => {
    const width = 320;
    const height = 148;
    const padX = 22;
    const padY = 18;

    // Group day stops by priest and sort cleanly by manualOrder or geographic sweep
    const byPriest = new Map<number, typeof day.stops>();
    for (const s of day.stops) {
      const list = byPriest.get(s.priestId);
      if (list) list.push(s);
      else byPriest.set(s.priestId, [s]);
    }

    const priestPaths: Array<{
      priestId: number;
      color: string;
      points: LatLng[];
    }> = [];

    for (const [priestId, list] of Array.from(byPriest.entries()).sort(
      (a, b) => a[0] - b[0]
    )) {
      const hasManual = list.some((s) => (s.manualOrder ?? 0) > 0);
      let ordered = [...list];
      if (hasManual) {
        ordered.sort((a, b) => (a.manualOrder ?? 99999) - (b.manualOrder ?? 99999));
      } else if (ordered.length > 1) {
        const orderMap = computeManualOrderForStops(ordered, 'asc');
        ordered.sort(
          (a, b) => (orderMap.get(a.id) ?? 99999) - (orderMap.get(b.id) ?? 99999)
        );
      }
      const palette =
        PRIEST_PALETTE.find((p) => p.id === priestId) ?? PRIEST_PALETTE[0];
      const corridor = buildCleanRouteCorridor(ordered);
      priestPaths.push({
        priestId,
        color: palette.color,
        points:
          corridor.mainCorridorPoints.length >= 2
            ? corridor.mainCorridorPoints
            : ordered.map((s) => s.location),
      });
    }

    // Focus camera tightly on the day's street corridor (fallback to church/boundary if 1 stop)
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

    const spanX = Math.max(0.0008, maxX - minX);
    const spanY = Math.max(0.0008, maxY - minY);
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
      return {
        priestId: r.priestId,
        color: r.color,
        polylineStr: pts
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' '),
        start: pts[0] ?? null,
        end: pts.length > 1 ? pts[pts.length - 1] : null,
        sampleDots:
          pts.length <= 16
            ? pts.slice(1, -1)
            : pts.filter((_, i) => i > 0 && i < pts.length - 1 && i % Math.ceil(pts.length / 12) === 0),
      };
    });

    const churchPt = parish ? project(parish.location) : null;

    return {
      width,
      height,
      boundaryStr,
      projectedRoutes,
      churchPt,
    };
  }, [boundary, day.stops, parish]);

  if (!geometry) return null;

  return (
    <button
      type="button"
      onClick={onOpenMap}
      aria-label={`Otwórz podgląd mapy kolędy na dzień ${day.shortDateLabel}`}
      className="group relative w-full rounded-xl overflow-hidden border border-slate-200/90 bg-[#F8F6F0] hover:border-amber-400 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
    >
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        className="w-full h-[132px] block select-none"
        role="img"
        aria-hidden="true"
      >
        {/* Subtle topographic grid */}
        <defs>
          <pattern
            id="dayMiniGrid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="#E7E5DC"
              strokeWidth="0.7"
            />
          </pattern>
        </defs>
        <rect
          width={geometry.width}
          height={geometry.height}
          fill="url(#dayMiniGrid)"
        />

        {/* Parish boundary context silhouette */}
        {geometry.boundaryStr && (
          <polygon
            points={geometry.boundaryStr}
            fill="#F59E0B"
            fillOpacity="0.07"
            stroke="#B45309"
            strokeOpacity="0.35"
            strokeWidth="1.25"
            strokeDasharray="4 3"
          />
        )}

        {/* Day route paths */}
        {geometry.projectedRoutes.map((route) => (
          <g key={route.priestId}>
            {route.polylineStr && (
              <>
                <polyline
                  points={route.polylineStr}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.92"
                />
                <polyline
                  points={route.polylineStr}
                  fill="none"
                  stroke={route.color}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {route.sampleDots.map((dot, idx) => (
              <circle
                key={idx}
                cx={dot.x}
                cy={dot.y}
                r="2.4"
                fill={route.color}
                stroke="#FFFFFF"
                strokeWidth="1"
              />
            ))}

            {route.end && (
              <circle
                cx={route.end.x}
                cy={route.end.y}
                r="4.5"
                fill="#0F172A"
                stroke="#FFFFFF"
                strokeWidth="1.8"
              />
            )}

            {route.start && (
              <g>
                <circle
                  cx={route.start.x}
                  cy={route.start.y}
                  r="5.5"
                  fill="#15803D"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              </g>
            )}
          </g>
        ))}

        {/* Church marker */}
        {geometry.churchPt && (
          <g
            transform={`translate(${geometry.churchPt.x}, ${geometry.churchPt.y})`}
          >
            <circle
              r="6.5"
              fill="#B45309"
              stroke="#FFFFFF"
              strokeWidth="1.8"
            />
            <path
              d="M 0 -3.2 L 0 3.2 M -2.3 -0.9 L 2.3 -0.9"
              stroke="#FFFFFF"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>

      {/* Clean bottom overlay bar */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 via-slate-900/35 to-transparent px-2.5 py-2 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-medium text-white/95">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white" />
            START
          </span>
          <span aria-hidden="true" className="opacity-60">
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-900 border border-white" />
            META
          </span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/95 text-slate-900 text-[11px] font-semibold shadow-xs group-hover:bg-amber-50">
          <Maximize2 className="w-3 h-3 text-amber-700" />
          <span>Otwórz mapę dnia</span>
        </span>
      </div>
    </button>
  );
};
