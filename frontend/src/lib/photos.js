// Retain review photo dimensions and remove EXIF metadata. Only avatars are resized.
export async function preparePhoto(file, avatar = false) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP photo.')
  if (file.size > 12000000) throw new Error('Choose a photo smaller than 12 MB.')
  const source = await createImageBitmap(file)
  try {
    const scale = avatar ? Math.min(1, 512 / Math.max(source.width, source.height)) : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(source.width * scale))
    canvas.height = Math.max(1, Math.round(source.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this photo. Please try again.')
    context.imageSmoothingQuality = 'high'
    context.fillStyle = '#fffef8'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    for (const quality of avatar ? [0.92, 0.85, 0.8] : [0.95, 0.92, 0.9]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size < (avatar ? 700000 : 3500000)) return blob
    }
    throw new Error('This photo is too detailed. Try a smaller image.')
  } finally {
    source.close()
  }
}
