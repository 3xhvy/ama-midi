import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PRODUCT_TOUR_STORAGE_KEY,
  completeProductTour,
  hasSeenProductTour,
  markProductTourSeen,
} from '../src/features/onboarding/product-tour-storage.ts'

test('product tour uses dedicated storage key', () => {
  assert.equal(PRODUCT_TOUR_STORAGE_KEY, 'ama-product-tour-seen')
})

test('markProductTourSeen persists and hasSeenProductTour reads it', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  }

  assert.equal(hasSeenProductTour(storage as Storage), false)
  markProductTourSeen(storage as Storage)
  assert.equal(hasSeenProductTour(storage as Storage), true)
})

test('completeProductTour is no-op without window', () => {
  assert.doesNotThrow(() => completeProductTour(undefined))
})
