export const PRODUCT_TOUR_STORAGE_KEY = 'ama-product-tour-seen'

export function hasSeenProductTour(storage: Pick<Storage, 'getItem'>): boolean {
  return storage.getItem(PRODUCT_TOUR_STORAGE_KEY) === 'true'
}

export function markProductTourSeen(storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(PRODUCT_TOUR_STORAGE_KEY, 'true')
}

export function completeProductTour(win: Window | undefined): void {
  if (!win) return
  markProductTourSeen(win.localStorage)
}
