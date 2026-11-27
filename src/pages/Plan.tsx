import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Calendar,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  GripVertical,
  Heart,
  History,
  RotateCcw,
  Search,
  ShoppingBasket,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AddToPlanModal } from '../components/AddToPlanModal'
import { DaySlot } from '../components/DaySlot'
import { OverviewCalendar } from '../components/OverviewCalendar'
import { RecipeImage } from '../components/RecipeImage'
import { useRecipes } from '../hooks/useRecipes'
import {
  formatLocalDate,
  formatShortDayDate,
  formatSlotLabel,
  formatWeekCompactRange,
  formatWeekRange,
  getWeekDates,
  getWeekdayShort,
  getWeekStartMonday,
  makeDatedSlotKey,
} from '../lib/dates'
import { buildShoppingList, formatShoppingListText } from '../lib/shopping'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSettings } from '../store/useSettings'
import { MEAL_SLOTS, type PlanSlotKey, type Recipe } from '../types'

function DraggablePaletteRecipe({
  recipe,
  onQuickPick,
}: {
  recipe: Recipe
  onQuickPick: (recipe: Recipe) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette::${recipe.id}`,
    data: { type: 'palette-recipe', recipe },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-2xl border border-parchment bg-white p-2 shadow-2xs transition hover:border-sage-400 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Drag ${recipe.name} to a day slot`}
        className="flex h-10 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink-subtle hover:bg-cream hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onQuickPick(recipe)}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-left transition hover:bg-cream/60"
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
          <RecipeImage
            recipe={recipe}
            alt=""
            className="h-full w-full object-cover"
            fallbackClassName="flex h-full w-full items-center justify-center"
            emojiClassName="text-lg"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-ink">{recipe.name}</p>
          <p className="text-[11px] text-ink-muted tabular-nums">
            {recipe.area} · {recipe.ingredients.length} ingr.
          </p>
        </div>
        <CalendarPlus className="h-4 w-4 shrink-0 text-sage-600" aria-hidden="true" />
      </button>
    </div>
  )
}

type PlanUndoAction =
  | {
      type: 'week'
      message: string
      slots: Partial<Record<PlanSlotKey, Recipe>>
      checkedItems: Record<string, boolean>
    }
  | {
      type: 'slot'
      message: string
      slotKey: PlanSlotKey
      recipe: Recipe
    }
  | {
      type: 'checked'
      message: string
      checkedItems: Record<string, boolean>
    }
  | {
      type: 'info'
      message: string
    }

