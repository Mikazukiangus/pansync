import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MealSlotType, PlanSlotKey, Recipe } from '../types'

interface DaySlotProps {
  slotKey: PlanSlotKey
  meal: MealSlotType
  recipe?: Recipe
  onEmptyClick: (slotKey: PlanSlotKey) => void
  onRemove: (slotKey: PlanSlotKey) => void
}

export function DaySlot({
  slotKey,
  meal,
  recipe,
  onEmptyClick,
  onRemove,
}: DaySlotProps) {
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: slotKey,
    data: { type: 'slot-drop', slotKey },
  })

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `slot-drag::${slotKey}`,
    data: { type: 'slot-item', slotKey, recipe },
    disabled: !recipe,
  })

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined

  return (
    <div
      ref={setDropRef}
      data-slot-key={slotKey}
      className={`rounded-2xl border p-2.5 transition ${
        isOver
          ? 'border-sage-500 bg-sage-50 ring-2 ring-sage-500/25'
          : recipe
            ? 'border-parchment bg-white'
            : 'border-dashed border-parchment bg-cream/40 hover:border-sage-300 hover:bg-white/70'
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-ink-subtle uppercase">
          {meal}
        </span>
        {recipe && (
          <button
            type="button"
            onClick={() => onRemove(slotKey)}
            aria-label={`Clear ${slotKey}`}
            className="rounded-full p-0.5 text-ink-subtle transition hover:bg-tomato-50 hover:text-tomato-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {recipe ? (
        <div
          ref={setDragRef}
          style={style}
          className={`flex items-center gap-2 rounded-xl bg-cream/70 p-2 ${
            isDragging ? 'opacity-40' : ''
          }`}
        >
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`Drag ${recipe.name}`}
            className="cursor-grab touch-none text-ink-subtle hover:text-ink active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {recipe.image ? (
            <img
              src={recipe.image}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-lg">
              {recipe.emoji ?? '🍲'}
            </div>
          )}

          <Link
            to={`/recipe/${recipe.id}`}
            className="line-clamp-2 flex-1 text-xs leading-snug font-semibold text-ink hover:text-sage-700 hover:underline"
          >
            {recipe.name}
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onEmptyClick(slotKey)}
          className="flex w-full items-center justify-center gap-1 rounded-xl py-3 text-xs font-medium text-ink-muted transition hover:text-sage-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Choose meal
        </button>
      )}
    </div>
  )
}
