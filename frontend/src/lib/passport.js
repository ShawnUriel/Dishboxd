// Cuisine stamps are earned from saved reviews, never from bookmarks or unvisited places.
// Explicit aliases recognise cuisine-specific categories without guessing from a dish/name.
const ORIGINAL_CUISINES = [
  { id: 'filipino', name: 'Filipino', aliases: ['filipino', 'philippine', 'pinoy'], icon: 'plate', color: '#8c2f2f' },
  { id: 'japanese', name: 'Japanese', aliases: ['japanese', 'ramen', 'sushi', 'izakaya'], icon: 'noodles', color: '#45687e' },
  { id: 'korean', name: 'Korean', aliases: ['korean', 'samgyupsal', 'korean bbq'], icon: 'grill', color: '#9b5333' },
  { id: 'italian', name: 'Italian', aliases: ['italian', 'pizzeria'], icon: 'pizza', color: '#527158' },
  { id: 'chinese', name: 'Chinese', aliases: ['chinese', 'dim sum', 'cantonese', 'sichuan'], icon: 'dumpling', color: '#8c2f2f' },
  { id: 'thai', name: 'Thai', aliases: ['thai'], icon: 'bowl', color: '#8a6125' },
  { id: 'vietnamese', name: 'Vietnamese', aliases: ['vietnamese', 'pho'], icon: 'noodles', color: '#527158' },
  { id: 'indian', name: 'Indian', aliases: ['indian'], icon: 'bowl', color: '#9b5333' },
  { id: 'mexican', name: 'Mexican', aliases: ['mexican', 'taqueria'], icon: 'taco', color: '#527158' },
  { id: 'american', name: 'American', aliases: ['american', 'american diner'], icon: 'burger', color: '#45687e' },
  { id: 'french', name: 'French', aliases: ['french'], icon: 'croissant', color: '#8c2f2f' },
  { id: 'mediterranean', name: 'Mediterranean', aliases: ['mediterranean', 'greek', 'levantine'], icon: 'olive', color: '#527158' },
]

