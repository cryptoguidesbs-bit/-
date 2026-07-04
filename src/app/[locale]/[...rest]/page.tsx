import { notFound } from 'next/navigation'

// Catch-all for unknown paths inside a valid locale → renders the
// localized not-found page.
export default function CatchAllPage() {
  notFound()
}
