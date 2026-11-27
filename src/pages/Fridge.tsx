import {
  Check,
  Flame,
  Pencil,
  Plus,
  Refrigerator,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { useRecipes } from '../hooks/useRecipes'
import {
  addDaysToDate,
  daysUntil,
  formatReadableDate,
  getExpiryStatus,
  sortFridgeItemsByExpiry,
} from '../lib/dates'
import { normalize } from '../lib/matching'
import { useFridge } from '../store/useFridge'
import { useSearch } from '../store/useSearch'
import type { FridgeItem } from '../types'

type FridgeFilter = 'all' | 'urgent' | 'fresh'

export function Fridge() {
  const navigate = useNavigate()
  const { ingredientSuggestions } = useRecipes()
  const items = useFridge((s) => s.items)
  const addItem = useFridge((s) => s.addItem)
  const updateItem = useFridge((s) => s.updateItem)
  const removeItem = useFridge((s) => s.removeItem)
  const markUsed = useFridge((s) => s.markUsed)
  const restoreItem = useFridge((s) => s.restoreItem)
  const restoreItems = useFridge((s) => s.restoreItems)
  const clearFridge = useFridge((s) => s.clearFridge)
  const loadSampleFridge = useFridge((s) => s.loadSampleFridge)

  const setFridgeMode = useSearch((s) => s.setFridgeMode)
  const setMaxMissing = useSearch((s) => s.setMaxMissing)

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [useBy, setUseBy] = useState(() => addDaysToDate(3))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editUseBy, setEditUseBy] = useState('')
  const [filter, setFilter] = useState<FridgeFilter>('all')
  const [undoToast, setUndoToast] = useState<{
    message: string
    items: FridgeItem[]
  } | null>(null)

  useEffect(() => {
    if (!undoToast) return
    const timer = setTimeout(() => setUndoToast(null), 5000)
    return () => clearTimeout(timer)
  }, [undoToast])

  const sortedItems = useMemo(() => sortFridgeItemsByExpiry(items), [items])

  const filteredItems = useMemo(() => {
    if (filter === 'all') return sortedItems
    return sortedItems.filter((item) => {
      const status = getExpiryStatus(item.useBy)
      if (filter === 'urgent') {
        return status === 'expired' || status === 'today' || status === 'soon'
      }
      return status === 'fine' || status === 'none'
    })
  }, [sortedItems, filter])

  const counts = useMemo(() => {
    let expiredOrToday = 0
    let soon = 0
    let fine = 0
    for (const item of items) {
      const status = getExpiryStatus(item.useBy)
      if (status === 'expired' || status === 'today') expiredOrToday++
      else if (status === 'soon') soon++
      else fine++
    }
    return { expiredOrToday, soon, fine }
  }, [items])

  // Error prevention hints while typing
  const duplicateMatch = useMemo(() => {
    const norm = normalize(name)
    if (!norm) return null
    return items.find((item) => normalize(item.name) === norm) ?? null
  }, [name, items])

  const isPastDate = useMemo(() => {
    if (!useBy) return false
    const diff = daysUntil(useBy)
    return diff !== null && diff < 0
  }, [useBy])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addItem({ name, quantity: quantity || '1', useBy })
    setName('')
    setQuantity('')
    setUseBy(addDaysToDate(3))
  }

  const startEdit = (item: FridgeItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditQuantity(item.quantity)
    setEditUseBy(item.useBy)
  }

  const saveEdit = (id: string) => {
    if (!editName.trim()) return
    updateItem(id, {
      name: editName,
      quantity: editQuantity || '1',
      useBy: editUseBy,
    })
    setEditingId(null)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingId(null)
    }
  }

  const handleMarkUsed = (item: FridgeItem) => {
    markUsed(item.id)
    setUndoToast({
      message: `Marked "${item.name}" as cooked & used up.`,
      items: [item],
    })
  }

  const handleDeleteItem = (item: FridgeItem) => {
    removeItem(item.id)
    setUndoToast({
      message: `Removed "${item.name}" from your fridge.`,
      items: [item],
    })
  }

  const handleClearAll = () => {
    if (items.length === 0) return
    const snapshot = [...items]
    clearFridge()
    setUndoToast({
      message: `Cleared ${snapshot.length} fridge item${snapshot.length === 1 ? '' : 's'}.`,
      items: snapshot,
    })
  }

  const handleUndo = () => {
    if (!undoToast) return
    if (undoToast.items.length === 1) {
      restoreItem(undoToast.items[0])
    } else {
      restoreItems(undoToast.items)
    }
    setUndoToast(null)
  }

  const handleCookExpiring = () => {
    setFridgeMode(true)
    setMaxMissing(null)
    navigate('/')
  }

  return (
    <div className="space-y-8">
      {/* Header + Cook with what's expiring CTA */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Fridge Tracker</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Track leftovers and use-by dates so expiring ingredients jump to the top of your recipe matches.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-parchment bg-white px-4 py-2.5 text-xs font-semibold text-ink-muted transition hover:border-tomato-200 hover:bg-tomato-50 hover:text-tomato-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
            <button
              type="button"
              onClick={handleCookExpiring}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-tomato-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-tomato-700"
            >
              <Flame className="h-4 w-4" />
              Cook with what&rsquo;s expiring
            </button>
          </div>
        )}
      </div>

      {/* Status summary cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
          <div className="rounded-2xl border border-tomato-200 bg-tomato-50/70 p-3.5">
            <span className="text-xs font-semibold text-tomato-700">Expired / Today</span>
            <p className="mt-1 font-display text-2xl font-bold text-tomato-700 tabular-nums">
              {counts.expiredOrToday}
            </p>
          </div>
          <div className="rounded-2xl border border-honey-500/30 bg-honey-50 p-3.5">
            <span className="text-xs font-semibold text-honey-700">≤ 3 days</span>
            <p className="mt-1 font-display text-2xl font-bold text-honey-700 tabular-nums">
              {counts.soon}
            </p>
          </div>
          <div className="rounded-2xl border border-sage-200 bg-sage-50 p-3.5">
            <span className="text-xs font-semibold text-sage-800">Fresh</span>
            <p className="mt-1 font-display text-2xl font-bold text-sage-800 tabular-nums">
              {counts.fine}
            </p>
          </div>
        </div>
      )}

      {/* Add item form */}
      <section className="rounded-3xl border border-parchment bg-white p-6 shadow-xs">
        <h2 className="font-display text-lg font-semibold text-ink">Add to fridge</h2>
        <form onSubmit={handleAdd} className="mt-4 grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label htmlFor="fridge-item-name" className="block text-xs font-semibold text-ink-muted">
              Ingredient
            </label>
            <input
              id="fridge-item-name"
              list="fridge-ingredient-datalist"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Baby Spinach, Cooked Rice..."
              className="mt-1 w-full rounded-xl border border-parchment bg-cream/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-sage-500 focus:bg-white focus:outline-none"
            />
            <datalist id="fridge-ingredient-datalist">
              {ingredientSuggestions.slice(0, 200).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="fridge-item-qty" className="block text-xs font-semibold text-ink-muted">
              Quantity
            </label>
            <input
              id="fridge-item-qty"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 200g, 2 cups, 4"
              className="mt-1 w-full rounded-xl border border-parchment bg-cream/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-sage-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="fridge-item-date" className="block text-xs font-semibold text-ink-muted">
              Use-by date
            </label>
            <input
              id="fridge-item-date"
              type="date"
              value={useBy}
              onChange={(e) => setUseBy(e.target.value)}
              className="mt-1 w-full rounded-xl border border-parchment bg-cream/50 px-3 py-2.5 text-sm text-ink focus:border-sage-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-end sm:col-span-1">
            <button
              type="submit"
              aria-label="Add fridge item"
              className="inline-flex h-[42px] w-full items-center justify-center gap-1 rounded-xl bg-sage-600 px-4 text-sm font-semibold text-white transition hover:bg-sage-700"
            >
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">Add item</span>
            </button>
          </div>
        </form>

        {/* Error-prevention hints */}
        {(duplicateMatch || isPastDate) && (
          <div className="mt-2.5 space-y-1 text-xs font-medium text-honey-700">
            {duplicateMatch && (
              <p>
                Heads up: <strong>{duplicateMatch.name}</strong> ({duplicateMatch.quantity}) is already in your fridge — adding will create a separate entry.
              </p>
            )}
            {isPastDate && (
              <p>
                Heads up: {formatReadableDate(useBy)} is in the past. Double-check the date if this is fresh produce.
              </p>
            )}
          </div>
        )}

        {/* Quick date shortcuts */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ink-muted">Quick use-by:</span>
          {[
            { label: 'Today', offset: 0 },
            { label: 'Tomorrow', offset: 1 },
            { label: 'In 3 days', offset: 3 },
            { label: 'In 1 week', offset: 7 },
            { label: 'No date', offset: null },
          ].map((preset) => {
            const targetVal = preset.offset === null ? '' : addDaysToDate(preset.offset)
            const active = useBy === targetVal
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setUseBy(targetVal)}
                className={`min-h-8 rounded-full border px-3 py-1 font-medium transition ${
                  active
                    ? 'border-sage-500 bg-sage-50 text-sage-800'
                    : 'border-parchment bg-cream/70 text-ink-muted hover:border-sage-400 hover:text-ink'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </section>

      {undoToast && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm font-medium text-sage-800"
        >
          <span>{undoToast.message}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-sage-800 ring-1 ring-sage-200 transition hover:bg-sage-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
      )}

      {/* Filter tabs when fridge has several items */}
      {items.length > 4 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter fridge items by freshness"
            className="inline-flex items-center gap-1 rounded-xl bg-cream-dark/70 p-1"
          >
            {(
              [
                { key: 'all', label: `All (${items.length})` },
                {
                  key: 'urgent',
                  label: `Expiring soon (${counts.expiredOrToday + counts.soon})`,
                },
                { key: 'fresh', label: `Fresh (${counts.fine})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={filter === tab.key}
                onClick={() => setFilter(tab.key)}
                className={`min-h-8 rounded-lg px-3 py-1 text-xs font-semibold tabular-nums transition ${
                  filter === tab.key
                    ? 'bg-white text-ink shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fridge Items List or Empty State */}
      {sortedItems.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-parchment bg-white/75 px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
            <Refrigerator className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
            Your fridge tracker is empty
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Log leftovers and fresh produce with use-by dates — PanSync highlights what needs cooking today and subtracts everything here from your weekly shopping list.
          </p>
          <button
            type="button"
            onClick={() => loadSampleFridge()}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-sage-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-sage-700"
          >
            <Sparkles className="h-4 w-4" />
            Load sample fridge
          </button>
        </section>
      ) : filteredItems.length === 0 ? (
        <section className="rounded-3xl border border-parchment bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink-muted">
            No items match that freshness filter right now.
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-3 min-h-9 rounded-xl bg-sage-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sage-700"
          >
            Show all items
          </button>
        </section>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-parchment bg-white shadow-xs">
          <ul className="divide-y divide-parchment/70">
            {filteredItems.map((item) => {
              const isEditing = editingId === item.id

              if (isEditing) {
                return (
                  <li key={item.id} className="bg-cream/50 p-4 sm:px-6">
                    <div className="grid gap-3 sm:grid-cols-12">
                      <input
                        type="text"
                        aria-label="Edit ingredient name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                        className="rounded-xl border border-parchment bg-white px-3 py-2 text-sm sm:col-span-4"
                      />
                      <input
                        type="text"
                        aria-label="Edit quantity"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                        className="rounded-xl border border-parchment bg-white px-3 py-2 text-sm sm:col-span-3"
                      />
                      <input
                        type="date"
                        aria-label="Edit use-by date"
                        value={editUseBy}
                        onChange={(e) => setEditUseBy(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                        className="rounded-xl border border-parchment bg-white px-3 py-2 text-sm sm:col-span-3"
                      />
                      <div className="flex items-center justify-end gap-2 sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(item.id)}
                          aria-label="Save changes"
                          className="min-h-9 rounded-xl bg-sage-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sage-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel editing"
                          className="flex min-h-9 min-w-9 items-center justify-center rounded-xl border border-parchment bg-white p-2 text-ink-muted hover:text-ink"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              }

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-cream/40 sm:px-6"
                >
                  <div className="min-w-44">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-semibold text-ink">{item.name}</span>
                      <span className="rounded-lg bg-cream px-2 py-0.5 text-xs font-medium text-ink-muted">
                        {item.quantity}
                      </span>
                      <ExpiryBadge useBy={item.useBy} />
                    </div>
                    {item.useBy && (
                      <p className="mt-1 text-xs text-ink-subtle">
                        Use by {formatReadableDate(item.useBy)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMarkUsed(item)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-sage-200 bg-sage-50 px-3 py-1.5 text-xs font-semibold text-sage-800 transition hover:bg-sage-600 hover:text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Used
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`Edit ${item.name}`}
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-xl p-2 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      aria-label={`Delete ${item.name}`}
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-xl p-2 text-ink-muted transition hover:bg-tomato-50 hover:text-tomato-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