// Suggestions are a starting point, not an allowlist. Any explicit ticket tag can earn a stamp.
const WORLD_CUISINES = [
  'Afghan|Armenian|Azerbaijani|Bangladeshi|Bengali|Bhutanese|Burmese|Cambodian|Cantonese|Central Asian|Chinese Muslim|Fujian|Georgian|Goan|Gujarati|Hakka|Hong Kong|Hunan|Hyderabadi|Indonesian|Javanese|Jiangsu|Kapampangan|Kashmiri|Kazakh|Kerala|Kyrgyz|Lao|Macanese|Malaysian|Maldivian|Manchu|Mongolian|Nepalese|North Indian|Okinawan|Pakistani|Peranakan|Persian|Punjabi|Rajasthani|Shandong|Shanghai|Sichuan|Singaporean|South Indian|Sri Lankan|Sundanese|Taiwanese|Tajik|Tamil|Tibetan|Turkmen|Uyghur|Uzbek|Yunnan|Zhejiang',
  'Arabian|Bahraini|Emirati|Iraqi|Israeli|Jordanian|Kuwaiti|Lebanese|Levantine|Omani|Palestinian|Qatari|Saudi Arabian|Syrian|Turkish|Yemeni',
  'Albanian|Andalusian|Austrian|Balkan|Basque|Bavarian|Belarusian|Belgian|Bosnian|British|Bulgarian|Catalan|Corsican|Croatian|Cypriot|Czech|Danish|Dutch|Eastern European|English|Estonian|Finnish|Galician|German|Greek|Hungarian|Icelandic|Irish|Latvian|Lithuanian|Luxembourgish|Macedonian|Maltese|Moldovan|Montenegrin|Neapolitan|Nordic|Norwegian|Polish|Portuguese|Provençal|Romanian|Russian|Sardinian|Scandinavian|Scottish|Serbian|Sicilian|Slovak|Slovenian|Spanish|Swedish|Swiss|Ukrainian|Welsh',
  'Algerian|Angolan|Beninese|Botswanan|Burkinabé|Cameroonian|Cape Verdean|Chadian|Congolese|Djiboutian|East African|Egyptian|Eritrean|Ethiopian|Gabonese|Gambian|Ghanaian|Guinean|Ivorian|Kenyan|Liberian|Libyan|Malagasy|Malian|Mauritian|Moroccan|Mozambican|Namibian|Nigerien|Nigerian|North African|Rwandan|Senegalese|Seychellois|Sierra Leonean|Somali|South African|South Sudanese|Sudanese|Tanzanian|Togolese|Tunisian|Ugandan|West African|Zambian|Zimbabwean',
  'Argentinian|Bahamian|Barbadian|Belizean|Bolivian|Brazilian|Cajun|Californian|Canadian|Caribbean|Chilean|Colombian|Costa Rican|Creole|Cuban|Dominican|Ecuadorian|Guatemalan|Guyanese|Haitian|Honduran|Jamaican|Latin American|Native American|New England|New Mexican|Nicaraguan|Panamanian|Paraguayan|Peruvian|Puerto Rican|Québécois|Salvadoran|Soul Food|South American|Southern American|Southwestern US|Surinamese|Tex-Mex|Trinidadian and Tobagonian|Uruguayan|Venezuelan',
  'Australian|Fijian|Hawaiian|Māori|Melanesian|Micronesian|New Zealand|Papua New Guinean|Polynesian|Samoan|Tahitian|Tongan',
  'African|Asian|Asian Fusion|European|Fusion|Indigenous|International|Jewish|Middle Eastern|Western',
].flatMap(group => group.split('|'))
const COLORS = ['#8c2f2f', '#45687e', '#527158', '#9b5333', '#8a6125']
export function normalizeCuisine(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s+cuisine$/, '') : ''
}
const EXTRA_ALIASES = { Afghan: ['afghani'], Burmese: ['myanmar'], Persian: ['iranian'], 'Sri Lankan': ['sri lanka'], Argentinian: ['argentine', 'argentinean'], Nepalese: ['nepali'], 'Tex-Mex': ['tex mex'], 'Māori': ['maori'], 'Québécois': ['quebecois'], 'Provençal': ['provencal'], 'Burkinabé': ['burkinabe'], Uyghur: ['uighur'] }
export const CUISINES = [...ORIGINAL_CUISINES, ...WORLD_CUISINES.sort((a, b) => a.localeCompare(b)).map((name, index) => ({
  id: normalizeCuisine(name).replace(/\s+/g, '-'), name, aliases: [normalizeCuisine(name), ...(EXTRA_ALIASES[name] || [])], icon: 'globe', color: COLORS[index % COLORS.length],
}))]
const byName = new Map(CUISINES.map(cuisine => [normalizeCuisine(cuisine.name), cuisine]))
const byAlias = new Map(CUISINES.flatMap(cuisine => cuisine.aliases.map(alias => [alias, cuisine])))

export function cuisineStamp(value, allowCustom = true) {
  const normalized = normalizeCuisine(value)
  if (!normalized) return null
  const known = byName.get(normalized) || byAlias.get(normalized)
  if (known) return known
  if (!allowCustom) return null
  const hash = [...normalized].reduce((total, char) => (total * 31 + char.codePointAt(0)) >>> 0, 0)
  return { id: `custom:${normalized}`, name: normalized.replace(/(^|[\s-])\p{L}/gu, letter => letter.toUpperCase()), aliases: [normalized], icon: 'globe', color: COLORS[hash % COLORS.length] }
}

export function passportCuisine(value) {
  return cuisineStamp(value, false)?.name || ''
}

export function collectPassport(visits, restaurants) {
  const places = new Map(restaurants.map(place => [place.id, place]))
  const stamps = new Map(CUISINES.map(cuisine => [cuisine.id, { ...cuisine, earned: false, visits: 0 }]))
  for (const visit of visits) {
    const tag = visit.cuisine ?? places.get(visit.restaurantId)?.category ?? visit.restaurant?.category ?? ''
    // Legacy restaurant categories such as Cafe do not create invented cuisine stamps.
    const cuisine = cuisineStamp(tag, visit.cuisine != null)
    if (!cuisine) continue
    const stamp = stamps.get(cuisine.id) || { ...cuisine, earned: false, visits: 0 }
    stamp.earned = true
    stamp.visits++
    if (!stamp.firstVisit || visit.date < stamp.firstVisit.date || (visit.date === stamp.firstVisit.date && visit.id < stamp.firstVisit.id)) stamp.firstVisit = visit
    stamps.set(cuisine.id, stamp)
  }
  return [...stamps.values()]
}
