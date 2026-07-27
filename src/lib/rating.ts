const RATING_ICON: Record<string, string> = {
  good: '🟢',
  'needs-improvement': '🟠',
  poor: '🔴'
}

/** The traffic light for a metric's rating; ⚪ for anything unrated. */
export function ratingIcon(rating?: string): string {
  return (rating && RATING_ICON[rating]) || '⚪'
}
