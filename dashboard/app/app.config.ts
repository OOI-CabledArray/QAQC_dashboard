export default defineAppConfig({
  ui: {
    toaster: {
      position: 'top-right',
    } as any,
    colors: {
      primary: 'primary',
      neutral: 'slate',
    },
    card: {
      slots: {
        header: 'p-2 sm:p-4',
        body: 'p-2 sm:p-4',
        footer: 'p-2 sm:p-4',
      },
    },
    slider: {
      slots: {
        thumb: 'cursor-grab',
      },
    },
    button: {
      default: {
        class: 'cursor-pointer',
      },
    } as any,
  },
})
