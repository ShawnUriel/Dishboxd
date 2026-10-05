import { api } from './api.js'

// Stickers are made here, in the browser: the original picture never leaves the device.
// Only the finished sticker, a small transparent PNG, is uploaded.
export const STICKER_STYLES = [
  { value: 'original', label: 'Just the image', hint: 'Your picture, with a sticker edge' },
  { value: 'pixel', label: 'Pixelated', hint: 'Chunky, 8-bit pixels' },
  { value: 'vector', label: 'Vector', hint: 'Flat colours, like an illustration' },
  { value: 'translucent', label: 'Translucent', hint: 'See-through, like clear vinyl' },
]

const SIZES = [320, 256, 200] // longest side in pixels; smaller ones are tried if a PNG is too big
const MAX_BYTES = 380000

export async function readStickerImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))
    throw new Error('Choose a JPEG, PNG, WebP or GIF image.')
  if (file.size > 12000000) throw new Error('Choose an image smaller than 12 MB.')
  return createImageBitmap(file)
}

// Draws the sticker with these options and returns { blob, cutOut }.
// cutOut is false when no plain background was found to remove.
export async function renderSticker(source, { style = 'original', cutOut = false, outline = true } = {}) {
  for (const size of SIZES) {
    const { canvas, removed } = drawSticker(source, { style, cutOut, outline, size })
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (blob && blob.size <= MAX_BYTES) return { blob, cutOut: removed }
  }
  throw new Error('This picture is too detailed for a sticker. Try a simpler one.')
}

