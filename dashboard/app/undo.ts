import { useEventListener } from '@vueuse/core'
import { cloneDeep, isEqual } from 'lodash-es'

const maxHistoryLength = 250

export type UndoRedoOptions<T> = {
  current: () => T
  onUndo?: (state: T) => void
  onRedo?: (state: T) => void
  handleKeypresses?: MaybeRefOrGetter<boolean>
}

export function useUndo<T>({
  current,
  onUndo = () => {},
  onRedo = () => {},
  ...options
}: UndoRedoOptions<T>) {
  const handleKeypress = $computed(() => toValue(options.handleKeypresses) ?? true)
  const history = shallowReactive<T[]>([cloneDeep(current())])

  const canUndo = $computed(() => history.length > 0 && index > 0)
  const canRedo = $computed(() => index < history.length - 1)

  let index = $ref(0)

  function undo() {
    if (history.length > 0 && index > 0) {
      index--
      const value = cloneDeep(history[index]!)
      onUndo(value)
      return value
    }
  }

  function redo() {
    if (index < history.length - 1) {
      index++
      const value = cloneDeep(history[index]!)
      onRedo(value)
      return value
    }
  }

  function save(state?: T) {
    const value = state !== undefined ? state : current()

    history.splice(index + 1)
    // Only save the new state if it's different from the previous saved state.
    if (history.length === 0 || !isEqual(value, history[history.length - 1])) {
      history.push(cloneDeep(value))
      if (history.length > maxHistoryLength) {
        history.splice(0, history.length - maxHistoryLength)
      }
    }

    index = history.length - 1
  }

  useEventListener('keydown', (event: KeyboardEvent) => {
    if (!handleKeypress) {
      return
    }

    if (event.key.toLowerCase() === 'z' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (event.shiftKey) {
        redo()
      } else {
        undo()
      }
    }
  })

  return reactive({
    history: computed(() => readonly(history)),
    length: computed(() => history.length),
    canUndo: computed(() => canUndo),
    canRedo: computed(() => canRedo),
    index: computed(() => index),
    undo,
    redo,
    save,
  })
}
