/**
 * Offline proof.  Load the built app once, wait until the service worker has cached it, cut
 * the network, reload, and then use every screen.  Any console error, page error or request
 * that is not answered from the cache fails the test.
 */
import { expect, test, type Page } from '@playwright/test'

const problems: string[] = []

async function goOffline(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('today-status')).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()                                   // now controlled by the service worker
  await expect(page.getByTestId('today-status')).toBeVisible()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await page.context().setOffline(true)
  await page.reload()                                   // must come entirely from the cache
  await expect(page.getByTestId('today-status')).toBeVisible()
}

const nav = async (page: Page, hash: string) => {
  await page.evaluate((h) => { location.hash = h }, hash)
}

test('every screen works with the network disabled', async ({ page }) => {
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`))

  await goOffline(page)
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)

  await test.step('Today: status, offline banner, recommended action', async () => {
    await expect(page.getByTestId('today-status')).toContainText(/Act today|Worth a look|Steady/)
    await expect(page.getByTestId('offline-banner')).toBeVisible()
    await expect(page.getByTestId('today-action')).toBeVisible()
    await expect(page.getByText('Simulated data').first()).toBeVisible()
  })

  await test.step('Alert detail: evidence, action, escalation, log what you did', async () => {
    await page.getByTestId('open-alert').click()
    await expect(page.getByTestId('alert-action')).toBeVisible()
    await expect(page.getByText('What changed')).toBeVisible()
    await page.getByRole('button', { name: 'Did it', exact: true }).click()
    await page.getByRole('group', { name: /How do you feel now/ }).getByRole('button').nth(3).click()
    await page.getByTestId('log-action').click()
    await expect(page.getByText('Saved on this device.')).toBeVisible()
    await expect(page.getByText('How soon, and who should know')).toBeVisible()
    await page.getByTestId('share-cmo').click()
    await expect(page.getByText(/can see the details of this alert/)).toBeVisible()
  })

  await test.step('Trends: charts against the personal baseline', async () => {
    await nav(page, '#/trends')
    await expect(page.getByRole('heading', { name: 'Trends' })).toBeVisible()
    expect(await page.locator('main svg[role="img"]').count()).toBeGreaterThan(10)
    await page.getByRole('button', { name: 'Mission', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Resting heart rate' })).toBeVisible()
  })

  await test.step('A fixed safety threshold reacts to one entered reading, offline', async () => {
    await nav(page, '#/checkin')
    await page.getByTestId('more-checkin').click()
    await page.getByLabel(/Blood oxygen/).fill('91')
    await page.getByTestId('save-checkin').first().click()
    await nav(page, '#/today')
    await expect(page.getByTestId('today-status')).toContainText('Act now')
    await expect(page.getByTestId('today-action')).toContainText('Tell the medical officer now')
    await nav(page, '#/crew')
    await expect(page.getByTestId('crew-c2')).toContainText(/emergency sharing/)
    await nav(page, '#/checkin')
    await page.getByTestId('more-checkin').click()
    await page.getByLabel(/Blood oxygen/).fill('97')
    await page.getByTestId('save-checkin').first().click()
    await expect(page.getByText('Saved.')).toBeVisible()
  })

  await test.step('A thermometer reading entered at check-in or on the action card triggers the fever rules', async () => {
    await nav(page, '#/checkin/measure')
    await page.getByLabel(/Body temperature \(thermometer\)/).fill('38.4')
    await page.getByTestId('save-checkin').first().click()
    await nav(page, '#/today')
    await expect(page.locator('main')).toContainText('Thermometer reading is in the fever range')
    await page.getByTestId('temp-now').first().fill('39.6')
    await page.getByTestId('temp-save').first().click()
    await expect(page.getByTestId('today-status')).toContainText('Act now')
    await expect(page.locator('main')).toContainText('39.4 °C or higher')
    await page.getByTestId('temp-now').first().fill('36.8')
    await page.getByTestId('temp-save').first().click()
    await expect(page.getByTestId('today-status')).not.toContainText('Act now')
  })

  await test.step('Check-in: enter mood, symptom, fluids, save, re-analysis runs on device', async () => {
    await nav(page, '#/checkin')
    await page.getByTestId('mood-2').click()
    await page.getByTestId('sym-headache').click()
    await page.getByTestId('fluid-plus').click()
    await page.getByTestId('save-checkin').first().click()
    await expect(page.getByText('Saved.')).toBeVisible()
    await nav(page, '#/today')
    await expect(page.getByText('Check-in done')).toBeVisible()
  })

  await test.step('Sharing: change a level, preview updates', async () => {
    await nav(page, '#/sharing')
    await page.getByTestId('share-cmo-sleep-detail').click()
    await expect(page.getByTestId('role-preview')).toContainText('Full detail')
    await expect(page.getByTestId('emergency-toggle').getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true')
  })

  await test.step('Crew readiness: commander and medical officer views write the access log', async () => {
    await nav(page, '#/crew')
    await expect(page.getByTestId('crew-summary')).toBeVisible()
    await expect(page.getByTestId('crew-c0')).toContainText(/No Keel flags|Minor flags|Talk to the medical officer first|Not enough recent data/)
    await page.getByRole('button', { name: 'Medical officer' }).click()
    await expect(page.getByTestId('crew-c2')).toBeVisible()
    await nav(page, '#/sharing')
    await expect(page.getByTestId('access-log')).toContainText('Crew medical officer')
  })

  await test.step('Link: cut the link, summaries queue, restore', async () => {
    await nav(page, '#/more')
    await page.getByTestId('day-slider').fill('100')         // a day with a nominal link
    await nav(page, '#/link')
    await expect(page.getByTestId('link-status')).toContainText('each way')
    await page.getByTestId('cut-link').click()
    await expect(page.getByTestId('link-status')).toContainText('No link to Earth')
    await expect(page.getByTestId('link-chip')).toContainText('No Earth link')
    await nav(page, '#/more')
    await page.getByTestId('day-plus').click()
    await page.getByTestId('day-plus').click()
    await nav(page, '#/link')
    await expect(page.getByTestId('queue-count')).not.toHaveText('0 waiting')
    await page.getByTestId('cut-link').click()
    await expect(page.getByTestId('queue-count')).toHaveText('0 waiting')
  })

  await test.step('Replay: step and play a scripted event to its result', async () => {
    await nav(page, '#/replay')
    await page.getByTestId('replay-step').click()
    await page.getByRole('button', { name: 'Fast' }).click()
    await page.getByTestId('replay-play').click()
    await expect(page.getByTestId('replay-result')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('replay-feed')).toContainText(/What was scripted/)
  })

  await test.step('Validation, Method, Guide render from cached results', async () => {
    await nav(page, '#/validation')
    await expect(page.getByTestId('validation-headline')).toContainText('false alerts per person-month')
    expect(await page.locator('main svg[role="img"]').count()).toBeGreaterThan(8)
    await nav(page, '#/method')
    await expect(page.getByRole('heading', { name: 'Personal baselines' })).toBeVisible()
    await nav(page, '#/guide')
    await expect(page.getByRole('heading', { name: 'Guide to measurements' })).toBeVisible()
  })

  await test.step('Data sources: switch mission and import a wearable file, all offline', async () => {
    await nav(page, '#/data')
    await page.getByTestId('load-lunar_surface').click()
    await expect(page.getByText('Lunar surface stay.').first()).toBeVisible()
    const csv = await page.evaluate(async () => (await fetch('samples/sample_wearable.csv')).text())
    await page.getByTestId('import-file').setInputFiles({ name: 'sample_wearable.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await expect(page.getByText(/Imported 75 days/)).toBeVisible()
    await nav(page, '#/today')
    await expect(page.getByTestId('today-status')).toBeVisible()
    await expect(page.getByText(/Real data/).first()).toBeVisible()
    await nav(page, '#/data')
    await page.getByTestId('load-mars_transit').click()
    await expect(page.getByText('Mars transit.').first()).toBeVisible()
  })

  expect(problems, problems.join('\n')).toEqual([])
})

test('data entered offline survives a reload', async ({ page }) => {
  await goOffline(page)
  await nav(page, '#/checkin')
  await page.getByTestId('mood-5').click()
  await page.getByTestId('save-checkin').first().click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await page.reload()
  await nav(page, '#/today')
  await expect(page.getByText('Check-in done')).toBeVisible()
})
