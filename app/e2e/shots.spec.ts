/** Screenshots of every screen at tablet and phone widths, saved to docs/shots/. Also fails on any console error. */
import { expect, test, type Page } from '@playwright/test'

const OUT = '../docs/shots'
const errors: string[] = []
const nav = async (page: Page, hash: string) => { await page.evaluate((h) => { location.hash = h }, hash); await page.waitForTimeout(350) }

async function tour(page: Page, tag: string) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`) })
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`))
  await page.goto('/')
  await expect(page.getByTestId('today-status')).toBeVisible()
  const shot = (name: string, fullPage = true) => page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage })
  await shot('01-today')
  await shot('01-today-first-view', false)
  await page.getByTestId('open-alert').click()
  await page.waitForTimeout(300)
  await shot('03-alert')
  await nav(page, '#/trends/rhr'); await shot('02-trends')
  await nav(page, '#/checkin'); await shot('04-checkin')
  await nav(page, '#/sharing'); await shot('05-sharing')
  await nav(page, '#/crew'); await shot('06-crew-commander')
  await page.getByRole('button', { name: 'Medical officer' }).click(); await page.waitForTimeout(200); await shot('06-crew-medical-officer')
  await nav(page, '#/link'); await shot('07-link-blackout')
  await nav(page, '#/replay')
  await page.getByRole('button', { name: 'Fast' }).click()
  await page.getByTestId('replay-play').click()
  await expect(page.getByTestId('replay-result')).toBeVisible({ timeout: 30_000 })
  await shot('08-replay')
  await nav(page, '#/validation'); await expect(page.getByTestId('validation-headline')).toBeVisible(); await page.waitForTimeout(400); await shot('09-validation')
  await nav(page, '#/method'); await shot('09-method')
  await nav(page, '#/guide'); await shot('10-guide')
  await nav(page, '#/data'); await shot('11-data-sources')
  await nav(page, '#/more'); await shot('12-more')
}

test.describe('tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 } })
  test('screens', async ({ page }) => { await tour(page, 'tablet') })
})
test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  test('screens', async ({ page }) => { await tour(page, 'phone') })
})
test.describe('light theme', () => {
  test.use({ viewport: { width: 820, height: 1180 } })
  test('today and validation', async ({ page }) => {
    await page.goto('/#/more')
    await page.getByRole('button', { name: 'Light' }).click()
    await nav(page, '#/today'); await page.screenshot({ path: `${OUT}/light-01-today.png`, fullPage: true })
    await nav(page, '#/validation'); await expect(page.getByTestId('validation-headline')).toBeVisible(); await page.screenshot({ path: `${OUT}/light-09-validation.png`, fullPage: true })
  })
})
test.afterAll(() => { expect(errors, errors.join('\n')).toEqual([]) })
