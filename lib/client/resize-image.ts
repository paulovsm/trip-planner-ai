/**
 * Shrinks phone photos before upload (Vercel caps request bodies at ~4.5 MB):
 * longest side ≤ 2048 px, JPEG 0.8. Non-images, or formats the browser cannot
 * decode (e.g. HEIC outside Safari), are returned unchanged.
 */
export async function prepareUpload(file: File, maxSide = 2048, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type === "image/jpeg") return file
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}
