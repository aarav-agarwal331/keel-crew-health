/** Capture each screen of a running Keel (default: the deployed site) as text plus screenshot slices, for reviewers. */
import { expect, test, type Page } from '@playwright/test'

const URL = process.env.KEEL_URL ?? 'https://aarav-agarwal331.github.io/keel-crew-health/'
const OUT = '../docs/review'
import fs from 'node:fs'

async function capture(page: Page, name: string) {
  await page.waitForTimeout(500)
  const text = await page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText)
  const top = await page.evaluate(() => (document.querySelector('.topbar') as HTMLElement).innerText.replace(/\n+/g, ' | '))
  fs.writeFileSync(`${OUT}/${name}.txt`, `SCREEN: ${name}\nTOP BAR: ${top}\nBOTTOM NAV: Today | Trends | Check-in | Crew | More\n\n${text}\n`)
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  const slice = 1200
  for (let i = 0; i * slice < h && i < 5; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * slice)
    await page.waitForTimeout(120)
    await page.screenshot({ path: `${OUT}/${name}-${i + 1}.png` })
  }
  await page.evaluate(() => window.scrollTo(0, 0))
}
const nav = async (page: Page, hash: string) => { await page.evaluate((h) => { location.hash = h }, hash); await page.waitForTimeout(300) }

test.use({ viewport: { width: 820, height: 1200 }, baseURL: URL })
test('capture for review', async ({ page }) => {
  test.setTimeout(300_000)
  fs.mkdirSync(OUT, { recursive: true })
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL)
  await expect(page.getByTestId('today-status')).toBeVisible({ timeout: 30_000 })
  await capture(page, '01-today')
  await page.getByTestId('open-alert').click(); await capture(page, '02-alert-detail')
  await nav(page, '#/trends'); await capture(page, '03-trends')
  await nav(page, '#/checkin'); await capture(page, '04-checkin')
  await nav(page, '#/checkin/measure'); await page.getByTestId('serious-toggle').click(); await capture(page, '04-checkin-with-extras-open')
  await nav(page, '#/sharing'); await capture(page, '05-sharing')
  await nav(page, '#/crew'); await capture(page, '06-crew-as-commander')
  await page.getByRole('button', { name: 'Medical officer' }).click(); await capture(page, '06-crew-as-medical-officer')
  await nav(page, '#/link'); await capture(page, '07-link-scripted-blackout')
  await page.getByTestId('jump-link-up').click(); await capture(page, '07-link-working')
  await page.getByTestId('cut-link').click(); await capture(page, '07-link-after-cut'); await page.getByTestId('cut-link').click()
  await nav(page, '#/more'); await page.getByRole('button', { name: 'Back to the demo day' }).click()
  await nav(page, '#/replay'); await capture(page, '08-replay-before')
  await page.getByRole('button', { name: 'Fast' }).click(); await page.getByTestId('replay-play').click()
  await expect(page.getByTestId('replay-result')).toBeVisible({ timeout: 30_000 }); await capture(page, '08-replay-finished')
  await nav(page, '#/validation'); await expect(page.getByTestId('validation-headline')).toBeVisible(); await capture(page, '09-validation')
  await nav(page, '#/method'); await capture(page, '10-method')
  await nav(page, '#/guide'); await capture(page, '11-guide')
  await nav(page, '#/data'); await capture(page, '12-data-sources')
  await nav(page, '#/more'); await capture(page, '13-more')
  // a steady day and a notice-tier day for contrast
  await page.getByTestId('who').selectOption('c0'); await page.getByTestId('day-slider').fill('95'); await nav(page, '#/today'); await capture(page, '14-today-steady-day-commander')
  // entering readings: a low blood sugar, then a normal repeat; then an extreme heart rate
  await nav(page, '#/more'); await page.getByTestId('who').selectOption('c2'); await page.getByRole('button', { name: 'Back to the demo day' }).click()
  await nav(page, '#/checkin/measure')
  await page.getByLabel(/Blood sugar/).fill('50'); await page.getByTestId('save-checkin').first().click(); await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  await page.getByLabel(/Blood sugar/).fill('85'); await page.getByTestId('save-checkin').first().click(); await page.waitForTimeout(300)
  await page.getByLabel(/Heart rate now/).fill('170'); await page.getByTestId('save-checkin').first().click(); await page.waitForTimeout(400)
  await capture(page, '15-checkin-after-entering-readings')
  await page.getByTestId('confirm-rhr').first().click(); await page.waitForTimeout(300)
  await nav(page, '#/today'); await capture(page, '16-today-after-entering-readings')
  await nav(page, '#/crew'); await page.getByRole('button', { name: 'Medical officer' }).click(); await capture(page, '17-crew-as-medical-officer-after-readings')
  fs.writeFileSync(`${OUT}/console-errors.txt`, errors.length ? errors.join('\n') : 'No console errors during the capture.\n')
})
