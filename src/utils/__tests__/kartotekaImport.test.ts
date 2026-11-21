import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VisitStop } from '../../types/parish';
import {
  KartotekaParseOptions,
  matchKartotekaToExistingStops,
  normalizeStreetCore,
  parseAndAggregateKartotekaCsv,
  splitHouseAndUnit,
  stripPolishDiacritics,
} from '../kartotekaImport';

const DEFAULT_OPTS: KartotekaParseOptions = {
  defaultCity: 'Mikołów',
  granularity: 'family',
  splitSlashUnits: true,
  privacyStripNotes: true,
  markMultiFamilyAsMultiUnit: true,
  defaultVisitMinutes: 15,
};

describe('kartotekaImport utilities', () => {
  it('strips Polish diacritics and normalizes street prefixes', () => {
    assert.equal(stripPolishDiacritics('ul. Żółkiewskiego'), 'ul. zolkiewskiego');
    assert.equal(normalizeStreetCore('ul. św. Jana Pawła II'), 'jana pawla ii');
    assert.equal(normalizeStreetCore('Al. Korfantego'), 'korfantego');
  });

  it('splits building and apartment numbers across Polish notation styles', () => {
    assert.deepEqual(splitHouseAndUnit('12/4'), {
      buildingNumber: '12',
      unitNumber: '4',
    });
    assert.deepEqual(splitHouseAndUnit('14A m. 7'), {
      buildingNumber: '14A',
      unitNumber: '7',
    });
    assert.deepEqual(splitHouseAndUnit('8B'), {
      buildingNumber: '8B',
      unitNumber: '',
    });
  });

  it('aggregates apartment block rows while ignoring sensitive PII columns (PESEL, telefon, nazwisko)', () => {
    const csv = [
      'Ulica;Nr domu;Mieszkanie;Nazwisko;PESEL;Telefon;Uwagi;Kolęda',
      'ul. Gliwicka;12;1;Kowalski;90010112345;501234567;Starsi państwo;Przyjęli',
      'ul. Gliwicka;12;2;Nowak;88020254321;509876543;Nowa rodzina;Przyjęli',
      'ul. Gliwicka;14;;Wiśniewski;77030311111;600111222;;Nie przyjmują',
    ].join('\n');

    const result = parseAndAggregateKartotekaCsv(csv, DEFAULT_OPTS);

    assert.equal(result.validRows, 3);
    assert.equal(result.buildings.length, 2);
    assert.equal(result.multiUnitBuildingsCount, 1);

    // Ensure sensitive PII columns were detected and dropped
    const ignoredLower = result.ignoredPiiColumns.map((c) => c.toLowerCase());
    assert.ok(ignoredLower.some((c) => c.includes('pesel')));
    assert.ok(ignoredLower.some((c) => c.includes('telefon')));
    assert.ok(ignoredLower.some((c) => c.includes('nazwisko')));

    const block = result.buildings.find((b) => b.buildingNumber === '12');
    assert.ok(block);
    assert.equal(block.isMultiUnit, true);
    assert.equal(block.units.length, 2);
    // No family names or PESEL leaked into aggregated building summaryNote
    assert.equal(block.summaryNote.includes('Kowalski'), false);
    assert.equal(block.summaryNote.includes('90010112345'), false);

    const declinedHouse = result.buildings.find((b) => b.buildingNumber === '14');
    assert.ok(declinedHouse);
    assert.equal(declinedHouse.permanentDecline, true);
  });

  it('matches imported kartoteka buildings to existing map stops accurately', () => {
    const csv = [
      'Ulica;Nr domu;Mieszkanie',
      'ul. Polna;4;1',
      'ul. Polna;4;2',
      'ul. Polna;99;',
    ].join('\n');

    const parsed = parseAndAggregateKartotekaCsv(csv, DEFAULT_OPTS);

    const existingStops: VisitStop[] = [
      {
        id: 'stop-1',
        label: 'Polna 4, 43-190 Mikołów',
        address: 'Polna 4, 43-190 Mikołów',
        location: { lat: 50.171, lng: 18.903 },
        durationMinutes: 15,
        priestId: 1,
        inBoundary: true,
        included: true,
      },
    ];

    const match = matchKartotekaToExistingStops(parsed.buildings, existingStops);
    assert.equal(match.matched.length, 1);
    assert.equal(match.matched[0].stop.id, 'stop-1');
    assert.equal(match.unmatched.length, 1);
    assert.equal(match.unmatched[0].buildingNumber, '99');
  });
});
