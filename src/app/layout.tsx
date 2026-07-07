import type { ReactNode } from 'react'

// Pass-through root layout. Locale routes render <html>/<body> in
// [locale]/layout.tsx; this root exists so the root not-found.tsx (served
// for non-locale paths) has a layout ancestor — required by Next.js and
// what gives notFound() a real 404 status in production.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
