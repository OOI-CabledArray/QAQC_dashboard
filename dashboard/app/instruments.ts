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

// Full reference designators (sitesDictionary.csv stage 9; ZPLSC from the
// echogram workflow). Image paths use only the trailing sensor id — derive it
// with sensorId() rather than storing the bare ids.
export const hydrophones = [
  'RS01SLBS-LJ01A-09-HYDBBA102',
  'CE04OSBP-LJ01C-11-HYDBBA105',
  'CE02SHBP-LJ01D-11-HYDBBA106',
  'RS03AXBS-LJ03A-09-HYDBBA302',
  'RS01SBPS-PC01A-08-HYDBBA103',
  'RS03AXPS-PC03A-08-HYDBBA303',
  'RS01SLBS-MJ01A-05-HYDLFA101',
  'RS01SUM1-LJ01B-05-HYDLFA104',
  'RS03AXBS-MJ03A-05-HYDLFA301',
  'RS03ECAL-MJ03E-09-HYDLFA304',
  'RS03CCAL-MJ03F-06-HYDLFA305',
]

export const echosounders = ['CE02SHBP-MJ01C-07-ZPLSCB101', 'CE04OSPS-PC01B-05-ZPLSCB102']

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
