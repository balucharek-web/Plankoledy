import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ParishCenter,
  PlanConfig,
  SeasonPlanConfig,
  VisitStop,
} from '../../types/parish';
import {
  advanceStopClockWithBreaks,
  buildSeasonDaySummaries,
  formatAnnouncementsPlainText,
  getPolishKoledaHolidayDates,
  haversineMeters,
  parseWeekdaysMask,
  simulateAutoScheduleSeason,
  toggleWeekdayInMask,
} from '../seasonScheduler';

const TEST_PARISH: ParishCenter = {
  name: 'Parafia św. Antoniego',
  address: 'Rynek 1, 43-190 Mikołów',
  location: { lat: 50.171, lng: 18.903 },
};

const TEST_CONFIG: PlanConfig = {
  priestCount: 2,
  travelMode: 'WALKING',
  startTime: '15:30',
  defaultVisitMinutes: 15,
  returnToParish: true,
};

const TEST_SEASON_CONFIG: SeasonPlanConfig = {
  startDate: '2026-12-28',
  endDate: '2027-01-15',
  weekdayStartTime: '15:30',
  saturdayStartTime: '09:00',
  weekendStartTime: '14:00',
  dailyEndTime: '20:30',
  weekdaysMask: '1,2,3,4,5,6',
  excludedDates: ['2026-12-31', '2027-01-01', '2027-01-06'],
  defaultBreaks: [
    {
      id: 'msza',
      label: 'Msza św. wieczorna',
      startTime: '17:45',
      endTime: '18:45',
    },
  ],
};

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

describe('seasonScheduler utilities', () => {
  it('computes Haversine distances accurately', () => {
    const a = { lat: 50.171, lng: 18.903 };
    const b = { lat: 50.18, lng: 18.903 }; // ~1 km north
    const dist = haversineMeters(a, b);
    assert.ok(dist > 950 && dist < 1050, `Expected ~1000m, got ${dist}`);
    assert.equal(haversineMeters(a, a), 0);
  });

  it('parses and toggles weekdays masks without allowing an empty mask', () => {
    const parsed = parseWeekdaysMask('1,2,3');
    assert.equal(parsed.has(1), true);
    assert.equal(parsed.has(7), false);

    const toggled = toggleWeekdayInMask('1,2,3', 6);
    assert.equal(parseWeekdaysMask(toggled).has(6), true);

    // Toggling off the last remaining weekday keeps at least one day active
    const single = toggleWeekdayInMask('1', 1);
    assert.equal(parseWeekdaysMask(single).size, 1);
  });

  it('includes Polish koleda holidays (New Year & Epiphany)', () => {
    const holidays = getPolishKoledaHolidayDates('2026-12-28');
    assert.ok(holidays.includes('2027-01-01'));
    assert.ok(holidays.includes('2027-01-06'));
  });

  it('shifts visit start/end times cleanly around configured Mass/lunch breaks', () => {
    const res = advanceStopClockWithBreaks(17 * 60 + 35, 0, 20, false, [
      {
        id: 'msza',
        label: 'Msza',
        startTime: '17:45',
        endTime: '18:45',
      },
    ]);
    // 17:35 + 20m overlaps 17:45-18:45 break, so visit shifts to 18:45-19:05
    assert.equal(res.arrivalAbs, 18 * 60 + 45);
    assert.equal(res.departureAbs, 19 * 60 + 5);
  });

  it('auto-schedules a season while skipping excluded holidays and permanent declines', () => {
    const stops: VisitStop[] = [
      makeStop('s1', 'Lipowa 2, Mikołów', 50.172, 18.904),
      makeStop('s2', 'Lipowa 4, Mikołów', 50.1722, 18.9042),
      makeStop('s3', 'Lipowa 6, Mikołów', 50.1724, 18.9044),
      makeStop('s4', 'Lipowa 8, Mikołów', 50.1726, 18.9046),
      makeStop('s5', 'Lipowa 10, Mikołów', 50.1728, 18.9048, {
        permanentDecline: true,
      }),
    ];

    const sim = simulateAutoScheduleSeason({
      parish: TEST_PARISH,
      stops,
      config: TEST_CONFIG,
      seasonConfig: TEST_SEASON_CONFIG,
      targetMode: 'all',
    });

    assert.equal(sim.skippedPermanentDeclineCount, 1);
    assert.equal(sim.newlyScheduledCount, 4);

    const declined = sim.scheduledStops.find((s) => s.id === 's5');
    assert.equal(declined?.visitDate ?? '', '');

    const scheduledDates = sim.scheduledStops
      .filter((s) => s.id !== 's5')
      .map((s) => s.visitDate);
    for (const d of scheduledDates) {
      assert.ok(d && !TEST_SEASON_CONFIG.excludedDates?.includes(d));
    }
  });

  it('generates RODO-compliant parish announcements with zero family names or notes', () => {
    const stops: VisitStop[] = [
      makeStop('s1', 'Gliwicka 2, Mikołów', 50.172, 18.904, {
        visitDate: '2026-12-28',
        notes: 'Rodzina Kowalskich - tel. 500123456',
        units: [
          {
            id: 'u1',
            unitNumber: '1',
            familyName: 'Jan Nowak',
            status: 'pending',
          },
        ],
      }),
      makeStop('s2', 'Gliwicka 8, Mikołów', 50.1725, 18.9045, {
        visitDate: '2026-12-28',
        notes: 'Tajna notatka duszpasterska',
      }),
    ];

    const summary = buildSeasonDaySummaries(
      stops,
      TEST_PARISH,
      TEST_CONFIG,
      TEST_SEASON_CONFIG
    );
    const announcement = formatAnnouncementsPlainText(TEST_PARISH, summary.days);

    assert.ok(announcement.includes('Gliwicka'));
    assert.ok(announcement.includes('2'));
    assert.ok(announcement.includes('8'));
    assert.equal(announcement.includes('Kowalskich'), false);
    assert.equal(announcement.includes('Nowak'), false);
    assert.equal(announcement.includes('500123456'), false);
    assert.equal(announcement.includes('Tajna notatka'), false);
  });
});
