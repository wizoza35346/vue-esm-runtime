/**
 * Component - Vue SFC 組件類
 */

import { httpRequest } from './utils.js';
import { StyleContext } from './context/StyleContext.js';
import { ScriptContext } from './context/ScriptContext.js';
import { TemplateContext } from './context/TemplateContext.js';

let scopeIndex = 0;

export class Component {
  constructor(name) {
    this.name = name;
    this.template = null;
    this.script = null;
    this.styles = [];
    this._scopeId = '';
  }

  getHead() {
    return document.head || document.getElementsByTagName('head')[0];
  }

  getScopeId() {
    if (this._scopeId === '') {
      this._scopeId = 'data-v-' + (scopeIndex++).toString(36);
      if (this.template) {
        if (typeof this.template.applyScope === 'function') {
          this.template.applyScope(this._scopeId);
        } else {
          const rootElt = this.template.getRootElt();
          if (rootElt) rootElt.setAttribute(this._scopeId, '');
        }
      }
    }
    return this._scopeId;
  }

  load(componentURL) {
    return httpRequest(componentURL).then(responseText => {
      this.baseURI = componentURL.substr(0, componentURL.lastIndexOf('/') + 1);

      // 預處理：將自閉合標籤轉換為完整標籤
      const processed = responseText.replace(
        /<([A-Z][A-Za-z0-9]*|[a-z]+-[a-z-]*)([^>]*?)\s*\/>/g,
        (match, tagName, attrs) => `<${tagName}${attrs}></${tagName}>`
      );

      const doc = document.implementation.createHTMLDocument('');
      doc.body.innerHTML = (this.baseURI ? `<base href="${this.baseURI}">` : '') + processed;

      for (let it = doc.body.firstChild; it; it = it.nextSibling) {
        switch (it.nodeName) {
          case 'TEMPLATE':
            this.template = new TemplateContext(this, it);
            break;
          case 'SCRIPT':
            this.script = new ScriptContext(this, it);
            break;
          case 'STYLE':
            this.styles.push(new StyleContext(this, it));
            break;
        }
      }
      return this;
    });
  }

  _normalizeSection(eltCx, langProcessor) {
    let p;

    if (eltCx === null || !eltCx.elt.hasAttribute('src')) {
      p = Promise.resolve(null);
    } else {
      p = httpRequest(eltCx.elt.getAttribute('src')).then(content => {
        eltCx.elt.removeAttribute('src');
        return content;
      });
    }

    return p.then(content => {
      if (eltCx !== null && eltCx.elt.hasAttribute('type')) {
        const type = eltCx.elt.getAttribute('type');
        eltCx.elt.removeAttribute('type');
        return langProcessor[type.toLowerCase()].call(this, content === null ? eltCx.getContent() : content);
      }
      return content;
    }).then(content => {
      if (content !== null) eltCx.setContent(content);
    });
  }

  normalize(langProcessor) {
    return Promise.all([
      this._normalizeSection(this.template, langProcessor),
      this._normalizeSection(this.script, langProcessor),
      ...this.styles.map(s => this._normalizeSection(s, langProcessor))
    ]).then(() => this);
  }

  compile(vueEsmRuntime, scriptExportsHandler) {
    // 若有 scoped style，先觸發 getScopeId() 讓 template 完成標籤注入
    const hasScoped = this.styles.some(style => style.elt.hasAttribute('scoped'));
    if (hasScoped) {
      this.getScopeId();
    }

    const childModuleRequire = childURL => {
      const resolved = vueEsmRuntime.resolveURL(this.baseURI, childURL);
      // 若為 SFC 組件，自動回傳異步組件定義 (Vue 3 為 defineAsyncComponent)
      if (typeof resolved === 'string' && resolved.endsWith('.vue')) {
        return vueEsmRuntime(resolved);
      }
      return vueEsmRuntime.require(resolved);
    };

    const scriptCode = this.script ? this.script.getContent() : '';
    const preloadPromise = vueEsmRuntime && vueEsmRuntime.preloadScriptDependencies
      ? vueEsmRuntime.preloadScriptDependencies(scriptCode, this.baseURI)
      : Promise.resolve();

    return preloadPromise.then(() => {
      return Promise.all([
        this.template && this.template.compile(),
        this.script && this.script.compile(childModuleRequire, vueEsmRuntime, this.template ? this.template.getContent() : '')
          .then(exports => scriptExportsHandler(exports))
          .then(exports => { this.script.module.exports = exports; }),
        ...this.styles.map(style => style.compile())
      ]).then(() => this);
    });
  }
}
