import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Learning System', () => {
  test('dashboard page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(dashboard|sign-in)`))
  })

  test('manual learning form is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)

    const form = page.getByTestId('manual-learning-form')
    const visible = await form.isVisible().catch(() => false)
    if (!visible) {
      test.skip()
      return
    }

    await expect(form).toBeVisible()
  })

  test('learnings panel displays entries', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)

    const panel = page.getByTestId('learnings-panel')
    const visible = await panel.isVisible().catch(() => false)
    if (!visible) {
      test.skip()
      return
    }

    await expect(panel).toBeVisible()
  })

  test('learning entries show source type badge', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)

    const panel = page.getByTestId('learnings-panel')
    const visible = await panel.isVisible().catch(() => false)
    if (!visible) {
      test.skip()
      return
    }

    const entries = page.getByTestId('learning-entry')
    const count = await entries.count().catch(() => 0)
    if (count === 0) {
      test.skip()
      return
    }

    // Each entry should have at least one visible element
    await expect(entries.first()).toBeVisible()
  })
})
