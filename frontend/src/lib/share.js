// Shares a review's link: the phone's share sheet when there is one, otherwise the clipboard.
// The link opens for signed-in diners (shared reviews only).
export async function shareReview(review) {
  const url = `${window.location.origin}/review/${review.id}`
  const title = `${review.restaurant?.name || 'A meal'} on Dishboxd`
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}
