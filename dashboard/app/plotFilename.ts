/** QAQC plot filenames follow
 *
 *   <refDes>_<variable>_[<NNNmeters|NNNprofile>_]<timeSpan>_<overlay>_<dataRange>.<png|svg>
 *
 * where <variable> may itself contain underscores (e.g. spectral_irradiance_412nm,
 * seafloor_pressure) and is empty for camera plots — so the trailing fields must be
 * parsed from the end, never positionally from the front.
 */
export type PlotFilename = {
  ref: string
  variable: string
  /** '010meters', '000profile', or '' for fixed-depth plots. */
  depthString: string
  timeSpan: string
  overlays: string
  dataRange: string
}

export function parsePlotFilename(plot: string): PlotFilename | null {
  const name = (plot.split('/').at(-1) as string).replace(/\.(png|svg)$/i, '')
  const tokens = name.split('_')
  if (tokens.length < 4) return null

  const dataRange = tokens.at(-1) as string
  const overlays = tokens.at(-2) as string
  const timeSpan = tokens.at(-3) as string

  let middle = tokens.slice(1, -3)
  let depthString = ''
  const beforeSpan = middle.at(-1)
  if (beforeSpan && (beforeSpan.endsWith('meters') || beforeSpan.endsWith('profile'))) {
    depthString = beforeSpan
    middle = middle.slice(0, -1)
  }

  return {
    ref: tokens[0] as string,
    variable: middle.join('_'),
    depthString,
    timeSpan,
    overlays,
    dataRange,
  }
}
