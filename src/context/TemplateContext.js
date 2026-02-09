/**
 * TemplateContext - 處理 <template> 區塊
 */

export class TemplateContext {
  constructor(component, elt) {
    this.component = component;
    this.elt = elt;
  }

  getContent() {
    return this.elt.innerHTML;
  }

  setContent(content) {
    this.elt.innerHTML = content;
  }

  getRootElt() {
    const tplElt = this.elt.content || this.elt;
    if ('firstElementChild' in tplElt) {
      return tplElt.firstElementChild;
    }
    for (let node = tplElt.firstChild; node !== null; node = node.nextSibling) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return node;
      }
    }
    return null;
  }

  compile() {
    return Promise.resolve();
  }
}
