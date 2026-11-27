import { CalendarPlus, Check, X } from 'lucide-react'
import { useState } from 'react'
import { usePlan } from '../store/usePlan'
import {
  DAYS_OF_WEEK,
  MEAL_SLOTS,
  type DayOfWeek,
  type MealSlotType,
  type PlanSlotKey,
  type Recipe,
} from '../types'

interface AddToPlanModalProps {
  recipe: Recipe | null
  onClose: () => void
}

export function AddToPlanModal({ recipe, onClose }: AddToPlanModalProps) {
  const slots = usePlan((s) => s.slots)
  const setSlot = usePlan((s) => s.setSlot)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Mon')
  const [selectedMeal, setSelectedMeal] = useState<MealSlotType>('Dinner')
  const [justAdded, setJustAdded] = useState(false)

  if (!recipe) return null

  const targetKey: PlanSlotKey = `${selectedDay}-${selectedMeal}`
  const existingInTarget = slots[targetKey]

  const handleConfirm = () => {
    setSlot(targetKey, recipe)
    setJustAdded(true)
    setTimeout(() => {
      setJustAdded(false)
      onClose()
    }, 550)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-picker-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-parchment bg-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="plan-picker-title" className="font-display text-lg font-semibold text-ink">
                Add to Weekly Plan
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
            className="rounded-full p-1.5 text-ink-muted hover:bg-cream-dark hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5">
          <label className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Pick a Day
          </label>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {DAYS_OF_WEEK.map((day) => {
              const active = selectedDay === day
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`rounded-xl py-2 text-xs font-semibold transition ${
                    active
                      ? 'bg-sage-600 text-white shadow-xs'
                      : 'border border-parchment bg-white text-ink hover:border-sage-300'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Meal Slot
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MEAL_SLOTS.map((meal) => {
              const active = selectedMeal === meal
              const slotOccupant = slots[`${selectedDay}-${meal}`]
              return (
                <button
                  key={meal}
                  type="button"
                  onClick={() => setSelectedMeal(meal)}
                  className={`flex flex-col items-start rounded-2xl border p-3 text-left transition ${
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
            <strong>{selectedDay} {selectedMeal}</strong> currently has{' '}
            <em>{existingInTarget.name}</em> — confirming will swap it out.
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-cream-dark hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sage-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-sage-700"
          >
            {justAdded ? (
              <>
                <Check className="h-4 w-4" />
                Added!
              </>
            ) : (
              <>Save to {selectedDay} {selectedMeal}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
