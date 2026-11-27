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
  Check,
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
import { useRecipes } from '../hooks/useRecipes'
import { buildShoppingList, formatShoppingListText } from '../lib/shopping'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSettings } from '../store/useSettings'
import {
  DAYS_OF_WEEK,
  MEAL_SLOTS,
  type PlanSlotKey,
  type Recipe,
} from '../types'

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
  const clearPlan = usePlan((s) => s.clearPlan)
  const toggleChecked = usePlan((s) => s.toggleChecked)

  const fridgeItems = useFridge((s) => s.items)
  const staples = useSettings((s) => s.staples)

  const [sidebarTab, setSidebarTab] = useState<'favourites' | 'recent'>('favourites')
  const [activeDragRecipe, setActiveDragRecipe] = useState<Recipe | null>(null)
  const [pickingSlot, setPickingSlot] = useState<PlanSlotKey | null>(null)
  const [modalFilter, setModalFilter] = useState('')
  const [copied, setCopied] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

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

  const plannedRecipesList = useMemo(() => {
    const list: Recipe[] = []
    for (const day of DAYS_OF_WEEK) {
      for (const meal of MEAL_SLOTS) {
        const r = slots[`${day}-${meal}`]
        if (r) list.push(r)
      }
    }
    return list
  }, [slots])

  const shoppingItems = useMemo(
    () => buildShoppingList(plannedRecipesList, fridgeItems, staples),
    [plannedRecipesList, fridgeItems, staples],
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
      // Fallback textarea copy if clipboard permission restricted
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
              Drag recipes onto any Lunch or Dinner slot — or click an empty slot to pick. Your shopping list updates live.
            </p>
          </div>
          {plannedRecipesList.length > 0 && (
            <button
              type="button"
              onClick={clearPlan}
              className="inline-flex items-center gap-1.5 rounded-xl border border-parchment bg-white px-3.5 py-2 text-xs font-semibold text-ink-muted transition hover:border-tomato-200 hover:bg-tomato-50 hover:text-tomato-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear week
            </button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Draggable Sidebar Palette */}
          <aside className="rounded-3xl border border-parchment bg-white p-5 shadow-xs lg:col-span-4 h-fit">
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
              Drag a recipe onto a day slot on the right:
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

          {/* Mon-Sun Grid */}
          <section className="space-y-4 lg:col-span-8">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="rounded-3xl border border-parchment bg-white/80 p-4 shadow-2xs"
                >
                  <h2 className="font-display text-lg font-semibold text-ink">{day}</h2>
                  <div className="mt-3 space-y-2.5">
                    {MEAL_SLOTS.map((meal) => {
                      const slotKey: PlanSlotKey = `${day}-${meal}`
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
              ))}
            </div>
          </section>
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
                  Duplicates merged across {plannedRecipesList.length} planned meal
                  {plannedRecipesList.length === 1 ? '' : 's'} · {fridgeItems.length} fridge item
                  {fridgeItems.length === 1 ? '' : 's'} &amp; {staples.length} pantry staples automatically subtracted.
                </p>
              </div>
            </div>

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

          {plannedRecipesList.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-parchment bg-cream/40 p-8 text-center text-sm text-ink-muted">
              Add at least one recipe to your weekly plan above to generate your shopping list.
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
                  Choose meal for {pickingSlot.replace('-', ' ')}
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
