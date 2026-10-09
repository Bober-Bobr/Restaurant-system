/**
 * What a photo picker's selection DOES — toggling, appending and reordering.
 *
 * Pure, and out of the component, because these are the rules that can be
 * quietly wrong: a cap that drops the photo somebody just chose instead of
 * refusing it, a duplicate that makes two tiles share a React key, a reorder
 * that walks off the end of the list. None of that is visible in a screenshot,
 * and all of it is one line here.
 */

/** Normalise a selection: no blanks, no duplicates, never longer than the cap. */
export function normalizeSelection(photos: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const photo of photos) {
    if (typeof photo !== 'string' || photo.trim().length === 0) continue;
    if (seen.has(photo)) continue;
    seen.add(photo);
    out.push(photo);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Tick or untick one photo.
 *
 * Appends at the END, so the arrival order is the gallery order and the cover
 * does not change under the writer when they add a sixth photo. Past the cap
 * the selection is returned UNCHANGED — refusing the new photo rather than
 * evicting one they already arranged.
 */
export function togglePhoto(photos: string[], photo: string, max: number): string[] {
  if (photos.includes(photo)) return photos.filter((p) => p !== photo);
  if (photos.length >= max) return photos;
  return normalizeSelection([...photos, photo], max);
}

/**
 * Move a photo one place earlier or later.
 *
 * A move off either end is a no-op rather than a wrap: the arrows are disabled
 * at the ends, and a keyboard or a double-press reaching this anyway must not
 * teleport the last photo into the cover slot.
 */
export function movePhoto(photos: string[], from: number, to: number): string[] {
  if (from < 0 || from >= photos.length) return photos;
  if (to < 0 || to >= photos.length) return photos;
  const next = [...photos];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * What an upload adds to the selection.
 *
 * In gallery mode, ALL of it, appended in the order the files were given — the
 * file dialog has always been `multiple`, so keeping only the first threw away
 * nine photos out of ten of a phone's worth, which is the whole of what was
 * asked for here. Single-photo mode keeps its old behaviour: the library gets
 * every file, the field takes the first.
 */
export function appendUploaded(
  selection: string[],
  uploaded: string[],
  options: { multiple: boolean; max: number },
): string[] {
  if (uploaded.length === 0) return selection;
  if (!options.multiple) return [uploaded[0]];
  return normalizeSelection([...selection, ...uploaded], options.max);
}