function drawSticker(source, { style, cutOut, outline, size }) {
  const border = outline ? Math.max(4, Math.round(size * 0.03)) : 0
  const pad = border + 2
  const scale = Math.min(1, (size - pad * 2) / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const work = canvasOf(width, height)
  const context = work.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  const image = context.getImageData(0, 0, width, height)
  const removed = cutOut && removeBackground(image)
  if (!removed && isOpaque(image)) roundCorners(image, Math.round(Math.min(width, height) * 0.12))
  if (style === 'pixel') pixelate(image, Math.max(4, Math.round(Math.max(width, height) / 34)))
  if (style === 'vector') flatten(image, 8)
  if (style === 'translucent') fade(image, 0.6)
  context.putImageData(image, 0, 0)

  const canvas = canvasOf(width + pad * 2, height + pad * 2)
  const out = canvas.getContext('2d')
  if (border) {
    // A white die-cut edge: the shape's silhouette, spread outwards, minus the shape itself
    const silhouette = canvasOf(width, height)
    const silhouetteContext = silhouette.getContext('2d')
    silhouetteContext.drawImage(work, 0, 0)
    silhouetteContext.globalCompositeOperation = 'source-in'
    silhouetteContext.fillStyle = '#ffffff'
    silhouetteContext.fillRect(0, 0, width, height)
    const ring = canvasOf(canvas.width, canvas.height)
    const ringContext = ring.getContext('2d')
    for (const [dx, dy] of ringOffsets(border, style === 'pixel')) {
      ringContext.drawImage(silhouette, pad + dx, pad + dy)
    }
    ringContext.globalCompositeOperation = 'destination-out'
    ringContext.drawImage(silhouette, pad, pad)
    out.globalAlpha = style === 'translucent' ? 0.7 : 1
    out.drawImage(ring, 0, 0)
    out.globalAlpha = 1
  }
  out.drawImage(work, pad, pad)
  return { canvas, removed }
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

// Points around a circle (or a square, for pixel stickers) at the border's distance
function ringOffsets(radius, square) {
  const points = []
  for (let step = 0; step < 32; step++) {
    const angle = (step / 32) * Math.PI * 2
    const x = Math.cos(angle)
    const y = Math.sin(angle)
    const stretch = square ? 1 / Math.max(Math.abs(x), Math.abs(y)) : 1
    points.push([Math.round(x * radius * stretch), Math.round(y * radius * stretch)])
  }
  return points
}

function isOpaque({ data }) {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return false
  return true
}

// Removes a plain background: starting from the edges, clears every connected pixel close to
// the most common edge colour. Returns false (and changes nothing) when that would remove
// nothing or almost everything, which means there was no plain background to find.
function removeBackground(image) {
  const { data, width, height } = image
  const edges = []
  for (let x = 0; x < width; x++) edges.push(x, (height - 1) * width + x)
  for (let y = 1; y < height - 1; y++) edges.push(y * width, y * width + width - 1)

  const buckets = new Map()
  for (const p of edges) {
    const i = p * 4
    if (data[i + 3] < 32) continue
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bucket.n++
    bucket.r += data[i]
    bucket.g += data[i + 1]
    bucket.b += data[i + 2]
    buckets.set(key, bucket)
  }
  let common = null
  for (const bucket of buckets.values()) if (!common || bucket.n > common.n) common = bucket
  const reference = common && [common.r / common.n, common.g / common.n, common.b / common.n]
  const close = (p) => {
    const i = p * 4
    if (data[i + 3] < 32) return true
    if (!reference) return false
    return Math.hypot(data[i] - reference[0], data[i + 1] - reference[1], data[i + 2] - reference[2]) < 46
  }

  const removed = new Uint8Array(width * height)
  const stack = []
  for (const p of edges) {
    if (!removed[p] && close(p)) {
      removed[p] = 1
      stack.push(p)
    }
  }
  let count = stack.length
  while (stack.length) {
    const p = stack.pop()
    const x = p % width
    const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]
    for (const q of neighbours) {
      if (q >= 0 && q < removed.length && !removed[q] && close(q)) {
        removed[q] = 1
        count++
        stack.push(q)
      }
    }
  }
  if (count === 0 || count > removed.length * 0.92) return false

  // Holes in the background colour (the middle of a donut) go too, when they are big enough
  // to be background rather than a small highlight or sprinkle in the picture
  const seen = new Uint8Array(removed.length)
  const smallest = removed.length * 0.01
  for (let start = 0; start < removed.length; start++) {
    if (removed[start] || seen[start] || !close(start)) continue
    seen[start] = 1
    const region = [start]
    for (let index = 0; index < region.length; index++) {
      const p = region[index]
      const x = p % width
      const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]
      for (const q of neighbours) {
        if (q >= 0 && q < removed.length && !removed[q] && !seen[q] && close(q)) {
          seen[q] = 1
          region.push(q)
        }
      }
    }
    if (region.length >= smallest) for (const p of region) removed[p] = 1
  }

  for (let p = 0; p < removed.length; p++) {
    if (removed[p]) {
      data[p * 4 + 3] = 0
      continue
    }
    // Soften the cut: pixels touching the removed background fade halfway
    const x = p % width
    const touches =
      (x > 0 && removed[p - 1]) ||
      (x < width - 1 && removed[p + 1]) ||
      removed[p - width] === 1 ||
      removed[p + width] === 1
    if (touches) data[p * 4 + 3] = Math.round(data[p * 4 + 3] * 0.55)
  }
  return true
}

// Rounded corners, so a rectangular photo looks like a sticker rather than a square
function roundCorners(image, radius) {
  const { data, width, height } = image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cx = x < radius ? radius : x >= width - radius ? width - radius - 1 : null
      const cy = y < radius ? radius : y >= height - radius ? height - radius - 1 : null
      if (cx === null || cy === null) continue
      const outside = Math.hypot(x - cx, y - cy) - radius
      if (outside > 0) data[(y * width + x) * 4 + 3] *= Math.max(0, 1 - outside)
    }
  }
}

// Each block becomes one colour, fully opaque or fully clear
function pixelate(image, block) {
  const { data, width, height } = image
  for (let top = 0; top < height; top += block) {
    for (let left = 0; left < width; left += block) {
      let r = 0
      let g = 0
      let b = 0
      let alpha = 0
      let pixels = 0
      const bottom = Math.min(top + block, height)
      const right = Math.min(left + block, width)
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const i = (y * width + x) * 4
          r += data[i] * data[i + 3]
          g += data[i + 1] * data[i + 3]
          b += data[i + 2] * data[i + 3]
          alpha += data[i + 3]
          pixels++
        }
      }
      const opaque = alpha / pixels >= 128
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const i = (y * width + x) * 4
          data[i] = alpha ? r / alpha : 0
          data[i + 1] = alpha ? g / alpha : 0
          data[i + 2] = alpha ? b / alpha : 0
          data[i + 3] = opaque ? 255 : 0
        }
      }
    }
  }
}

