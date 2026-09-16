import type { DesignSpecs } from '../types'

// Per-service design-spec labels, matching exactly what the requestor sees on
// the booking form. Shared by the request-review modal, the job-order detail
// view, and the approver/coordinator emails so they can never drift apart.
export const DESIGN_SPEC_LABELS: Record<string, [keyof DesignSpecs, string][]> = {
  'Static Artwork Design': [['paperSize', 'Size'], ['orientation', 'Orientation'], ['material', 'Material Type']],
  'Digital Design':        [['paperSize', 'Platform / Usage'], ['orientation', 'Asset Type'], ['dimensions', 'Output Dimensions']],
  'Graphics':              [['paperSize', 'Project Category'], ['colorMode', 'Printing Process'], ['dimensions', 'Output Dimensions'], ['material', 'Material Type']],
  'Printing':              [['paperSize', 'Paper Size'], ['colorMode', 'Color'], ['orientation', 'Orientation'], ['material', 'Material Type']],
  'ASC':                   [['paperSize', 'Ad Type']],
  'Video Editing':         [['platform', 'Platform'], ['dimensions', 'Resolution'], ['orientation', 'Orientation'], ['paperSize', 'Output Format'], ['colorMode', 'Duration'], ['material', 'Style / Tone']],
  'Video Shoot':           [['shootTypeDetail', 'Type of Shoot']],
  'Content Writing':       [['paperSize', 'Content Type'], ['material', 'Sub-type']],
}

export function designSpecRows(activityType: string, ds?: DesignSpecs): { label: string; value: string }[] {
  if (!ds) return []
  const rows: { label: string; value: string }[] = []
  for (const [key, label] of (DESIGN_SPEC_LABELS[activityType] ?? [])) {
    const v = ds[key]
    if (typeof v === 'string' && v.trim()) rows.push({ label, value: v })
  }
  return rows
}

/** The specification rows an approver needs to judge a request, led by the
 *  brand. The requestor's notes are sent separately (see requestorNotes) so
 *  every email renders them in the same prominent block. */
export function emailSpecRows(activityType: string, ds?: DesignSpecs): { label: string; value: string }[] {
  if (!ds) return []
  const rows = [...designSpecRows(activityType, ds)]
  if (ds.brand?.trim()) rows.unshift({ label: 'Brand', value: ds.brand })
  return rows
}

/** The requestor's Additional Notes. Design services keep them inside the
 *  specs ("Additional Notes", "Script / Production Brief", "Content Brief");
 *  shoots use the top-level notes field. Whichever was filled in wins. */
export function requestorNotes(req?: { notes?: string; designSpecs?: DesignSpecs } | null): string {
  if (!req) return ''
  return req.designSpecs?.additionalNotes?.trim() || req.notes?.trim() || ''
}

/** The same, resolved from a job order through its linked booking request.
 *  Job orders created by hand (no request) fall back to their own notes. */
export function requestorNotesForJO(
  jo: { id: string; notes?: string },
  bookingRequests: { joId?: string; notes?: string; designSpecs?: DesignSpecs }[]
): string {
  const req = bookingRequests.find(r => r.joId === jo.id)
  return req ? requestorNotes(req) : (jo.notes?.trim() || '')
}
