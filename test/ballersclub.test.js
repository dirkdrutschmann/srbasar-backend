const ExcelJS = require('exceljs');
const { parseWorksheet, parseWorkbook, timeRange, berlinTimestamp } = require('../src/modules/ballersclub/parser');
const { parseConfig, parseSheetUrl } = require('../src/modules/ballersclub/config');
const { findHall, normalizeHallName } = require('../src/modules/ballersclub/hallResolver');
const { BallersClubService } = require('../src/modules/ballersclub/service');
const { buildOrder } = require('../src/repositories/basarRepository');
const { toBallersGame } = require('../src/modules/ballersclub/catalogRepository');

const options = { sourceKey: 'source', now: new Date('2026-09-11T17:00:00Z'), daysAhead: 21 };
function sheet() {
  const workbook = new ExcelJS.Workbook();
  const page = workbook.addWorksheet('Tabellenblatt1');
  page.addRow(['', 'Datum', 'Wochentag', 'Uhrzeit', 'Halle', 'Typ', 'Schiedsrichter', 'SR 1']);
  return page;
}
function event(page, date, slots, occupied = 0) {
  const start = page.rowCount + 1;
  for (let index = 0; index < slots; index++) {
    const row = page.addRow(index === 0 ? ['', date, 'Sa', '10:00 13:30', 'Adalbertstraße', 'U12 Tour'] : []);
    const cell = row.getCell(7);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    if (index < occupied) cell.value = `Privater Name ${index}`;
  }
  return start;
}

