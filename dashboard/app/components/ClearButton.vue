<script lang="ts" setup generic="T">
const { clearValue = undefined } = defineProps<{
  clearValue?: T | (() => T)
}>()

const emit = defineEmits(['click'])

const modelValue = defineModel<T>()

function onClick() {
  const assigned = typeof clearValue !== 'function' ? clearValue : (clearValue as () => T)()
  modelValue.value = assigned
  emit('click')
}
</script>

<template>
  <u-button
    v-if="modelValue !== clearValue"
    class="hover:text-gray-600! p-0 text-gray-500"
    variant="link"
    @click.stop.prevent="onClick"
  >
    <u-icon name="material-symbols:cancel" />
  </u-button>
</template>
