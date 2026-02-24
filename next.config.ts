import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const nextConfig: NextConfig = {
  // Prevent pdfjs-dist and pdf-parse from being bundled into server chunks.
  // pdfjs-dist uses DOMMatrix (a browser API) at module-init time, which
  // crashes Inngest and other server-side routes in Node.js.
  serverExternalPackages: ['pdfjs-dist', 'pdf-parse'],
  webpack: (config) => {
    // pdfjs-dist requires canvas to be aliased away in server/edge builds
    config.resolve.alias.canvas = false
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
