import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import {
  formatLocalDate,
  formatMonthYear,
  getMonthGridDates,
  getWeekdayShort,
  makeDatedSlotKey,
  parseLocalDate,
} from '../lib/dates'
import type { PlanSlotKey, Recipe } from '../types'

interface OverviewCalendarProps {
  year: number
  month: number // 0-based
  todayYmd: string
  selectedDateYmd: string
  expandedWeekYmds: readonly string[]
  slots: Partial<Record<PlanSlotKey, Recipe>>
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSelectDate: (date: Date) => void
}

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const WEEKDAY_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export function OverviewCalendar({
  year,
  month,
  todayYmd,
  selectedDateYmd,
  expandedWeekYmds,
  slots,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
}: OverviewCalendarProps) {
  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month])
  const expandedWeekSet = useMemo(() => new Set(expandedWeekYmds), [expandedWeekYmds])

  const plannedDaysInMonth = useMemo(() => {
    let count = 0
    for (const date of gridDates) {
      if (date.getMonth() !== month || date.getFullYear() !== year) continue
      const ymd = formatLocalDate(date)
      const hasMeal = Boolean(
        slots[makeDatedSlotKey(ymd, 'Breakfast')] ||
          slots[makeDatedSlotKey(ymd, 'Lunch')] ||
          slots[makeDatedSlotKey(ymd, 'Dinner')],
      )
      if (hasMeal) count += 1
    }
    return count
  }, [gridDates, month, year, slots])

  const isViewingCurrentMonthAndWeek = useMemo(() => {
    const todayDate = parseLocalDate(todayYmd)
    if (!todayDate) return false
    return (
      year === todayDate.getFullYear() &&
      month === todayDate.getMonth() &&
      expandedWeekSet.has(todayYmd)
    )
  }, [year, month, expandedWeekSet, todayYmd])

  return (
    <section
      aria-label="Meal plan overview calendar"
      className="rounded-3xl border border-parchment bg-white p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sage-100 text-sage-700">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-ink">
              {formatMonthYear(year, month)}
            </h2>
            <p className="text-[11px] text-ink-muted tabular-nums">
              {plannedDaysInMonth === 0
                ? 'No days planned this month'
                : `${plannedDaysInMonth} planned ${plannedDaysInMonth === 1 ? 'day' : 'days'} this month`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isViewingCurrentMonthAndWeek && (
            <button
              type="button"
              onClick={onToday}
              className="min-h-8 rounded-full border border-parchment bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-sage-400 hover:bg-sage-50"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mon–Sun Header */}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_HEADERS.map((letter, idx) => (
          <span
            key={WEEKDAY_FULL[idx]}
            aria-label={WEEKDAY_FULL[idx]}
            className="py-1 text-[10px] font-bold tracking-wider text-ink-subtle uppercase"
          >
            {letter}
          </span>
        ))}
      </div>

      {/* Month Date Grid */}
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {gridDates.map((date, idx) => {
          const ymd = formatLocalDate(date)
          const isCurrentMonth = date.getMonth() === month && date.getFullYear() === year
          const isToday = ymd === todayYmd
          const isInExpandedWeek = expandedWeekSet.has(ymd)
          const isSelected = ymd === selectedDateYmd

          const breakfast = slots[makeDatedSlotKey(ymd, 'Breakfast')]
          const lunch = slots[makeDatedSlotKey(ymd, 'Lunch')]
          const dinner = slots[makeDatedSlotKey(ymd, 'Dinner')]
          const plannedCount =
            (breakfast ? 1 : 0) + (lunch ? 1 : 0) + (dinner ? 1 : 0)

          const colIdx = idx % 7
          const weekEdgeClass = isInExpandedWeek
            ? colIdx === 0
              ? 'rounded-l-xl'
              : colIdx === 6
                ? 'rounded-r-xl'
                : ''
            : 'rounded-xl'

          const mealSummary = [
            breakfast ? `Breakfast: ${breakfast.name}` : null,
            lunch ? `Lunch: ${lunch.name}` : null,
            dinner ? `Dinner: ${dinner.name}` : null,
          ]
            .filter(Boolean)
            .join(', ')

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelectDate(date)}
              data-date={ymd}
              data-planned-count={plannedCount}
              data-in-expanded-week={isInExpandedWeek}
              aria-label={`${getWeekdayShort(date)} ${ymd}${plannedCount > 0 ? `, ${plannedCount} planned (${mealSummary})` : ', no meals planned'}`}
              title={
                plannedCount > 0
                  ? `${ymd}: ${mealSummary}`
                  : `${ymd} — click to open this week`
              }
              className={`relative flex flex-col items-center justify-center py-1.5 text-xs tabular-nums transition ${weekEdgeClass} ${
                isInExpandedWeek
                  ? 'bg-sage-100/85 text-ink hover:bg-sage-200/70'
                  : plannedCount > 0
                    ? 'bg-sage-50/70 text-ink hover:bg-sage-100/70'
                    : 'hover:bg-cream'
              } ${!isCurrentMonth ? 'opacity-45' : ''}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  isToday
                    ? 'bg-sage-600 font-bold text-white shadow-2xs'
                    : isSelected
                      ? 'ring-2 ring-sage-500 font-bold text-ink'
                      : plannedCount > 0
                        ? 'font-bold text-sage-800'
                        : 'font-medium text-ink'
                }`}
              >
                {date.getDate()}
              </span>
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                {breakfast && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-honey-500"
                    aria-hidden="true"
                  />
                )}
                {lunch && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-sage-600"
                    aria-hidden="true"
                  />
                )}
                {dinner && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-tomato-500"
                    aria-hidden="true"
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Compact Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-parchment/70 pt-3 text-[11px] text-ink-muted">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-honey-500" />
            Breakfast
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sage-600" />
            Lunch
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-tomato-500" />
            Dinner
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-sage-100 ring-1 ring-sage-300/70" />
          Expanded week
        </span>
      </div>
    </section>
  )
}
