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

/** The specification rows an approver needs to judge a request, including the
 *  brand and the requestor's notes. Sent with approval and coordinator emails. */
export function emailSpecRows(activityType: string, ds?: DesignSpecs): { label: string; value: string }[] {
  if (!ds) return []
  const rows = [...designSpecRows(activityType, ds)]
  if (ds.brand?.trim()) rows.unshift({ label: 'Brand', value: ds.brand })
  if (ds.additionalNotes?.trim()) rows.push({ label: 'Notes', value: ds.additionalNotes })
  return rows
}
