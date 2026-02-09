/**
 * 工具函數
 */

export function identity(value) {
  return value;
}

export function parseModuleURL(url, extension = 'js') {
  const comp = url.match(/(.*?)([^/]+?)\/?(\.js|\.vue)?(\?.*|#.*|$)/);
  return {
    name: comp[2],
    url: comp[1] + comp[2] + (comp[3] === undefined ? '/index.' + extension : comp[3]) + comp[4]
  };
}

export function parseComponentURL(url) {
  return parseModuleURL(url, 'vue');
}

export function resolveURL(baseURL, url) {
  // 絕對路徑或 http(s) 路徑，直接回傳
  if (!url || url.charAt(0) === '/' || url.indexOf('://') !== -1) {
    return url;
  }

  // 非相對路徑，直接回傳
  if (url.charAt(0) !== '.') {
    return url;
  }

  // 確保 baseURL 以 / 結尾
  let base = baseURL || './';
  if (base.charAt(base.length - 1) !== '/') {
    base = base.substring(0, base.lastIndexOf('/') + 1);
  }

  // 組合路徑
  const combined = base + url;

  // 正規化路徑：處理 ./ 和 ../
  const parts = combined.split('/');
  const result = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '.' || part === '') {
      if (i === 0 && part === '.') {
        result.push('.');
      }
      continue;
    } else if (part === '..') {
      if (result.length > 0 && result[result.length - 1] !== '.' && result[result.length - 1] !== '..') {
        result.pop();
      } else {
        result.push('..');
      }
    } else {
      result.push(part);
    }
  }

  let finalPath = result.join('/');
  if (finalPath.charAt(0) !== '.' && finalPath.charAt(0) !== '/') {
    finalPath = './' + finalPath;
  }

  return finalPath;
}

export function httpRequest(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'text';

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('HTTP ' + xhr.status + ': ' + url));
        }
      }
    };

    xhr.send(null);
  });
}
