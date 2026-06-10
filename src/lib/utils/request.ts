import { AuthError } from './auth'

/**
 * Reads and parses a JSON request body. Throws an AuthError(400) on
 * malformed JSON, which route handlers' existing AuthError catch blocks
 * translate into a 400 response instead of an unhandled 500.
 *
 * Returns `any` to match the typing of request.json() at existing call
 * sites; prefer validating the result with a Zod schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJsonBody(request: Request): Promise<any> {
  try {
    return await request.json()
  } catch {
    throw new AuthError('Invalid JSON body', 400)
  }
}
