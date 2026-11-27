import { CalendarPlus, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  formatLocalDate,
  formatShortDayDate,
  formatWeekRange,
  getWeekDates,
  getWeekdayShort,
  getWeekStartMonday,
  makeDatedSlotKey,
  parseLocalDate,
} from '../lib/dates'
import { usePlan } from '../store/usePlan'
import { MEAL_SLOTS, type MealSlotType, type PlanSlotKey, type Recipe } from '../types'

interface AddToPlanModalProps {
  recipe: Recipe | null
  onClose: () => void
  onAdded?: (slotKey: PlanSlotKey, recipe: Recipe) => void
}

export function AddToPlanModal({ recipe, onClose, onAdded }: AddToPlanModalProps) {
  if (!recipe) return null
  return (
    <AddToPlanModalContent
      key={recipe.id}
      recipe={recipe}
      onClose={onClose}
      onAdded={onAdded}
    />
  )
}

function AddToPlanModalContent({
  recipe,
  onClose,
  onAdded,
}: {
  recipe: Recipe
  onClose: () => void
  onAdded?: (slotKey: PlanSlotKey, recipe: Recipe) => void
}) {
  const slots = usePlan((s) => s.slots)
  const setSlot = usePlan((s) => s.setSlot)

  const [todayStr] = useState<string>(() => formatLocalDate(new Date()))
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStartMonday(new Date()))
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [selectedMeal, setSelectedMeal] = useState<MealSlotType>('Dinner')
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => {
      setJustAdded(false)
      onClose()
    }, 550)
    return () => clearTimeout(timer)
  }, [justAdded, onClose])

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const selectedDateObj = useMemo(
    () => parseLocalDate(selectedDate) ?? weekDates[0],
    [selectedDate, weekDates],
  )

  const targetKey = makeDatedSlotKey(selectedDate, selectedMeal)
  const existingInTarget = slots[targetKey]
  const selectedDayLabel = `${getWeekdayShort(selectedDateObj)}, ${formatShortDayDate(selectedDateObj)}`

  const shiftWeek = (deltaWeeks: number) => {
    const nextStart = new Date(weekStart)
    nextStart.setDate(nextStart.getDate() + deltaWeeks * 7)
    setWeekStart(nextStart)
    const nextDates = getWeekDates(nextStart)
    const nextHasSelected = nextDates.some((d) => formatLocalDate(d) === selectedDate)
    if (!nextHasSelected) {
      setSelectedDate(formatLocalDate(nextDates[0]))
    }
  }

  const handleConfirm = () => {
    setSlot(targetKey, recipe)
    onAdded?.(targetKey, recipe)
    setJustAdded(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-picker-title"
      onClick={onClose}
    >
      <div
        className="pb-safe max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-parchment bg-cream p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="plan-picker-title" className="font-display text-lg font-semibold text-ink">
                Add to Meal Plan
              </h2>
              <p className="line-clamp-1 text-xs font-medium text-ink-muted">
                {recipe.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close meal picker"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-full p-1.5 text-ink-muted hover:bg-cream-dark hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Pick a Date
            </label>
            <div className="inline-flex items-center gap-1 rounded-full border border-parchment bg-white px-2 py-0.5 text-xs">
              <button
                type="button"
                aria-label="Previous week"
                onClick={() => shiftWeek(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-cream hover:text-ink"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 font-semibold text-ink tabular-nums">
                {formatWeekRange(weekStart)}
              </span>
              <button
                type="button"
                aria-label="Next week"
                onClick={() => shiftWeek(1)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-cream hover:text-ink"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {weekDates.map((dateObj) => {
              const ymd = formatLocalDate(dateObj)
              const active = selectedDate === ymd
              const isToday = ymd === todayStr
              const hasPlanned = MEAL_SLOTS.some((meal) =>
                Boolean(slots[makeDatedSlotKey(ymd, meal)]),
              )
              return (
                <button
                  key={ymd}
                  type="button"
                  aria-label={`${getWeekdayShort(dateObj)}, ${formatShortDayDate(dateObj)}`}
                  onClick={() => setSelectedDate(ymd)}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-xl py-2 text-xs font-semibold tabular-nums transition ${
                    active
                      ? 'bg-sage-600 text-white shadow-xs'
                      : isToday
                        ? 'border border-sage-400 bg-sage-50 text-ink hover:border-sage-500'
                        : 'border border-parchment bg-white text-ink hover:border-sage-300'
                  }`}
                >
                  <span className="text-[10px] font-medium opacity-85">
                    {getWeekdayShort(dateObj)}
                  </span>
                  <span className="mt-0.5 text-xs font-bold">{dateObj.getDate()}</span>
                  <span
                    className={`mt-1 h-1 w-1 rounded-full ${
                      hasPlanned
                        ? active
                          ? 'bg-white'
                          : 'bg-sage-600'
                        : 'bg-transparent'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Meal Slot · {selectedDayLabel}
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {MEAL_SLOTS.map((meal) => {
              const active = selectedMeal === meal
              const slotOccupant = slots[makeDatedSlotKey(selectedDate, meal)]
              return (
                <button
                  key={meal}
                  type="button"
                  onClick={() => setSelectedMeal(meal)}
                  className={`flex min-h-16 flex-col items-start rounded-2xl border p-3 text-left transition ${
                    active
                      ? 'border-sage-600 bg-sage-50 ring-2 ring-sage-600/20'
                      : 'border-parchment bg-white hover:border-sage-300'
                  }`}
                >
                  <span className="text-sm font-semibold text-ink">{meal}</span>
                  <span className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">
                    {slotOccupant ? `Replaces: ${slotOccupant.name}` : 'Open slot'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {existingInTarget && (
          <p className="mt-3 rounded-xl bg-honey-50 px-3 py-2 text-xs text-honey-700">
            <strong>
              {selectedDayLabel} · {selectedMeal}
            </strong>{' '}
            currently has <em>{existingInTarget.name}</em> — confirming will swap it out.
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl px-4 py-2 text-sm font-medium text-ink-muted hover:bg-cream-dark hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sage-600 px-5 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-sage-700"
          >
            {justAdded ? (
              <>
                <Check className="h-4 w-4" />
                Added!
              </>
            ) : (
              <>
                Save to {selectedDayLabel} · {selectedMeal}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
