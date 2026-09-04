export function normalizeEmbedUrl(
  provider: 'youtube' | 'vimeo' | 'file',
  url?: string | null,
): string | null {
  if (!url) return null
  if (provider === 'file') return null
  if (provider === 'youtube') {
    const id =
      url.match(/[?&]v=([\w-]{6,})/)?.[1] ??
      url.match(/youtu\.be\/([\w-]{6,})/)?.[1] ??
      url.match(/youtube\.com\/embed\/([\w-]{6,})/)?.[1]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (provider === 'vimeo') {
    const id = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/)?.[1]
    return id ? `https://player.vimeo.com/video/${id}` : null
  }
  return null
}