const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b

function nearest(palette, [r, g, b]) {
  let best = 0
  let bestDistance = Infinity
  palette.forEach(([pr, pg, pb], index) => {
    const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

// "Vector": a handful of flat colours with clean edges, like an illustration
function flatten(image, colours) {
  const { data, width, height } = image
  const total = width * height
  const soft = blur(data, width, height, 2)

  // Palette: k-means on a sample of the opaque pixels, starting from evenly spread brightness levels
  const samples = []
  const step = Math.max(1, Math.floor(total / 4000))
  for (let p = 0; p < total; p += step) {
    if (data[p * 4 + 3] >= 128) samples.push([soft[p * 4], soft[p * 4 + 1], soft[p * 4 + 2]])
  }
  if (!samples.length) return
  samples.sort((a, b) => luma(a) - luma(b))
  const k = Math.min(colours, samples.length)
  let palette = Array.from({ length: k }, (_, i) => [...samples[Math.floor(((i + 0.5) * samples.length) / k)]])
  for (let round = 0; round < 8; round++) {
    const sums = palette.map(() => [0, 0, 0, 0])
    for (const sample of samples) {
      const sum = sums[nearest(palette, sample)]
      sum[0] += sample[0]
      sum[1] += sample[1]
      sum[2] += sample[2]
      sum[3]++
    }
    palette = sums.map((sum, i) => (sum[3] ? [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]] : palette[i]))
  }

  const index = new Uint8Array(total)
  for (let p = 0; p < total; p++) index[p] = nearest(palette, [soft[p * 4], soft[p * 4 + 1], soft[p * 4 + 2]])
  const tidy = majority(index, width, height, k)
  for (let p = 0; p < total; p++) {
    const i = p * 4
    const [r, g, b] = palette[tidy[p]]
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = data[i + 3] >= 128 ? 255 : 0
  }
}

// Box blur of the colours (weighted by opacity, so clear pixels do not darken edges)
function blur(data, width, height, radius) {
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0
      let weight = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const i = (yy * width + xx) * 4
          const alpha = data[i + 3] + 1
          r += data[i] * alpha
          g += data[i + 1] * alpha
          b += data[i + 2] * alpha
          weight += alpha
        }
      }
      const i = (y * width + x) * 4
      out[i] = r / weight
      out[i + 1] = g / weight
      out[i + 2] = b / weight
      out[i + 3] = data[i + 3]
    }
  }
  return out
}

// Each pixel takes the most common palette colour around it, which clears single stray specks
function majority(index, width, height, k) {
  const out = new Uint8Array(index.length)
  const counts = new Uint8Array(k)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      counts.fill(0)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx >= 0 && xx < width && yy >= 0 && yy < height) counts[index[yy * width + xx]]++
        }
      }
      const own = index[y * width + x]
      let best = own
      for (let c = 0; c < k; c++) if (counts[c] > counts[best]) best = c
      out[y * width + x] = best
    }
  }
  return out
}

function fade({ data }, opacity) {
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity)
}

// Sticker images load with the login token, so they are kept as blob URLs for the session
const urls = new Map()

export function stickerUrl(id) {
  if (!urls.has(id)) {
    const request = api(`/api/stickers/${id}/image`, { binary: true })
      .then((blob) => URL.createObjectURL(blob))
      .catch((error) => {
        urls.delete(id)
        throw error
      })
    urls.set(id, request)
  }
  return urls.get(id)
}

export async function uploadSticker(blob, style) {
  const { sticker } = await api(`/api/stickers?style=${encodeURIComponent(style)}`, { method: 'POST', body: blob })
  urls.set(sticker.id, Promise.resolve(URL.createObjectURL(blob)))
  return sticker
}

export function forgetSticker(id) {
  const request = urls.get(id)
  urls.delete(id)
  request?.then((url) => URL.revokeObjectURL(url)).catch(() => {})
}
