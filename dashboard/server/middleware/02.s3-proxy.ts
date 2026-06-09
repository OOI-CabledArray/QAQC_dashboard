const S3_PREFIXES = [
  'QAQC_plots/',
  'discrete/',
  'HITL_notes/',
  'spectrograms/',
  'echograms/',
  'archives/',
]

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    return
  }

  const path = event.path.slice(1)
  if (!S3_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return
  }

  if (path.startsWith('archives/internal/')) {
    requireAuth(event)
  }

  return proxyS3Path(event, path)
})
