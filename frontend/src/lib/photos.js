// Resize and re-encode on the device: smaller uploads, no EXIF location metadata.
export async function preparePhoto(file, avatar = false) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP photo.')
  if (file.size > 12000000) throw new Error('Choose a photo smaller than 12 MB.')
  const source = await createImageBitmap(file)
  try {
    const scale = Math.min(1, (avatar ? 512 : 1440) / Math.max(source.width, source.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(source.width * scale))
    canvas.height = Math.max(1, Math.round(source.height * scale))
    const context = canvas.getContext('2d')
    context.fillStyle = '#fffef8'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.82, 0.65, 0.45]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size < 700000) return blob
    }
    throw new Error('This photo is too detailed. Try a smaller image.')
  } finally {
    source.close()
  }
}
