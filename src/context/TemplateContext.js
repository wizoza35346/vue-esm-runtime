/**
 * TemplateContext - 處理 <template> 區塊
 */

export class TemplateContext {
  constructor(component, elt) {
    this.component = component;
    this.elt = elt;
  }

  getContent() {
    if (this.elt.content) {
      const container = document.createElement('div');
      container.appendChild(this.elt.content.cloneNode(true));
      return container.innerHTML;
    }
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

  applyScope(scopeId) {
    const tplElt = this.elt.content || this.elt;
    const walk = (node) => {
      if (node.nodeType === 1) { // Node.ELEMENT_NODE
        node.setAttribute(scopeId, '');
        for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
          walk(child);
        }
      }
    };
    for (let child = tplElt.firstElementChild; child; child = child.nextElementSibling) {
      walk(child);
    }
  }

  compile() {
    return Promise.resolve();
  }
}
