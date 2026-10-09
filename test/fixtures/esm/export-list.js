const x = 1
function f() { return 'f' }
const y = 2
export { x, f as g, y as default }
export { late }
const late = 'late'
