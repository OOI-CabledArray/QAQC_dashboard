export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (path !== '/' && path.endsWith('/')) {
    return sendRedirect(event, path.slice(0, -1), 301)
  }
})
