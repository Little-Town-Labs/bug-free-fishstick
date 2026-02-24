/**
 * Next.js instrumentation — runs once on server startup before any routes.
 * Polyfills browser APIs that pdfjs-dist references in Node.js environments.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (typeof globalThis.DOMMatrix === 'undefined') {
      // Minimal DOMMatrix stub so pdfjs-dist doesn't crash at module init.
      // pdf-parse v2 uses pdfjs-dist/legacy which references DOMMatrix at the
      // module level. Text extraction only needs the constructor to exist.
      class DOMMatrixPolyfill {
        m11 = 1; m12 = 0; m13 = 0; m14 = 0
        m21 = 0; m22 = 1; m23 = 0; m24 = 0
        m31 = 0; m32 = 0; m33 = 1; m34 = 0
        m41 = 0; m42 = 0; m43 = 0; m44 = 1
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
        is2D = true
        isIdentity = true
        multiply() { return new DOMMatrixPolyfill() }
        translate() { return new DOMMatrixPolyfill() }
        scale() { return new DOMMatrixPolyfill() }
        rotate() { return new DOMMatrixPolyfill() }
        inverse() { return new DOMMatrixPolyfill() }
        transformPoint(p: { x?: number; y?: number; z?: number; w?: number }) {
          return { x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0, w: p.w ?? 1 }
        }
      }
      ;(globalThis as Record<string, unknown>).DOMMatrix = DOMMatrixPolyfill
    }
  }
}
