import { useEventListener } from '@vueuse/core'
import { cloneDeep, isEqual } from 'lodash-es'

export type UndoRedoOptions<T> = {
  initial: T
  onUndo?: (state: T) => void
  onRedo?: (state: T) => void
  handleKeypresses?: MaybeRefOrGetter<boolean>
}

export function useUndo<T>({
  initial,
  onUndo = () => {},
  onRedo = () => {},
  ...options
}: UndoRedoOptions<T>) {
  const handleKeypress = $computed(() => toValue(options.handleKeypresses) ?? true)
  const history = shallowReactive<T[]>([cloneDeep(initial)])

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

  function save(state: T) {
    history.splice(index + 1)
    // Only save the new state if it's different from the previous saved state.
    if (history.length === 0 || !isEqual(state, history[history.length - 1])) {
      history.push(cloneDeep(state))
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
