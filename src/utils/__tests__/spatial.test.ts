import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LatLng, VisitStop } from '../../types/parish';
import {
  addMinutesToHHMM,
  buildGoogleMapsDirectionsUrl,
  compareStopsByHouseNumber,
  computePolygonAreaSqMeters,
  computeStreetNumberBounds,
  createPresetBoundaryPolygon,
  extractHouseNumberLabel,
  extractHouseNumberSortKey,
  extractStreetName,
  findMissingHouseNumberGaps,
  formatStreetHouseRange,
  isEvenHouseNumberStr,
  isPointInsideBoundary,
  partitionStopsBySector,
} from '../spatial';

function makeStop(
  id: string,
  address: string,
  lat: number,
  lng: number,
  extra?: Partial<VisitStop>
): VisitStop {
  return {
    id,
    label: address,
    address,
    location: { lat, lng },
    durationMinutes: 15,
    priestId: 1,
    inBoundary: true,
    included: true,
    ...extra,
  };
}

describe('spatial utilities', () => {
  it('checks point-in-polygon accurately for parish boundary', () => {
    const square: LatLng[] = [
      { lat: 50.0, lng: 19.0 },
      { lat: 50.0, lng: 19.1 },
      { lat: 50.1, lng: 19.1 },
      { lat: 50.1, lng: 19.0 },
    ];

    assert.equal(isPointInsideBoundary({ lat: 50.05, lng: 19.05 }, square), true);
    assert.equal(isPointInsideBoundary({ lat: 50.2, lng: 19.05 }, square), false);
    assert.equal(isPointInsideBoundary({ lat: 49.95, lng: 19.05 }, square), false);
  });

  it('computes realistic area for preset circular boundary polygon', () => {
    const center: LatLng = { lat: 50.17, lng: 18.9 };
    const radiusMeters = 1000;
    const poly = createPresetBoundaryPolygon(center, radiusMeters, 16);
    const area = computePolygonAreaSqMeters(poly);
    // Circle of r=1000m has area ~3.14 km^2; 16-gon is slightly below pi*r^2
    assert.ok(area > 2_800_000 && area < 3_300_000, `Unexpected area: ${area}`);
  });

  it('extracts Polish street names, house numbers, parity, and natural sorting', () => {
    const stops = [
      makeStop('a', 'Gliwicka 12A, 43-190 Mikołów', 50.17, 18.9),
      makeStop('b', 'Gliwicka 2, 43-190 Mikołów', 50.17, 18.9),
      makeStop('c', 'Gliwicka 10, 43-190 Mikołów', 50.17, 18.9),
      makeStop('d', 'Gliwicka 3, 43-190 Mikołów', 50.17, 18.9),
    ];

    assert.equal(extractStreetName(stops[0]), 'Gliwicka');
    assert.equal(extractHouseNumberLabel(stops[0]), '12A');
    assert.equal(extractHouseNumberSortKey('12A'), 12);
    assert.equal(isEvenHouseNumberStr('12A'), true);
    assert.equal(isEvenHouseNumberStr('3'), false);

    const sorted = [...stops].sort(compareStopsByHouseNumber);
    assert.deepEqual(
      sorted.map((s) => extractHouseNumberLabel(s)),
      ['2', '3', '10', '12A']
    );

    const bounds = computeStreetNumberBounds(stops);
    assert.equal(bounds.even?.minLabel, '2');
    assert.equal(bounds.even?.maxLabel, '12A');
    assert.equal(bounds.odd?.minLabel, '3');

    const rangeLabel = formatStreetHouseRange(stops);
    assert.ok(rangeLabel.includes('2'));
    assert.ok(rangeLabel.includes('12A'));
  });

  it('detects missing house number gaps on a street', () => {
    const stops = [
      makeStop('1', 'Polna 2, Mikołów', 50.17, 18.9),
      makeStop('2', 'Polna 6, Mikołów', 50.17, 18.901),
      makeStop('3', 'Polna 10, Mikołów', 50.17, 18.902),
    ];

    const missingNumbers = findMissingHouseNumberGaps(stops);
    assert.ok(missingNumbers.includes(4));
    assert.ok(missingNumbers.includes(8));
  });

  it('partitions stops across multiple priests deterministically', () => {
    const center: LatLng = { lat: 50.17, lng: 18.9 };
    const stops = [
      makeStop('s1', 'Północna 1', 50.18, 18.9),
      makeStop('s2', 'Północna 2', 50.181, 18.901),
      makeStop('s3', 'Południowa 1', 50.16, 18.9),
      makeStop('s4', 'Południowa 2', 50.159, 18.899),
    ];

    const assigned = partitionStopsBySector(center, stops, 2);
    assert.equal(assigned.length, 4);
    const priestIds = new Set(assigned.map((s) => s.priestId));
    assert.deepEqual(priestIds, new Set([1, 2]));
  });

  it('adds minutes to HH:MM cleanly across midnight wrap and builds safe Google Maps URLs', () => {
    assert.equal(addMinutesToHHMM('15:45', 30), '16:15');
    assert.equal(addMinutesToHHMM('23:50', 20), '00:10');

    const url = buildGoogleMapsDirectionsUrl(
      {
        name: 'Parafia św. Antoniego',
        address: 'Rynek 1',
        location: { lat: 50.17, lng: 18.9 },
      },
      [makeStop('s1', 'Gliwicka 10', 50.171, 18.902)],
      true,
      'WALKING'
    );
    assert.ok(url.startsWith('https://www.google.com/maps/dir/?api=1'));
    assert.ok(url.includes('travelmode=walking'));
  });
});
