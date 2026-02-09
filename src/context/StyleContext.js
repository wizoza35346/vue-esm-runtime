/**
 * StyleContext - 處理 <style> 區塊
 */

export class StyleContext {
  constructor(component, elt) {
    this.component = component;
    this.elt = elt;
  }

  withBase(callback) {
    let tmpBaseElt;
    if (this.component.baseURI) {
      tmpBaseElt = document.createElement('base');
      tmpBaseElt.href = this.component.baseURI;
      const headElt = this.component.getHead();
      headElt.insertBefore(tmpBaseElt, headElt.firstChild);
    }
    callback.call(this);
    if (tmpBaseElt) {
      this.component.getHead().removeChild(tmpBaseElt);
    }
  }

  scopeStyles(styleElt, scopeName) {
    const process = () => {
      const sheet = styleElt.sheet;
      const rules = sheet.cssRules;

      for (let i = 0; i < rules.length; ++i) {
        const rule = rules[i];
        if (rule.type !== 1) continue;

        const scopedSelectors = [];
        rule.selectorText.split(/\s*,\s*/).forEach(sel => {
          scopedSelectors.push(scopeName + ' ' + sel);
          const segments = sel.match(/([^ :]+)(.+)?/);
          scopedSelectors.push(segments[1] + scopeName + (segments[2] || ''));
        });

        const scopedRule = scopedSelectors.join(',') + rule.cssText.substr(rule.selectorText.length);
        sheet.deleteRule(i);
        sheet.insertRule(scopedRule, i);
      }
    };

    try {
      process();
    } catch (ex) {
      if (ex instanceof DOMException && ex.code === DOMException.INVALID_ACCESS_ERR) {
        styleElt.sheet.disabled = true;
        styleElt.addEventListener('load', function onStyleLoaded() {
          styleElt.removeEventListener('load', onStyleLoaded);
          setTimeout(() => {
            process();
            styleElt.sheet.disabled = false;
          });
        });
        return;
      }
      throw ex;
    }
  }

  compile() {
    const hasTemplate = this.component.template !== null;
    const scoped = this.elt.hasAttribute('scoped');

    if (scoped) {
      if (!hasTemplate) return;
      this.elt.removeAttribute('scoped');
    }

    this.withBase(() => {
      this.component.getHead().appendChild(this.elt);
    });

    if (scoped) {
      this.scopeStyles(this.elt, '[' + this.component.getScopeId() + ']');
    }

    return Promise.resolve();
  }

  getContent() {
    return this.elt.textContent;
  }

  setContent(content) {
    this.withBase(() => {
      this.elt.textContent = content;
    });
  }
}
