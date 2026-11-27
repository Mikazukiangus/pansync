import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  GripVertical,
  Heart,
  History,
  Search,
  ShoppingBasket,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { DaySlot } from '../components/DaySlot'
import { OverviewCalendar } from '../components/OverviewCalendar'
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
  onQuickPick?: (recipe: Recipe) => void
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
      {...listeners}
      {...attributes}
      onClick={() => onQuickPick?.(recipe)}
      className={`flex cursor-grab touch-none items-center gap-2.5 rounded-2xl border border-parchment bg-white p-2.5 shadow-2xs transition hover:border-sage-400 active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-ink-subtle" />
      {recipe.image ? (
        <img
          src={recipe.image}
          alt=""
          className="h-10 w-10 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-lg">
          {recipe.emoji ?? '🍲'}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-ink">{recipe.name}</p>
        <p className="text-[11px] text-ink-muted">
          {recipe.area} · {recipe.ingredients.length} ingr.
        </p>
      </div>
    </div>
  )
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
  const toggleChecked = usePlan((s) => s.toggleChecked)

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
  const [modalFilter, setModalFilter] = useState('')
  const [copied, setCopied] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
        if (!q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)) {
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
              Check planned days on the calendar, scroll between weeks, and drag or pick recipes for Breakfast, Lunch, and Dinner.
            </p>
          </div>
          {expandedWeekRecipesList.length > 0 && (
            <button
              type="button"
              onClick={() => clearWeek(expandedWeekYmds)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-parchment bg-white px-3.5 py-2 text-xs font-semibold text-ink-muted transition hover:border-tomato-200 hover:bg-tomato-50 hover:text-tomato-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear week
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* Overview Calendar */}
          <div className="order-1 lg:col-span-4 lg:col-start-1 lg:row-start-1">
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
          </div>

          {/* Expanded 1-Week Meal Grid (at most 1 week expanded at a time) */}
          <section
            aria-label="Expanded week meal plan"
            className="order-2 space-y-4 lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:row-start-1"
          >
            {/* Week Stepper & Scrollable Week Strip */}
            <div className="rounded-3xl border border-parchment bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous week"
                    onClick={() => shiftWeek(-1)}
                    className="rounded-full border border-parchment bg-cream p-1.5 text-ink-muted transition hover:border-sage-300 hover:bg-white hover:text-ink"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-sage-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-semibold text-ink">
                      {formatWeekRange(weekStart)}
                    </h2>
                  </div>

                  <button
                    type="button"
                    aria-label="Next week"
                    onClick={() => shiftWeek(1)}
                    className="rounded-full border border-parchment bg-cream p-1.5 text-ink-muted transition hover:border-sage-300 hover:bg-white hover:text-ink"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!isCurrentWeek && (
                    <button
                      type="button"
                      onClick={jumpToToday}
                      className="rounded-full border border-sage-300 bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-800 transition hover:bg-sage-100"
                    >
                      This week
                    </button>
                  )}
                  <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink-muted">
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
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
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
                            : 'bg-sage-200/80 text-sage-800'
                        }`}
                      >
                        {w.plannedCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Strictly 1 expanded week (7 days Mon–Sun) in linear top-to-bottom order */}
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
                        ? 'border-sage-400 bg-white ring-2 ring-sage-200/80'
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
                        <span className="text-xs font-medium text-ink-muted">
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
                            onRemove={removeSlot}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Draggable Sidebar Palette */}
          <aside className="order-3 rounded-3xl border border-parchment bg-white p-5 shadow-xs lg:col-span-4 lg:col-start-1 lg:row-start-2">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1">
              <button
                type="button"
                onClick={() => setSidebarTab('favourites')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
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
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
                  sidebarTab === 'recent'
                    ? 'bg-white text-ink shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <History className="h-3.5 w-3.5 text-sage-600" />
                Recent ({recentOrStarterList.length})
              </button>
            </div>

            <p className="mt-3 text-xs text-ink-muted">
              Drag a recipe onto any day slot in the expanded week:
            </p>

            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {sidebarTab === 'favourites' ? (
                favouriteList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-parchment p-5 text-center text-xs text-ink-muted">
                    No favourites yet. Switch to <strong>Recent</strong> or click any slot to search recipes!
                  </div>
                ) : (
                  favouriteList.map((recipe) => (
                    <DraggablePaletteRecipe key={recipe.id} recipe={recipe} />
                  ))
                )
              ) : (
                recentOrStarterList.map((recipe) => (
                  <DraggablePaletteRecipe key={recipe.id} recipe={recipe} />
                ))
              )}
            </div>
          </aside>
        </div>

        {/* Consolidated Smart Shopping List */}
        <section className="rounded-3xl border border-parchment bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
                <ShoppingBasket className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-ink">
                  Shopping List ({shoppingItems.length})
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
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
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
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
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
                      shoppingScope === 'all'
                        ? 'bg-white text-ink shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    All planned ({allPlannedRecipesList.length})
                  </button>
                </div>
              )}

              {shoppingItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyList}
                  className="inline-flex items-center gap-2 rounded-2xl bg-sage-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-sage-700"
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

          {activeShoppingRecipes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-parchment bg-cream/40 p-8 text-center text-sm text-ink-muted">
              Add at least one recipe to {shoppingScope === 'week' ? 'this week’s plan' : 'your meal plan'} above to generate your shopping list.
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
                            <span className="rounded-md bg-sage-50 px-2 py-0.5 text-[11px] font-semibold text-sage-800">
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

      {/* Click-a-slot Recipe Selector Modal */}
      {pickingSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="slot-picker-heading"
          onClick={() => setPickingSlot(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-parchment bg-cream p-6 shadow-2xl"
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
                className="rounded-full p-1.5 text-ink-muted hover:bg-cream-dark hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-ink-subtle" />
              <input
                type="text"
                value={modalFilter}
                onChange={(e) => setModalFilter(e.target.value)}
                placeholder="Search recipes by name or category..."
                className="w-full rounded-xl border border-parchment bg-white py-2.5 pr-4 pl-10 text-sm text-ink placeholder:text-ink-subtle focus:border-sage-500 focus:outline-none"
              />
            </div>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {modalChoices.map((r) => (
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
                  {r.image ? (
                    <img
                      src={r.image}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-xl">
                      {r.emoji ?? '🍲'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                    <p className="text-xs text-ink-muted">
                      {r.area} · {r.category} · {r.ingredients.length} ingredients
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </DndContext>
  )
}
