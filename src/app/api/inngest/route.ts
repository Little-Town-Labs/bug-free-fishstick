import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'

/**
 * Inngest API route handler for Next.js App Router
 * Serves the Inngest development UI and handles function execution
 * Functions will be registered here as they are implemented
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
})
