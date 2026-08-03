import pc from 'picocolors'

/** The traffic light for a metric's rating; dim ○ for anything unrated. */
export function ratingIcon(rating?: string): string {
  switch (rating) {
    case 'good':
      return pc.green('●')
    case 'needs-improvement':
      return pc.yellow('▪')
    case 'poor':
      return pc.red('▲')
    default:
      return pc.dim('○')
  }
}
