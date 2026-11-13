import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHeartRate, rmssd } from './ble'
import { parseAny, parseAppleHealth, parseCsv, parseFitbitJson, toMission } from './importers'
import { delayFor, fmtDelay, linkState, marsTransitDistanceAu } from './link'
import type { Mission } from './types'

describe('importers', () => {
  it('reads the bundled sample CSV', () => {
    const r = parseCsv(fs.readFileSync('public/samples/sample_wearable.csv', 'utf8'))
    expect(r.rows.length).toBe(75)
    expect(r.rows[0].values.rhr).toBeGreaterThan(40)
    const m = toMission(r, 'x')
    expect(m.days).toBe(75)
    expect(m.simulated).toBe(false)
    expect(m.series.you.rhr.filter((v) => v !== null).length).toBe(75)
  })
  it('handles aliases, semicolons, minutes of sleep and missing cells', () => {
    const r = parseCsv('Date;Resting Heart Rate;minutesAsleep\n2026-01-01;58;420\n2026-01-03;;390\n')
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0].values).toEqual({ rhr: 58, sleep_h: 7 })
    expect(r.rows[1].values).toEqual({ sleep_h: 6.5 })
    expect(toMission(r, 'x').days).toBe(3)
  })
  it('reads a thermometer column as a fever-checked reading, keeps low blood sugar, and refuses ambiguous dates', () => {
    const r = parseCsv('date,temperature,skin_temp,glucose\n2026-01-01,38.6,0.4,60\n2026-01-01,37.0,0.2,350\n2026-01-02,36.8,0.1,20\n2026-01-03,36.7,0.0,110\n')
    expect(r.rows[0].values.temp_oral).toBe(38.6)
    expect(r.rows[0].values.glucose).toBe(60)
    expect(r.rows[1].values.glucose).toBe(20)
    expect(r.notes.join(' ')).toMatch(/both under 70/)
    expect(() => parseCsv('date,rhr\n03/04/2026,60\n05/06/2026,61\n')).toThrow(/YYYY-MM-DD/)
    expect(parseCsv('date,rhr\n13/04/2026,60\n03/04/2026,61\n').rows.map((x) => x.date)).toEqual(['2026-04-03', '2026-04-13'])
  })
  it('rejects files without a date or known columns', () => {
    expect(() => parseCsv('a,b\n1,2\n')).toThrow(/date/)
    expect(() => parseCsv('date,foo\n2026-01-01,2\n')).toThrow(/indicator/)
  })
  it('reads Fitbit resting heart rate and sleep JSON', () => {
    const hr = parseFitbitJson(JSON.stringify([{ dateTime: '01/02/26 00:00:00', value: { date: '01/02/26', value: 61.2, error: 6.7 } }]))
    expect(hr.rows[0]).toEqual({ date: '2026-01-02', values: { rhr: 61.2 } })
    const sl = parseFitbitJson(JSON.stringify([{ dateOfSleep: '2026-01-02', minutesAsleep: 300 }, { dateOfSleep: '2026-01-02', minutesAsleep: 60 }]))
    expect(sl.rows[0].values.sleep_h).toBe(6)
  })
  it('reads Apple Health records with unit conversion', () => {
    const xml = `<?xml version="1.0"?><HealthData>
      <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-01-02 08:00:00 +0000" endDate="2026-01-02 08:00:00 +0000" value="57"/>
      <Record type="HKQuantityTypeIdentifierOxygenSaturation" unit="%" startDate="2026-01-02 03:00:00 +0000" endDate="2026-01-02 03:00:00 +0000" value="0.97"/>
      <Record type="HKQuantityTypeIdentifierBloodGlucose" unit="mmol/L" startDate="2026-01-02 07:00:00 +0000" endDate="2026-01-02 07:00:00 +0000" value="5"/>
      <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-01-01 23:00:00 +0000" endDate="2026-01-02 06:00:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
    </HealthData>`
    const r = parseAppleHealth(xml)
    expect(r.rows[0].values.rhr).toBe(57)
    expect(r.rows[0].values.spo2).toBeCloseTo(97)
    expect(r.rows[0].values.glucose).toBeCloseTo(90.08, 1)
    expect(r.rows[0].values.sleep_h).toBeCloseTo(7)
    expect(parseAny('export.xml', xml).format).toMatch(/Apple/)
  })
})

describe('heart-rate strap parsing', () => {
  it('parses 8-bit heart rate with RR intervals', () => {
    const b = new Uint8Array([0x10, 62, 0x00, 0x04, 0x10, 0x04]) // RR 1024/1024 s and 1040/1024 s
    const s = parseHeartRate(new DataView(b.buffer))
    expect(s.hr).toBe(62)
    expect(s.rr[0]).toBeCloseTo(1000)
    expect(s.rr[1]).toBeCloseTo(1015.6, 0)
  })
  it('parses 16-bit heart rate with energy field and contact bits', () => {
    const b = new Uint8Array([0x01 | 0x08 | 0x04 | 0x02, 0x2c, 0x01, 0x05, 0x00])
    const s = parseHeartRate(new DataView(b.buffer))
    expect(s.hr).toBe(300)
    expect(s.contact).toBe(true)
    expect(s.rr).toHaveLength(0)
  })
  it('computes RMSSD and ignores ectopic beats', () => {
    expect(rmssd([1000, 1020, 1000, 1020, 1000])).toBeCloseTo(20)
    expect(rmssd([1000, 1020, 400, 1020, 1000, 1020])).toBeCloseTo(20)
    expect(rmssd([1000])).toBeNaN()
  })
})

describe('link model', () => {
  const m = JSON.parse(fs.readFileSync('public/data/missions/mars_transit.json', 'utf8')) as Mission
  it('delay starts near zero and stays within the verified Earth-Mars range', () => {
    expect(delayFor(m, m.pre_days).delayS).toBeLessThan(5)
    const end = delayFor(m, m.days - 1).delayS / 60
    expect(end).toBeGreaterThan(3)
    expect(end).toBeLessThan(24)
    for (let fd = 1; fd <= 180; fd++) expect(marsTransitDistanceAu(fd, 180)).toBeGreaterThanOrEqual(marsTransitDistanceAu(fd - 1, 180) - 1e-9)
  })
  it('manual cut and scripted blackouts make the link unavailable; before launch it is direct', () => {
    expect(linkState(m, m.pre_days + 50, false).available).toBe(true)
    expect(linkState(m, m.pre_days + 50, true).available).toBe(false)
    expect(linkState(m, m.pre_days + 122, false).available).toBe(false)
    expect(linkState(m, 5, false).delayS).toBe(0)
  })
  it('formats delays', () => {
    expect(fmtDelay(1.27)).toBe('1.3 s')
    expect(fmtDelay(252)).toBe('4 min 12 s')
  })
})
