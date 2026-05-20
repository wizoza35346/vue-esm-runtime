// 位置：/example_vue3/composables/useGreeting.js
// 需要 import 跨目錄上去：../js/utils/format.js
import { formatName, PREFIX } from '../js/utils/format.js'
import formatModule from '../js/utils/format.js'

console.log('[composables/useGreeting.js] loaded')
console.log('[composables/useGreeting.js] formatModule path:', formatModule.path)

export function useGreeting(name) {
  return `${PREFIX} ${formatName(name)}`
}

export const COMPOSABLE_PATH = 'composables/useGreeting.js'
