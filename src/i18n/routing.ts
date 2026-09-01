import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ko', 'en'],
  defaultLocale: 'en',
  localePrefix: 'always',
  // next-intl 4 defaults NEXT_LOCALE to a session cookie; pin one year so an
  // explicit language choice survives browser restarts (site policy — the
  // switcher writes the same max-age).
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
})

export type Locale = (typeof routing.locales)[number]
