import { test, expect } from '@playwright/test'

test.describe('Response Editing Workflow (US3)', () => {
  // These tests are skipped until the full auth/DB setup is available in E2E env.
  // They document the expected user journeys for US3.

  test.skip('should display AI-generated responses with confidence indicators', async ({ page }) => {
    await page.goto('/rfps/test-rfp-id')

    // Editor should be visible
    await expect(page.getByTestId('rfp-editor')).toBeVisible()

    // Should show at least one response card
    await expect(page.getByTestId('response-card').first()).toBeVisible()

    // Confidence indicators should be present for responses with scores
    const confidenceIndicators = page.getByTestId('confidence-indicator')
    await expect(confidenceIndicators.first()).toBeVisible()
  })

  test.skip('should show completion progress', async ({ page }) => {
    await page.goto('/rfps/test-rfp-id')

    // Completion progress bar should be visible
    await expect(page.getByTestId('completion-progress')).toBeVisible()
    await expect(page.getByTestId('completion-percentage')).toBeVisible()
    await expect(page.getByTestId('completion-bar')).toBeVisible()
  })

  test.skip('should accept a response and update completion progress', async ({ page }) => {
    await page.goto('/rfps/test-rfp-id')

    const initialPercentage = await page
      .getByTestId('completion-percentage')
      .textContent()

    // Accept the first auto-filled response
    const firstCard = page.getByTestId('response-card').first()
    await firstCard.getByRole('button', { name: /accept/i }).click()

    // Optimistic update: card should show approved status
    await expect(firstCard.getByText('Approved')).toBeVisible()

    // Completion percentage should increase
    const updatedPercentage = await page
      .getByTestId('completion-percentage')
      .textContent()
    expect(updatedPercentage).not.toBe(initialPercentage)
  })

  test.skip('should edit a response and trigger auto-save', async ({ page }) => {
    await page.goto('/rfps/test-rfp-id')

    const firstCard = page.getByTestId('response-card').first()

    // Enter edit mode
    await firstCard.getByRole('button', { name: /edit/i }).click()

    // Textarea should appear
    const textarea = firstCard.getByRole('textbox')
    await expect(textarea).toBeVisible()

    // Type new response
    await textarea.clear()
    await textarea.fill('Updated response text for this field')

    // Save the edit
    await firstCard.getByRole('button', { name: /save/i }).click()

    // Exit edit mode
    await expect(firstCard.getByRole('textbox')).not.toBeVisible()

    // Auto-save indicator should appear briefly
    // (may be too fast to catch reliably in CI, but documents expected behavior)
  })

  test.skip('should show saving indicator during auto-save', async ({ page }) => {
    // Slow down network to observe auto-save state
    await page.route('/api/rfps/*/responses/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await page.goto('/rfps/test-rfp-id')

    const firstCard = page.getByTestId('response-card').first()
    await firstCard.getByRole('button', { name: /edit/i }).click()
    await firstCard.getByRole('textbox').fill('New text that triggers auto-save')
    await firstCard.getByRole('button', { name: /save/i }).click()

    // Should show saving indicator
    await expect(page.getByTestId('auto-save-indicator')).toBeVisible()

    // Eventually should show saved
    await expect(page.getByTestId('saved-indicator')).toBeVisible({ timeout: 2000 })
  })

  test.skip('should reject a response and mark it as needs input', async ({ page }) => {
    await page.goto('/rfps/test-rfp-id')

    const firstCard = page.getByTestId('response-card').first()

    // Reject the response
    await firstCard.getByRole('button', { name: /reject/i }).click()

    // Status should change to needs_input
    await expect(firstCard.getByText('Needs Input')).toBeVisible()
  })

  test.skip('should display confidence level with correct color coding', async ({ page }) => {
    await page.goto('/rfps/test-rfp-id')

    // High confidence responses should have green indicators
    const highConfidenceIndicator = page
      .getByTestId('confidence-indicator')
      .filter({ hasText: /9\d%/ })
      .first()

    if (await highConfidenceIndicator.isVisible()) {
      await expect(highConfidenceIndicator).toHaveClass(/text-green-600/)
    }
  })

  test.skip('should handle conflict during concurrent edits', async ({ page, context }) => {
    // Open second page to simulate concurrent editing
    const page2 = await context.newPage()

    await page.goto('/rfps/test-rfp-id')
    await page2.goto('/rfps/test-rfp-id')

    // Both pages edit the same field
    const card1 = page.getByTestId('response-card').first()
    const card2 = page2.getByTestId('response-card').first()

    await card1.getByRole('button', { name: /edit/i }).click()
    await card2.getByRole('button', { name: /edit/i }).click()

    await card2.getByRole('textbox').fill('Page 2 saves first')
    await card2.getByRole('button', { name: /save/i }).click()

    // Wait for page2 save to complete
    await page2.waitForTimeout(500)

    // Now page1 tries to save with stale lastSaved
    await card1.getByRole('textbox').fill('Page 1 tries to save with stale data')
    await card1.getByRole('button', { name: /save/i }).click()

    // Should show conflict error
    await expect(page.getByTestId('save-error')).toContainText(/newer version|conflict/i)

    await page2.close()
  })
})
