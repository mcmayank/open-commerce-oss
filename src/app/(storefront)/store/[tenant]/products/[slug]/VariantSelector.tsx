'use client'

import React, { useState } from 'react'
import { formatMoney } from '@/lib/money'
import { trackEvent } from '@/components/analytics/track'
import { toMajor } from '@/lib/analytics'
import { isInStock } from '@/lib/inventory'
import {
  resolveVariant,
  availableValues,
  variantPriceRange,
  isCompleteSelection,
  type ProductOption,
  type ProductVariant,
  type Selection,
} from '@/lib/variants'

interface VariantSelectorProps {
  options: ProductOption[]
  variants: ProductVariant[]
  currency: string
  productId: string
  productTitle: string
  /**
   * Forwarded from the product so each denomination is judged by `isInStock`
   * rather than its own `stock` column. Fixed denominations (50 / 100 / 200)
   * are the natural way to model a gift card, and every one of them sits at the
   * schema default of 0 — so gating here is the same bug one level down.
   */
  issuesGiftCard?: boolean | null
}

export default function VariantSelector({
  options,
  variants,
  currency,
  productId,
  productTitle,
  issuesGiftCard,
}: VariantSelectorProps) {
  // Legacy products (no axes) keep the original flat button list.
  if (!options || options.length === 0) {
    return (
      <FlatVariantSelector
        variants={variants}
        currency={currency}
        productId={productId}
        productTitle={productTitle}
        issuesGiftCard={issuesGiftCard}
      />
    )
  }

  return (
    <GroupedVariantSelector
      options={options}
      variants={variants}
      currency={currency}
      productId={productId}
      productTitle={productTitle}
      issuesGiftCard={issuesGiftCard}
    />
  )
}

function GroupedVariantSelector({
  options,
  variants,
  currency,
  productId,
  productTitle,
  issuesGiftCard,
}: VariantSelectorProps) {
  const [selection, setSelection] = useState<Selection>({})

  const complete = isCompleteSelection(selection, options)
  const resolved = complete ? resolveVariant(selection, variants, options) : null
  const range = variantPriceRange(variants)
  const outOfStock = !resolved || !isInStock({ issuesGiftCard }, resolved.stock)

  const priceLabel = resolved
    ? formatMoney(resolved.price, currency)
    : range.min === range.max
      ? formatMoney(range.min, currency)
      : `${formatMoney(range.min, currency)} – ${formatMoney(range.max, currency)}`

  // Set the chosen value for `axis`, then auto-clear any OTHER axis whose current
  // selection is no longer available for the new combination — so the shopper can
  // never sit on an impossible combo (a disabled value never stays "selected", and
  // a complete selection therefore always resolves to a real variant).
  const pick = (axis: string, value: string) =>
    setSelection((prev) => {
      if (prev[axis] === value) return prev
      const next: Selection = { ...prev, [axis]: value }
      for (const ax of options) {
        if (ax.name === axis) continue
        const chosen = next[ax.name]
        if (chosen && !availableValues(ax.name, next, variants, options).has(chosen)) {
          delete next[ax.name]
        }
      }
      return next
    })

  return (
    <div className="space-y-4">
      {options.map((axis) => {
        const available = availableValues(axis.name, selection, variants, options)
        return (
          <div key={axis.name} className="space-y-2">
            <p className="text-sm font-medium text-(--color-text)">{axis.name}</p>
            <div className="flex flex-wrap gap-2">
              {axis.values.map((val) => {
                const disabled = !available.has(val.value)
                const selected = selection[axis.name] === val.value
                return (
                  <button
                    key={val.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(axis.name, val.value)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 text-gray-700 hover:border-gray-500'
                    } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    {val.value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-2xl font-bold text-(--color-heading)">{priceLabel}</p>

      {complete &&
        (outOfStock ? (
          <p className="text-sm font-medium text-red-500">Out of stock</p>
        ) : (
          <p className="text-sm font-medium text-green-600">In stock</p>
        ))}

      <input type="hidden" name="variantId" value={resolved?.id ?? ''} />

      <button
        type="submit"
        disabled={!resolved || outOfStock}
        onClick={() =>
          resolved &&
          trackEvent('add_to_cart', {
            currency,
            value: toMajor(resolved.price),
            items: [
              {
                item_id: resolved.id ? `${productId}-${resolved.id}` : productId,
                item_name: `${productTitle} — ${resolved.title ?? ''}`,
                price: toMajor(resolved.price),
                quantity: 1,
              },
            ],
          })
        }
        className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {!complete ? 'Select options' : outOfStock ? 'Unavailable' : 'Add to Cart'}
      </button>
    </div>
  )
}

function FlatVariantSelector({
  variants,
  currency,
  productId,
  productTitle,
  issuesGiftCard,
}: Omit<VariantSelectorProps, 'options'>) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selected = variants[selectedIndex]
  const outOfStock = !isInStock({ issuesGiftCard }, selected.stock)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {variants.map((v, i) => (
          <button
            key={v.id ?? i}
            type="button"
            onClick={() => setSelectedIndex(i)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              i === selectedIndex
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-700 hover:border-gray-500'
            } ${isInStock({ issuesGiftCard }, v.stock) ? '' : 'opacity-50'}`}
          >
            {v.title}
          </button>
        ))}
      </div>

      <p className="text-2xl font-bold text-gray-900">{formatMoney(selected.price, currency)}</p>

      {outOfStock ? (
        <p className="text-sm font-medium text-red-500">Out of stock</p>
      ) : (
        <p className="text-sm font-medium text-green-600">In stock</p>
      )}

      <input type="hidden" name="variantId" value={selected.id ?? ''} />

      <button
        type="submit"
        disabled={outOfStock}
        onClick={() =>
          trackEvent('add_to_cart', {
            currency,
            value: toMajor(selected.price),
            items: [
              {
                item_id: selected.id ? `${productId}-${selected.id}` : productId,
                item_name: `${productTitle} — ${selected.title ?? ''}`,
                price: toMajor(selected.price),
                quantity: 1,
              },
            ],
          })
        }
        className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {outOfStock ? 'Unavailable' : 'Add to Cart'}
      </button>
    </div>
  )
}
