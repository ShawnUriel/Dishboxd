// Explicit Google place types only: a cafe, burger shop or address does not establish a cuisine.
const CUISINE_TYPES = {
  filipino_restaurant: 'Filipino', japanese_restaurant: 'Japanese', ramen_restaurant: 'Japanese', sushi_restaurant: 'Japanese',
  japanese_curry_restaurant: 'Japanese', japanese_izakaya_restaurant: 'Japanese',
  korean_restaurant: 'Korean', korean_barbecue_restaurant: 'Korean',
  italian_restaurant: 'Italian', chinese_restaurant: 'Chinese', cantonese_restaurant: 'Chinese', dim_sum_restaurant: 'Chinese', chinese_noodle_restaurant: 'Chinese',
  thai_restaurant: 'Thai', vietnamese_restaurant: 'Vietnamese', pho_restaurant: 'Vietnamese',
  indian_restaurant: 'Indian', north_indian_restaurant: 'Indian', south_indian_restaurant: 'Indian',
  mexican_restaurant: 'Mexican', american_restaurant: 'American', french_restaurant: 'French',
  mediterranean_restaurant: 'Mediterranean', greek_restaurant: 'Greek',
  spanish_restaurant: 'Spanish', lebanese_restaurant: 'Lebanese', turkish_restaurant: 'Turkish',
  indonesian_restaurant: 'Indonesian', malaysian_restaurant: 'Malaysian', brazilian_restaurant: 'Brazilian',
}
function cuisineFromTypes(types, primaryType) {
  if (Object.hasOwn(CUISINE_TYPES, primaryType ?? '')) return CUISINE_TYPES[primaryType]
  const cuisines = [...new Set((Array.isArray(types) ? types : []).flatMap(type => Object.hasOwn(CUISINE_TYPES, type) ? [CUISINE_TYPES[type]] : []))]
  // With conflicting cuisines and no specific primary type, let the diner choose.
  return cuisines.length === 1 ? cuisines[0] : ''
}
module.exports = { cuisineFromTypes }
