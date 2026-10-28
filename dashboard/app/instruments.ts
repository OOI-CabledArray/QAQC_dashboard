/** Single source of truth for instrument classification.
 *
 * "Acoustic" instruments (hydrophones, echosounders) publish date-stamped
 * spectrogram/echogram images under /spectrograms and /echograms rather than
 * rolling QAQC plots — they are matched by sensor-id prefix. Seismometers
 * (OBSBB/OBSSP) are NOT acoustic in this sense: their waveform plots live in
 * QAQC_plots/ with the standard filename convention.
 */

export const spectrogramsURL = '/spectrograms'
export const echogramsURL = '/echograms'

// The rca-data-tools instrument registry. The store loads hydrophones and
// echosounders from its stage 9 rows as full reference designators; image
// paths use only the trailing sensor id (sensorId()).
// prettier-ignore
export const SITES_CSV_URL = 'https://raw.githubusercontent.com/OOI-CabledArray/rca-data-tools/main/rca_data_tools/qaqc/params/sitesDictionary.csv'

/** Last dash-segment of a refDes ('RS03AXBS-LJ03A-09-HYDBBA302' -> 'HYDBBA302').
 *  Bare sensor ids and nav keywords ('HYDBB', 'ZPLSC') pass through unchanged. */
export function sensorId(refDesOrId: string): string {
  return refDesOrId.split('-').pop() ?? ''
}

export function isHydrophone(refDesOrId: string): boolean {
  const id = sensorId(refDesOrId)
  return id.startsWith('HYDBB') || id.startsWith('HYDLF')
}

export function isEchosounder(refDesOrId: string): boolean {
  return sensorId(refDesOrId).startsWith('ZPLS')
}

export function isAcoustic(refDesOrId: string): boolean {
  return isHydrophone(refDesOrId) || isEchosounder(refDesOrId)
}

/** Date-stamped acoustic image path: <base>/<year>/<id>/<id>_<yyyymmdd>.png */
export function acousticImagePath(basePath: string, id: string, yyyymmdd: string): string {
  return `${basePath}/${yyyymmdd.slice(0, 4)}/${id}/${id}_${yyyymmdd}.png`
}
