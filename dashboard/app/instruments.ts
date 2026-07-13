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

export const hydrophones = [
  'HYDBBA102',
  'HYDBBA105',
  'HYDBBA106',
  'HYDBBA302',
  'HYDBBA103',
  'HYDBBA303',
  'HYDLFA101',
  'HYDLFA104',
  'HYDLFA301',
  'HYDLFA304',
  'HYDLFA305',
]

export const echosounders = ['ZPLSCB101', 'ZPLSCB102']

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
