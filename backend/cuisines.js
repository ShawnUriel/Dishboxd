// Explicit Google place types only: a cafe, burger shop or address does not establish a cuisine.
const CUISINE_TYPES = {
  filipino_restaurant: 'Filipino', japanese_restaurant: 'Japanese', ramen_restaurant: 'Japanese', sushi_restaurant: 'Japanese',
  japanese_curry_restaurant: 'Japanese', japanese_izakaya_restaurant: 'Japanese',
  korean_restaurant: 'Korean', korean_barbecue_restaurant: 'Korean',
  italian_restaurant: 'Italian', chinese_restaurant: 'Chinese', cantonese_restaurant: 'Cantonese', dim_sum_restaurant: 'Chinese', chinese_noodle_restaurant: 'Chinese',
  thai_restaurant: 'Thai', vietnamese_restaurant: 'Vietnamese', pho_restaurant: 'Vietnamese',
  indian_restaurant: 'Indian', north_indian_restaurant: 'North Indian', south_indian_restaurant: 'South Indian',
  mexican_restaurant: 'Mexican', american_restaurant: 'American', french_restaurant: 'French',
  mediterranean_restaurant: 'Mediterranean', greek_restaurant: 'Greek',
  spanish_restaurant: 'Spanish', lebanese_restaurant: 'Lebanese', turkish_restaurant: 'Turkish',
  indonesian_restaurant: 'Indonesian', malaysian_restaurant: 'Malaysian', brazilian_restaurant: 'Brazilian',
  afghani_restaurant: 'Afghan', african_restaurant: 'African', argentinian_restaurant: 'Argentinian',
  asian_fusion_restaurant: 'Asian Fusion', asian_restaurant: 'Asian', australian_restaurant: 'Australian',
  austrian_restaurant: 'Austrian', bangladeshi_restaurant: 'Bangladeshi', basque_restaurant: 'Basque',
  bavarian_restaurant: 'Bavarian', belgian_restaurant: 'Belgian', british_restaurant: 'British',
  burmese_restaurant: 'Burmese', cajun_restaurant: 'Cajun', californian_restaurant: 'Californian',
  cambodian_restaurant: 'Cambodian', caribbean_restaurant: 'Caribbean', chilean_restaurant: 'Chilean',
  colombian_restaurant: 'Colombian', croatian_restaurant: 'Croatian', cuban_restaurant: 'Cuban',
  czech_restaurant: 'Czech', danish_restaurant: 'Danish', dutch_restaurant: 'Dutch',
  eastern_european_restaurant: 'Eastern European', ethiopian_restaurant: 'Ethiopian', european_restaurant: 'European',
  fusion_restaurant: 'Fusion', german_restaurant: 'German', hawaiian_restaurant: 'Hawaiian',
  hungarian_restaurant: 'Hungarian', irish_restaurant: 'Irish', israeli_restaurant: 'Israeli',
  latin_american_restaurant: 'Latin American', middle_eastern_restaurant: 'Middle Eastern',
  moroccan_restaurant: 'Moroccan', pakistani_restaurant: 'Pakistani', persian_restaurant: 'Persian',
  peruvian_restaurant: 'Peruvian', polish_restaurant: 'Polish', portuguese_restaurant: 'Portuguese',
  romanian_restaurant: 'Romanian', russian_restaurant: 'Russian', scandinavian_restaurant: 'Scandinavian',
  soul_food_restaurant: 'Soul Food', south_american_restaurant: 'South American', southwestern_us_restaurant: 'Southwestern US',
  sri_lankan_restaurant: 'Sri Lankan', swiss_restaurant: 'Swiss', taiwanese_restaurant: 'Taiwanese',
  tex_mex_restaurant: 'Tex-Mex', tibetan_restaurant: 'Tibetan', ukrainian_restaurant: 'Ukrainian',
  western_restaurant: 'Western', tonkatsu_restaurant: 'Japanese', yakiniku_restaurant: 'Japanese', yakitori_restaurant: 'Japanese',
}
function cuisineFromTypes(types, primaryType) {
  if (Object.hasOwn(CUISINE_TYPES, primaryType ?? '')) return CUISINE_TYPES[primaryType]
  const cuisines = [...new Set((Array.isArray(types) ? types : []).flatMap(type => Object.hasOwn(CUISINE_TYPES, type) ? [CUISINE_TYPES[type]] : []))]
  // With conflicting cuisines and no specific primary type, let the diner choose.
  return cuisines.length === 1 ? cuisines[0] : ''
}
module.exports = { cuisineFromTypes, CUISINE_TYPES }
