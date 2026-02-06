import { cleanup, render, type RenderOptions } from '@testing-library/react'
import { afterEach } from 'vitest'
import React from 'react'

// Auto-cleanup after each test
afterEach(() => {
  cleanup()
})

/**
 * Mock ClerkProvider that passes children through without auth dependencies.
 * Used in tests to avoid requiring actual Clerk configuration.
 */
function MockClerkProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children)
}

/**
 * Custom render that wraps components with test providers (mocked ClerkProvider).
 * Use this instead of @testing-library/react's render in component tests.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: MockClerkProvider,
    ...options,
  })
}

/**
 * Create a mock NextRequest for testing API route handlers.
 */
export function createMockNextRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
): Request {
  const { method = 'GET', body, headers = {}, searchParams } = options

  let fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`

  if (searchParams) {
    const params = new URLSearchParams(searchParams)
    fullUrl += `?${params.toString()}`
  }

  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  }

  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body)
  }

  return new Request(fullUrl, init)
}

/**
 * Parse a Response object to extract JSON body and status.
 * Useful for asserting on API route handler responses.
 */
export async function parseResponse<T = unknown>(
  response: Response
): Promise<{ status: number; body: T }> {
  const body = (await response.json()) as T
  return { status: response.status, body }
}

/**
 * Create a mock auth context for testing authenticated routes.
 * Returns common auth fields that Clerk provides.
 */
export function createMockAuthContext(overrides: {
  userId?: string
  orgId?: string
  orgRole?: string
} = {}) {
  return {
    userId: overrides.userId ?? 'user_test123',
    orgId: overrides.orgId ?? 'org_test123',
    orgRole: overrides.orgRole ?? 'org:admin',
  }
}
