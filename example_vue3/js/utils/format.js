// 位置：/example_vue3/js/utils/format.js
console.log('[utils/format.js] loaded')

export function formatName(name) {
  return `<<${name}>>`
}

export const PREFIX = '[utils]'

export default {
  formatName,
  PREFIX,
  path: 'js/utils/format.js'
}
