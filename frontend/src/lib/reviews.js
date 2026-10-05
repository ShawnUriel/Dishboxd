// Review cards report changes as a partial review ({ id, likeCount, liked } or { id, stickers }).
// This merges one into a list, leaving the other reviews as they were.
export function mergeReview(list, partial) {
  return list.map((review) => (review.id === partial.id ? { ...review, ...partial } : review))
}
