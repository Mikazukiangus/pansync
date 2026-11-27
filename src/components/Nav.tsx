import {
  CalendarDays,
  CookingPot,
  Heart,
  Refrigerator,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getExpiryStatus } from '../lib/dates'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { SettingsModal } from './SettingsModal'

export function Nav() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const fridgeItems = useFridge((s) => s.items)
  const favCount = useFavourites((s) => s.ids.length)
  const planCount = usePlan((s) => Object.keys(s.slots).length)

  const urgentFridgeCount = fridgeItems.filter((item) => {
    const status = getExpiryStatus(item.useBy)
    return status === 'expired' || status === 'today' || status === 'soon'
  }).length

  const navItems = [
    {
      to: '/',
      label: 'Find',
      icon: Search,
      badge: null,
      urgent: false,
    },
    {
      to: '/fridge',
      label: 'Fridge',
      icon: Refrigerator,
      badge: urgentFridgeCount > 0 ? urgentFridgeCount : fridgeItems.length || null,
      urgent: urgentFridgeCount > 0,
    },
    {
      to: '/plan',
      label: 'Plan',
      icon: CalendarDays,
      badge: planCount || null,
      urgent: false,
    },
    {
      to: '/favourites',
      label: 'Favourites',
      icon: Heart,
      badge: favCount || null,
      urgent: false,
    },
  ]

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-parchment/80 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <NavLink to="/" className="group flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-600 text-cream shadow-sm transition group-hover:bg-sage-700">
              <CookingPot className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-ink">
                PanSync
              </span>
              <span className="hidden text-xs text-ink-muted sm:block">
                Cook what you have · waste nothing
              </span>
            </div>
          </NavLink>

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon, badge, urgent }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-sage-600 text-white shadow-xs'
                      : 'text-ink-muted hover:bg-cream-dark hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                    {badge !== null && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold ${
                          urgent
                            ? isActive
                              ? 'bg-tomato-500 text-white'
                              : 'bg-tomato-100 text-tomato-700'
                            : isActive
                              ? 'bg-white/25 text-white'
                              : 'bg-sage-100 text-sage-800'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open pantry staples and dietary settings"
            className="inline-flex items-center gap-2 rounded-full border border-parchment bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs transition hover:border-sage-300 hover:bg-sage-50"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-sage-700" />
            <span className="hidden sm:inline">Staples</span>
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-parchment bg-white/95 px-2 py-1.5 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {navItems.map(({ to, label, icon: Icon, badge, urgent }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition ${
                  isActive
                    ? 'bg-sage-50 text-sage-700'
                    : 'text-ink-muted hover:text-ink'
                }`
              }
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {badge !== null && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${
                      urgent
                        ? 'bg-tomato-500 text-white'
                        : 'bg-sage-600 text-white'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
