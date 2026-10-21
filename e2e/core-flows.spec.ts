import { expect, test } from '@playwright/test'

test('the dashboard shows payments and a payment can be ticked off', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  const overdue = page.getByRole('group', { name: 'Overdue' })
  const before = await overdue.textContent()
  await page.getByRole('checkbox', { name: 'Mark A-0042 as paid' }).check()
  await expect(overdue).not.toHaveText(before ?? '')
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Mark A-0042 as paid' })).toBeChecked()
})

test('the translator turns logged days into a numbered invoice', async ({ page }) => {
  await page.goto('/people/alex/time')
  const form = page.getByRole('form', { name: 'Log a day' })
  await form.getByLabel('What you did').fill('Proofreading')
  await form.getByLabel('Hours').selectOption('2')
  await form.getByLabel('Minutes').selectOption('45')
  await form.getByRole('button', { name: 'Add day' }).click()
  await expect(page.getByRole('list', { name: 'Time log' }).getByText('2 h 45 min')).toBeVisible()

  await page.getByRole('button', { name: /Create invoice from 5 unbilled days/ }).click()
  await expect(page.getByRole('heading', { name: 'Draft invoice' })).toBeVisible()
  await expect(page.getByTestId('total-time')).toHaveText('23 h 55 min')
  await page.getByRole('button', { name: 'Save and mark as sent' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice A-0045' })).toBeVisible()

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('list', { name: 'Incoming payments' }).getByText(/A-0045/)).toBeVisible()
})

test('the sales contractor bills base fee plus a commission amount in USD', async ({ page }) => {
  await page.goto('/people/sam/invoices')
  await page.getByRole('button', { name: 'New invoice' }).click()
  await expect(page.getByRole('heading', { name: 'Draft invoice' })).toBeVisible()
  await page.getByRole('group', { name: 'Line 2' }).getByLabel('Amount (USD)').fill('2250')
  await expect(page.getByTestId('total-gross')).toHaveText(/12,250.00/)
  await page.getByRole('button', { name: 'Save and mark as sent' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice S-0019' })).toBeVisible()
})
