// 原生 ES module（不是 CommonJS，也不是 UMD）：由瀏覽器的 module 載入器直接載入
export let count = 0;
export function inc() { return ++count; }
window.__libLoads = (window.__libLoads || 0) + 1;
export default 'lib-default';
