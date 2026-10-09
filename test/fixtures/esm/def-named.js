import D, { a as x, b } from './dep.js'
import { default as D2 } from './dep.js'
export const out = [D(), x, b, D2()]
