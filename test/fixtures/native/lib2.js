// 靜態 import 另一個原生模組：由瀏覽器自己處理，兩邊共用同一份 lib.js
import { inc } from './lib.js';
export const twice = () => { inc(); return inc(); };
