/** Drop the trailing field segment from a Payload field path.
 *  'layout.0.variant' -> 'layout.0'; 'variant' -> ''. */
export function parentPathOf(path: string): string {
  const i = path.lastIndexOf('.')
  return i === -1 ? '' : path.slice(0, i)
}