export function Plan() {
  const { recipes, recipesById } = useRecipes()
  const favIds = useFavourites((s) => s.ids)
  const favMap = useFavourites((s) => s.recipesById)

  const slots = usePlan((s) => s.slots)
  const recentRecipes = usePlan((s) => s.recentRecipes)
  const checkedItems = usePlan((s) => s.checkedItems)
  const setSlot = usePlan((s) => s.setSlot)
  const removeSlot = usePlan((s) => s.removeSlot)
  const moveSlot = usePlan((s) => s.moveSlot)
  const clearWeek = usePlan((s) => s.clearWeek)
  const restorePlan = usePlan((s) => s.restorePlan)
  const toggleChecked = usePlan((s) => s.toggleChecked)
  const clearChecked = usePlan((s) => s.clearChecked)
  const restoreChecked = usePlan((s) => s.restoreChecked)

  const fridgeItems = useFridge((s) => s.items)
  const staples = useSettings((s) => s.staples)

  const [today] = useState<Date>(() => new Date())
  const todayYmd = useMemo(() => formatLocalDate(today), [today])
  const currentWeekStart = useMemo(() => getWeekStartMonday(today), [today])
  const currentWeekYmd = useMemo(
    () => formatLocalDate(currentWeekStart),
    [currentWeekStart],
  )

  const [weekStart, setWeekStart] = useState<Date>(() => currentWeekStart)
  const [calendarYear, setCalendarYear] = useState<number>(() => today.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState<number>(() => today.getMonth())
  const [selectedDateYmd, setSelectedDateYmd] = useState<string>(() => todayYmd)

  const [sidebarTab, setSidebarTab] = useState<'favourites' | 'recent'>('favourites')
  const [shoppingScope, setShoppingScope] = useState<'week' | 'all'>('week')
  const [activeDragRecipe, setActiveDragRecipe] = useState<Recipe | null>(null)
  const [pickingSlot, setPickingSlot] = useState<PlanSlotKey | null>(null)
  const [quickPickRecipe, setQuickPickRecipe] = useState<Recipe | null>(null)
  const [modalFilter, setModalFilter] = useState('')
  const [copied, setCopied] = useState(false)
  const [undoAction, setUndoAction] = useState<PlanUndoAction | null>(null)
  const modalSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!undoAction) return
    const timer = setTimeout(() => setUndoAction(null), 5500)
    return () => clearTimeout(timer)
  }, [undoAction])

  useEffect(() => {
    if (!pickingSlot) return
    modalSearchRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setPickingSlot(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pickingSlot])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const expandedWeekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const expandedWeekYmds = useMemo(
    () => expandedWeekDates.map((d) => formatLocalDate(d)),
    [expandedWeekDates],
  )
  const activeWeekStartYmd = formatLocalDate(weekStart)
  const isCurrentWeek = activeWeekStartYmd === currentWeekYmd

  // Scrollable week strip centered around the active week (-3..+4 weeks)
  const scrollableWeeks = useMemo(() => {
    return [-3, -2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const ws = new Date(weekStart)
      ws.setDate(ws.getDate() + offset * 7)
      const dates = getWeekDates(ws)
      const ymds = dates.map((d) => formatLocalDate(d))
      let plannedCount = 0
      for (const ymd of ymds) {
        for (const meal of MEAL_SLOTS) {
          if (slots[makeDatedSlotKey(ymd, meal)]) plannedCount += 1
        }
      }
      return {
        weekStart: ws,
        key: formatLocalDate(ws),
        label: formatWeekCompactRange(ws),
        isCurrent: formatLocalDate(ws) === currentWeekYmd,
        isActive: offset === 0,
        plannedCount,
      }
    })
  }, [weekStart, slots, currentWeekYmd])

  const selectWeek = (nextWeekStart: Date, focusDate?: Date) => {
    const normalizedStart = getWeekStartMonday(nextWeekStart)
    setWeekStart(normalizedStart)
    const syncTarget = focusDate ?? normalizedStart
    setCalendarYear(syncTarget.getFullYear())
    setCalendarMonth(syncTarget.getMonth())
    if (focusDate) {
      setSelectedDateYmd(formatLocalDate(focusDate))
    }
  }

  const shiftWeek = (deltaWeeks: number) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + deltaWeeks * 7)
    selectWeek(next)
  }

  const jumpToToday = () => {
    selectWeek(currentWeekStart, today)
  }

  const shiftCalendarMonth = (deltaMonths: number) => {
    const next = new Date(calendarYear, calendarMonth + deltaMonths, 1)
    setCalendarYear(next.getFullYear())
    setCalendarMonth(next.getMonth())
  }

  const favouriteList = useMemo(
    () =>
      favIds
        .map((id) => recipesById.get(id) ?? favMap[id])
        .filter((r): r is Recipe => Boolean(r)),
    [favIds, recipesById, favMap],
  )

  const recentOrStarterList = useMemo(() => {
    if (recentRecipes.length > 0) return recentRecipes
    return recipes.slice(0, 8)
  }, [recentRecipes, recipes])

  const expandedWeekRecipesList = useMemo(() => {
    const list: Recipe[] = []
    for (const ymd of expandedWeekYmds) {
      for (const meal of MEAL_SLOTS) {
        const r = slots[makeDatedSlotKey(ymd, meal)]
        if (r) list.push(r)
      }
    }
    return list
  }, [expandedWeekYmds, slots])

  const allPlannedRecipesList = useMemo(() => {
    return Object.entries(slots)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, recipe]) => recipe)
      .filter((r): r is Recipe => Boolean(r))
  }, [slots])

  const activeShoppingRecipes =
    shoppingScope === 'all' ? allPlannedRecipesList : expandedWeekRecipesList

  const shoppingItems = useMemo(
    () => buildShoppingList(activeShoppingRecipes, fridgeItems, staples),
    [activeShoppingRecipes, fridgeItems, staples],
  )

  const checkedCount = useMemo(
    () => shoppingItems.filter((item) => Boolean(checkedItems[item.key])).length,
    [shoppingItems, checkedItems],
  )

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { recipe?: Recipe } | undefined
    if (data?.recipe) {
      setActiveDragRecipe(data.recipe)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragRecipe(null)
    const { active, over } = event
    if (!over) return

    const targetSlotKey = over.id as PlanSlotKey
    const activeData = active.data.current as
      | { type: 'palette-recipe'; recipe: Recipe }
      | { type: 'slot-item'; slotKey: PlanSlotKey; recipe: Recipe }
      | undefined

    if (!activeData) return

    if (activeData.type === 'palette-recipe') {
      setSlot(targetSlotKey, activeData.recipe)
    } else if (activeData.type === 'slot-item') {
      moveSlot(activeData.slotKey, targetSlotKey)
    }
  }

  const handleRemoveSlot = (slotKey: PlanSlotKey) => {
    const existing = slots[slotKey]
    removeSlot(slotKey)
    if (existing) {
      setUndoAction({
        type: 'slot',
        message: `Removed "${existing.name}" from ${formatSlotLabel(slotKey)}.`,
        slotKey,
        recipe: existing,
      })
    }
  }

  const handleClearWeek = () => {
    if (expandedWeekRecipesList.length === 0) return
    const snapshotSlots = { ...slots }
    const snapshotChecked = { ...checkedItems }
    const count = expandedWeekRecipesList.length
    clearWeek(expandedWeekYmds)
    setUndoAction({
      type: 'week',
      message: `Cleared ${count} planned meal${count === 1 ? '' : 's'} from ${formatWeekRange(weekStart)}.`,
      slots: snapshotSlots,
      checkedItems: snapshotChecked,
    })
  }

  const handleClearChecked = () => {
    const snapshot = { ...checkedItems }
    clearChecked()
    setUndoAction({
      type: 'checked',
      message: 'Unchecked all shopping list items.',
      checkedItems: snapshot,
    })
  }

  const handleUndo = () => {
    if (!undoAction) return
    if (undoAction.type === 'week') {
      restorePlan(undoAction.slots, undoAction.checkedItems)
    } else if (undoAction.type === 'slot') {
      setSlot(undoAction.slotKey, undoAction.recipe)
    } else if (undoAction.type === 'checked') {
      restoreChecked(undoAction.checkedItems)
    }
    setUndoAction(null)
  }

  const handleCopyList = async () => {
    const text = formatShoppingListText(shoppingItems, checkedItems)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const modalChoices = useMemo(() => {
    const q = modalFilter.trim().toLowerCase()
    const pool = [...favouriteList, ...recentRecipes, ...recipes]
    const seen = new Set<string>()
    const deduped: Recipe[] = []
    for (const r of pool) {
      if (!seen.has(r.id)) {
        seen.add(r.id)
        if (
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.area.toLowerCase().includes(q)
        ) {
          deduped.push(r)
        }
      }
      if (deduped.length >= 24) break
    }
    return deduped
  }, [modalFilter, favouriteList, recentRecipes, recipes])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragRecipe(null)}
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">Weekly Meal Plan</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Check planned days on the calendar, scroll between weeks, and drag or tap recipes for Breakfast, Lunch, and Dinner.
            </p>
          </div>
          {expandedWeekRecipesList.length > 0 && (
            <button
              type="button"
              onClick={handleClearWeek}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-parchment bg-white px-3.5 py-2 text-xs font-semibold text-ink-muted transition hover:border-tomato-200 hover:bg-tomato-50 hover:text-tomato-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear week
            </button>
          )}
        </div>

        {undoAction && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm font-medium text-sage-800"
          >
            <span>{undoAction.message}</span>
            {undoAction.type !== 'info' && (
              <button
                type="button"
                onClick={handleUndo}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-sage-800 ring-1 ring-sage-200 hover:bg-sage-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Undo
              </button>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* Sticky Left Column: Overview Calendar + Favourites/Recent bubble moving together */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:col-span-4">
            <OverviewCalendar
              year={calendarYear}
              month={calendarMonth}
              todayYmd={todayYmd}
              selectedDateYmd={selectedDateYmd}
              expandedWeekYmds={expandedWeekYmds}
              slots={slots}
              onPrevMonth={() => shiftCalendarMonth(-1)}
              onNextMonth={() => shiftCalendarMonth(1)}
              onToday={jumpToToday}
              onSelectDate={(date) => selectWeek(date, date)}
            />

            {/* Draggable & Tap-to-Plan Sidebar Palette directly under the calendar */}
            <aside
              aria-label="Favourites and recent recipes"
              className="rounded-3xl border border-parchment bg-white p-5 shadow-xs"
            >
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1">
                <button
                  type="button"
                  onClick={() => setSidebarTab('favourites')}
                  className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold tabular-nums transition ${
                    sidebarTab === 'favourites'
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Heart className="h-3.5 w-3.5 text-tomato-500" />
                  Favourites ({favouriteList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('recent')}
                  className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold tabular-nums transition ${
                    sidebarTab === 'recent'
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <History className="h-3.5 w-3.5 text-sage-600" />
                  {recentRecipes.length > 0 ? 'Recent' : 'Ideas'} ({recentOrStarterList.length})
                </button>
              </div>

              <p className="mt-3 text-xs text-ink-muted">
                Drag by the handle onto a day slot, or tap a recipe to assign it:
              </p>

              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {(sidebarTab === 'favourites' ? favouriteList : recentOrStarterList).map(
                  (recipe) => (
                    <DraggablePaletteRecipe
                      key={recipe.id}
                      recipe={recipe}
                      onQuickPick={setQuickPickRecipe}
                    />
                  ),
                )}

                {sidebarTab === 'favourites' && favouriteList.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-parchment bg-cream/50 p-4 text-center text-xs text-ink-muted">
                    Heart recipes while browsing to keep them handy here, or switch to{' '}
                    <button
                      type="button"
                      onClick={() => setSidebarTab('recent')}
                      className="font-semibold text-sage-700 underline"
                    >
                      Ideas
                    </button>
                    .
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* Right Column: Expanded 1-Week Meal Grid (at most 1 week expanded at a time) */}
          <section
            aria-label="Expanded week meal plan"
            className="space-y-4 lg:col-span-8"
          >
            {/* Week Stepper & Scrollable Week Strip */}
            <div className="rounded-3xl border border-parchment bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous week"
                    onClick={() => shiftWeek(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-parchment bg-cream text-ink-muted transition hover:border-sage-300 hover:bg-white hover:text-ink"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-sage-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-semibold text-ink tabular-nums">
                      {formatWeekRange(weekStart)}
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Next week"
                    onClick={() => shiftWeek(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-parchment bg-cream text-ink-muted transition hover:border-sage-300 hover:bg-white hover:text-ink"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!isCurrentWeek && (
                    <button
                      type="button"
                      onClick={jumpToToday}
                      className="min-h-8 rounded-full border border-sage-300 bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-800 transition hover:bg-sage-100"
                    >
                      This week
                    </button>
                  )}
                  <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink-muted tabular-nums">
                    {expandedWeekRecipesList.length} meal
                    {expandedWeekRecipesList.length === 1 ? '' : 's'} planned
                  </span>
                </div>
              </div>

              {/* Scrollable week switcher bar */}
              <div
                aria-label="Scroll between weeks"
                className="mt-3 flex gap-2 overflow-x-auto pb-1"
              >
                {scrollableWeeks.map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => selectWeek(w.weekStart)}
                    aria-pressed={w.isActive}
                    className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition ${
                      w.isActive
                        ? 'border-sage-600 bg-sage-600 text-white shadow-2xs'
                        : w.isCurrent
                          ? 'border-sage-300 bg-sage-50 text-sage-800 hover:bg-sage-100'
                          : 'border-parchment bg-cream/60 text-ink-muted hover:border-sage-300 hover:bg-white hover:text-ink'
                    }`}
                  >
                    <span>{w.isCurrent ? `This week · ${w.label}` : w.label}</span>
                    {w.plannedCount > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          w.isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-sage-100 text-sage-800'
                        }`}
                      >
                        {w.plannedCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Linear Mon -> Sun Day Cards (Strictly 1 week expanded) */}
            <div className="space-y-3">
              {expandedWeekDates.map((dateObj) => {
                const ymd = formatLocalDate(dateObj)
                const weekday = getWeekdayShort(dateObj)
                const dateLabel = formatShortDayDate(dateObj)
                const isToday = ymd === todayYmd
                const isSelected = ymd === selectedDateYmd

                return (
                  <div
                    key={ymd}
                    data-plan-date={ymd}
                    className={`rounded-3xl border p-4 shadow-2xs transition ${
                      isToday
                        ? 'border-sage-400 bg-white ring-1 ring-sage-400/30'
                        : isSelected
                          ? 'border-sage-300 bg-white'
                          : 'border-parchment bg-white/85'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <h3 className="font-display text-lg font-semibold text-ink">
                          {weekday}
                        </h3>
                        <span className="text-xs font-medium text-ink-muted tabular-nums">
                          {dateLabel}
                        </span>
                      </div>
                      {isToday && (
                        <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-bold text-sage-800">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      {MEAL_SLOTS.map((meal) => {
                        const slotKey = makeDatedSlotKey(ymd, meal)
                        return (
                          <DaySlot
                            key={slotKey}
                            slotKey={slotKey}
                            meal={meal}
                            recipe={slots[slotKey]}
                            onEmptyClick={setPickingSlot}
                            onRemove={handleRemoveSlot}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Consolidated Smart Shopping List */}
        <section className="rounded-3xl border border-parchment bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
                <ShoppingBasket className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-ink tabular-nums">
                  Shopping List ({shoppingItems.length})
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                  Duplicates merged across {activeShoppingRecipes.length} planned meal
                  {activeShoppingRecipes.length === 1 ? '' : 's'} · {fridgeItems.length} fridge item
                  {fridgeItems.length === 1 ? '' : 's'} &amp; {staples.length} pantry staples automatically subtracted.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {allPlannedRecipesList.length > expandedWeekRecipesList.length && (
                <div className="inline-flex rounded-full border border-parchment bg-cream p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setShoppingScope('week')}
                    className={`rounded-full px-3 py-1.5 font-semibold tabular-nums transition ${
                      shoppingScope === 'week'
                        ? 'bg-white text-ink shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    This week ({expandedWeekRecipesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShoppingScope('all')}
                    className={`rounded-full px-3 py-1.5 font-semibold tabular-nums transition ${
                      shoppingScope === 'all'
                        ? 'bg-white text-ink shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    All planned ({allPlannedRecipesList.length})
                  </button>
                </div>
              )}

              {checkedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearChecked}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-2xl border border-parchment bg-white px-3.5 py-2 text-xs font-semibold text-ink-muted transition hover:border-sage-300 hover:text-ink"
                >
                  Uncheck ({checkedCount})
                </button>
              )}
              {shoppingItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyList}
                  className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-sage-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-sage-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied to clipboard!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="h-4 w-4" />
                      Copy shopping list
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {shoppingItems.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-dark">
                <div
                  className="h-full rounded-full bg-sage-600 transition-all duration-200"
                  style={{
                    width: `${Math.round((checkedCount / shoppingItems.length) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs font-medium text-ink-muted tabular-nums">
                {checkedCount} of {shoppingItems.length} bought
              </span>
            </div>
          )}

          {activeShoppingRecipes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-parchment bg-cream/40 p-8 text-center text-sm text-ink-muted">
              Add at least one recipe to{' '}
              {shoppingScope === 'week' ? 'this week’s plan' : 'your meal plan'} above to generate your shopping list.
            </div>
          ) : shoppingItems.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-sage-200 bg-sage-50 p-6 text-center text-sm font-medium text-sage-800">
              You already have every ingredient needed in your fridge and pantry staples — nothing to buy!
            </div>
          ) : (
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {shoppingItems.map((item) => {
                const checked = Boolean(checkedItems[item.key])
                return (
                  <li key={item.key}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                        checked
                          ? 'border-parchment/70 bg-cream/60 opacity-65'
                          : 'border-parchment bg-cream/25 hover:border-sage-300 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChecked(item.key)}
                        className="mt-0.5 h-4 w-4 rounded border-parchment accent-sage-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span
                            className={`text-sm font-semibold text-ink ${
                              checked ? 'line-through' : ''
                            }`}
                          >
                            {item.name}
                          </span>
                          {item.measures.length > 0 && (
                            <span className="rounded-md bg-sage-50 px-2 py-0.5 text-[11px] font-semibold text-sage-800 tabular-nums">
                              {item.measures.join(' + ')}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-ink-subtle">
                          For: {item.recipeNames.join(', ')}
                        </p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragRecipe ? (
          <div className="flex w-60 items-center gap-2.5 rounded-2xl border-2 border-sage-500 bg-white p-2.5 shadow-xl">
            <GripVertical className="h-4 w-4 text-sage-600" />
            <span className="truncate text-xs font-bold text-ink">
              {activeDragRecipe.name}
            </span>
          </div>
        ) : null}
      </DragOverlay>

      {/* Tap-to-plan modal from sidebar recipe */}
      <AddToPlanModal
        recipe={quickPickRecipe}
        onClose={() => setQuickPickRecipe(null)}
        onAdded={(slotKey, addedRecipe) => {
          setUndoAction({
            type: 'info',
            message: `Planned "${addedRecipe.name}" for ${formatSlotLabel(slotKey)}.`,
          })
        }}
      />

      {/* Click-a-slot Recipe Selector Modal */}
      {pickingSlot && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="slot-picker-heading"
          onClick={() => setPickingSlot(null)}
        >
          <div
            className="pb-safe max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-parchment bg-cream p-5 shadow-2xl sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="slot-picker-heading" className="font-display text-xl font-semibold text-ink">
                  Choose meal for {formatSlotLabel(pickingSlot)}
                </h2>
                <p className="text-xs text-ink-muted">
                  Pick from your favourites, recent matches, or search all recipes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickingSlot(null)}
                aria-label="Close slot picker"
                className="flex min-h-10 min-w-10 items-center justify-center rounded-full p-1.5 text-ink-muted hover:bg-cream-dark hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-ink-subtle" />
              <input
                ref={modalSearchRef}
                type="text"
                value={modalFilter}
                onChange={(e) => setModalFilter(e.target.value)}
                placeholder="Search recipes by name, cuisine, or category..."
                className="w-full rounded-xl border border-parchment bg-white py-2.5 pr-9 pl-10 text-sm text-ink placeholder:text-ink-subtle focus:border-sage-500 focus:outline-none"
              />
              {modalFilter && (
                <button
                  type="button"
                  onClick={() => setModalFilter('')}
                  aria-label="Clear recipe filter"
                  className="absolute top-2.5 right-2.5 rounded-full p-1 text-ink-subtle hover:bg-cream hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {modalChoices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-parchment bg-white/60 p-6 text-center text-xs text-ink-muted">
                  No recipes matched &ldquo;{modalFilter.trim()}&rdquo;.{' '}
                  <button
                    type="button"
                    onClick={() => setModalFilter('')}
                    className="font-semibold text-sage-700 underline"
                  >
                    Show all choices
                  </button>
                </div>
              ) : (
                modalChoices.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSlot(pickingSlot, r)
                      setPickingSlot(null)
                      setModalFilter('')
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-parchment bg-white p-2.5 text-left transition hover:border-sage-400 hover:bg-sage-50/50"
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                      <RecipeImage
                        recipe={r}
                        alt=""
                        className="h-full w-full object-cover"
                        fallbackClassName="flex h-full w-full items-center justify-center"
                        emojiClassName="text-xl"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                      <p className="text-xs text-ink-muted tabular-nums">
                        {r.area} · {r.category} · {r.ingredients.length} ingredients
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </DndContext>
  )
}