test('counts only blank yellow referee cells, not the green applications, with variable capacity', () => {
  const page = sheet();
  const first = event(page, '12.09.2026', 3, 2);
  page.getCell(`H${first + 2}`).value = 'Eine Bewerbung';
  page.getCell(`H${first + 2}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
  event(page, '20.09.2026', 5, 1);
  event(page, '26.09.2026', 2, 2);
  const events = parseWorksheet(page, options);
  expect(events.map(row => [row.totalSpots, row.freeSpots])).toEqual([[3, 1], [5, 4], [2, 0]]);
  expect(JSON.stringify(events)).not.toMatch(/Privater Name|Eine Bewerbung/);
});

test('counts merged yellow slots once and ignores uncoloured blank cells', () => {
  const page = sheet();
  const first = event(page, '12.09.2026', 3);
  page.mergeCells(`G${first}:G${first + 1}`);
  page.addRow(['', '', '', 'Treffpunkt: 9:40 Uhr']);
  const [result] = parseWorksheet(page, options);
  expect(result.totalSpots).toBe(2);
  expect(result.meetingTime).toBe('Treffpunkt: 9:40 Uhr');
});

test('uses Berlin calendar days with an inclusive 21-day horizon and stable IDs', () => {
  const page = sheet();
  event(page, '10.09.2026', 2);
  event(page, '02.10.2026', 2);
  event(page, '03.10.2026', 2);
  const first = parseWorksheet(page, options);
  expect(first.map(row => row.date)).toEqual(['2026-10-02']);
  expect(parseWorksheet(page, options)[0].id).toBe(first[0].id);
  expect(berlinTimestamp('2026-10-25', '10:00')).toBe(Date.parse('2026-10-25T09:00:00Z'));
  expect(berlinTimestamp('2026-03-29', '10:00')).toBe(Date.parse('2026-03-29T08:00:00Z'));
});

test('keeps TBA times honest and rejects malformed times and missing headers', () => {
  expect(timeRange('TBA', '2026-09-12').timeLabel).toBe('Uhrzeit folgt');
  expect(timeRange('29:00–30:00', '2026-09-12')).toBeNull();
  expect(() => parseWorksheet(new ExcelJS.Workbook().addWorksheet('Changed'), options)).toThrow('sheet_headers_missing');
});

test('parses XLSX with formats and dates, rejects HTML and ambiguous sheet selection', async () => {
  const page = sheet();
  event(page, new Date('2026-09-12T00:00:00Z'), 3, 1);
  const bytes = Buffer.from(await page.workbook.xlsx.writeBuffer());
  expect((await parseWorkbook(bytes, options))[0].freeSpots).toBe(2);
  await expect(parseWorkbook(Buffer.from('<html>login</html>'), options)).rejects.toThrow('sheet_download_invalid');
  page.workbook.addWorksheet('Zweites Blatt');
  await expect(parseWorkbook(Buffer.from(await page.workbook.xlsx.writeBuffer()), options)).rejects.toThrow('sheet_selection_ambiguous');
});

test('validates source URLs and all contact configuration before enabling the module', () => {
  expect(parseConfig({})).toEqual({ enabled: false });
  expect(parseSheetUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=42').gid).toBe('42');
  for (const url of ['https://example.org/spreadsheets/d/abc/', 'http://docs.google.com/spreadsheets/d/abc/', 'https://docs.google.com.evil.example/spreadsheets/d/abc/']) expect(() => parseSheetUrl(url)).toThrow();
  expect(() => parseConfig({ BALLERSCLUB_SHEET_URL: 'https://docs.google.com/spreadsheets/d/abc/edit' })).toThrow();
});

test('maps unique known halls but never ambiguous floors or uncertain hall names', () => {
  const halls = [{ id: 1, name: 'Adalbertstraße, unten' }, { id: 2, name: 'Efeuweg (oben)' }];
  expect(findHall('Adalbertstraße, unten (Anschluss)', halls)?.id).toBe(1);
  expect(findHall('Campus Efeuweg', halls)).toBeNull();
  expect(findHall('Adalbertstraße', [...halls, { id: 3, name: 'Adalbertstraße, oben' }])).toBeNull();
  expect(findHall('Hausburg ???', [{ id: 1, name: 'Hausburg ???' }])).toBeNull();
  expect(normalizeHallName('Halle (unten)')).toContain('unten');
});

test('failed refresh preserves the successful snapshot and never returns applicant information', async () => {
  const store = { getSync: jest.fn(), replaceSnapshot: jest.fn(), recordFailure: jest.fn() };
  const config = { enabled: true, sourceKey: 'key', sheet: { exportUrl: 'https://docs.google.com/x' }, maxAgeMs: 900000, contact: { name: 'Kontakt' } };
  const service = new BallersClubService({ config: () => config, store, fetch: jest.fn().mockRejectedValue(new Error('network')) });
  await service.refresh();
  expect(store.replaceSnapshot).not.toHaveBeenCalled();
  expect(store.recordFailure).toHaveBeenCalledWith('key', 'import_failed');
  store.getSync.mockResolvedValue({ fetchedAt: new Date('2026-09-11T17:00:00Z'), lastError: 'import_failed' });
  expect((await service.publicState(new Date('2026-09-11T17:10:00Z'))).status).toBe('stale');
  expect((await service.publicState(new Date('2026-09-11T17:16:00Z'))).available).toBe(false);
});

test('keeps retrying after a transient startup configuration error', async () => {
  jest.useFakeTimers();
  const store = { getSync: jest.fn(), replaceSnapshot: jest.fn(), recordFailure: jest.fn() };
  const config = jest.fn()
    .mockImplementationOnce(() => { throw new Error('EACCES'); })
    .mockReturnValue({
      enabled: true,
      sourceKey: 'key',
      sheet: { exportUrl: 'https://docs.google.com/x' },
      refreshMs: 300000,
      maxAgeMs: 900000,
      contact: { name: 'Kontakt' }
    });
  const service = new BallersClubService({ config, store, fetch: jest.fn().mockRejectedValue(new Error('network')) });

  try {
    service.start();
    expect(service.timer).not.toBeNull();
    await jest.advanceTimersByTimeAsync(300000);
    expect(config.mock.calls.length).toBeGreaterThanOrEqual(3);
  } finally {
    await service.stop();
    jest.useRealTimers();
  }
});

test('public Ballers entries have no fabricated TeamSL ID or minimum licence', () => {
  const data = toBallersGame({ id: 'abc', startsAt: 1, endsAt: 2, tournamentType: 'U12 Tour', locationRaw: 'Halle', freeSpots: 1, totalSpots: 3 });
  expect(data.id).toBe('ballers-club:abc');
  expect(data.spielplanId).toBeNull();
  expect(data.srLizenz).toBeNull();
  expect(data.isAtRisk).toBe(false);
  expect(buildOrder('injected; DROP TABLE hallen', 'invalid')).not.toContain('DROP');
});
