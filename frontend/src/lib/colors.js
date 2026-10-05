// Card catalog box colours: the five originals by name, or any #rrggbb from the colour picker.
export const BOX_PRESETS = [
  { value: 'orange', label: 'Orange', hex: '#ffb366' },
  { value: 'mint', label: 'Mint', hex: '#c6efc0' },
  { value: 'lavender', label: 'Lavender', hex: '#b6a9ff' },
  { value: 'pink', label: 'Pink', hex: '#ffa3a3' },
  { value: 'plum', label: 'Plum', hex: '#8e3f96' },
]

export const MORE_SWATCHES = [
  { value: '#ffe17a', label: 'Lemon' },
  { value: '#9fd3f5', label: 'Sky' },
  { value: '#a8d5b5', label: 'Sage' },
  { value: '#d9c7a7', label: 'Kraft' },
  { value: '#4e6887', label: 'Slate' },
  { value: '#8c2f2f', label: 'Cherry' },
  { value: '#2b2823', label: 'Ink' },
]

export function boxHex(color) {
  return BOX_PRESETS.find((preset) => preset.value === color)?.hex ?? (/^#[0-9a-f]{6}$/i.test(color ?? '') ? color : BOX_PRESETS[0].hex)
}

function luminance(hex) {
  const channel = (start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

// White text when it contrasts better than the ink colour (#2b2823) on this box
export function isDarkBox(color) {
  const background = luminance(boxHex(color))
  const ink = luminance('#2b2823')
  return 1.05 / (background + 0.05) > (background + 0.05) / (ink + 0.05)
}
