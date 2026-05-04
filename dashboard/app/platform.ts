export function isMac(): boolean {
  if (import.meta.server) {
    const headers = useRequestHeaders(['user-agent'])
    return headers['user-agent']?.includes('Mac') ?? false
  }
  return navigator.userAgent.includes('Mac')
}
