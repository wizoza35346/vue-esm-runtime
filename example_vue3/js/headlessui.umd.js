(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('vue')) :
  typeof define === 'function' && define.amd ? define(['exports', 'vue'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.HeadlessUI = {}, global.Vue));
})(this, (function (exports, e$2) { 'use strict';

  function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
      Object.keys(e).forEach(function (k) {
        if (k !== 'default') {
          var d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: function () { return e[k]; }
          });
        }
      });
    }
    n.default = e;
    return Object.freeze(n);
  }

  var e__namespace = /*#__PURE__*/_interopNamespaceDefault(e$2);

  function getMeasurementKey(item) {
    return typeof item === "object" ? item.key : item;
  }
  function createLazyMeasurementsView(cache, flat) {
    const count = cache.length;
    return new Proxy(cache, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          const c = prop.charCodeAt(0);
          if (c >= 48 && c <= 57) {
            const i = +prop;
            if (Number.isInteger(i) && i >= 0 && i < count) {
              let v = target[i];
              if (typeof v !== "object") {
                const s = flat[i * 2];
                v = target[i] = {
                  index: i,
                  key: v,
                  start: s,
                  size: flat[i * 2 + 1],
                  end: s + flat[i * 2 + 1],
                  lane: 0
                };
              }
              return v;
            }
          }
          if (prop === "length") return count;
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }

  function memo(getDeps, fn, opts) {
    let deps = opts.initialDeps ?? [];
    let result;
    let isInitial = true;
    function memoizedFunction() {
      var _a;
      const debugEnabled = process.env.NODE_ENV !== "production" && !!opts.key && !!((_a = opts.debug) == null ? void 0 : _a.call(opts));
      let depTime = 0;
      if (debugEnabled) depTime = Date.now();
      const newDeps = getDeps();
      const depsChanged = newDeps.length !== deps.length || newDeps.some((dep, index) => deps[index] !== dep);
      if (!depsChanged) {
        return result;
      }
      deps = newDeps;
      let resultTime = 0;
      if (debugEnabled) resultTime = Date.now();
      result = fn(...newDeps);
      if (debugEnabled) {
        const depEndTime = Math.round((Date.now() - depTime) * 100) / 100;
        const resultEndTime = Math.round((Date.now() - resultTime) * 100) / 100;
        const resultFpsPercentage = resultEndTime / 16;
        const pad = (str, num) => {
          str = String(str);
          while (str.length < num) {
            str = " " + str;
          }
          return str;
        };
        console.info(
          `%c⏱ ${pad(resultEndTime, 5)} /${pad(depEndTime, 5)} ms`,
          `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(
          0,
          Math.min(120 - 120 * resultFpsPercentage, 120)
        )}deg 100% 31%);`,
          opts == null ? void 0 : opts.key
        );
      }
      if ((opts == null ? void 0 : opts.onChange) && !(isInitial && opts.skipInitialOnChange)) {
        opts.onChange(result);
      }
      isInitial = false;
      return result;
    }
    memoizedFunction.updateDeps = (newDeps) => {
      deps = newDeps;
    };
    return memoizedFunction;
  }
  function notUndefined(value, msg) {
    if (value === void 0) {
      throw new Error(`Unexpected undefined${""}`);
    } else {
      return value;
    }
  }
  const approxEqual = (a, b) => Math.abs(a - b) < 1.01;
  const debounce = (targetWindow, fn, ms) => {
    let timeoutId;
    return Object.assign(
      function(...args) {
        targetWindow.clearTimeout(timeoutId);
        timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms);
      },
      {
        // The handle is closure-local, so a caller that has already
        // unsubscribed has no way to stop a queued call. Teardown paths use
        // this to drop the pending invocation instead of letting it land.
        cancel: () => {
          targetWindow.clearTimeout(timeoutId);
        }
      }
    );
  };

  let _isIOSResult;
  const isIOSWebKit = () => {
    if (_isIOSResult !== void 0) return _isIOSResult;
    if (typeof navigator === "undefined") return _isIOSResult = false;
    if (/iP(hone|od|ad)/.test(navigator.userAgent)) return _isIOSResult = true;
    const mtp = navigator.maxTouchPoints;
    return _isIOSResult = navigator.platform === "MacIntel" && mtp !== void 0 && mtp > 0;
  };
  const getRect = (element) => {
    const { offsetWidth, offsetHeight } = element;
    return { width: offsetWidth, height: offsetHeight };
  };
  const defaultKeyExtractor = (index) => index;
  const defaultRangeExtractor = (range) => {
    const start = Math.max(range.startIndex - range.overscan, 0);
    const end = Math.min(range.endIndex + range.overscan, range.count - 1);
    const len = end - start + 1;
    const arr = new Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = start + i;
    }
    return arr;
  };
  const observeElementRect = (instance, cb) => {
    const element = instance.scrollElement;
    if (!element) {
      return;
    }
    const targetWindow = instance.targetWindow;
    if (!targetWindow) {
      return;
    }
    const handler = (rect) => {
      const { width, height } = rect;
      cb({ width: Math.round(width), height: Math.round(height) });
    };
    handler(getRect(element));
    if (!targetWindow.ResizeObserver) {
      return () => {
      };
    }
    const observer = new targetWindow.ResizeObserver((entries) => {
      const run = () => {
        const entry = entries[0];
        if (entry == null ? void 0 : entry.borderBoxSize) {
          const box = entry.borderBoxSize[0];
          if (box) {
            handler({ width: box.inlineSize, height: box.blockSize });
            return;
          }
        }
        handler(getRect(element));
      };
      instance.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
    });
    observer.observe(element, { box: "border-box" });
    return () => {
      observer.unobserve(element);
    };
  };
  const addEventListenerOptions = {
    passive: true
  };
  const supportsScrollend = typeof window == "undefined" ? true : "onscrollend" in window;
  const observeOffset = (instance, cb, readOffset) => {
    const element = instance.scrollElement;
    if (!element) {
      return;
    }
    const targetWindow = instance.targetWindow;
    if (!targetWindow) {
      return;
    }
    const registerScrollendEvent = instance.options.useScrollendEvent && supportsScrollend;
    let offset = 0;
    const fallback = registerScrollendEvent ? null : debounce(
      targetWindow,
      () => cb(readOffset(element), false),
      instance.options.isScrollingResetDelay
    );
    const createHandler = (isScrolling) => () => {
      offset = readOffset(element);
      fallback == null ? void 0 : fallback();
      cb(offset, isScrolling);
    };
    const handler = createHandler(true);
    const endHandler = createHandler(false);
    element.addEventListener("scroll", handler, addEventListenerOptions);
    if (registerScrollendEvent) {
      element.addEventListener("scrollend", endHandler, addEventListenerOptions);
    }
    return () => {
      element.removeEventListener("scroll", handler);
      if (registerScrollendEvent) {
        element.removeEventListener("scrollend", endHandler);
      }
      fallback == null ? void 0 : fallback.cancel();
    };
  };
  const observeElementOffset = (instance, cb) => observeOffset(instance, cb, (el) => {
    const { horizontal, isRtl } = instance.options;
    return horizontal ? el.scrollLeft * (isRtl && -1 || 1) : el.scrollTop;
  });
  const measureElement = (element, entry, instance) => {
    if (instance.options.useCachedMeasurements) {
      const index = instance.indexFromElement(element);
      const key = instance.options.getItemKey(index);
      return instance.itemSizeCache.get(key) ?? instance.options.estimateSize(index);
    }
    if (entry == null ? void 0 : entry.borderBoxSize) {
      const box = entry.borderBoxSize[0];
      if (box) {
        const size = Math.round(
          box[instance.options.horizontal ? "inlineSize" : "blockSize"]
        );
        return size;
      }
    }
    if (!entry) {
      const index = instance.indexFromElement(element);
      const key = instance.options.getItemKey(index);
      const cachedSize = instance.itemSizeCache.get(key);
      if (cachedSize !== void 0) {
        return cachedSize;
      }
    }
    return element[instance.options.horizontal ? "offsetWidth" : "offsetHeight"];
  };
  const scrollWithAdjustments = (offset, {
    adjustments = 0,
    behavior
  }, instance) => {
    var _a, _b;
    (_b = (_a = instance.scrollElement) == null ? void 0 : _a.scrollTo) == null ? void 0 : _b.call(_a, {
      [instance.options.horizontal ? "left" : "top"]: offset + adjustments,
      behavior
    });
  };
  const elementScroll = scrollWithAdjustments;
  function isAppendWithTrim(prevCount, nextCount, getPreviousKey, getNextKey) {
    if (nextCount === 0) return false;
    const firstKey = getNextKey(0);
    const removedKeys = /* @__PURE__ */ new Set();
    let removedCount = 0;
    while (removedCount < prevCount) {
      const key = getPreviousKey(removedCount);
      if (key === firstKey) break;
      removedKeys.add(key);
      removedCount++;
    }
    const retainedCount = prevCount - removedCount;
    if (retainedCount === 0 || retainedCount >= nextCount) return false;
    for (let i = 0; i < retainedCount; i++) {
      if (getNextKey(i) !== getPreviousKey(removedCount + i)) return false;
    }
    for (let i = retainedCount; i < nextCount; i++) {
      if (removedKeys.has(getNextKey(i))) return false;
    }
    return true;
  }
  class Virtualizer {
    constructor(opts) {
      this.unsubs = [];
      this.scrollElement = null;
      this.targetWindow = null;
      this.isScrolling = false;
      this.scrollState = null;
      this.measurementsCache = [];
      this._singleLaneMeasurements = null;
      this.itemSizeCache = /* @__PURE__ */ new Map();
      this.itemSizeCacheVersion = 0;
      this.laneAssignments = /* @__PURE__ */ new Map();
      this.pendingMin = null;
      this.prevLanes = void 0;
      this.lanesChangedFlag = false;
      this.lanesSettling = false;
      this.pendingScrollAnchor = null;
      this.scrollRect = null;
      this.scrollOffset = null;
      this.scrollDirection = null;
      this.scrollAdjustments = 0;
      this._iosDeferredAdjustment = 0;
      this._iosTouching = false;
      this._iosJustTouchEnded = false;
      this._iosTouchEndTimerId = null;
      this._intendedScrollOffset = null;
      this._clampedAdjustment = null;
      this.elementsCache = /* @__PURE__ */ new Map();
      this.now = () => {
        var _a, _b, _c;
        return ((_c = (_b = (_a = this.targetWindow) == null ? void 0 : _a.performance) == null ? void 0 : _b.now) == null ? void 0 : _c.call(_b)) ?? Date.now();
      };
      this.observer = /* @__PURE__ */ (() => {
        let _ro = null;
        const get = () => {
          if (_ro) {
            return _ro;
          }
          if (!this.targetWindow || !this.targetWindow.ResizeObserver) {
            return null;
          }
          return _ro = new this.targetWindow.ResizeObserver((entries) => {
            entries.forEach((entry) => {
              const run = () => {
                const node = entry.target;
                const index = this.indexFromElement(node);
                if (!node.isConnected) {
                  this.observer.unobserve(node);
                  for (const [cacheKey, cachedNode] of this.elementsCache) {
                    if (cachedNode === node) {
                      this.elementsCache.delete(cacheKey);
                      break;
                    }
                  }
                  return;
                }
                if (!this.isIndexInRange(index)) return;
                if (this.shouldMeasureDuringScroll(index)) {
                  this.resizeItem(
                    index,
                    this.options.measureElement(node, entry, this)
                  );
                }
              };
              this.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
            });
          });
        };
        return {
          disconnect: () => {
            var _a;
            (_a = get()) == null ? void 0 : _a.disconnect();
            _ro = null;
          },
          observe: (target) => {
            var _a;
            return (_a = get()) == null ? void 0 : _a.observe(target, { box: "border-box" });
          },
          unobserve: (target) => {
            var _a;
            return (_a = get()) == null ? void 0 : _a.unobserve(target);
          }
        };
      })();
      this.range = null;
      this.setOptions = (opts2) => {
        var _a;
        const merged = {
          debug: false,
          initialOffset: 0,
          overscan: 1,
          paddingStart: 0,
          paddingEnd: 0,
          scrollPaddingStart: 0,
          scrollPaddingEnd: 0,
          horizontal: false,
          getItemKey: defaultKeyExtractor,
          rangeExtractor: defaultRangeExtractor,
          onChange: () => {
          },
          measureElement,
          initialRect: { width: 0, height: 0 },
          scrollMargin: 0,
          gap: 0,
          indexAttribute: "data-index",
          initialMeasurementsCache: [],
          lanes: 1,
          anchorTo: "start",
          followOnAppend: false,
          scrollEndThreshold: 1,
          isScrollingResetDelay: 150,
          enabled: true,
          isRtl: false,
          useScrollendEvent: false,
          useAnimationFrameWithResizeObserver: false,
          laneAssignmentMode: "estimate",
          useCachedMeasurements: false
        };
        for (const key in opts2) {
          const v = opts2[key];
          if (v !== void 0) merged[key] = v;
        }
        const prevOptions = this.options;
        let anchor = null;
        let followOnAppend = null;
        let edgeKeysChanged = false;
        if (prevOptions !== void 0 && prevOptions.enabled && merged.enabled && merged.anchorTo === "end" && this.scrollElement !== null) {
          const prevCount = prevOptions.count;
          const nextCount = merged.count;
          const measurements = this.getMeasurements();
          const previousItems = ((_a = this._singleLaneMeasurements) == null ? void 0 : _a.items) ?? measurements;
          const getPreviousKey = (index) => getMeasurementKey(previousItems[index]);
          const prevFirstKey = prevCount > 0 ? getPreviousKey(0) : null;
          const prevLastKey = prevCount > 0 ? getPreviousKey(prevCount - 1) : null;
          const didCountChange = nextCount !== prevCount;
          const didEdgeKeysChange = didCountChange || prevCount > 0 && nextCount > 0 && (merged.getItemKey(0) !== prevFirstKey || merged.getItemKey(nextCount - 1) !== prevLastKey);
          if (didEdgeKeysChange) {
            edgeKeysChanged = true;
            const item = prevCount > 0 ? this.getVirtualItemForOffset(this.getScrollOffset()) ?? measurements[0] : null;
            if (item) {
              anchor = [item.key, this.getScrollOffset() - item.start];
            }
            const behavior = merged.followOnAppend === true ? "auto" : merged.followOnAppend || null;
            if (behavior && nextCount > 0 && this.isAtEnd(prevOptions.scrollEndThreshold) && (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)) {
              if (nextCount > prevCount || isAppendWithTrim(
                prevCount,
                nextCount,
                getPreviousKey,
                merged.getItemKey
              )) {
                followOnAppend = behavior;
              }
            }
          }
        }
        this.options = merged;
        if (edgeKeysChanged) {
          this.pendingMin = 0;
          this.itemSizeCacheVersion++;
        }
        let anchorResolved = false;
        let anchorDelta = 0;
        if (anchor && this.scrollOffset !== null) {
          const [anchorKey, anchorOffset] = anchor;
          const newMeasurements = this.getMeasurements();
          const { count, getItemKey } = this.options;
          let idx = 0;
          while (idx < count && getItemKey(idx) !== anchorKey) {
            idx++;
          }
          if (idx < count) {
            const anchorItem = newMeasurements[idx];
            if (anchorItem) {
              const newOffset = Math.max(0, anchorItem.start + anchorOffset);
              if (!followOnAppend && newOffset !== this.scrollOffset) {
                anchorDelta = newOffset - this.scrollOffset;
                this.scrollOffset = newOffset;
                anchorResolved = true;
              }
            }
          }
        }
        if (anchorResolved || followOnAppend) {
          this.pendingScrollAnchor = [
            anchorResolved ? anchor[0] : null,
            anchorResolved ? anchor[1] : 0,
            followOnAppend,
            anchorDelta
          ];
        }
      };
      this.notify = (sync) => {
        var _a, _b;
        (_b = (_a = this.options).onChange) == null ? void 0 : _b.call(_a, this, sync);
      };
      this.maybeNotify = memo(
        () => {
          this.calculateRange();
          return [
            this.isScrolling,
            this.range ? this.range.startIndex : null,
            this.range ? this.range.endIndex : null
          ];
        },
        (isScrolling) => {
          this.notify(isScrolling);
        },
        {
          key: process.env.NODE_ENV !== "production" && "maybeNotify",
          debug: () => this.options.debug,
          initialDeps: [
            this.isScrolling,
            this.range ? this.range.startIndex : null,
            this.range ? this.range.endIndex : null
          ]
        }
      );
      this.cleanup = () => {
        this.unsubs.filter(Boolean).forEach((d) => d());
        this.unsubs = [];
        this.observer.disconnect();
        if (this.rafId != null && this.targetWindow) {
          this.targetWindow.cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        this.scrollState = null;
        this.isScrolling = false;
        this.scrollDirection = null;
        this._iosDeferredAdjustment = 0;
        this._iosTouching = false;
        this._iosJustTouchEnded = false;
        this._clampedAdjustment = null;
        this.scrollElement = null;
        this.targetWindow = null;
      };
      this._didMount = () => {
        return () => {
          this.cleanup();
        };
      };
      this._willUpdate = () => {
        var _a, _b;
        const scrollElement = this.options.enabled ? this.options.getScrollElement() : null;
        if (this.scrollElement !== scrollElement) {
          this.cleanup();
          if (!scrollElement) {
            this.maybeNotify();
            return;
          }
          this.scrollElement = scrollElement;
          if (this.scrollElement && "ownerDocument" in this.scrollElement) {
            this.targetWindow = this.scrollElement.ownerDocument.defaultView;
          } else {
            this.targetWindow = ((_a = this.scrollElement) == null ? void 0 : _a.window) ?? null;
          }
          this.elementsCache.forEach((cached) => {
            this.observer.observe(cached);
          });
          this.unsubs.push(
            this.options.observeElementRect(this, (rect) => {
              this.scrollRect = rect;
              this.maybeNotify();
            })
          );
          this.unsubs.push(
            this.options.observeElementOffset(this, (offset, isScrolling) => {
              if (isScrolling && this._intendedScrollOffset === null && offset === this.scrollOffset) {
                return;
              }
              if (this._intendedScrollOffset !== null && Math.abs(offset - this._intendedScrollOffset) < 1.5) {
                offset = this._intendedScrollOffset;
              }
              this._intendedScrollOffset = null;
              if (this._clampedAdjustment !== null && Math.abs(offset - this._clampedAdjustment.maxAtWrite) >= 1.5) {
                this._clampedAdjustment = null;
              }
              this.scrollAdjustments = 0;
              const prevOffset = this.getScrollOffset();
              this.scrollDirection = isScrolling ? prevOffset === offset ? this.scrollDirection : prevOffset < offset ? "forward" : "backward" : null;
              this.scrollOffset = offset;
              this.isScrolling = isScrolling;
              this._flushIosDeferredIfReady();
              if (this.scrollState) {
                this.scheduleScrollReconcile();
              }
              this.maybeNotify();
            })
          );
          if ("addEventListener" in this.scrollElement) {
            const scrollEl = this.scrollElement;
            const onTouchStart = () => {
              this._iosTouching = true;
              this._iosJustTouchEnded = false;
              if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
                this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
                this._iosTouchEndTimerId = null;
              }
            };
            const onTouchEnd = () => {
              this._iosTouching = false;
              if (!isIOSWebKit() || this.targetWindow == null) {
                return;
              }
              this._iosJustTouchEnded = true;
              this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
                this._iosJustTouchEnded = false;
                this._iosTouchEndTimerId = null;
                this._flushIosDeferredIfReady();
              }, 150);
            };
            scrollEl.addEventListener(
              "touchstart",
              onTouchStart,
              addEventListenerOptions
            );
            scrollEl.addEventListener(
              "touchend",
              onTouchEnd,
              addEventListenerOptions
            );
            this.unsubs.push(() => {
              scrollEl.removeEventListener("touchstart", onTouchStart);
              scrollEl.removeEventListener("touchend", onTouchEnd);
              if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
                this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
                this._iosTouchEndTimerId = null;
              }
            });
          }
          this._scrollToOffset(this.getScrollOffset(), {
            adjustments: void 0,
            behavior: void 0
          });
        }
        const anchor = this.pendingScrollAnchor;
        this.pendingScrollAnchor = null;
        if (anchor && this.scrollElement && this.options.enabled) {
          const [key, _offset, followOnAppend, anchorDelta] = anchor;
          if (key !== null && !followOnAppend) {
            if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
              if (anchorDelta !== 0) {
                this._iosDeferredAdjustment += anchorDelta;
              }
            } else if (((_b = this.scrollState) == null ? void 0 : _b.behavior) === "smooth" && !approxEqual(
              this.getScrollOffset() - anchorDelta,
              this.scrollState.lastTargetOffset
            )) ;
            else {
              this._scrollToOffset(this.getScrollOffset(), {
                adjustments: void 0,
                behavior: void 0
              });
            }
          }
          if (followOnAppend) {
            this.scrollToEnd({ behavior: followOnAppend });
          }
        }
        this._retryClampedAdjustment();
      };
      this._retryClampedAdjustment = () => {
        if (this._clampedAdjustment === null || !this.scrollElement || !this.options.enabled) {
          return;
        }
        const { target, maxAtWrite } = this._clampedAdjustment;
        const max = this.getMaxScrollOffset();
        if (max > maxAtWrite + 0.5) {
          this._clampedAdjustment = target > max + 0.5 ? { target, maxAtWrite: max } : null;
          this._scrollToOffset(target, {
            adjustments: void 0,
            behavior: void 0
          });
        }
      };
      this._flushIosDeferredIfReady = () => {
        if (this._iosDeferredAdjustment === 0) return;
        if (this.isScrolling) return;
        if (this._iosTouching) return;
        if (this._iosJustTouchEnded) return;
        const cur = this.getScrollOffset();
        const max = this.getMaxScrollOffset();
        if (cur < 0 || cur > max) return;
        if (this._iosDeferredAdjustment < 0 && cur >= max - 1) {
          this._iosDeferredAdjustment = 0;
          return;
        }
        const delta = this._iosDeferredAdjustment;
        this._iosDeferredAdjustment = 0;
        this._scrollToOffset(cur, {
          adjustments: this.scrollAdjustments += delta,
          behavior: void 0
        });
      };
      this.rafId = null;
      this.getSize = () => {
        if (!this.options.enabled) {
          this.scrollRect = null;
          return 0;
        }
        this.scrollRect = this.scrollRect ?? this.options.initialRect;
        return this.scrollRect[this.options.horizontal ? "width" : "height"];
      };
      this.getScrollOffset = () => {
        if (!this.options.enabled) {
          this.scrollOffset = null;
          return 0;
        }
        this.scrollOffset = this.scrollOffset ?? (typeof this.options.initialOffset === "function" ? this.options.initialOffset() : this.options.initialOffset);
        return this.scrollOffset;
      };
      this.getMeasurementOptions = memo(
        () => [
          this.options.count,
          this.options.paddingStart,
          this.options.scrollMargin,
          this.options.getItemKey,
          this.options.enabled,
          this.options.lanes,
          this.options.laneAssignmentMode,
          this.options.gap
        ],
        (count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap) => {
          const lanesChanged = this.prevLanes !== void 0 && this.prevLanes !== lanes;
          if (lanesChanged) {
            this.lanesChangedFlag = true;
          }
          this.prevLanes = lanes;
          this.pendingMin = null;
          return {
            count,
            paddingStart,
            scrollMargin,
            getItemKey,
            enabled,
            lanes,
            laneAssignmentMode,
            gap
          };
        },
        {
          key: false
        }
      );
      this.isIndexInRange = (index) => index >= 0 && index < this.options.count;
      this.getMeasurements = memo(
        () => [this.getMeasurementOptions(), this.itemSizeCacheVersion],
        ({
          count,
          paddingStart,
          scrollMargin,
          getItemKey,
          enabled,
          lanes,
          laneAssignmentMode,
          gap
        }, _itemSizeCacheVersion) => {
          var _a;
          const itemSizeCache = this.itemSizeCache;
          if (!enabled) {
            this.measurementsCache = [];
            this._singleLaneMeasurements = null;
            this.itemSizeCache.clear();
            this.laneAssignments.clear();
            return [];
          }
          if (this.laneAssignments.size > count) {
            for (const index of this.laneAssignments.keys()) {
              if (index >= count) {
                this.laneAssignments.delete(index);
              }
            }
          }
          if (this.lanesChangedFlag) {
            this.lanesChangedFlag = false;
            this.lanesSettling = true;
            this.measurementsCache = [];
            this._singleLaneMeasurements = null;
            this.itemSizeCache.clear();
            this.laneAssignments.clear();
            this.pendingMin = null;
          }
          if (this.measurementsCache.length === 0 && !this.lanesSettling) {
            this.measurementsCache = this.options.initialMeasurementsCache;
            this.measurementsCache.forEach((item) => {
              this.itemSizeCache.set(item.key, item.size);
            });
          }
          const min = this.lanesSettling ? 0 : this.pendingMin ?? 0;
          this.pendingMin = null;
          if (this.lanesSettling && this.measurementsCache.length === count) {
            this.lanesSettling = false;
          }
          if (lanes === 1) {
            const need = count * 2;
            let flat = (_a = this._singleLaneMeasurements) == null ? void 0 : _a.flat;
            if (!flat || flat.length < need) {
              const next = new Float64Array(need);
              if (flat && min > 0) next.set(flat.subarray(0, min * 2));
              flat = next;
            }
            const items = min === 0 ? new Array(count) : this._singleLaneMeasurements.items.slice();
            let runningStart;
            if (min === 0) {
              runningStart = paddingStart + scrollMargin;
            } else {
              const prevIdx = min - 1;
              runningStart = flat[prevIdx * 2] + flat[prevIdx * 2 + 1] + gap;
            }
            for (let i = min; i < count; i++) {
              const key = getItemKey(i);
              items[i] = key;
              const measuredSize = itemSizeCache.get(key);
              const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
              flat[i * 2] = runningStart;
              flat[i * 2 + 1] = size;
              runningStart += size + gap;
            }
            this._singleLaneMeasurements = { flat, items };
            const view = createLazyMeasurementsView(items, flat);
            this.measurementsCache = view;
            return view;
          }
          const measurements = this.measurementsCache.slice(0, min);
          const laneLastIndex = new Array(lanes).fill(
            void 0
          );
          const laneEnds = new Float64Array(lanes);
          let filledLanes = 0;
          for (let m = 0; m < min; m++) {
            const item = measurements[m];
            if (item) {
              if (laneLastIndex[item.lane] === void 0) filledLanes++;
              laneLastIndex[item.lane] = m;
              laneEnds[item.lane] = item.end;
            }
          }
          for (let i = min; i < count; i++) {
            const key = getItemKey(i);
            const cachedLane = this.laneAssignments.get(i);
            let lane;
            let start;
            const shouldCacheLane = laneAssignmentMode === "estimate" || itemSizeCache.has(key);
            if (cachedLane !== void 0 && this.options.lanes > 1) {
              lane = cachedLane;
              const prevIndex = laneLastIndex[lane];
              const prevInLane = prevIndex !== void 0 ? measurements[prevIndex] : void 0;
              start = prevInLane ? prevInLane.end + gap : paddingStart + scrollMargin;
            } else if (filledLanes === lanes) {
              let bestLane = 0;
              let bestEnd = laneEnds[0];
              let bestIdx = laneLastIndex[0];
              for (let l = 1; l < lanes; l++) {
                const e = laneEnds[l];
                if (e < bestEnd || e === bestEnd && laneLastIndex[l] < bestIdx) {
                  bestLane = l;
                  bestEnd = e;
                  bestIdx = laneLastIndex[l];
                }
              }
              lane = bestLane;
              start = bestEnd + gap;
              if (shouldCacheLane) {
                this.laneAssignments.set(i, lane);
              }
            } else {
              lane = i % this.options.lanes;
              start = paddingStart + scrollMargin;
              if (shouldCacheLane) {
                this.laneAssignments.set(i, lane);
              }
            }
            const measuredSize = itemSizeCache.get(key);
            const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
            const end = start + size;
            measurements[i] = {
              index: i,
              start,
              size,
              end,
              key,
              lane
            };
            if (laneLastIndex[lane] === void 0) filledLanes++;
            laneLastIndex[lane] = i;
            laneEnds[lane] = end;
          }
          this.measurementsCache = measurements;
          return measurements;
        },
        {
          key: process.env.NODE_ENV !== "production" && "getMeasurements",
          debug: () => this.options.debug
        }
      );
      this.calculateRange = memo(
        () => [
          this.getMeasurements(),
          this.getSize(),
          this.getScrollOffset(),
          this.options.lanes
        ],
        (measurements, outerSize, scrollOffset, lanes) => {
          if (measurements.length === 0 || outerSize === 0) {
            this.range = null;
            return null;
          }
          this.range = calculateRangeImpl(
            measurements,
            outerSize,
            scrollOffset,
            lanes,
            // Pass the typed array so binary search + forward-walk can read
            // start/end directly from Float64Array, skipping the Proxy traps.
            lanes === 1 && this._singleLaneMeasurements !== null ? this._singleLaneMeasurements.flat : null
          );
          return this.range;
        },
        {
          key: process.env.NODE_ENV !== "production" && "calculateRange",
          debug: () => this.options.debug
        }
      );
      this.getVirtualIndexes = memo(
        () => {
          let startIndex = null;
          let endIndex = null;
          const range = this.calculateRange();
          if (range) {
            startIndex = range.startIndex;
            endIndex = range.endIndex;
          }
          this.maybeNotify.updateDeps([this.isScrolling, startIndex, endIndex]);
          return [
            this.options.rangeExtractor,
            this.options.overscan,
            this.options.count,
            startIndex,
            endIndex
          ];
        },
        (rangeExtractor, overscan, count, startIndex, endIndex) => {
          return startIndex === null || endIndex === null ? [] : rangeExtractor({
            startIndex,
            endIndex,
            overscan,
            count
          });
        },
        {
          key: process.env.NODE_ENV !== "production" && "getVirtualIndexes",
          debug: () => this.options.debug
        }
      );
      this.indexFromElement = (node) => {
        const attributeName = this.options.indexAttribute;
        const indexStr = node.getAttribute(attributeName);
        if (!indexStr) {
          console.warn(
            `Missing attribute name '${attributeName}={index}' on measured element.`
          );
          return -1;
        }
        return parseInt(indexStr, 10);
      };
      this.shouldMeasureDuringScroll = (index) => {
        var _a;
        if (!this.scrollState || this.scrollState.behavior !== "smooth") {
          return true;
        }
        const scrollIndex = this.scrollState.index ?? ((_a = this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)) == null ? void 0 : _a.index);
        if (scrollIndex !== void 0 && this.range) {
          const bufferSize = Math.max(
            this.options.overscan,
            Math.ceil((this.range.endIndex - this.range.startIndex) / 2)
          );
          const minIndex = Math.max(0, scrollIndex - bufferSize);
          const maxIndex = Math.min(
            this.options.count - 1,
            scrollIndex + bufferSize
          );
          return index >= minIndex && index <= maxIndex;
        }
        return true;
      };
      this.measureElement = (node) => {
        if (!node) {
          this.elementsCache.forEach((cached, key2) => {
            if (!cached.isConnected) {
              this.observer.unobserve(cached);
              this.elementsCache.delete(key2);
            }
          });
          return;
        }
        const index = this.indexFromElement(node);
        if (!this.isIndexInRange(index)) return;
        const key = this.options.getItemKey(index);
        const prevNode = this.elementsCache.get(key);
        if (prevNode !== node) {
          if (prevNode) {
            this.observer.unobserve(prevNode);
          }
          this.observer.observe(node);
          this.elementsCache.set(key, node);
        }
        if ((!this.isScrolling || this.scrollState) && this.shouldMeasureDuringScroll(index)) {
          this.resizeItem(index, this.options.measureElement(node, void 0, this));
        }
      };
      this.resizeItem = (index, size) => {
        var _a, _b, _c;
        if (!this.isIndexInRange(index)) return;
        let cachedSize;
        let itemStart;
        let key;
        const flat = (_a = this._singleLaneMeasurements) == null ? void 0 : _a.flat;
        if (this.options.lanes === 1 && flat != null) {
          key = this.options.getItemKey(index);
          itemStart = flat[index * 2];
          cachedSize = flat[index * 2 + 1];
        } else {
          const item = this.measurementsCache[index];
          if (!item) return;
          key = item.key;
          itemStart = item.start;
          cachedSize = item.size;
        }
        const itemSize = this.itemSizeCache.get(key) ?? cachedSize;
        const delta = size - itemSize;
        if (delta !== 0) {
          const wasAtEnd = this.options.anchorTo === "end" && ((_b = this.scrollState) == null ? void 0 : _b.behavior) !== "smooth" && this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold;
          const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0;
          const scrollOffsetWithAdj = this.getScrollOffset() + this.scrollAdjustments;
          const isFirstMeasure = !this.itemSizeCache.has(key);
          const defaultShouldAdjust = isFirstMeasure ? (
            // First measurement: compensate any item whose top sits above the
            // fold — the estimate→actual delta must be corrected regardless of
            // scroll direction, since the whole estimated block was above it.
            itemStart < scrollOffsetWithAdj
          ) : (
            // Re-measurement: only compensate an item that is ENTIRELY above the
            // fold. An item that merely *spans* the fold (top above, bottom
            // below — e.g. a streaming chat message growing at its bottom)
            // changes size *below* the anchor point, so shifting scrollTop by the
            // delta would drag the viewport downward on every growth (#1218).
            // Also skip during backward scroll to avoid the "items jump while
            // scrolling up" cascade.
            itemStart + itemSize <= scrollOffsetWithAdj && this.scrollDirection !== "backward"
          );
          const shouldAdjustScroll = ((_c = this.scrollState) == null ? void 0 : _c.behavior) !== "smooth" && (this.shouldAdjustScrollPositionOnItemSizeChange !== void 0 ? this.shouldAdjustScrollPositionOnItemSizeChange(
            // The callback expects a VirtualItem; build one lazily only
            // when the consumer actually supplied a custom predicate.
            this.measurementsCache[index] ?? {
              index,
              key,
              start: itemStart,
              size: cachedSize,
              end: itemStart + cachedSize,
              lane: 0
            },
            delta,
            this
          ) : defaultShouldAdjust);
          if (this.pendingMin === null || index < this.pendingMin) {
            this.pendingMin = index;
          }
          this.itemSizeCache.set(key, size);
          this.itemSizeCacheVersion++;
          let adjustedSync = false;
          if (wasAtEnd) {
            adjustedSync = this.applyScrollAdjustment(
              this.getTotalSize() - prevTotalSize
            );
          } else if (shouldAdjustScroll) {
            adjustedSync = this.applyScrollAdjustment(delta);
          }
          this.notify(adjustedSync);
          this._retryClampedAdjustment();
        }
      };
      this.getVirtualItems = memo(
        () => [this.getVirtualIndexes(), this.getMeasurements()],
        (indexes, measurements) => {
          const virtualItems = [];
          for (let k = 0, len = indexes.length; k < len; k++) {
            const i = indexes[k];
            const measurement = measurements[i];
            virtualItems.push(measurement);
          }
          return virtualItems;
        },
        {
          key: process.env.NODE_ENV !== "production" && "getVirtualItems",
          debug: () => this.options.debug
        }
      );
      this.getVirtualItemForOffset = (offset) => {
        var _a;
        const measurements = this.getMeasurements();
        if (measurements.length === 0) {
          return void 0;
        }
        const flat = (_a = this._singleLaneMeasurements) == null ? void 0 : _a.flat;
        const useFlat = this.options.lanes === 1 && flat != null;
        const idx = findNearestBinarySearch(
          0,
          measurements.length - 1,
          useFlat ? (i) => flat[i * 2] : (i) => notUndefined(measurements[i]).start,
          offset
        );
        return notUndefined(measurements[idx]);
      };
      this.getMaxScrollOffset = () => {
        if (!this.scrollElement) return 0;
        if ("scrollHeight" in this.scrollElement) {
          return this.options.horizontal ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
        } else {
          const doc = this.scrollElement.document.documentElement;
          return this.options.horizontal ? doc.scrollWidth - this.scrollElement.innerWidth : doc.scrollHeight - this.scrollElement.innerHeight;
        }
      };
      this.getVirtualDistanceFromEnd = () => {
        return Math.max(
          this.getTotalSize() - this.getSize() - this.getScrollOffset(),
          0
        );
      };
      this.getDistanceFromEnd = () => {
        return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0);
      };
      this.isAtEnd = (threshold = this.options.scrollEndThreshold) => {
        return this.getDistanceFromEnd() <= threshold;
      };
      this.getOffsetForAlignment = (toOffset, align, itemSize = 0) => {
        if (!this.scrollElement) return 0;
        const size = this.getSize();
        const scrollOffset = this.getScrollOffset();
        if (align === "auto") {
          align = toOffset >= scrollOffset + size ? "end" : "start";
        }
        if (align === "center") {
          toOffset += (itemSize - size) / 2;
        } else if (align === "end") {
          toOffset -= size;
        }
        const maxOffset = this.getMaxScrollOffset();
        return Math.max(Math.min(maxOffset, toOffset), 0);
      };
      this.getOffsetForIndex = (index, align = "auto") => {
        index = Math.max(0, Math.min(index, this.options.count - 1));
        const size = this.getSize();
        const scrollOffset = this.getScrollOffset();
        const item = this.measurementsCache[index];
        if (!item) return;
        if (align === "auto") {
          if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) {
            align = "end";
          } else if (item.start <= scrollOffset + this.options.scrollPaddingStart) {
            align = "start";
          } else {
            return [scrollOffset, align];
          }
        }
        if (align === "end" && index === this.options.count - 1) {
          return [this.getMaxScrollOffset(), align];
        }
        const toOffset = align === "end" ? item.end + this.options.scrollPaddingEnd : item.start - this.options.scrollPaddingStart;
        return [
          this.getOffsetForAlignment(toOffset, align, item.size),
          align
        ];
      };
      this.scrollToOffset = (toOffset, { align = "start", behavior = "auto" } = {}) => {
        this._iosDeferredAdjustment = 0;
        const offset = this.getOffsetForAlignment(toOffset, align);
        const now = this.now();
        this.scrollState = {
          index: null,
          align,
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: void 0, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollToIndex = (index, {
        align: initialAlign = "auto",
        behavior = "auto"
      } = {}) => {
        this._iosDeferredAdjustment = 0;
        index = Math.max(0, Math.min(index, this.options.count - 1));
        const offsetInfo = this.getOffsetForIndex(index, initialAlign);
        if (!offsetInfo) {
          return;
        }
        const [offset, align] = offsetInfo;
        const now = this.now();
        this.scrollState = {
          index,
          align,
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: void 0, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollBy = (delta, { behavior = "auto" } = {}) => {
        const offset = this.getScrollOffset() + delta;
        const now = this.now();
        this.scrollState = {
          index: null,
          align: "start",
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: void 0, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollToEnd = ({ behavior = "auto" } = {}) => {
        if (this.options.count > 0) {
          this.scrollToIndex(this.options.count - 1, {
            align: "end",
            behavior
          });
          return;
        }
        this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), {
          behavior
        });
      };
      this.getTotalSize = () => {
        var _a, _b;
        const measurements = this.getMeasurements();
        let end;
        if (measurements.length === 0) {
          end = this.options.paddingStart;
        } else if (this.options.lanes === 1) {
          const lastIdx = measurements.length - 1;
          const flat = (_a = this._singleLaneMeasurements) == null ? void 0 : _a.flat;
          if (flat != null) {
            end = flat[lastIdx * 2] + flat[lastIdx * 2 + 1];
          } else {
            end = ((_b = measurements[lastIdx]) == null ? void 0 : _b.end) ?? 0;
          }
        } else {
          const endByLane = Array(this.options.lanes).fill(null);
          let endIndex = measurements.length - 1;
          while (endIndex >= 0 && endByLane.some((val) => val === null)) {
            const item = measurements[endIndex];
            if (endByLane[item.lane] === null) {
              endByLane[item.lane] = item.end;
            }
            endIndex--;
          }
          end = Math.max(...endByLane.filter((val) => val !== null));
        }
        return Math.max(
          end - this.options.scrollMargin + this.options.paddingEnd,
          0
        );
      };
      this.takeSnapshot = () => {
        const snapshot = [];
        if (this.itemSizeCache.size === 0) return snapshot;
        const m = this.getMeasurements();
        for (const item of m) {
          if (item && this.itemSizeCache.has(item.key)) {
            snapshot.push({
              index: item.index,
              key: item.key,
              start: item.start,
              size: item.size,
              end: item.end,
              lane: item.lane
            });
          }
        }
        return snapshot;
      };
      this._scrollToOffset = (offset, {
        adjustments,
        behavior
      }) => {
        this._intendedScrollOffset = offset + (adjustments ?? 0);
        this.options.scrollToFn(offset, { behavior, adjustments }, this);
      };
      this.measure = () => {
        this.pendingMin = null;
        this.itemSizeCache.clear();
        this.laneAssignments.clear();
        this.itemSizeCacheVersion++;
        this.notify(false);
      };
      this.setOptions(opts);
    }
    // Returns `true` when it performed a synchronous `scrollTop` write this
    // tick, `false` when the delta was zero or the write was deferred (iOS).
    // `resizeItem` uses that to decide whether the follow-up `notify` must be
    // synchronous so the grown transforms commit in the same paint (#1227).
    applyScrollAdjustment(delta, behavior) {
      if (delta === 0) return false;
      if (process.env.NODE_ENV !== "production" && this.options.debug) {
        console.info("correction", delta);
      }
      if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
        this._iosDeferredAdjustment += delta;
        return false;
      } else {
        const target = this.getScrollOffset() + this.scrollAdjustments + delta;
        const el = this.scrollElement;
        const maxAtWrite = el !== null && ("scrollHeight" in el || "document" in el) ? this.getMaxScrollOffset() : null;
        this._clampedAdjustment = maxAtWrite !== null && target > maxAtWrite + 0.5 ? { target, maxAtWrite } : null;
        this._scrollToOffset(this.getScrollOffset(), {
          adjustments: this.scrollAdjustments += delta,
          behavior
        });
        if (this.scrollOffset !== null) {
          this.scrollOffset += this.scrollAdjustments;
          if (this.scrollOffset < 0) this.scrollOffset = 0;
          this.scrollAdjustments = 0;
        }
        return true;
      }
    }
    scheduleScrollReconcile() {
      if (!this.targetWindow) {
        this.scrollState = null;
        return;
      }
      if (this.rafId != null) return;
      this.rafId = this.targetWindow.requestAnimationFrame(() => {
        this.rafId = null;
        this.reconcileScroll();
      });
    }
    reconcileScroll() {
      if (!this.scrollState) return;
      const el = this.scrollElement;
      if (!el) return;
      const MAX_RECONCILE_MS = 5e3;
      if (this.now() - this.scrollState.startedAt > MAX_RECONCILE_MS) {
        this.scrollState = null;
        return;
      }
      const offsetInfo = this.scrollState.index != null ? this.getOffsetForIndex(this.scrollState.index, this.scrollState.align) : void 0;
      const targetOffset = offsetInfo ? offsetInfo[0] : this.scrollState.lastTargetOffset;
      const STABLE_FRAMES = 1;
      const targetChanged = targetOffset !== this.scrollState.lastTargetOffset;
      if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
        this.scrollState.stableFrames++;
        if (this.scrollState.stableFrames >= STABLE_FRAMES) {
          if (this.getScrollOffset() !== targetOffset) {
            this._scrollToOffset(targetOffset, {
              adjustments: void 0,
              behavior: "auto"
            });
          }
          this.scrollState = null;
          return;
        }
      } else {
        this.scrollState.stableFrames = 0;
        if (targetChanged) {
          const viewport = this.getSize() || 600;
          const distance = Math.abs(targetOffset - this.getScrollOffset());
          const keepSmooth = this.scrollState.behavior === "smooth" && distance > viewport;
          this.scrollState.lastTargetOffset = targetOffset;
          if (!keepSmooth) {
            this.scrollState.behavior = "auto";
          }
          this._scrollToOffset(targetOffset, {
            adjustments: void 0,
            behavior: keepSmooth ? "smooth" : "auto"
          });
        }
      }
      this.scheduleScrollReconcile();
    }
  }
  const findNearestBinarySearch = (low, high, getCurrentValue, value) => {
    while (low <= high) {
      const middle = (low + high) / 2 | 0;
      const currentValue = getCurrentValue(middle);
      if (currentValue < value) {
        low = middle + 1;
      } else if (currentValue > value) {
        high = middle - 1;
      } else {
        return middle;
      }
    }
    if (low > 0) {
      return low - 1;
    } else {
      return 0;
    }
  };
  function findNearestBinarySearchFlat(flat, high, value) {
    let low = 0;
    while (low <= high) {
      const middle = (low + high) / 2 | 0;
      const currentValue = flat[middle * 2];
      if (currentValue < value) {
        low = middle + 1;
      } else if (currentValue > value) {
        high = middle - 1;
      } else {
        return middle;
      }
    }
    return low > 0 ? low - 1 : 0;
  }
  function calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, flat) {
    const lastIndex = measurements.length - 1;
    if (measurements.length <= lanes) {
      return { startIndex: 0, endIndex: lastIndex };
    }
    if (lanes === 1 && flat !== null) {
      const startIndex2 = findNearestBinarySearchFlat(
        flat,
        lastIndex,
        scrollOffset
      );
      let endIndex2 = startIndex2;
      const limit = scrollOffset + outerSize;
      while (endIndex2 < lastIndex && flat[endIndex2 * 2] + flat[endIndex2 * 2 + 1] < limit) {
        endIndex2++;
      }
      return { startIndex: startIndex2, endIndex: endIndex2 };
    }
    const getStart = (index) => measurements[index].start;
    let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset);
    let endIndex = startIndex;
    if (lanes === 1) {
      while (endIndex < lastIndex && measurements[endIndex].end < scrollOffset + outerSize) {
        endIndex++;
      }
    } else if (lanes > 1) {
      const endPerLane = Array(lanes).fill(0);
      while (endIndex < lastIndex && endPerLane.some((pos) => pos < scrollOffset + outerSize)) {
        const item = measurements[endIndex];
        endPerLane[item.lane] = item.end;
        endIndex++;
      }
      const startPerLane = Array(lanes).fill(scrollOffset + outerSize);
      while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
        const item = measurements[startIndex];
        startPerLane[item.lane] = item.start;
        startIndex--;
      }
      startIndex = Math.max(0, startIndex - startIndex % lanes);
      endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - endIndex % lanes));
    }
    return { startIndex, endIndex };
  }

  function useVirtualizerBase(options) {
    const virtualizer = new Virtualizer(e$2.unref(options));
    const state = e$2.shallowRef(virtualizer);
    const cleanup = virtualizer._didMount();
    e$2.watch(
      () => e$2.unref(options).getScrollElement(),
      (el) => {
        if (el) {
          virtualizer._willUpdate();
        }
      },
      {
        immediate: true
      }
    );
    e$2.watch(
      () => e$2.unref(options),
      (options2) => {
        virtualizer.setOptions({
          ...options2,
          onChange: (instance, sync) => {
            var _a;
            e$2.triggerRef(state);
            (_a = options2.onChange) == null ? void 0 : _a.call(options2, instance, sync);
          }
        });
        virtualizer._willUpdate();
        e$2.triggerRef(state);
      },
      {
        immediate: true
      }
    );
    e$2.onScopeDispose(cleanup);
    return state;
  }
  function useVirtualizer(options) {
    return useVirtualizerBase(
      e$2.computed(() => ({
        observeElementRect,
        observeElementOffset,
        scrollToFn: elementScroll,
        ...e$2.unref(options)
      }))
    );
  }

  function d$7(u,e,r){let i=e$2.ref(r==null?void 0:r.value),f=e$2.computed(()=>u.value!==void 0);return [e$2.computed(()=>f.value?u.value:i.value),function(t){return f.value||(i.value=t),e==null?void 0:e(t)}]}

  function t$6(e){typeof queueMicrotask=="function"?queueMicrotask(e):Promise.resolve().then(e).catch(o=>setTimeout(()=>{throw o}));}

  function o$5(){let a=[],s={addEventListener(e,t,r,i){return e.addEventListener(t,r,i),s.add(()=>e.removeEventListener(t,r,i))},requestAnimationFrame(...e){let t=requestAnimationFrame(...e);s.add(()=>cancelAnimationFrame(t));},nextFrame(...e){s.requestAnimationFrame(()=>{s.requestAnimationFrame(...e);});},setTimeout(...e){let t=setTimeout(...e);s.add(()=>clearTimeout(t));},microTask(...e){let t={current:true};return t$6(()=>{t.current&&e[0]();}),s.add(()=>{t.current=false;})},style(e,t,r){let i=e.style.getPropertyValue(t);return Object.assign(e.style,{[t]:r}),this.add(()=>{Object.assign(e.style,{[t]:i});})},group(e){let t=o$5();return e(t),this.add(()=>t.dispose())},add(e){return a.push(e),()=>{let t=a.indexOf(e);if(t>=0)for(let r of a.splice(t,1))r();}},dispose(){for(let e of a.splice(0))e();}};return s}

  function i$7(){let o=o$5();return e$2.onUnmounted(()=>o.dispose()),o}

  function t$5(){let e=i$7();return o=>{e.dispose(),e.nextFrame(o);}}

  var r$2;let n$4=Symbol("headlessui.useid"),o$4=0;const i$6=(r$2=e__namespace.useId)!=null?r$2:function(){return e__namespace.inject(n$4,()=>`${++o$4}`)()};function s$5(t){e__namespace.provide(n$4,t);}

  function o$3(e){var l;if(e==null||e.value==null)return null;let n=(l=e.value.$el)!=null?l:e.value;return n instanceof Node?n:null}

  function u$7(r,n,...a){if(r in n){let e=n[r];return typeof e=="function"?e(...a):e}let t=new Error(`Tried to handle "${r}" but there is no handler defined. Only defined handlers are: ${Object.keys(n).map(e=>`"${e}"`).join(", ")}.`);throw Error.captureStackTrace&&Error.captureStackTrace(t,u$7),t}

  var i$5=Object.defineProperty;var d$6=(t,e,r)=>e in t?i$5(t,e,{enumerable:true,configurable:true,writable:true,value:r}):t[e]=r;var n$3=(t,e,r)=>(d$6(t,typeof e!="symbol"?e+"":e,r),r);let s$4 = class s{constructor(){n$3(this,"current",this.detect());n$3(this,"currentId",0);}set(e){this.current!==e&&(this.currentId=0,this.current=e);}reset(){this.set(this.detect());}nextId(){return ++this.currentId}get isServer(){return this.current==="server"}get isClient(){return this.current==="client"}detect(){return typeof window=="undefined"||typeof document=="undefined"?"server":"client"}};let c$3=new s$4;

  function i$4(r){if(c$3.isServer)return null;if(r instanceof Node)return r.ownerDocument;if(r!=null&&r.hasOwnProperty("value")){let n=o$3(r);if(n)return n.ownerDocument}return document}

  let c$2=["[contentEditable=true]","[tabindex]","a[href]","area[href]","button:not([disabled])","iframe","input:not([disabled])","select:not([disabled])","textarea:not([disabled])"].map(e=>`${e}:not([tabindex='-1'])`).join(",");var N$6=(n=>(n[n.First=1]="First",n[n.Previous=2]="Previous",n[n.Next=4]="Next",n[n.Last=8]="Last",n[n.WrapAround=16]="WrapAround",n[n.NoScroll=32]="NoScroll",n))(N$6||{}),T$3=(o=>(o[o.Error=0]="Error",o[o.Overflow=1]="Overflow",o[o.Success=2]="Success",o[o.Underflow=3]="Underflow",o))(T$3||{}),F$1=(t=>(t[t.Previous=-1]="Previous",t[t.Next=1]="Next",t))(F$1||{});function E$4(e=document.body){return e==null?[]:Array.from(e.querySelectorAll(c$2)).sort((r,t)=>Math.sign((r.tabIndex||Number.MAX_SAFE_INTEGER)-(t.tabIndex||Number.MAX_SAFE_INTEGER)))}var h=(t=>(t[t.Strict=0]="Strict",t[t.Loose=1]="Loose",t))(h||{});function w$4(e,r=0){var t;return e===((t=i$4(e))==null?void 0:t.body)?false:u$7(r,{[0](){return e.matches(c$2)},[1](){let l=e;for(;l!==null;){if(l.matches(c$2))return  true;l=l.parentElement;}return  false}})}function _(e){let r=i$4(e);e$2.nextTick(()=>{r&&!w$4(r.activeElement,0)&&S$1(e);});}var y$2=(t=>(t[t.Keyboard=0]="Keyboard",t[t.Mouse=1]="Mouse",t))(y$2||{});typeof window!="undefined"&&typeof document!="undefined"&&(document.addEventListener("keydown",e=>{e.metaKey||e.altKey||e.ctrlKey||(document.documentElement.dataset.headlessuiFocusVisible="");},true),document.addEventListener("click",e=>{e.detail===1?delete document.documentElement.dataset.headlessuiFocusVisible:e.detail===0&&(document.documentElement.dataset.headlessuiFocusVisible="");},true));function S$1(e){e==null||e.focus({preventScroll:true});}let H$3=["textarea","input"].join(",");function I(e){var r,t;return (t=(r=e==null?void 0:e.matches)==null?void 0:r.call(e,H$3))!=null?t:false}function O$2(e,r=t=>t){return e.slice().sort((t,l)=>{let o=r(t),i=r(l);if(o===null||i===null)return 0;let n=o.compareDocumentPosition(i);return n&Node.DOCUMENT_POSITION_FOLLOWING?-1:n&Node.DOCUMENT_POSITION_PRECEDING?1:0})}function v$2(e,r){return P(E$4(),r,{relativeTo:e})}function P(e,r,{sorted:t=true,relativeTo:l=null,skipElements:o=[]}={}){var m;let i=(m=Array.isArray(e)?e.length>0?e[0].ownerDocument:document:e==null?void 0:e.ownerDocument)!=null?m:document,n=Array.isArray(e)?t?O$2(e):e:E$4(e);o.length>0&&n.length>1&&(n=n.filter(s=>!o.includes(s))),l=l!=null?l:i.activeElement;let x=(()=>{if(r&5)return 1;if(r&10)return  -1;throw new Error("Missing Focus.First, Focus.Previous, Focus.Next or Focus.Last")})(),p=(()=>{if(r&1)return 0;if(r&2)return Math.max(0,n.indexOf(l))-1;if(r&4)return Math.max(0,n.indexOf(l))+1;if(r&8)return n.length-1;throw new Error("Missing Focus.First, Focus.Previous, Focus.Next or Focus.Last")})(),L=r&32?{preventScroll:true}:{},a=0,d=n.length,u;do{if(a>=d||a+d<=0)return 0;let s=p+a;if(r&16)s=(s+d)%d;else {if(s<0)return 3;if(s>=d)return 1}u=n[s],u==null||u.focus(L),a+=x;}while(u!==i.activeElement);return r&6&&I(u)&&u.select(),2}

  function t$4(){return /iPhone/gi.test(window.navigator.platform)||/Mac/gi.test(window.navigator.platform)&&window.navigator.maxTouchPoints>0}function i$3(){return /Android/gi.test(window.navigator.userAgent)}function n$2(){return t$4()||i$3()}

  function u$6(e,t,n){c$3.isServer||e$2.watchEffect(o=>{document.addEventListener(e,t,n),o(()=>document.removeEventListener(e,t,n));});}

  function w$3(e,n,t){c$3.isServer||e$2.watchEffect(o=>{window.addEventListener(e,n,t),o(()=>window.removeEventListener(e,n,t));});}

  function w$2(f,m,l=e$2.computed(()=>true)){function a(e,r){if(!l.value||e.defaultPrevented)return;let t=r(e);if(t===null||!t.getRootNode().contains(t))return;let c=function o(n){return typeof n=="function"?o(n()):Array.isArray(n)||n instanceof Set?n:[n]}(f);for(let o of c){if(o===null)continue;let n=o instanceof HTMLElement?o:o$3(o);if(n!=null&&n.contains(t)||e.composed&&e.composedPath().includes(n))return}return !w$4(t,h.Loose)&&t.tabIndex!==-1&&e.preventDefault(),m(e,t)}let u=e$2.ref(null);u$6("pointerdown",e=>{var r,t;l.value&&(u.value=((t=(r=e.composedPath)==null?void 0:r.call(e))==null?void 0:t[0])||e.target);},true),u$6("mousedown",e=>{var r,t;l.value&&(u.value=((t=(r=e.composedPath)==null?void 0:r.call(e))==null?void 0:t[0])||e.target);},true),u$6("click",e=>{n$2()||u.value&&(a(e,()=>u.value),u.value=null);},true),u$6("touchend",e=>a(e,()=>e.target instanceof HTMLElement?e.target:null),true),w$3("blur",e=>a(e,()=>window.document.activeElement instanceof HTMLIFrameElement?window.document.activeElement:null),true);}

  function r$1(t,e){if(t)return t;let n=e!=null?e:"button";if(typeof n=="string"&&n.toLowerCase()==="button")return "button"}function s$3(t,e){let n=e$2.ref(r$1(t.value.type,t.value.as));return e$2.onMounted(()=>{n.value=r$1(t.value.type,t.value.as);}),e$2.watchEffect(()=>{var u;n.value||o$3(e)&&o$3(e)instanceof HTMLButtonElement&&!((u=o$3(e))!=null&&u.hasAttribute("type"))&&(n.value="button");}),n}

  function r(e){return [e.screenX,e.screenY]}function u$5(){let e=e$2.ref([-1,-1]);return {wasMoved(n){let t=r(n);return e.value[0]===t[0]&&e.value[1]===t[1]?false:(e.value=t,true)},update(n){e.value=r(n);}}}

  function i$2({container:e,accept:t,walk:d,enabled:o}){e$2.watchEffect(()=>{let r=e.value;if(!r||o!==void 0&&!o.value)return;let l=i$4(e);if(!l)return;let c=Object.assign(f=>t(f),{acceptNode:t}),n=l.createTreeWalker(r,NodeFilter.SHOW_ELEMENT,c,false);for(;n.nextNode();)d(n.currentNode);});}

  var N$5=(o=>(o[o.None=0]="None",o[o.RenderStrategy=1]="RenderStrategy",o[o.Static=2]="Static",o))(N$5||{}),S=(e=>(e[e.Unmount=0]="Unmount",e[e.Hidden=1]="Hidden",e))(S||{});function A$4({visible:r=true,features:t=0,ourProps:e,theirProps:o,...i}){var a;let n=j(o,e),l=Object.assign(i,{props:n});if(r||t&2&&n.static)return y$1(l);if(t&1){let d=(a=n.unmount)==null||a?0:1;return u$7(d,{[0](){return null},[1](){return y$1({...i,props:{...n,hidden:true,style:{display:"none"}}})}})}return y$1(l)}function y$1({props:r,attrs:t,slots:e,slot:o,name:i}){var m,h;let{as:n,...l}=T$2(r,["unmount","static"]),a=(m=e.default)==null?void 0:m.call(e,o),d={};if(o){let u=false,c=[];for(let[p,f]of Object.entries(o))typeof f=="boolean"&&(u=true),f===true&&c.push(p);u&&(d["data-headlessui-state"]=c.join(" "));}if(n==="template"){if(a=b(a!=null?a:[]),Object.keys(l).length>0||Object.keys(t).length>0){let[u,...c]=a!=null?a:[];if(!v$1(u)||c.length>0)throw new Error(['Passing props on "template"!',"",`The current component <${i} /> is rendering a "template".`,"However we need to passthrough the following props:",Object.keys(l).concat(Object.keys(t)).map(s=>s.trim()).filter((s,g,R)=>R.indexOf(s)===g).sort((s,g)=>s.localeCompare(g)).map(s=>`  - ${s}`).join(`
`),"","You can apply a few solutions:",['Add an `as="..."` prop, to ensure that we render an actual element instead of a "template".',"Render a single element as the child so that we can forward the props onto that element."].map(s=>`  - ${s}`).join(`
`)].join(`
`));let p=j((h=u.props)!=null?h:{},l,d),f=e$2.cloneVNode(u,p,true);for(let s in p)s.startsWith("on")&&(f.props||(f.props={}),f.props[s]=p[s]);return f}return Array.isArray(a)&&a.length===1?a[0]:a}return e$2.h(n,Object.assign({},l,d),{default:()=>a})}function b(r){return r.flatMap(t=>t.type===e$2.Fragment?b(t.children):[t])}function j(...r){if(r.length===0)return {};if(r.length===1)return r[0];let t={},e={};for(let i of r)for(let n in i)n.startsWith("on")&&typeof i[n]=="function"?((e[n])!=null||(e[n]=[]),e[n].push(i[n])):t[n]=i[n];if(t.disabled||t["aria-disabled"])return Object.assign(t,Object.fromEntries(Object.keys(e).map(i=>[i,void 0])));for(let i in e)Object.assign(t,{[i](n,...l){let a=e[i];for(let d of a){if(n instanceof Event&&n.defaultPrevented)return;d(n,...l);}}});return t}function E$3(r){let t=Object.assign({},r);for(let e in t)t[e]===void 0&&delete t[e];return t}function T$2(r,t=[]){let e=Object.assign({},r);for(let o of t)o in e&&delete e[o];return e}function v$1(r){return r==null?false:typeof r.type=="string"||typeof r.type=="object"||typeof r.type=="function"}

  var u$4=(e=>(e[e.None=1]="None",e[e.Focusable=2]="Focusable",e[e.Hidden=4]="Hidden",e))(u$4||{});let f$3=e$2.defineComponent({name:"Hidden",props:{as:{type:[Object,String],default:"div"},features:{type:Number,default:1}},setup(t,{slots:n,attrs:i}){return ()=>{var r;let{features:e,...d}=t,o={"aria-hidden":(e&2)===2?true:(r=d["aria-hidden"])!=null?r:void 0,hidden:(e&4)===4?true:void 0,style:{position:"fixed",top:1,left:1,width:1,height:0,padding:0,margin:-1,overflow:"hidden",clip:"rect(0, 0, 0, 0)",whiteSpace:"nowrap",borderWidth:"0",...(e&4)===4&&(e&2)!==2&&{display:"none"}}};return A$4({ourProps:o,theirProps:d,slot:{},attrs:i,slots:n,name:"Hidden"})}}});

  let n$1=Symbol("Context");var i$1=(e=>(e[e.Open=1]="Open",e[e.Closed=2]="Closed",e[e.Closing=4]="Closing",e[e.Opening=8]="Opening",e))(i$1||{});function s$2(){return l$2()!==null}function l$2(){return e$2.inject(n$1,null)}function t$3(o){e$2.provide(n$1,o);}

  var o$2=(r=>(r.Space=" ",r.Enter="Enter",r.Escape="Escape",r.Backspace="Backspace",r.Delete="Delete",r.ArrowLeft="ArrowLeft",r.ArrowUp="ArrowUp",r.ArrowRight="ArrowRight",r.ArrowDown="ArrowDown",r.Home="Home",r.End="End",r.PageUp="PageUp",r.PageDown="PageDown",r.Tab="Tab",r))(o$2||{});

  var g$3=(f=>(f[f.Left=0]="Left",f[f.Right=2]="Right",f))(g$3||{});

  function t$2(n){function e(){document.readyState!=="loading"&&(n(),document.removeEventListener("DOMContentLoaded",e));}typeof window!="undefined"&&typeof document!="undefined"&&(document.addEventListener("DOMContentLoaded",e),e());}

  let t$1=[];t$2(()=>{function e(n){n.target instanceof HTMLElement&&n.target!==document.body&&t$1[0]!==n.target&&(t$1.unshift(n.target),t$1=t$1.filter(r=>r!=null&&r.isConnected),t$1.splice(10));}window.addEventListener("click",e,{capture:true}),window.addEventListener("mousedown",e,{capture:true}),window.addEventListener("focus",e,{capture:true}),document.body.addEventListener("click",e,{capture:true}),document.body.addEventListener("mousedown",e,{capture:true}),document.body.addEventListener("focus",e,{capture:true});});

  function u$3(l){throw new Error("Unexpected object: "+l)}var c$1=(i=>(i[i.First=0]="First",i[i.Previous=1]="Previous",i[i.Next=2]="Next",i[i.Last=3]="Last",i[i.Specific=4]="Specific",i[i.Nothing=5]="Nothing",i))(c$1||{});function f$2(l,n){let t=n.resolveItems();if(t.length<=0)return null;let r=n.resolveActiveIndex(),s=r!=null?r:-1;switch(l.focus){case 0:{for(let e=0;e<t.length;++e)if(!n.resolveDisabled(t[e],e,t))return e;return r}case 1:{s===-1&&(s=t.length);for(let e=s-1;e>=0;--e)if(!n.resolveDisabled(t[e],e,t))return e;return r}case 2:{for(let e=s+1;e<t.length;++e)if(!n.resolveDisabled(t[e],e,t))return e;return r}case 3:{for(let e=t.length-1;e>=0;--e)if(!n.resolveDisabled(t[e],e,t))return e;return r}case 4:{for(let e=0;e<t.length;++e)if(n.resolveId(t[e],e,t)===l.id)return e;return r}case 5:return null;default:u$3(l);}}

  function e$1(i={},s=null,t=[]){for(let[r,n]of Object.entries(i))o$1(t,f$1(s,r),n);return t}function f$1(i,s){return i?i+"["+s+"]":s}function o$1(i,s,t){if(Array.isArray(t))for(let[r,n]of t.entries())o$1(i,f$1(s,r.toString()),n);else t instanceof Date?i.push([s,t.toISOString()]):typeof t=="boolean"?i.push([s,t?"1":"0"]):typeof t=="string"?i.push([s,t]):typeof t=="number"?i.push([s,`${t}`]):t==null?i.push([s,""]):e$1(t,s,i);}function p$1(i){var t,r;let s=(t=i==null?void 0:i.form)!=null?t:i.closest("form");if(s){for(let n of s.elements)if(n!==i&&(n.tagName==="INPUT"&&n.type==="submit"||n.tagName==="BUTTON"&&n.type==="submit"||n.nodeName==="INPUT"&&n.type==="image")){n.click();return}(r=s.requestSubmit)==null||r.call(s);}}

  function De(a,h){return a===h}var Ee$2=(r=>(r[r.Open=0]="Open",r[r.Closed=1]="Closed",r))(Ee$2||{}),Ve$1=(r=>(r[r.Single=0]="Single",r[r.Multi=1]="Multi",r))(Ve$1||{}),ke$1=(y=>(y[y.Pointer=0]="Pointer",y[y.Focus=1]="Focus",y[y.Other=2]="Other",y))(ke$1||{});let ne=Symbol("ComboboxContext");function K$2(a){let h=e$2.inject(ne,null);if(h===null){let r=new Error(`<${a} /> is missing a parent <Combobox /> component.`);throw Error.captureStackTrace&&Error.captureStackTrace(r,K$2),r}return h}let ie$1=Symbol("VirtualContext"),Ae$2=e$2.defineComponent({name:"VirtualProvider",setup(a,{slots:h}){let r=K$2("VirtualProvider"),y=e$2.computed(()=>{let c=o$3(r.optionsRef);if(!c)return {start:0,end:0};let f=window.getComputedStyle(c);return {start:parseFloat(f.paddingBlockStart||f.paddingTop),end:parseFloat(f.paddingBlockEnd||f.paddingBottom)}}),o=useVirtualizer(e$2.computed(()=>({scrollPaddingStart:y.value.start,scrollPaddingEnd:y.value.end,count:r.virtual.value.options.length,estimateSize(){return 40},getScrollElement(){return o$3(r.optionsRef)},overscan:12}))),u=e$2.computed(()=>{var c;return (c=r.virtual.value)==null?void 0:c.options}),e=e$2.ref(0);return e$2.watch([u],()=>{e.value+=1;}),e$2.provide(ie$1,r.virtual.value?o:null),()=>[e$2.h("div",{style:{position:"relative",width:"100%",height:`${o.value.getTotalSize()}px`},ref:c=>{if(c){if(typeof process!="undefined"&&process.env.JEST_WORKER_ID!==void 0||r.activationTrigger.value===0)return;r.activeOptionIndex.value!==null&&r.virtual.value.options.length>r.activeOptionIndex.value&&o.value.scrollToIndex(r.activeOptionIndex.value);}}},o.value.getVirtualItems().map(c=>e$2.cloneVNode(h.default({option:r.virtual.value.options[c.index],open:r.comboboxState.value===0})[0],{key:`${e.value}-${c.index}`,"data-index":c.index,"aria-setsize":r.virtual.value.options.length,"aria-posinset":c.index+1,style:{position:"absolute",top:0,left:0,transform:`translateY(${c.start}px)`,overflowAnchor:"none"}})))]}}),lt=e$2.defineComponent({name:"Combobox",emits:{"update:modelValue":a=>true},props:{as:{type:[Object,String],default:"template"},disabled:{type:[Boolean],default:false},by:{type:[String,Function],nullable:true,default:null},modelValue:{type:[Object,String,Number,Boolean],default:void 0},defaultValue:{type:[Object,String,Number,Boolean],default:void 0},form:{type:String,optional:true},name:{type:String,optional:true},nullable:{type:Boolean,default:false},multiple:{type:[Boolean],default:false},immediate:{type:[Boolean],default:false},virtual:{type:Object,default:null}},inheritAttrs:false,setup(a,{slots:h,attrs:r,emit:y}){let o=e$2.ref(1),u=e$2.ref(null),e=e$2.ref(null),c=e$2.ref(null),f=e$2.ref(null),S=e$2.ref({static:false,hold:false}),v=e$2.ref([]),d=e$2.ref(null),D=e$2.ref(2),E=e$2.ref(false);function w(t=n=>n){let n=d.value!==null?v.value[d.value]:null,s=t(v.value.slice()),b=s.length>0&&s[0].dataRef.order.value!==null?s.sort((C,A)=>C.dataRef.order.value-A.dataRef.order.value):O$2(s,C=>o$3(C.dataRef.domRef)),O=n?b.indexOf(n):null;return O===-1&&(O=null),{options:b,activeOptionIndex:O}}let M=e$2.computed(()=>a.multiple?1:0),$=e$2.computed(()=>a.nullable),[B,p]=d$7(e$2.computed(()=>a.modelValue),t=>y("update:modelValue",t),e$2.computed(()=>a.defaultValue)),R=e$2.computed(()=>B.value===void 0?u$7(M.value,{[1]:[],[0]:void 0}):B.value),V=null,i=null;function I(t){return u$7(M.value,{[0](){return p==null?void 0:p(t)},[1]:()=>{let n=e$2.toRaw(l.value.value).slice(),s=e$2.toRaw(t),b=n.findIndex(O=>l.compare(s,e$2.toRaw(O)));return b===-1?n.push(s):n.splice(b,1),p==null?void 0:p(n)}})}let T=e$2.computed(()=>{});e$2.watch([T],([t],[n])=>{if(l.virtual.value&&t&&n&&d.value!==null){let s=t.indexOf(n[d.value]);s!==-1?d.value=s:d.value=null;}});let l={comboboxState:o,value:R,mode:M,compare(t,n){if(typeof a.by=="string"){let s=a.by;return (t==null?void 0:t[s])===(n==null?void 0:n[s])}return a.by===null?De(t,n):a.by(t,n)},calculateIndex(t){return l.virtual.value?a.by===null?l.virtual.value.options.indexOf(t):l.virtual.value.options.findIndex(n=>l.compare(n,t)):v.value.findIndex(n=>l.compare(n.dataRef.value,t))},defaultValue:e$2.computed(()=>a.defaultValue),nullable:$,immediate:e$2.computed(()=>false),virtual:e$2.computed(()=>null),inputRef:e,labelRef:u,buttonRef:c,optionsRef:f,disabled:e$2.computed(()=>a.disabled),options:v,change(t){p(t);},activeOptionIndex:e$2.computed(()=>{if(E.value&&d.value===null&&(l.virtual.value?l.virtual.value.options.length>0:v.value.length>0)){if(l.virtual.value){let n=l.virtual.value.options.findIndex(s=>{var b;return !((b=l.virtual.value)!=null&&b.disabled(s))});if(n!==-1)return n}let t=v.value.findIndex(n=>!n.dataRef.disabled);if(t!==-1)return t}return d.value}),activationTrigger:D,optionsPropsRef:S,closeCombobox(){E.value=false,!a.disabled&&o.value!==1&&(o.value=1,d.value=null);},openCombobox(){if(E.value=true,!a.disabled&&o.value!==0){if(l.value.value){let t=l.calculateIndex(l.value.value);t!==-1&&(d.value=t);}o.value=0;}},setActivationTrigger(t){D.value=t;},goToOption(t,n,s){E.value=false,V!==null&&cancelAnimationFrame(V),V=requestAnimationFrame(()=>{if(a.disabled||f.value&&!S.value.static&&o.value===1)return;if(l.virtual.value){d.value=t===c$1.Specific?n:f$2({focus:t},{resolveItems:()=>l.virtual.value.options,resolveActiveIndex:()=>{var C,A;return (A=(C=l.activeOptionIndex.value)!=null?C:l.virtual.value.options.findIndex(j=>{var q;return !((q=l.virtual.value)!=null&&q.disabled(j))}))!=null?A:null},resolveDisabled:C=>l.virtual.value.disabled(C),resolveId(){throw new Error("Function not implemented.")}}),D.value=s!=null?s:2;return}let b=w();if(b.activeOptionIndex===null){let C=b.options.findIndex(A=>!A.dataRef.disabled);C!==-1&&(b.activeOptionIndex=C);}let O=t===c$1.Specific?n:f$2({focus:t},{resolveItems:()=>b.options,resolveActiveIndex:()=>b.activeOptionIndex,resolveId:C=>C.id,resolveDisabled:C=>C.dataRef.disabled});d.value=O,D.value=s!=null?s:2,v.value=b.options;});},selectOption(t){let n=v.value.find(b=>b.id===t);if(!n)return;let{dataRef:s}=n;I(s.value);},selectActiveOption(){if(l.activeOptionIndex.value!==null){if(l.virtual.value)I(l.virtual.value.options[l.activeOptionIndex.value]);else {let{dataRef:t}=v.value[l.activeOptionIndex.value];I(t.value);}l.goToOption(c$1.Specific,l.activeOptionIndex.value);}},registerOption(t,n){let s=e$2.reactive({id:t,dataRef:n});if(l.virtual.value){v.value.push(s);return}i&&cancelAnimationFrame(i);let b=w(O=>(O.push(s),O));d.value===null&&l.isSelected(n.value.value)&&(b.activeOptionIndex=b.options.indexOf(s)),v.value=b.options,d.value=b.activeOptionIndex,D.value=2,b.options.some(O=>!o$3(O.dataRef.domRef))&&(i=requestAnimationFrame(()=>{let O=w();v.value=O.options,d.value=O.activeOptionIndex;}));},unregisterOption(t,n){if(V!==null&&cancelAnimationFrame(V),n&&(E.value=true),l.virtual.value){v.value=v.value.filter(b=>b.id!==t);return}let s=w(b=>{let O=b.findIndex(C=>C.id===t);return O!==-1&&b.splice(O,1),b});v.value=s.options,d.value=s.activeOptionIndex,D.value=2;},isSelected(t){return u$7(M.value,{[0]:()=>l.compare(e$2.toRaw(l.value.value),e$2.toRaw(t)),[1]:()=>e$2.toRaw(l.value.value).some(n=>l.compare(e$2.toRaw(n),e$2.toRaw(t)))})},isActive(t){return d.value===l.calculateIndex(t)}};w$2([e,c,f],()=>l.closeCombobox(),e$2.computed(()=>o.value===0)),e$2.provide(ne,l),t$3(e$2.computed(()=>u$7(o.value,{[0]:i$1.Open,[1]:i$1.Closed})));let g=e$2.computed(()=>{var t;return (t=o$3(e))==null?void 0:t.closest("form")});return e$2.onMounted(()=>{e$2.watch([g],()=>{if(!g.value||a.defaultValue===void 0)return;function t(){l.change(a.defaultValue);}return g.value.addEventListener("reset",t),()=>{var n;(n=g.value)==null||n.removeEventListener("reset",t);}},{immediate:true});}),()=>{var C,A,j;let{name:t,disabled:n,form:s,...b}=a,O={open:o.value===0,disabled:n,activeIndex:l.activeOptionIndex.value,activeOption:l.activeOptionIndex.value===null?null:l.virtual.value?l.virtual.value.options[(C=l.activeOptionIndex.value)!=null?C:0]:(j=(A=l.options.value[l.activeOptionIndex.value])==null?void 0:A.dataRef.value)!=null?j:null,value:R.value};return e$2.h(e$2.Fragment,[...t!=null&&R.value!=null?e$1({[t]:R.value}).map(([q,ue])=>e$2.h(f$3,E$3({features:u$4.Hidden,key:q,as:"input",type:"hidden",hidden:true,readOnly:true,form:s,disabled:n,name:q,value:ue}))):[],A$4({theirProps:{...r,...T$2(b,["by","defaultValue","immediate","modelValue","multiple","nullable","onUpdate:modelValue","virtual"])},ourProps:{},slot:O,slots:h,attrs:r,name:"Combobox"})])}}}),at=e$2.defineComponent({name:"ComboboxLabel",props:{as:{type:[Object,String],default:"label"},id:{type:String,default:null}},setup(a,{attrs:h,slots:r}){var e;let y=(e=a.id)!=null?e:`headlessui-combobox-label-${i$6()}`,o=K$2("ComboboxLabel");function u(){var c;(c=o$3(o.inputRef))==null||c.focus({preventScroll:true});}return ()=>{let c={open:o.comboboxState.value===0,disabled:o.disabled.value},{...f}=a,S={id:y,ref:o.labelRef,onClick:u};return A$4({ourProps:S,theirProps:f,slot:c,attrs:h,slots:r,name:"ComboboxLabel"})}}}),nt=e$2.defineComponent({name:"ComboboxButton",props:{as:{type:[Object,String],default:"button"},id:{type:String,default:null}},setup(a,{attrs:h,slots:r,expose:y}){var S;let o=(S=a.id)!=null?S:`headlessui-combobox-button-${i$6()}`,u=K$2("ComboboxButton");y({el:u.buttonRef,$el:u.buttonRef});function e(v){u.disabled.value||(u.comboboxState.value===0?u.closeCombobox():(v.preventDefault(),u.openCombobox()),e$2.nextTick(()=>{var d;return (d=o$3(u.inputRef))==null?void 0:d.focus({preventScroll:true})}));}function c(v){switch(v.key){case o$2.ArrowDown:v.preventDefault(),v.stopPropagation(),u.comboboxState.value===1&&u.openCombobox(),e$2.nextTick(()=>{var d;return (d=u.inputRef.value)==null?void 0:d.focus({preventScroll:true})});return;case o$2.ArrowUp:v.preventDefault(),v.stopPropagation(),u.comboboxState.value===1&&(u.openCombobox(),e$2.nextTick(()=>{u.value.value||u.goToOption(c$1.Last);})),e$2.nextTick(()=>{var d;return (d=u.inputRef.value)==null?void 0:d.focus({preventScroll:true})});return;case o$2.Escape:if(u.comboboxState.value!==0)return;v.preventDefault(),u.optionsRef.value&&!u.optionsPropsRef.value.static&&v.stopPropagation(),u.closeCombobox(),e$2.nextTick(()=>{var d;return (d=u.inputRef.value)==null?void 0:d.focus({preventScroll:true})});return}}let f=s$3(e$2.computed(()=>({as:a.as,type:h.type})),u.buttonRef);return ()=>{var E,w;let v={open:u.comboboxState.value===0,disabled:u.disabled.value,value:u.value.value},{...d}=a,D={ref:u.buttonRef,id:o,type:f.value,tabindex:"-1","aria-haspopup":"listbox","aria-controls":(E=o$3(u.optionsRef))==null?void 0:E.id,"aria-expanded":u.comboboxState.value===0,"aria-labelledby":u.labelRef.value?[(w=o$3(u.labelRef))==null?void 0:w.id,o].join(" "):void 0,disabled:u.disabled.value===true?true:void 0,onKeydown:c,onClick:e};return A$4({ourProps:D,theirProps:d,slot:v,attrs:h,slots:r,name:"ComboboxButton"})}}}),it=e$2.defineComponent({name:"ComboboxInput",props:{as:{type:[Object,String],default:"input"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true},displayValue:{type:Function},defaultValue:{type:String,default:void 0},id:{type:String,default:null}},emits:{change:a=>true},setup(a,{emit:h,attrs:r,slots:y,expose:o}){var V;let u=(V=a.id)!=null?V:`headlessui-combobox-input-${i$6()}`,e=K$2("ComboboxInput"),c=e$2.computed(()=>i$4(o$3(e.inputRef))),f={value:false};o({el:e.inputRef,$el:e.inputRef});function S(){e.change(null);let i=o$3(e.optionsRef);i&&(i.scrollTop=0),e.goToOption(c$1.Nothing);}let v=e$2.computed(()=>{var I;let i=e.value.value;return o$3(e.inputRef)?typeof a.displayValue!="undefined"&&i!==void 0?(I=a.displayValue(i))!=null?I:"":typeof i=="string"?i:"":""});e$2.onMounted(()=>{e$2.watch([v,e.comboboxState,c],([i,I],[T,l])=>{if(f.value)return;let g=o$3(e.inputRef);g&&((l===0&&I===1||i!==T)&&(g.value=i),requestAnimationFrame(()=>{var s;if(f.value||!g||((s=c.value)==null?void 0:s.activeElement)!==g)return;let{selectionStart:t,selectionEnd:n}=g;Math.abs((n!=null?n:0)-(t!=null?t:0))===0&&t===0&&g.setSelectionRange(g.value.length,g.value.length);}));},{immediate:true}),e$2.watch([e.comboboxState],([i],[I])=>{if(i===0&&I===1){if(f.value)return;let T=o$3(e.inputRef);if(!T)return;let l=T.value,{selectionStart:g,selectionEnd:t,selectionDirection:n}=T;T.value="",T.value=l,n!==null?T.setSelectionRange(g,t,n):T.setSelectionRange(g,t);}});});let d=e$2.ref(false);function D(){d.value=true;}function E(){o$5().nextFrame(()=>{d.value=false;});}let w=t$5();function M(i){switch(f.value=true,w(()=>{f.value=false;}),i.key){case o$2.Enter:if(f.value=false,e.comboboxState.value!==0||d.value)return;if(i.preventDefault(),i.stopPropagation(),e.activeOptionIndex.value===null){e.closeCombobox();return}e.selectActiveOption(),e.mode.value===0&&e.closeCombobox();break;case o$2.ArrowDown:return f.value=false,i.preventDefault(),i.stopPropagation(),u$7(e.comboboxState.value,{[0]:()=>e.goToOption(c$1.Next),[1]:()=>e.openCombobox()});case o$2.ArrowUp:return f.value=false,i.preventDefault(),i.stopPropagation(),u$7(e.comboboxState.value,{[0]:()=>e.goToOption(c$1.Previous),[1]:()=>{e.openCombobox(),e$2.nextTick(()=>{e.value.value||e.goToOption(c$1.Last);});}});case o$2.Home:if(i.shiftKey)break;return f.value=false,i.preventDefault(),i.stopPropagation(),e.goToOption(c$1.First);case o$2.PageUp:return f.value=false,i.preventDefault(),i.stopPropagation(),e.goToOption(c$1.First);case o$2.End:if(i.shiftKey)break;return f.value=false,i.preventDefault(),i.stopPropagation(),e.goToOption(c$1.Last);case o$2.PageDown:return f.value=false,i.preventDefault(),i.stopPropagation(),e.goToOption(c$1.Last);case o$2.Escape:if(f.value=false,e.comboboxState.value!==0)return;i.preventDefault(),e.optionsRef.value&&!e.optionsPropsRef.value.static&&i.stopPropagation(),e.nullable.value&&e.mode.value===0&&e.value.value===null&&S(),e.closeCombobox();break;case o$2.Tab:if(f.value=false,e.comboboxState.value!==0)return;e.mode.value===0&&e.activationTrigger.value!==1&&e.selectActiveOption(),e.closeCombobox();break}}function $(i){h("change",i),e.nullable.value&&e.mode.value===0&&i.target.value===""&&S(),e.openCombobox();}function B(i){var T,l,g;let I=(T=i.relatedTarget)!=null?T:t$1.find(t=>t!==i.currentTarget);if(f.value=false,!((l=o$3(e.optionsRef))!=null&&l.contains(I))&&!((g=o$3(e.buttonRef))!=null&&g.contains(I))&&e.comboboxState.value===0)return i.preventDefault(),e.mode.value===0&&(e.nullable.value&&e.value.value===null?S():e.activationTrigger.value!==1&&e.selectActiveOption()),e.closeCombobox()}function p(i){var T,l,g;let I=(T=i.relatedTarget)!=null?T:t$1.find(t=>t!==i.currentTarget);(l=o$3(e.buttonRef))!=null&&l.contains(I)||(g=o$3(e.optionsRef))!=null&&g.contains(I)||e.disabled.value||e.immediate.value&&e.comboboxState.value!==0&&(e.openCombobox(),o$5().nextFrame(()=>{e.setActivationTrigger(1);}));}let R=e$2.computed(()=>{var i,I,T,l;return (l=(T=(I=a.defaultValue)!=null?I:e.defaultValue.value!==void 0?(i=a.displayValue)==null?void 0:i.call(a,e.defaultValue.value):null)!=null?T:e.defaultValue.value)!=null?l:""});return ()=>{var t,n,s,b,O,C,A;let i={open:e.comboboxState.value===0},{displayValue:I,onChange:T,...l}=a,g={"aria-controls":(t=e.optionsRef.value)==null?void 0:t.id,"aria-expanded":e.comboboxState.value===0,"aria-activedescendant":e.activeOptionIndex.value===null?void 0:e.virtual.value?(n=e.options.value.find(j=>!e.virtual.value.disabled(j.dataRef.value)&&e.compare(j.dataRef.value,e.virtual.value.options[e.activeOptionIndex.value])))==null?void 0:n.id:(s=e.options.value[e.activeOptionIndex.value])==null?void 0:s.id,"aria-labelledby":(C=(b=o$3(e.labelRef))==null?void 0:b.id)!=null?C:(O=o$3(e.buttonRef))==null?void 0:O.id,"aria-autocomplete":"list",id:u,onCompositionstart:D,onCompositionend:E,onKeydown:M,onInput:$,onFocus:p,onBlur:B,role:"combobox",type:(A=r.type)!=null?A:"text",tabIndex:0,ref:e.inputRef,defaultValue:R.value,disabled:e.disabled.value===true?true:void 0};return A$4({ourProps:g,theirProps:l,slot:i,attrs:r,slots:y,features:N$5.RenderStrategy|N$5.Static,name:"ComboboxInput"})}}}),ut=e$2.defineComponent({name:"ComboboxOptions",props:{as:{type:[Object,String],default:"ul"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true},hold:{type:[Boolean],default:false}},setup(a,{attrs:h,slots:r,expose:y}){let o=K$2("ComboboxOptions"),u=`headlessui-combobox-options-${i$6()}`;y({el:o.optionsRef,$el:o.optionsRef}),e$2.watchEffect(()=>{o.optionsPropsRef.value.static=a.static;}),e$2.watchEffect(()=>{o.optionsPropsRef.value.hold=a.hold;});let e=l$2(),c=e$2.computed(()=>e!==null?(e.value&i$1.Open)===i$1.Open:o.comboboxState.value===0);i$2({container:e$2.computed(()=>o$3(o.optionsRef)),enabled:e$2.computed(()=>o.comboboxState.value===0),accept(S){return S.getAttribute("role")==="option"?NodeFilter.FILTER_REJECT:S.hasAttribute("role")?NodeFilter.FILTER_SKIP:NodeFilter.FILTER_ACCEPT},walk(S){S.setAttribute("role","none");}});function f(S){S.preventDefault();}return ()=>{var D,E,w;let S={open:o.comboboxState.value===0},v={"aria-labelledby":(w=(D=o$3(o.labelRef))==null?void 0:D.id)!=null?w:(E=o$3(o.buttonRef))==null?void 0:E.id,id:u,ref:o.optionsRef,role:"listbox","aria-multiselectable":o.mode.value===1?true:void 0,onMousedown:f},d=T$2(a,["hold"]);return A$4({ourProps:v,theirProps:d,slot:S,attrs:h,slots:o.virtual.value&&o.comboboxState.value===0?{...r,default:()=>[e$2.h(Ae$2,{},r.default)]}:r,features:N$5.RenderStrategy|N$5.Static,visible:c.value,name:"ComboboxOptions"})}}}),rt=e$2.defineComponent({name:"ComboboxOption",props:{as:{type:[Object,String],default:"li"},value:{type:[Object,String,Number,Boolean]},disabled:{type:Boolean,default:false},order:{type:[Number],default:null}},setup(a,{slots:h,attrs:r,expose:y}){let o=K$2("ComboboxOption"),u=`headlessui-combobox-option-${i$6()}`,e=e$2.ref(null),c=e$2.computed(()=>a.disabled);y({el:e,$el:e});let f=e$2.computed(()=>{var p;return o.virtual.value?o.activeOptionIndex.value===o.calculateIndex(a.value):o.activeOptionIndex.value===null?false:((p=o.options.value[o.activeOptionIndex.value])==null?void 0:p.id)===u}),S=e$2.computed(()=>o.isSelected(a.value)),v=e$2.inject(ie$1,null),d=e$2.computed(()=>({disabled:a.disabled,value:a.value,domRef:e,order:e$2.computed(()=>a.order)}));e$2.onMounted(()=>o.registerOption(u,d)),e$2.onUnmounted(()=>o.unregisterOption(u,f.value)),e$2.watchEffect(()=>{let p=o$3(e);p&&(v==null||v.value.measureElement(p));}),e$2.watchEffect(()=>{o.comboboxState.value===0&&f.value&&(o.virtual.value||o.activationTrigger.value!==0&&e$2.nextTick(()=>{var p,R;return (R=(p=o$3(e))==null?void 0:p.scrollIntoView)==null?void 0:R.call(p,{block:"nearest"})}));});function D(p){p.preventDefault(),p.button===g$3.Left&&(c.value||(o.selectOption(u),n$2()||requestAnimationFrame(()=>{var R;return (R=o$3(o.inputRef))==null?void 0:R.focus({preventScroll:true})}),o.mode.value===0&&o.closeCombobox()));}function E(){var R;if(a.disabled||(R=o.virtual.value)!=null&&R.disabled(a.value))return o.goToOption(c$1.Nothing);let p=o.calculateIndex(a.value);o.goToOption(c$1.Specific,p);}let w=u$5();function M(p){w.update(p);}function $(p){var V;if(!w.wasMoved(p)||a.disabled||(V=o.virtual.value)!=null&&V.disabled(a.value)||f.value)return;let R=o.calculateIndex(a.value);o.goToOption(c$1.Specific,R,0);}function B(p){var R;w.wasMoved(p)&&(a.disabled||(R=o.virtual.value)!=null&&R.disabled(a.value)||f.value&&(o.optionsPropsRef.value.hold||o.goToOption(c$1.Nothing)));}return ()=>{let{disabled:p}=a,R={active:f.value,selected:S.value,disabled:p},V={id:u,ref:e,role:"option",tabIndex:p===true?void 0:-1,"aria-disabled":p===true?true:void 0,"aria-selected":S.value,disabled:void 0,onMousedown:D,onFocus:E,onPointerenter:M,onMouseenter:M,onPointermove:$,onMousemove:$,onPointerleave:B,onMouseleave:B},i=T$2(a,["order","value"]);return A$4({ourProps:V,theirProps:i,slot:R,attrs:r,slots:h,name:"ComboboxOption"})}}});

  function E$2(n,e,o,r){c$3.isServer||e$2.watchEffect(t=>{n=n!=null?n:window,n.addEventListener(e,o,r),t(()=>n.removeEventListener(e,o,r));});}

  var d$5=(r=>(r[r.Forwards=0]="Forwards",r[r.Backwards=1]="Backwards",r))(d$5||{});function n(){let o=e$2.ref(0);return w$3("keydown",e=>{e.key==="Tab"&&(o.value=e.shiftKey?1:0);}),o}

  function B(t){if(!t)return new Set;if(typeof t=="function")return new Set(t());let n=new Set;for(let r of t.value){let l=o$3(r);l instanceof HTMLElement&&n.add(l);}return n}var A$3=(e=>(e[e.None=1]="None",e[e.InitialFocus=2]="InitialFocus",e[e.TabLock=4]="TabLock",e[e.FocusLock=8]="FocusLock",e[e.RestoreFocus=16]="RestoreFocus",e[e.All=30]="All",e))(A$3||{});let ue$2=Object.assign(e$2.defineComponent({name:"FocusTrap",props:{as:{type:[Object,String],default:"div"},initialFocus:{type:Object,default:null},features:{type:Number,default:30},containers:{type:[Object,Function],default:e$2.ref(new Set)}},inheritAttrs:false,setup(t,{attrs:n$1,slots:r,expose:l}){let o=e$2.ref(null);l({el:o,$el:o});let i=e$2.computed(()=>i$4(o)),e=e$2.ref(false);e$2.onMounted(()=>e.value=true),e$2.onUnmounted(()=>e.value=false),$$3({ownerDocument:i},e$2.computed(()=>e.value&&Boolean(t.features&16)));let m=z$1({ownerDocument:i,container:o,initialFocus:e$2.computed(()=>t.initialFocus)},e$2.computed(()=>e.value&&Boolean(t.features&2)));J({ownerDocument:i,container:o,containers:t.containers,previousActiveElement:m},e$2.computed(()=>e.value&&Boolean(t.features&8)));let f=n();function a(u){let T=o$3(o);if(!T)return;(w=>w())(()=>{u$7(f.value,{[d$5.Forwards]:()=>{P(T,N$6.First,{skipElements:[u.relatedTarget]});},[d$5.Backwards]:()=>{P(T,N$6.Last,{skipElements:[u.relatedTarget]});}});});}let s=e$2.ref(false);function F(u){u.key==="Tab"&&(s.value=true,requestAnimationFrame(()=>{s.value=false;}));}function H(u){if(!e.value)return;let T=B(t.containers);o$3(o)instanceof HTMLElement&&T.add(o$3(o));let d=u.relatedTarget;d instanceof HTMLElement&&d.dataset.headlessuiFocusGuard!=="true"&&(N$4(T,d)||(s.value?P(o$3(o),u$7(f.value,{[d$5.Forwards]:()=>N$6.Next,[d$5.Backwards]:()=>N$6.Previous})|N$6.WrapAround,{relativeTo:u.target}):u.target instanceof HTMLElement&&S$1(u.target)));}return ()=>{let u={},T={ref:o,onKeydown:F,onFocusout:H},{features:d,initialFocus:w,containers:Q,...O}=t;return e$2.h(e$2.Fragment,[Boolean(d&4)&&e$2.h(f$3,{as:"button",type:"button","data-headlessui-focus-guard":true,onFocus:a,features:u$4.Focusable}),A$4({ourProps:T,theirProps:{...n$1,...O},slot:u,attrs:n$1,slots:r,name:"FocusTrap"}),Boolean(d&4)&&e$2.h(f$3,{as:"button",type:"button","data-headlessui-focus-guard":true,onFocus:a,features:u$4.Focusable})])}}}),{features:A$3});function W$1(t){let n=e$2.ref(t$1.slice());return e$2.watch([t],([r],[l])=>{l===true&&r===false?t$6(()=>{n.value.splice(0);}):l===false&&r===true&&(n.value=t$1.slice());},{flush:"post"}),()=>{var r;return (r=n.value.find(l=>l!=null&&l.isConnected))!=null?r:null}}function $$3({ownerDocument:t},n){let r=W$1(n);e$2.onMounted(()=>{e$2.watchEffect(()=>{var l,o;n.value||((l=t.value)==null?void 0:l.activeElement)===((o=t.value)==null?void 0:o.body)&&S$1(r());},{flush:"post"});}),e$2.onUnmounted(()=>{n.value&&S$1(r());});}function z$1({ownerDocument:t,container:n,initialFocus:r},l){let o=e$2.ref(null),i=e$2.ref(false);return e$2.onMounted(()=>i.value=true),e$2.onUnmounted(()=>i.value=false),e$2.onMounted(()=>{e$2.watch([n,r,l],(e,m)=>{if(e.every((a,s)=>(m==null?void 0:m[s])===a)||!l.value)return;let f=o$3(n);f&&t$6(()=>{var F,H;if(!i.value)return;let a=o$3(r),s=(F=t.value)==null?void 0:F.activeElement;if(a){if(a===s){o.value=s;return}}else if(f.contains(s)){o.value=s;return}a?S$1(a):P(f,N$6.First|N$6.NoScroll)===T$3.Error&&console.warn("There are no focusable elements inside the <FocusTrap />"),o.value=(H=t.value)==null?void 0:H.activeElement;});},{immediate:true,flush:"post"});}),o}function J({ownerDocument:t,container:n,containers:r,previousActiveElement:l},o){var i;E$2((i=t.value)==null?void 0:i.defaultView,"focus",e=>{if(!o.value)return;let m=B(r);o$3(n)instanceof HTMLElement&&m.add(o$3(n));let f=l.value;if(!f)return;let a=e.target;a&&a instanceof HTMLElement?N$4(m,a)?(l.value=a,S$1(a)):(e.preventDefault(),e.stopPropagation(),S$1(f)):S$1(l.value);},true);}function N$4(t,n){for(let r of t)if(r.contains(n))return  true;return  false}

  function m$2(t){let e=e$2.shallowRef(t.getSnapshot());return e$2.onUnmounted(t.subscribe(()=>{e.value=t.getSnapshot();})),e}

  function a$3(o,r){let t=o(),n=new Set;return {getSnapshot(){return t},subscribe(e){return n.add(e),()=>n.delete(e)},dispatch(e,...s){let i=r[e].call(t,...s);i&&(t=i,n.forEach(c=>c()));}}}

  function c(){let o;return {before({doc:e}){var l;let n=e.documentElement;o=((l=e.defaultView)!=null?l:window).innerWidth-n.clientWidth;},after({doc:e,d:n}){let t=e.documentElement,l=t.clientWidth-t.offsetWidth,r=o-l;n.style(t,"paddingRight",`${r}px`);}}}

  function w$1(){return t$4()?{before({doc:r,d:n,meta:c}){function a(o){return c.containers.flatMap(l=>l()).some(l=>l.contains(o))}n.microTask(()=>{var s;if(window.getComputedStyle(r.documentElement).scrollBehavior!=="auto"){let t=o$5();t.style(r.documentElement,"scrollBehavior","auto"),n.add(()=>n.microTask(()=>t.dispose()));}let o=(s=window.scrollY)!=null?s:window.pageYOffset,l=null;n.addEventListener(r,"click",t=>{if(t.target instanceof HTMLElement)try{let e=t.target.closest("a");if(!e)return;let{hash:f}=new URL(e.href),i=r.querySelector(f);i&&!a(i)&&(l=i);}catch{}},true),n.addEventListener(r,"touchstart",t=>{if(t.target instanceof HTMLElement)if(a(t.target)){let e=t.target;for(;e.parentElement&&a(e.parentElement);)e=e.parentElement;n.style(e,"overscrollBehavior","contain");}else n.style(t.target,"touchAction","none");}),n.addEventListener(r,"touchmove",t=>{if(t.target instanceof HTMLElement){if(t.target.tagName==="INPUT")return;if(a(t.target)){let e=t.target;for(;e.parentElement&&e.dataset.headlessuiPortal!==""&&!(e.scrollHeight>e.clientHeight||e.scrollWidth>e.clientWidth);)e=e.parentElement;e.dataset.headlessuiPortal===""&&t.preventDefault();}else t.preventDefault();}},{passive:false}),n.add(()=>{var e;let t=(e=window.scrollY)!=null?e:window.pageYOffset;o!==t&&window.scrollTo(0,o),l&&l.isConnected&&(l.scrollIntoView({block:"nearest"}),l=null);});});}}:{}}

  function l$1(){return {before({doc:e,d:o}){o.style(e.documentElement,"overflow","hidden");}}}

  function m$1(e){let n={};for(let t of e)Object.assign(n,t(n));return n}let a$2=a$3(()=>new Map,{PUSH(e,n){var o;let t=(o=this.get(e))!=null?o:{doc:e,count:0,d:o$5(),meta:new Set};return t.count++,t.meta.add(n),this.set(e,t),this},POP(e,n){let t=this.get(e);return t&&(t.count--,t.meta.delete(n)),this},SCROLL_PREVENT({doc:e,d:n,meta:t}){let o={doc:e,d:n,meta:m$1(t)},c$1=[w$1(),c(),l$1()];c$1.forEach(({before:r})=>r==null?void 0:r(o)),c$1.forEach(({after:r})=>r==null?void 0:r(o));},SCROLL_ALLOW({d:e}){e.dispose();},TEARDOWN({doc:e}){this.delete(e);}});a$2.subscribe(()=>{let e=a$2.getSnapshot(),n=new Map;for(let[t]of e)n.set(t,t.documentElement.style.overflow);for(let t of e.values()){let o=n.get(t.doc)==="hidden",c=t.count!==0;(c&&!o||!c&&o)&&a$2.dispatch(t.count>0?"SCROLL_PREVENT":"SCROLL_ALLOW",t),t.count===0&&a$2.dispatch("TEARDOWN",t);}});

  function d$4(t,a,n){let i=m$2(a$2),l=e$2.computed(()=>{let e=t.value?i.value.get(t.value):void 0;return e?e.count>0:false});return e$2.watch([t,a],([e,m],[r],o)=>{if(!e||!m)return;a$2.dispatch("PUSH",e,n);let f=false;o(()=>{f||(a$2.dispatch("POP",r!=null?r:e,n),f=true);});},{immediate:true}),l}

  let i=new Map,t=new Map;function E$1(d,f=e$2.ref(true)){e$2.watchEffect(o=>{var a;if(!f.value)return;let e=o$3(d);if(!e)return;o(function(){var u;if(!e)return;let r=(u=t.get(e))!=null?u:1;if(r===1?t.delete(e):t.set(e,r-1),r!==1)return;let n=i.get(e);n&&(n["aria-hidden"]===null?e.removeAttribute("aria-hidden"):e.setAttribute("aria-hidden",n["aria-hidden"]),e.inert=n.inert,i.delete(e));});let l=(a=t.get(e))!=null?a:0;t.set(e,l+1),l===0&&(i.set(e,{"aria-hidden":e.getAttribute("aria-hidden"),inert:e.inert}),e.setAttribute("aria-hidden","true"),e.inert=true);});}

  function N$3({defaultContainers:o=[],portals:i,mainTreeNodeRef:H}={}){let t=e$2.ref(null),r=i$4(t);function u(){var l,f,a;let n=[];for(let e of o)e!==null&&(e instanceof HTMLElement?n.push(e):"value"in e&&e.value instanceof HTMLElement&&n.push(e.value));if(i!=null&&i.value)for(let e of i.value)n.push(e);for(let e of (l=r==null?void 0:r.querySelectorAll("html > *, body > *"))!=null?l:[])e!==document.body&&e!==document.head&&e instanceof HTMLElement&&e.id!=="headlessui-portal-root"&&(e.contains(o$3(t))||e.contains((a=(f=o$3(t))==null?void 0:f.getRootNode())==null?void 0:a.host)||n.some(M=>e.contains(M))||n.push(e));return n}return {resolveContainers:u,contains(n){return u().some(l=>l.contains(n))},mainTreeNodeRef:t,MainTreeNode(){return H!=null?null:e$2.h(f$3,{features:u$4.Hidden,ref:t})}}}function v(){let o=e$2.ref(null);return {mainTreeNodeRef:o,MainTreeNode(){return e$2.h(f$3,{features:u$4.Hidden,ref:o})}}}

  let e=Symbol("ForcePortalRootContext");function s$1(){return e$2.inject(e,false)}let u$2=e$2.defineComponent({name:"ForcePortalRoot",props:{as:{type:[Object,String],default:"template"},force:{type:Boolean,default:false}},setup(o,{slots:t,attrs:r}){return e$2.provide(e,o.force),()=>{let{force:f,...n}=o;return A$4({theirProps:n,ourProps:{},slot:{},slots:t,attrs:r,name:"ForcePortalRoot"})}}});

  let u$1=Symbol("StackContext");var s=(e=>(e[e.Add=0]="Add",e[e.Remove=1]="Remove",e))(s||{});function y(){return e$2.inject(u$1,()=>{})}function R$1({type:o,enabled:r,element:e,onUpdate:i}){let a=y();function t(...n){i==null||i(...n),a(...n);}e$2.onMounted(()=>{e$2.watch(r,(n,d)=>{n?t(0,o,e):d===true&&t(1,o,e);},{immediate:true,flush:"sync"});}),e$2.onUnmounted(()=>{r.value&&t(1,o,e);}),e$2.provide(u$1,t);}

  let u=Symbol("DescriptionContext");function w(){let t=e$2.inject(u,null);if(t===null)throw new Error("Missing parent");return t}function k$1({slot:t=e$2.ref({}),name:o="Description",props:s={}}={}){let e=e$2.ref([]);function r(n){return e.value.push(n),()=>{let i=e.value.indexOf(n);i!==-1&&e.value.splice(i,1);}}return e$2.provide(u,{register:r,slot:t,name:o,props:s}),e$2.computed(()=>e.value.length>0?e.value.join(" "):void 0)}let K$1=e$2.defineComponent({name:"Description",props:{as:{type:[Object,String],default:"p"},id:{type:String,default:null}},setup(t,{attrs:o,slots:s}){var n;let e=(n=t.id)!=null?n:`headlessui-description-${i$6()}`,r=w();return e$2.onMounted(()=>e$2.onUnmounted(r.register(e))),()=>{let{name:i="Description",slot:l=e$2.ref({}),props:d={}}=r,{...c}=t,f={...Object.entries(d).reduce((a,[g,m])=>Object.assign(a,{[g]:e$2.unref(m)}),{}),id:e};return A$4({ourProps:f,theirProps:c,slot:l.value,attrs:o,slots:s,name:i})}}});

  function x(e){let t=i$4(e);if(!t){if(e===null)return null;throw new Error(`[Headless UI]: Cannot find ownerDocument for contextElement: ${e}`)}let l=t.getElementById("headlessui-portal-root");if(l)return l;let r=t.createElement("div");return r.setAttribute("id","headlessui-portal-root"),t.body.appendChild(r)}const f=new WeakMap;function U$3(e){var t;return (t=f.get(e))!=null?t:0}function M(e,t){let l=t(U$3(e));return l<=0?f.delete(e):f.set(e,l),l}let $$2=e$2.defineComponent({name:"Portal",props:{as:{type:[Object,String],default:"div"}},setup(e,{slots:t,attrs:l}){let r=e$2.ref(null),i=e$2.computed(()=>i$4(r)),o=s$1(),u=e$2.inject(H$2,null),n=e$2.ref(o===true||u==null?x(r.value):u.resolveTarget());n.value&&M(n.value,a=>a+1);let c=e$2.ref(false);e$2.onMounted(()=>{c.value=true;}),e$2.watchEffect(()=>{o||u!=null&&(n.value=u.resolveTarget());});let v=e$2.inject(d$3,null),g=false,b=e$2.getCurrentInstance();return e$2.watch(r,()=>{if(g||!v)return;let a=o$3(r);a&&(e$2.onUnmounted(v.register(a),b),g=true);}),e$2.onUnmounted(()=>{var P,T;let a=(P=i.value)==null?void 0:P.getElementById("headlessui-portal-root");!a||n.value!==a||M(n.value,L=>L-1)||n.value.children.length>0||(T=n.value.parentElement)==null||T.removeChild(n.value);}),()=>{if(!c.value||n.value===null)return null;let a={ref:r,"data-headlessui-portal":""};return e$2.h(e$2.Teleport,{to:n.value},A$4({ourProps:a,theirProps:e,slot:{},attrs:l,slots:t,name:"Portal"}))}}}),d$3=Symbol("PortalParentContext");function q(){let e=e$2.inject(d$3,null),t=e$2.ref([]);function l(o){return t.value.push(o),e&&e.register(o),()=>r(o)}function r(o){let u=t.value.indexOf(o);u!==-1&&t.value.splice(u,1),e&&e.unregister(o);}let i={register:l,unregister:r,portals:t};return [t,e$2.defineComponent({name:"PortalWrapper",setup(o,{slots:u}){return e$2.provide(d$3,i),()=>{var n;return (n=u.default)==null?void 0:n.call(u)}}})]}let H$2=Symbol("PortalGroupContext"),z=e$2.defineComponent({name:"PortalGroup",props:{as:{type:[Object,String],default:"template"},target:{type:Object,default:null}},setup(e,{attrs:t,slots:l}){let r=e$2.reactive({resolveTarget(){return e.target}});return e$2.provide(H$2,r),()=>{let{target:i,...o}=e;return A$4({theirProps:o,ourProps:{},slot:{},attrs:t,slots:l,name:"PortalGroup"})}}});

  var Te$1=(l=>(l[l.Open=0]="Open",l[l.Closed=1]="Closed",l))(Te$1||{});let H$1=Symbol("DialogContext");function T$1(t){let i=e$2.inject(H$1,null);if(i===null){let l=new Error(`<${t} /> is missing a parent <Dialog /> component.`);throw Error.captureStackTrace&&Error.captureStackTrace(l,T$1),l}return i}let A$2="DC8F892D-2EBD-447C-A4C8-A03058436FF4",Ye=e$2.defineComponent({name:"Dialog",inheritAttrs:false,props:{as:{type:[Object,String],default:"div"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true},open:{type:[Boolean,String],default:A$2},initialFocus:{type:Object,default:null},id:{type:String,default:null},role:{type:String,default:"dialog"}},emits:{close:t=>true},setup(t,{emit:i,attrs:l,slots:p,expose:s$1}){var q$1,W;let n=(q$1=t.id)!=null?q$1:`headlessui-dialog-${i$6()}`,u=e$2.ref(false);e$2.onMounted(()=>{u.value=true;});let r=false,g=e$2.computed(()=>t.role==="dialog"||t.role==="alertdialog"?t.role:(r||(r=true,console.warn(`Invalid role [${g}] passed to <Dialog />. Only \`dialog\` and and \`alertdialog\` are supported. Using \`dialog\` instead.`)),"dialog")),D=e$2.ref(0),S=l$2(),R=e$2.computed(()=>t.open===A$2&&S!==null?(S.value&i$1.Open)===i$1.Open:t.open),m=e$2.ref(null),E=e$2.computed(()=>i$4(m));if(s$1({el:m,$el:m}),!(t.open!==A$2||S!==null))throw new Error("You forgot to provide an `open` prop to the `Dialog`.");if(typeof R.value!="boolean")throw new Error(`You provided an \`open\` prop to the \`Dialog\`, but the value is not a boolean. Received: ${R.value===A$2?void 0:t.open}`);let c=e$2.computed(()=>u.value&&R.value?0:1),k=e$2.computed(()=>c.value===0),w=e$2.computed(()=>D.value>1),N=e$2.inject(H$1,null)!==null,[Q,X]=q(),{resolveContainers:B,mainTreeNodeRef:K,MainTreeNode:Z}=N$3({portals:Q,defaultContainers:[e$2.computed(()=>{var e;return (e=h.panelRef.value)!=null?e:m.value})]}),ee=e$2.computed(()=>w.value?"parent":"leaf"),U=e$2.computed(()=>S!==null?(S.value&i$1.Closing)===i$1.Closing:false),te=e$2.computed(()=>N||U.value?false:k.value),le=e$2.computed(()=>{var e,a,d;return (d=Array.from((a=(e=E.value)==null?void 0:e.querySelectorAll("body > *"))!=null?a:[]).find(f=>f.id==="headlessui-portal-root"?false:f.contains(o$3(K))&&f instanceof HTMLElement))!=null?d:null});E$1(le,te);let ae=e$2.computed(()=>w.value?true:k.value),oe=e$2.computed(()=>{var e,a,d;return (d=Array.from((a=(e=E.value)==null?void 0:e.querySelectorAll("[data-headlessui-portal]"))!=null?a:[]).find(f=>f.contains(o$3(K))&&f instanceof HTMLElement))!=null?d:null});E$1(oe,ae),R$1({type:"Dialog",enabled:e$2.computed(()=>c.value===0),element:m,onUpdate:(e,a)=>{if(a==="Dialog")return u$7(e,{[s.Add]:()=>D.value+=1,[s.Remove]:()=>D.value-=1})}});let re=k$1({name:"DialogDescription",slot:e$2.computed(()=>({open:R.value}))}),M=e$2.ref(null),h={titleId:M,panelRef:e$2.ref(null),dialogState:c,setTitleId(e){M.value!==e&&(M.value=e);},close(){i("close",false);}};e$2.provide(H$1,h);let ne=e$2.computed(()=>!(!k.value||w.value));w$2(B,(e,a)=>{e.preventDefault(),h.close(),e$2.nextTick(()=>a==null?void 0:a.focus());},ne);let ie=e$2.computed(()=>!(w.value||c.value!==0));E$2((W=E.value)==null?void 0:W.defaultView,"keydown",e=>{ie.value&&(e.defaultPrevented||e.key===o$2.Escape&&(e.preventDefault(),e.stopPropagation(),h.close()));});let ue=e$2.computed(()=>!(U.value||c.value!==0||N));return d$4(E,ue,e=>{var a;return {containers:[...(a=e.containers)!=null?a:[],B]}}),e$2.watchEffect(e=>{if(c.value!==0)return;let a=o$3(m);if(!a)return;let d=new ResizeObserver(f=>{for(let L of f){let x=L.target.getBoundingClientRect();x.x===0&&x.y===0&&x.width===0&&x.height===0&&h.close();}});d.observe(a),e(()=>d.disconnect());}),()=>{let{open:e,initialFocus:a,...d}=t,f={...l,ref:m,id:n,role:g.value,"aria-modal":c.value===0?true:void 0,"aria-labelledby":M.value,"aria-describedby":re.value},L={open:c.value===0};return e$2.h(u$2,{force:true},()=>[e$2.h($$2,()=>e$2.h(z,{target:m.value},()=>e$2.h(u$2,{force:false},()=>e$2.h(ue$2,{initialFocus:a,containers:B,features:k.value?u$7(ee.value,{parent:ue$2.features.RestoreFocus,leaf:ue$2.features.All&~ue$2.features.FocusLock}):ue$2.features.None},()=>e$2.h(X,{},()=>A$4({ourProps:f,theirProps:{...d,...l},slot:L,attrs:l,slots:p,visible:c.value===0,features:N$5.RenderStrategy|N$5.Static,name:"Dialog"})))))),e$2.h(Z)])}}}),_e=e$2.defineComponent({name:"DialogOverlay",props:{as:{type:[Object,String],default:"div"},id:{type:String,default:null}},setup(t,{attrs:i,slots:l}){var u;let p=(u=t.id)!=null?u:`headlessui-dialog-overlay-${i$6()}`,s=T$1("DialogOverlay");function n(r){r.target===r.currentTarget&&(r.preventDefault(),r.stopPropagation(),s.close());}return ()=>{let{...r}=t;return A$4({ourProps:{id:p,"aria-hidden":true,onClick:n},theirProps:r,slot:{open:s.dialogState.value===0},attrs:i,slots:l,name:"DialogOverlay"})}}}),ze=e$2.defineComponent({name:"DialogBackdrop",props:{as:{type:[Object,String],default:"div"},id:{type:String,default:null}},inheritAttrs:false,setup(t,{attrs:i,slots:l,expose:p}){var r;let s=(r=t.id)!=null?r:`headlessui-dialog-backdrop-${i$6()}`,n=T$1("DialogBackdrop"),u=e$2.ref(null);return p({el:u,$el:u}),e$2.onMounted(()=>{if(n.panelRef.value===null)throw new Error("A <DialogBackdrop /> component is being used, but a <DialogPanel /> component is missing.")}),()=>{let{...g}=t,D={id:s,ref:u,"aria-hidden":true};return e$2.h(u$2,{force:true},()=>e$2.h($$2,()=>A$4({ourProps:D,theirProps:{...i,...g},slot:{open:n.dialogState.value===0},attrs:i,slots:l,name:"DialogBackdrop"})))}}}),Ge$1=e$2.defineComponent({name:"DialogPanel",props:{as:{type:[Object,String],default:"div"},id:{type:String,default:null}},setup(t,{attrs:i,slots:l,expose:p}){var r;let s=(r=t.id)!=null?r:`headlessui-dialog-panel-${i$6()}`,n=T$1("DialogPanel");p({el:n.panelRef,$el:n.panelRef});function u(g){g.stopPropagation();}return ()=>{let{...g}=t,D={id:s,ref:n.panelRef,onClick:u};return A$4({ourProps:D,theirProps:g,slot:{open:n.dialogState.value===0},attrs:i,slots:l,name:"DialogPanel"})}}}),Ve=e$2.defineComponent({name:"DialogTitle",props:{as:{type:[Object,String],default:"h2"},id:{type:String,default:null}},setup(t,{attrs:i,slots:l}){var n;let p=(n=t.id)!=null?n:`headlessui-dialog-title-${i$6()}`,s=T$1("DialogTitle");return e$2.onMounted(()=>{s.setTitleId(p),e$2.onUnmounted(()=>s.setTitleId(null));}),()=>{let{...u}=t;return A$4({ourProps:{id:p},theirProps:u,slot:{open:s.dialogState.value===0},attrs:i,slots:l,name:"DialogTitle"})}}}),Je=K$1;

  var $$1=(o=>(o[o.Open=0]="Open",o[o.Closed=1]="Closed",o))($$1||{});let T=Symbol("DisclosureContext");function O$1(t){let r=e$2.inject(T,null);if(r===null){let o=new Error(`<${t} /> is missing a parent <Disclosure /> component.`);throw Error.captureStackTrace&&Error.captureStackTrace(o,O$1),o}return r}let k=Symbol("DisclosurePanelContext");function U$2(){return e$2.inject(k,null)}let N$2=e$2.defineComponent({name:"Disclosure",props:{as:{type:[Object,String],default:"template"},defaultOpen:{type:[Boolean],default:false}},setup(t,{slots:r,attrs:o}){let s=e$2.ref(t.defaultOpen?0:1),e=e$2.ref(null),i=e$2.ref(null),n={buttonId:e$2.ref(`headlessui-disclosure-button-${i$6()}`),panelId:e$2.ref(`headlessui-disclosure-panel-${i$6()}`),disclosureState:s,panel:e,button:i,toggleDisclosure(){s.value=u$7(s.value,{[0]:1,[1]:0});},closeDisclosure(){s.value!==1&&(s.value=1);},close(l){n.closeDisclosure();let a=(()=>l?l instanceof HTMLElement?l:l.value instanceof HTMLElement?o$3(l):o$3(n.button):o$3(n.button))();a==null||a.focus();}};return e$2.provide(T,n),t$3(e$2.computed(()=>u$7(s.value,{[0]:i$1.Open,[1]:i$1.Closed}))),()=>{let{defaultOpen:l,...a}=t,c={open:s.value===0,close:n.close};return A$4({theirProps:a,ourProps:{},slot:c,slots:r,attrs:o,name:"Disclosure"})}}}),Q$1=e$2.defineComponent({name:"DisclosureButton",props:{as:{type:[Object,String],default:"button"},disabled:{type:[Boolean],default:false},id:{type:String,default:null}},setup(t,{attrs:r,slots:o,expose:s}){let e=O$1("DisclosureButton"),i=U$2(),n=e$2.computed(()=>i===null?false:i.value===e.panelId.value);e$2.onMounted(()=>{n.value||t.id!==null&&(e.buttonId.value=t.id);}),e$2.onUnmounted(()=>{n.value||(e.buttonId.value=null);});let l=e$2.ref(null);s({el:l,$el:l}),n.value||e$2.watchEffect(()=>{e.button.value=l.value;});let a=s$3(e$2.computed(()=>({as:t.as,type:r.type})),l);function c(){var u;t.disabled||(n.value?(e.toggleDisclosure(),(u=o$3(e.button))==null||u.focus()):e.toggleDisclosure());}function D(u){var S;if(!t.disabled)if(n.value)switch(u.key){case o$2.Space:case o$2.Enter:u.preventDefault(),u.stopPropagation(),e.toggleDisclosure(),(S=o$3(e.button))==null||S.focus();break}else switch(u.key){case o$2.Space:case o$2.Enter:u.preventDefault(),u.stopPropagation(),e.toggleDisclosure();break}}function v(u){switch(u.key){case o$2.Space:u.preventDefault();break}}return ()=>{var C;let u={open:e.disclosureState.value===0},{id:S,...K}=t,M=n.value?{ref:l,type:a.value,onClick:c,onKeydown:D}:{id:(C=e.buttonId.value)!=null?C:S,ref:l,type:a.value,"aria-expanded":e.disclosureState.value===0,"aria-controls":e.disclosureState.value===0||o$3(e.panel)?e.panelId.value:void 0,disabled:t.disabled?true:void 0,onClick:c,onKeydown:D,onKeyup:v};return A$4({ourProps:M,theirProps:K,slot:u,attrs:r,slots:o,name:"DisclosureButton"})}}}),V=e$2.defineComponent({name:"DisclosurePanel",props:{as:{type:[Object,String],default:"div"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true},id:{type:String,default:null}},setup(t,{attrs:r,slots:o,expose:s}){let e=O$1("DisclosurePanel");e$2.onMounted(()=>{t.id!==null&&(e.panelId.value=t.id);}),e$2.onUnmounted(()=>{e.panelId.value=null;}),s({el:e.panel,$el:e.panel}),e$2.provide(k,e.panelId);let i=l$2(),n=e$2.computed(()=>i!==null?(i.value&i$1.Open)===i$1.Open:e.disclosureState.value===0);return ()=>{var v;let l={open:e.disclosureState.value===0,close:e.close},{id:a,...c}=t,D={id:(v=e.panelId.value)!=null?v:a,ref:e.panel};return A$4({ourProps:D,theirProps:c,slot:l,attrs:r,slots:o,features:N$5.RenderStrategy|N$5.Static,visible:n.value,name:"DisclosurePanel"})}}});

  let a$1=/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;function o(e){var r,i;let n=(r=e.innerText)!=null?r:"",t=e.cloneNode(true);if(!(t instanceof HTMLElement))return n;let u=false;for(let f of t.querySelectorAll('[hidden],[aria-hidden],[role="img"]'))f.remove(),u=true;let l=u?(i=t.innerText)!=null?i:"":n;return a$1.test(l)&&(l=l.replace(a$1,"")),l}function g$2(e){let n=e.getAttribute("aria-label");if(typeof n=="string")return n.trim();let t=e.getAttribute("aria-labelledby");if(t){let u=t.split(" ").map(l=>{let r=document.getElementById(l);if(r){let i=r.getAttribute("aria-label");return typeof i=="string"?i.trim():o(r).trim()}return null}).filter(Boolean);if(u.length>0)return u.join(", ")}return o(e).trim()}

  function p(a){let t=e$2.ref(""),r=e$2.ref("");return ()=>{let e=o$3(a);if(!e)return "";let l=e.innerText;if(t.value===l)return r.value;let u=g$2(e).trim().toLowerCase();return t.value=l,r.value=u,u}}

  function pe$2(o,b){return o===b}var ce$2=(r=>(r[r.Open=0]="Open",r[r.Closed=1]="Closed",r))(ce$2||{}),ve=(r=>(r[r.Single=0]="Single",r[r.Multi=1]="Multi",r))(ve||{}),be$1=(r=>(r[r.Pointer=0]="Pointer",r[r.Other=1]="Other",r))(be$1||{});function me$2(o){requestAnimationFrame(()=>requestAnimationFrame(o));}let $=Symbol("ListboxContext");function A$1(o){let b=e$2.inject($,null);if(b===null){let r=new Error(`<${o} /> is missing a parent <Listbox /> component.`);throw Error.captureStackTrace&&Error.captureStackTrace(r,A$1),r}return b}let Ie$1=e$2.defineComponent({name:"Listbox",emits:{"update:modelValue":o=>true},props:{as:{type:[Object,String],default:"template"},disabled:{type:[Boolean],default:false},by:{type:[String,Function],default:()=>pe$2},horizontal:{type:[Boolean],default:false},modelValue:{type:[Object,String,Number,Boolean],default:void 0},defaultValue:{type:[Object,String,Number,Boolean],default:void 0},form:{type:String,optional:true},name:{type:String,optional:true},multiple:{type:[Boolean],default:false}},inheritAttrs:false,setup(o,{slots:b,attrs:r,emit:w}){let n=e$2.ref(1),e=e$2.ref(null),f=e$2.ref(null),v=e$2.ref(null),s=e$2.ref([]),m=e$2.ref(""),p=e$2.ref(null),a=e$2.ref(1);function u(t=i=>i){let i=p.value!==null?s.value[p.value]:null,l=O$2(t(s.value.slice()),O=>o$3(O.dataRef.domRef)),d=i?l.indexOf(i):null;return d===-1&&(d=null),{options:l,activeOptionIndex:d}}let D=e$2.computed(()=>o.multiple?1:0),[y,L]=d$7(e$2.computed(()=>o.modelValue),t=>w("update:modelValue",t),e$2.computed(()=>o.defaultValue)),M=e$2.computed(()=>y.value===void 0?u$7(D.value,{[1]:[],[0]:void 0}):y.value),k={listboxState:n,value:M,mode:D,compare(t,i){if(typeof o.by=="string"){let l=o.by;return (t==null?void 0:t[l])===(i==null?void 0:i[l])}return o.by(t,i)},orientation:e$2.computed(()=>o.horizontal?"horizontal":"vertical"),labelRef:e,buttonRef:f,optionsRef:v,disabled:e$2.computed(()=>o.disabled),options:s,searchQuery:m,activeOptionIndex:p,activationTrigger:a,closeListbox(){o.disabled||n.value!==1&&(n.value=1,p.value=null);},openListbox(){o.disabled||n.value!==0&&(n.value=0);},goToOption(t,i,l){if(o.disabled||n.value===1)return;let d=u(),O=f$2(t===c$1.Specific?{focus:c$1.Specific,id:i}:{focus:t},{resolveItems:()=>d.options,resolveActiveIndex:()=>d.activeOptionIndex,resolveId:h=>h.id,resolveDisabled:h=>h.dataRef.disabled});m.value="",p.value=O,a.value=l!=null?l:1,s.value=d.options;},search(t){if(o.disabled||n.value===1)return;let l=m.value!==""?0:1;m.value+=t.toLowerCase();let O=(p.value!==null?s.value.slice(p.value+l).concat(s.value.slice(0,p.value+l)):s.value).find(I=>I.dataRef.textValue.startsWith(m.value)&&!I.dataRef.disabled),h=O?s.value.indexOf(O):-1;h===-1||h===p.value||(p.value=h,a.value=1);},clearSearch(){o.disabled||n.value!==1&&m.value!==""&&(m.value="");},registerOption(t,i){let l=u(d=>[...d,{id:t,dataRef:i}]);s.value=l.options,p.value=l.activeOptionIndex;},unregisterOption(t){let i=u(l=>{let d=l.findIndex(O=>O.id===t);return d!==-1&&l.splice(d,1),l});s.value=i.options,p.value=i.activeOptionIndex,a.value=1;},theirOnChange(t){o.disabled||L(t);},select(t){o.disabled||L(u$7(D.value,{[0]:()=>t,[1]:()=>{let i=e$2.toRaw(k.value.value).slice(),l=e$2.toRaw(t),d=i.findIndex(O=>k.compare(l,e$2.toRaw(O)));return d===-1?i.push(l):i.splice(d,1),i}}));}};w$2([f,v],(t,i)=>{var l;k.closeListbox(),w$4(i,h.Loose)||(t.preventDefault(),(l=o$3(f))==null||l.focus());},e$2.computed(()=>n.value===0)),e$2.provide($,k),t$3(e$2.computed(()=>u$7(n.value,{[0]:i$1.Open,[1]:i$1.Closed})));let C=e$2.computed(()=>{var t;return (t=o$3(f))==null?void 0:t.closest("form")});return e$2.onMounted(()=>{e$2.watch([C],()=>{if(!C.value||o.defaultValue===void 0)return;function t(){k.theirOnChange(o.defaultValue);}return C.value.addEventListener("reset",t),()=>{var i;(i=C.value)==null||i.removeEventListener("reset",t);}},{immediate:true});}),()=>{let{name:t,modelValue:i,disabled:l,form:d,...O}=o,h={open:n.value===0,disabled:l,value:M.value};return e$2.h(e$2.Fragment,[...t!=null&&M.value!=null?e$1({[t]:M.value}).map(([I,Q])=>e$2.h(f$3,E$3({features:u$4.Hidden,key:I,as:"input",type:"hidden",hidden:true,readOnly:true,form:d,disabled:l,name:I,value:Q}))):[],A$4({ourProps:{},theirProps:{...r,...T$2(O,["defaultValue","onUpdate:modelValue","horizontal","multiple","by"])},slot:h,slots:b,attrs:r,name:"Listbox"})])}}}),Ee$1=e$2.defineComponent({name:"ListboxLabel",props:{as:{type:[Object,String],default:"label"},id:{type:String,default:null}},setup(o,{attrs:b,slots:r}){var f;let w=(f=o.id)!=null?f:`headlessui-listbox-label-${i$6()}`,n=A$1("ListboxLabel");function e(){var v;(v=o$3(n.buttonRef))==null||v.focus({preventScroll:true});}return ()=>{let v={open:n.listboxState.value===0,disabled:n.disabled.value},{...s}=o,m={id:w,ref:n.labelRef,onClick:e};return A$4({ourProps:m,theirProps:s,slot:v,attrs:b,slots:r,name:"ListboxLabel"})}}}),je$1=e$2.defineComponent({name:"ListboxButton",props:{as:{type:[Object,String],default:"button"},id:{type:String,default:null}},setup(o,{attrs:b,slots:r,expose:w}){var p;let n=(p=o.id)!=null?p:`headlessui-listbox-button-${i$6()}`,e=A$1("ListboxButton");w({el:e.buttonRef,$el:e.buttonRef});function f(a){switch(a.key){case o$2.Space:case o$2.Enter:case o$2.ArrowDown:a.preventDefault(),e.openListbox(),e$2.nextTick(()=>{var u;(u=o$3(e.optionsRef))==null||u.focus({preventScroll:true}),e.value.value||e.goToOption(c$1.First);});break;case o$2.ArrowUp:a.preventDefault(),e.openListbox(),e$2.nextTick(()=>{var u;(u=o$3(e.optionsRef))==null||u.focus({preventScroll:true}),e.value.value||e.goToOption(c$1.Last);});break}}function v(a){switch(a.key){case o$2.Space:a.preventDefault();break}}function s(a){e.disabled.value||(e.listboxState.value===0?(e.closeListbox(),e$2.nextTick(()=>{var u;return (u=o$3(e.buttonRef))==null?void 0:u.focus({preventScroll:true})})):(a.preventDefault(),e.openListbox(),me$2(()=>{var u;return (u=o$3(e.optionsRef))==null?void 0:u.focus({preventScroll:true})})));}let m=s$3(e$2.computed(()=>({as:o.as,type:b.type})),e.buttonRef);return ()=>{var y,L;let a={open:e.listboxState.value===0,disabled:e.disabled.value,value:e.value.value},{...u}=o,D={ref:e.buttonRef,id:n,type:m.value,"aria-haspopup":"listbox","aria-controls":(y=o$3(e.optionsRef))==null?void 0:y.id,"aria-expanded":e.listboxState.value===0,"aria-labelledby":e.labelRef.value?[(L=o$3(e.labelRef))==null?void 0:L.id,n].join(" "):void 0,disabled:e.disabled.value===true?true:void 0,onKeydown:f,onKeyup:v,onClick:s};return A$4({ourProps:D,theirProps:u,slot:a,attrs:b,slots:r,name:"ListboxButton"})}}}),Ae$1=e$2.defineComponent({name:"ListboxOptions",props:{as:{type:[Object,String],default:"ul"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true},id:{type:String,default:null}},setup(o,{attrs:b,slots:r,expose:w}){var p;let n=(p=o.id)!=null?p:`headlessui-listbox-options-${i$6()}`,e=A$1("ListboxOptions"),f=e$2.ref(null);w({el:e.optionsRef,$el:e.optionsRef});function v(a){switch(f.value&&clearTimeout(f.value),a.key){case o$2.Space:if(e.searchQuery.value!=="")return a.preventDefault(),a.stopPropagation(),e.search(a.key);case o$2.Enter:if(a.preventDefault(),a.stopPropagation(),e.activeOptionIndex.value!==null){let u=e.options.value[e.activeOptionIndex.value];e.select(u.dataRef.value);}e.mode.value===0&&(e.closeListbox(),e$2.nextTick(()=>{var u;return (u=o$3(e.buttonRef))==null?void 0:u.focus({preventScroll:true})}));break;case u$7(e.orientation.value,{vertical:o$2.ArrowDown,horizontal:o$2.ArrowRight}):return a.preventDefault(),a.stopPropagation(),e.goToOption(c$1.Next);case u$7(e.orientation.value,{vertical:o$2.ArrowUp,horizontal:o$2.ArrowLeft}):return a.preventDefault(),a.stopPropagation(),e.goToOption(c$1.Previous);case o$2.Home:case o$2.PageUp:return a.preventDefault(),a.stopPropagation(),e.goToOption(c$1.First);case o$2.End:case o$2.PageDown:return a.preventDefault(),a.stopPropagation(),e.goToOption(c$1.Last);case o$2.Escape:a.preventDefault(),a.stopPropagation(),e.closeListbox(),e$2.nextTick(()=>{var u;return (u=o$3(e.buttonRef))==null?void 0:u.focus({preventScroll:true})});break;case o$2.Tab:a.preventDefault(),a.stopPropagation();break;default:a.key.length===1&&(e.search(a.key),f.value=setTimeout(()=>e.clearSearch(),350));break}}let s=l$2(),m=e$2.computed(()=>s!==null?(s.value&i$1.Open)===i$1.Open:e.listboxState.value===0);return ()=>{var y,L;let a={open:e.listboxState.value===0},{...u}=o,D={"aria-activedescendant":e.activeOptionIndex.value===null||(y=e.options.value[e.activeOptionIndex.value])==null?void 0:y.id,"aria-multiselectable":e.mode.value===1?true:void 0,"aria-labelledby":(L=o$3(e.buttonRef))==null?void 0:L.id,"aria-orientation":e.orientation.value,id:n,onKeydown:v,role:"listbox",tabIndex:0,ref:e.optionsRef};return A$4({ourProps:D,theirProps:u,slot:a,attrs:b,slots:r,features:N$5.RenderStrategy|N$5.Static,visible:m.value,name:"ListboxOptions"})}}}),Fe=e$2.defineComponent({name:"ListboxOption",props:{as:{type:[Object,String],default:"li"},value:{type:[Object,String,Number,Boolean]},disabled:{type:Boolean,default:false},id:{type:String,default:null}},setup(o,{slots:b,attrs:r,expose:w}){var C;let n=(C=o.id)!=null?C:`headlessui-listbox-option-${i$6()}`,e=A$1("ListboxOption"),f=e$2.ref(null);w({el:f,$el:f});let v=e$2.computed(()=>e.activeOptionIndex.value!==null?e.options.value[e.activeOptionIndex.value].id===n:false),s=e$2.computed(()=>u$7(e.mode.value,{[0]:()=>e.compare(e$2.toRaw(e.value.value),e$2.toRaw(o.value)),[1]:()=>e$2.toRaw(e.value.value).some(t=>e.compare(e$2.toRaw(t),e$2.toRaw(o.value)))})),m=e$2.computed(()=>u$7(e.mode.value,{[1]:()=>{var i;let t=e$2.toRaw(e.value.value);return ((i=e.options.value.find(l=>t.some(d=>e.compare(e$2.toRaw(d),e$2.toRaw(l.dataRef.value)))))==null?void 0:i.id)===n},[0]:()=>s.value})),p$1=p(f),a=e$2.computed(()=>({disabled:o.disabled,value:o.value,get textValue(){return p$1()},domRef:f}));e$2.onMounted(()=>e.registerOption(n,a)),e$2.onUnmounted(()=>e.unregisterOption(n)),e$2.onMounted(()=>{e$2.watch([e.listboxState,s],()=>{e.listboxState.value===0&&s.value&&u$7(e.mode.value,{[1]:()=>{m.value&&e.goToOption(c$1.Specific,n);},[0]:()=>{e.goToOption(c$1.Specific,n);}});},{immediate:true});}),e$2.watchEffect(()=>{e.listboxState.value===0&&v.value&&e.activationTrigger.value!==0&&e$2.nextTick(()=>{var t,i;return (i=(t=o$3(f))==null?void 0:t.scrollIntoView)==null?void 0:i.call(t,{block:"nearest"})});});function u(t){if(o.disabled)return t.preventDefault();e.select(o.value),e.mode.value===0&&(e.closeListbox(),e$2.nextTick(()=>{var i;return (i=o$3(e.buttonRef))==null?void 0:i.focus({preventScroll:true})}));}function D(){if(o.disabled)return e.goToOption(c$1.Nothing);e.goToOption(c$1.Specific,n);}let y=u$5();function L(t){y.update(t);}function M(t){y.wasMoved(t)&&(o.disabled||v.value||e.goToOption(c$1.Specific,n,0));}function k(t){y.wasMoved(t)&&(o.disabled||v.value&&e.goToOption(c$1.Nothing));}return ()=>{let{disabled:t}=o,i={active:v.value,selected:s.value,disabled:t},{value:l,disabled:d,...O}=o,h={id:n,ref:f,role:"option",tabIndex:t===true?void 0:-1,"aria-disabled":t===true?true:void 0,"aria-selected":s.value,disabled:void 0,onClick:u,onFocus:D,onPointerenter:L,onMouseenter:L,onPointermove:M,onMousemove:M,onPointerleave:k,onMouseleave:k};return A$4({ourProps:h,theirProps:O,slot:i,attrs:r,slots:b,name:"ListboxOption"})}}});

  var Z=(i=>(i[i.Open=0]="Open",i[i.Closed=1]="Closed",i))(Z||{}),ee=(i=>(i[i.Pointer=0]="Pointer",i[i.Other=1]="Other",i))(ee||{});function te$1(o){requestAnimationFrame(()=>requestAnimationFrame(o));}let A=Symbol("MenuContext");function O(o){let M=e$2.inject(A,null);if(M===null){let i=new Error(`<${o} /> is missing a parent <Menu /> component.`);throw Error.captureStackTrace&&Error.captureStackTrace(i,O),i}return M}let ge$2=e$2.defineComponent({name:"Menu",props:{as:{type:[Object,String],default:"template"}},setup(o,{slots:M,attrs:i}){let I=e$2.ref(1),p=e$2.ref(null),e=e$2.ref(null),r=e$2.ref([]),f=e$2.ref(""),d=e$2.ref(null),g=e$2.ref(1);function b(t=a=>a){let a=d.value!==null?r.value[d.value]:null,n=O$2(t(r.value.slice()),v=>o$3(v.dataRef.domRef)),s=a?n.indexOf(a):null;return s===-1&&(s=null),{items:n,activeItemIndex:s}}let l={menuState:I,buttonRef:p,itemsRef:e,items:r,searchQuery:f,activeItemIndex:d,activationTrigger:g,closeMenu:()=>{I.value=1,d.value=null;},openMenu:()=>I.value=0,goToItem(t,a,n){let s=b(),v=f$2(t===c$1.Specific?{focus:c$1.Specific,id:a}:{focus:t},{resolveItems:()=>s.items,resolveActiveIndex:()=>s.activeItemIndex,resolveId:u=>u.id,resolveDisabled:u=>u.dataRef.disabled});f.value="",d.value=v,g.value=n!=null?n:1,r.value=s.items;},search(t){let n=f.value!==""?0:1;f.value+=t.toLowerCase();let v=(d.value!==null?r.value.slice(d.value+n).concat(r.value.slice(0,d.value+n)):r.value).find(h=>h.dataRef.textValue.startsWith(f.value)&&!h.dataRef.disabled),u=v?r.value.indexOf(v):-1;u===-1||u===d.value||(d.value=u,g.value=1);},clearSearch(){f.value="";},registerItem(t,a){let n=b(s=>[...s,{id:t,dataRef:a}]);r.value=n.items,d.value=n.activeItemIndex,g.value=1;},unregisterItem(t){let a=b(n=>{let s=n.findIndex(v=>v.id===t);return s!==-1&&n.splice(s,1),n});r.value=a.items,d.value=a.activeItemIndex,g.value=1;}};return w$2([p,e],(t,a)=>{var n;l.closeMenu(),w$4(a,h.Loose)||(t.preventDefault(),(n=o$3(p))==null||n.focus());},e$2.computed(()=>I.value===0)),e$2.provide(A,l),t$3(e$2.computed(()=>u$7(I.value,{[0]:i$1.Open,[1]:i$1.Closed}))),()=>{let t={open:I.value===0,close:l.closeMenu};return A$4({ourProps:{},theirProps:o,slot:t,slots:M,attrs:i,name:"Menu"})}}}),Se$2=e$2.defineComponent({name:"MenuButton",props:{disabled:{type:Boolean,default:false},as:{type:[Object,String],default:"button"},id:{type:String,default:null}},setup(o,{attrs:M,slots:i,expose:I}){var b;let p=(b=o.id)!=null?b:`headlessui-menu-button-${i$6()}`,e=O("MenuButton");I({el:e.buttonRef,$el:e.buttonRef});function r(l){switch(l.key){case o$2.Space:case o$2.Enter:case o$2.ArrowDown:l.preventDefault(),l.stopPropagation(),e.openMenu(),e$2.nextTick(()=>{var t;(t=o$3(e.itemsRef))==null||t.focus({preventScroll:true}),e.goToItem(c$1.First);});break;case o$2.ArrowUp:l.preventDefault(),l.stopPropagation(),e.openMenu(),e$2.nextTick(()=>{var t;(t=o$3(e.itemsRef))==null||t.focus({preventScroll:true}),e.goToItem(c$1.Last);});break}}function f(l){switch(l.key){case o$2.Space:l.preventDefault();break}}function d(l){o.disabled||(e.menuState.value===0?(e.closeMenu(),e$2.nextTick(()=>{var t;return (t=o$3(e.buttonRef))==null?void 0:t.focus({preventScroll:true})})):(l.preventDefault(),e.openMenu(),te$1(()=>{var t;return (t=o$3(e.itemsRef))==null?void 0:t.focus({preventScroll:true})})));}let g=s$3(e$2.computed(()=>({as:o.as,type:M.type})),e.buttonRef);return ()=>{var n;let l={open:e.menuState.value===0},{...t}=o,a={ref:e.buttonRef,id:p,type:g.value,"aria-haspopup":"menu","aria-controls":(n=o$3(e.itemsRef))==null?void 0:n.id,"aria-expanded":e.menuState.value===0,onKeydown:r,onKeyup:f,onClick:d};return A$4({ourProps:a,theirProps:t,slot:l,attrs:M,slots:i,name:"MenuButton"})}}}),Me=e$2.defineComponent({name:"MenuItems",props:{as:{type:[Object,String],default:"div"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true},id:{type:String,default:null}},setup(o,{attrs:M,slots:i,expose:I}){var l;let p=(l=o.id)!=null?l:`headlessui-menu-items-${i$6()}`,e=O("MenuItems"),r=e$2.ref(null);I({el:e.itemsRef,$el:e.itemsRef}),i$2({container:e$2.computed(()=>o$3(e.itemsRef)),enabled:e$2.computed(()=>e.menuState.value===0),accept(t){return t.getAttribute("role")==="menuitem"?NodeFilter.FILTER_REJECT:t.hasAttribute("role")?NodeFilter.FILTER_SKIP:NodeFilter.FILTER_ACCEPT},walk(t){t.setAttribute("role","none");}});function f(t){var a;switch(r.value&&clearTimeout(r.value),t.key){case o$2.Space:if(e.searchQuery.value!=="")return t.preventDefault(),t.stopPropagation(),e.search(t.key);case o$2.Enter:if(t.preventDefault(),t.stopPropagation(),e.activeItemIndex.value!==null){let s=e.items.value[e.activeItemIndex.value];(a=o$3(s.dataRef.domRef))==null||a.click();}e.closeMenu(),_(o$3(e.buttonRef));break;case o$2.ArrowDown:return t.preventDefault(),t.stopPropagation(),e.goToItem(c$1.Next);case o$2.ArrowUp:return t.preventDefault(),t.stopPropagation(),e.goToItem(c$1.Previous);case o$2.Home:case o$2.PageUp:return t.preventDefault(),t.stopPropagation(),e.goToItem(c$1.First);case o$2.End:case o$2.PageDown:return t.preventDefault(),t.stopPropagation(),e.goToItem(c$1.Last);case o$2.Escape:t.preventDefault(),t.stopPropagation(),e.closeMenu(),e$2.nextTick(()=>{var n;return (n=o$3(e.buttonRef))==null?void 0:n.focus({preventScroll:true})});break;case o$2.Tab:t.preventDefault(),t.stopPropagation(),e.closeMenu(),e$2.nextTick(()=>v$2(o$3(e.buttonRef),t.shiftKey?N$6.Previous:N$6.Next));break;default:t.key.length===1&&(e.search(t.key),r.value=setTimeout(()=>e.clearSearch(),350));break}}function d(t){switch(t.key){case o$2.Space:t.preventDefault();break}}let g=l$2(),b=e$2.computed(()=>g!==null?(g.value&i$1.Open)===i$1.Open:e.menuState.value===0);return ()=>{var s,v;let t={open:e.menuState.value===0},{...a}=o,n={"aria-activedescendant":e.activeItemIndex.value===null||(s=e.items.value[e.activeItemIndex.value])==null?void 0:s.id,"aria-labelledby":(v=o$3(e.buttonRef))==null?void 0:v.id,id:p,onKeydown:f,onKeyup:d,role:"menu",tabIndex:0,ref:e.itemsRef};return A$4({ourProps:n,theirProps:a,slot:t,attrs:M,slots:i,features:N$5.RenderStrategy|N$5.Static,visible:b.value,name:"MenuItems"})}}}),be=e$2.defineComponent({name:"MenuItem",inheritAttrs:false,props:{as:{type:[Object,String],default:"template"},disabled:{type:Boolean,default:false},id:{type:String,default:null}},setup(o,{slots:M,attrs:i,expose:I}){var v;let p$1=(v=o.id)!=null?v:`headlessui-menu-item-${i$6()}`,e=O("MenuItem"),r=e$2.ref(null);I({el:r,$el:r});let f=e$2.computed(()=>e.activeItemIndex.value!==null?e.items.value[e.activeItemIndex.value].id===p$1:false),d=p(r),g=e$2.computed(()=>({disabled:o.disabled,get textValue(){return d()},domRef:r}));e$2.onMounted(()=>e.registerItem(p$1,g)),e$2.onUnmounted(()=>e.unregisterItem(p$1)),e$2.watchEffect(()=>{e.menuState.value===0&&f.value&&e.activationTrigger.value!==0&&e$2.nextTick(()=>{var u,h;return (h=(u=o$3(r))==null?void 0:u.scrollIntoView)==null?void 0:h.call(u,{block:"nearest"})});});function b(u){if(o.disabled)return u.preventDefault();e.closeMenu(),_(o$3(e.buttonRef));}function l(){if(o.disabled)return e.goToItem(c$1.Nothing);e.goToItem(c$1.Specific,p$1);}let t=u$5();function a(u){t.update(u);}function n(u){t.wasMoved(u)&&(o.disabled||f.value||e.goToItem(c$1.Specific,p$1,0));}function s(u){t.wasMoved(u)&&(o.disabled||f.value&&e.goToItem(c$1.Nothing));}return ()=>{let{disabled:u,...h}=o,C={active:f.value,disabled:u,close:e.closeMenu};return A$4({ourProps:{id:p$1,ref:r,role:"menuitem",tabIndex:u===true?void 0:-1,"aria-disabled":u===true?true:void 0,onClick:b,onFocus:l,onPointerenter:a,onMouseenter:a,onPointermove:n,onMousemove:n,onPointerleave:s,onMouseleave:s},theirProps:{...i,...h},slot:C,attrs:i,slots:M,name:"MenuItem"})}}});

  var Se$1=(s=>(s[s.Open=0]="Open",s[s.Closed=1]="Closed",s))(Se$1||{});let re=Symbol("PopoverContext");function U$1(d){let P=e$2.inject(re,null);if(P===null){let s=new Error(`<${d} /> is missing a parent <${ye$1.name} /> component.`);throw Error.captureStackTrace&&Error.captureStackTrace(s,U$1),s}return P}let le$2=Symbol("PopoverGroupContext");function ae(){return e$2.inject(le$2,null)}let ue$1=Symbol("PopoverPanelContext");function ge$1(){return e$2.inject(ue$1,null)}let ye$1=e$2.defineComponent({name:"Popover",inheritAttrs:false,props:{as:{type:[Object,String],default:"div"}},setup(d,{slots:P,attrs:s,expose:h$1}){var u;let f=e$2.ref(null);h$1({el:f,$el:f});let t=e$2.ref(1),o=e$2.ref(null),y=e$2.ref(null),v=e$2.ref(null),m=e$2.ref(null),b=e$2.computed(()=>i$4(f)),E=e$2.computed(()=>{var L,$;if(!o$3(o)||!o$3(m))return  false;for(let x of document.querySelectorAll("body > *"))if(Number(x==null?void 0:x.contains(o$3(o)))^Number(x==null?void 0:x.contains(o$3(m))))return  true;let e=E$4(),r=e.indexOf(o$3(o)),l=(r+e.length-1)%e.length,g=(r+1)%e.length,G=e[l],C=e[g];return !((L=o$3(m))!=null&&L.contains(G))&&!(($=o$3(m))!=null&&$.contains(C))}),a={popoverState:t,buttonId:e$2.ref(null),panelId:e$2.ref(null),panel:m,button:o,isPortalled:E,beforePanelSentinel:y,afterPanelSentinel:v,togglePopover(){t.value=u$7(t.value,{[0]:1,[1]:0});},closePopover(){t.value!==1&&(t.value=1);},close(e){a.closePopover();let r=(()=>e?e instanceof HTMLElement?e:e.value instanceof HTMLElement?o$3(e):o$3(a.button):o$3(a.button))();r==null||r.focus();}};e$2.provide(re,a),t$3(e$2.computed(()=>u$7(t.value,{[0]:i$1.Open,[1]:i$1.Closed})));let S={buttonId:a.buttonId,panelId:a.panelId,close(){a.closePopover();}},c=ae(),I=c==null?void 0:c.registerPopover,[F,w]=q(),i=N$3({mainTreeNodeRef:c==null?void 0:c.mainTreeNodeRef,portals:F,defaultContainers:[o,m]});function p(){var e,r,l,g;return (g=c==null?void 0:c.isFocusWithinPopoverGroup())!=null?g:((e=b.value)==null?void 0:e.activeElement)&&(((r=o$3(o))==null?void 0:r.contains(b.value.activeElement))||((l=o$3(m))==null?void 0:l.contains(b.value.activeElement)))}return e$2.watchEffect(()=>I==null?void 0:I(S)),E$2((u=b.value)==null?void 0:u.defaultView,"focus",e=>{var r,l;e.target!==window&&e.target instanceof HTMLElement&&t.value===0&&(p()||o&&m&&(i.contains(e.target)||(r=o$3(a.beforePanelSentinel))!=null&&r.contains(e.target)||(l=o$3(a.afterPanelSentinel))!=null&&l.contains(e.target)||a.closePopover()));},true),w$2(i.resolveContainers,(e,r)=>{var l;a.closePopover(),w$4(r,h.Loose)||(e.preventDefault(),(l=o$3(o))==null||l.focus());},e$2.computed(()=>t.value===0)),()=>{let e={open:t.value===0,close:a.close};return e$2.h(e$2.Fragment,[e$2.h(w,{},()=>A$4({theirProps:{...d,...s},ourProps:{ref:f},slot:e,slots:P,attrs:s,name:"Popover"})),e$2.h(i.MainTreeNode)])}}}),Ge=e$2.defineComponent({name:"PopoverButton",props:{as:{type:[Object,String],default:"button"},disabled:{type:[Boolean],default:false},id:{type:String,default:null}},inheritAttrs:false,setup(d,{attrs:P$1,slots:s,expose:h}){var u;let f=(u=d.id)!=null?u:`headlessui-popover-button-${i$6()}`,t=U$1("PopoverButton"),o=e$2.computed(()=>i$4(t.button));h({el:t.button,$el:t.button}),e$2.onMounted(()=>{t.buttonId.value=f;}),e$2.onUnmounted(()=>{t.buttonId.value=null;});let y=ae(),v=y==null?void 0:y.closeOthers,m=ge$1(),b=e$2.computed(()=>m===null?false:m.value===t.panelId.value),E=e$2.ref(null),a=`headlessui-focus-sentinel-${i$6()}`;b.value||e$2.watchEffect(()=>{t.button.value=o$3(E);});let S=s$3(e$2.computed(()=>({as:d.as,type:P$1.type})),E);function c(e){var r,l,g,G,C;if(b.value){if(t.popoverState.value===1)return;switch(e.key){case o$2.Space:case o$2.Enter:e.preventDefault(),(l=(r=e.target).click)==null||l.call(r),t.closePopover(),(g=o$3(t.button))==null||g.focus();break}}else switch(e.key){case o$2.Space:case o$2.Enter:e.preventDefault(),e.stopPropagation(),t.popoverState.value===1&&(v==null||v(t.buttonId.value)),t.togglePopover();break;case o$2.Escape:if(t.popoverState.value!==0)return v==null?void 0:v(t.buttonId.value);if(!o$3(t.button)||(G=o.value)!=null&&G.activeElement&&!((C=o$3(t.button))!=null&&C.contains(o.value.activeElement)))return;e.preventDefault(),e.stopPropagation(),t.closePopover();break}}function I(e){b.value||e.key===o$2.Space&&e.preventDefault();}function F(e){var r,l;d.disabled||(b.value?(t.closePopover(),(r=o$3(t.button))==null||r.focus()):(e.preventDefault(),e.stopPropagation(),t.popoverState.value===1&&(v==null||v(t.buttonId.value)),t.togglePopover(),(l=o$3(t.button))==null||l.focus()));}function w(e){e.preventDefault(),e.stopPropagation();}let i=n();function p(){let e=o$3(t.panel);if(!e)return;function r(){u$7(i.value,{[d$5.Forwards]:()=>P(e,N$6.First),[d$5.Backwards]:()=>P(e,N$6.Last)})===T$3.Error&&P(E$4().filter(g=>g.dataset.headlessuiFocusGuard!=="true"),u$7(i.value,{[d$5.Forwards]:N$6.Next,[d$5.Backwards]:N$6.Previous}),{relativeTo:o$3(t.button)});}r();}return ()=>{let e=t.popoverState.value===0,r={open:e},{...l}=d,g=b.value?{ref:E,type:S.value,onKeydown:c,onClick:F}:{ref:E,id:f,type:S.value,"aria-expanded":t.popoverState.value===0,"aria-controls":o$3(t.panel)?t.panelId.value:void 0,disabled:d.disabled?true:void 0,onKeydown:c,onKeyup:I,onClick:F,onMousedown:w};return e$2.h(e$2.Fragment,[A$4({ourProps:g,theirProps:{...P$1,...l},slot:r,attrs:P$1,slots:s,name:"PopoverButton"}),e&&!b.value&&t.isPortalled.value&&e$2.h(f$3,{id:a,features:u$4.Focusable,"data-headlessui-focus-guard":true,as:"button",type:"button",onFocus:p})])}}}),$e=e$2.defineComponent({name:"PopoverOverlay",props:{as:{type:[Object,String],default:"div"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true}},setup(d,{attrs:P,slots:s}){let h=U$1("PopoverOverlay"),f=`headlessui-popover-overlay-${i$6()}`,t=l$2(),o=e$2.computed(()=>t!==null?(t.value&i$1.Open)===i$1.Open:h.popoverState.value===0);function y(){h.closePopover();}return ()=>{let v={open:h.popoverState.value===0};return A$4({ourProps:{id:f,"aria-hidden":true,onClick:y},theirProps:d,slot:v,attrs:P,slots:s,features:N$5.RenderStrategy|N$5.Static,visible:o.value,name:"PopoverOverlay"})}}}),je=e$2.defineComponent({name:"PopoverPanel",props:{as:{type:[Object,String],default:"div"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true},focus:{type:Boolean,default:false},id:{type:String,default:null}},inheritAttrs:false,setup(d,{attrs:P$1,slots:s,expose:h}){var w;let f=(w=d.id)!=null?w:`headlessui-popover-panel-${i$6()}`,{focus:t}=d,o=U$1("PopoverPanel"),y=e$2.computed(()=>i$4(o.panel)),v=`headlessui-focus-sentinel-before-${i$6()}`,m=`headlessui-focus-sentinel-after-${i$6()}`;h({el:o.panel,$el:o.panel}),e$2.onMounted(()=>{o.panelId.value=f;}),e$2.onUnmounted(()=>{o.panelId.value=null;}),e$2.provide(ue$1,o.panelId),e$2.watchEffect(()=>{var p,u;if(!t||o.popoverState.value!==0||!o.panel)return;let i=(p=y.value)==null?void 0:p.activeElement;(u=o$3(o.panel))!=null&&u.contains(i)||P(o$3(o.panel),N$6.First);});let b=l$2(),E=e$2.computed(()=>b!==null?(b.value&i$1.Open)===i$1.Open:o.popoverState.value===0);function a(i){var p,u;switch(i.key){case o$2.Escape:if(o.popoverState.value!==0||!o$3(o.panel)||y.value&&!((p=o$3(o.panel))!=null&&p.contains(y.value.activeElement)))return;i.preventDefault(),i.stopPropagation(),o.closePopover(),(u=o$3(o.button))==null||u.focus();break}}function S(i){var u,e,r,l,g;let p=i.relatedTarget;p&&o$3(o.panel)&&((u=o$3(o.panel))!=null&&u.contains(p)||(o.closePopover(),((r=(e=o$3(o.beforePanelSentinel))==null?void 0:e.contains)!=null&&r.call(e,p)||(g=(l=o$3(o.afterPanelSentinel))==null?void 0:l.contains)!=null&&g.call(l,p))&&p.focus({preventScroll:true})));}let c=n();function I(){let i=o$3(o.panel);if(!i)return;function p(){u$7(c.value,{[d$5.Forwards]:()=>{var e;P(i,N$6.First)===T$3.Error&&((e=o$3(o.afterPanelSentinel))==null||e.focus());},[d$5.Backwards]:()=>{var u;(u=o$3(o.button))==null||u.focus({preventScroll:true});}});}p();}function F(){let i=o$3(o.panel);if(!i)return;function p(){u$7(c.value,{[d$5.Forwards]:()=>{let u=o$3(o.button),e=o$3(o.panel);if(!u)return;let r=E$4(),l=r.indexOf(u),g=r.slice(0,l+1),C=[...r.slice(l+1),...g];for(let L of C.slice())if(L.dataset.headlessuiFocusGuard==="true"||e!=null&&e.contains(L)){let $=C.indexOf(L);$!==-1&&C.splice($,1);}P(C,N$6.First,{sorted:false});},[d$5.Backwards]:()=>{var e;P(i,N$6.Previous)===T$3.Error&&((e=o$3(o.button))==null||e.focus());}});}p();}return ()=>{let i={open:o.popoverState.value===0,close:o.close},{focus:p,...u}=d,e={ref:o.panel,id:f,onKeydown:a,onFocusout:t&&o.popoverState.value===0?S:void 0,tabIndex:-1};return A$4({ourProps:e,theirProps:{...P$1,...u},attrs:P$1,slot:i,slots:{...s,default:(...r)=>{var l;return [e$2.h(e$2.Fragment,[E.value&&o.isPortalled.value&&e$2.h(f$3,{id:v,ref:o.beforePanelSentinel,features:u$4.Focusable,"data-headlessui-focus-guard":true,as:"button",type:"button",onFocus:I}),(l=s.default)==null?void 0:l.call(s,...r),E.value&&o.isPortalled.value&&e$2.h(f$3,{id:m,ref:o.afterPanelSentinel,features:u$4.Focusable,"data-headlessui-focus-guard":true,as:"button",type:"button",onFocus:F})])]}},features:N$5.RenderStrategy|N$5.Static,visible:E.value,name:"PopoverPanel"})}}}),Ae=e$2.defineComponent({name:"PopoverGroup",inheritAttrs:false,props:{as:{type:[Object,String],default:"div"}},setup(d,{attrs:P,slots:s,expose:h}){let f=e$2.ref(null),t=e$2.shallowRef([]),o=e$2.computed(()=>i$4(f)),y=v();h({el:f,$el:f});function v$1(a){let S=t.value.indexOf(a);S!==-1&&t.value.splice(S,1);}function m(a){return t.value.push(a),()=>{v$1(a);}}function b(){var c;let a=o.value;if(!a)return  false;let S=a.activeElement;return (c=o$3(f))!=null&&c.contains(S)?true:t.value.some(I=>{var F,w;return ((F=a.getElementById(I.buttonId.value))==null?void 0:F.contains(S))||((w=a.getElementById(I.panelId.value))==null?void 0:w.contains(S))})}function E(a){for(let S of t.value)S.buttonId.value!==a&&S.close();}return e$2.provide(le$2,{registerPopover:m,unregisterPopover:v$1,isFocusWithinPopoverGroup:b,closeOthers:E,mainTreeNodeRef:y.mainTreeNodeRef}),()=>e$2.h(e$2.Fragment,[A$4({ourProps:{ref:f},theirProps:{...d,...P},slot:{},attrs:P,slots:s,name:"PopoverGroup"}),e$2.h(y.MainTreeNode)])}});

  let a=Symbol("LabelContext");function d$2(){let t=e$2.inject(a,null);if(t===null){let n=new Error("You used a <Label /> component, but it is not inside a parent.");throw Error.captureStackTrace&&Error.captureStackTrace(n,d$2),n}return t}function E({slot:t={},name:n="Label",props:i={}}={}){let e=e$2.ref([]);function o(r){return e.value.push(r),()=>{let l=e.value.indexOf(r);l!==-1&&e.value.splice(l,1);}}return e$2.provide(a,{register:o,slot:t,name:n,props:i}),e$2.computed(()=>e.value.length>0?e.value.join(" "):void 0)}let K=e$2.defineComponent({name:"Label",props:{as:{type:[Object,String],default:"label"},passive:{type:[Boolean],default:false},id:{type:String,default:null}},setup(t,{slots:n,attrs:i}){var r;let e=(r=t.id)!=null?r:`headlessui-label-${i$6()}`,o=d$2();return e$2.onMounted(()=>e$2.onUnmounted(o.register(e))),()=>{let{name:l="Label",slot:p={},props:c={}}=o,{passive:f,...s}=t,u={...Object.entries(c).reduce((b,[g,m])=>Object.assign(b,{[g]:e$2.unref(m)}),{}),id:e};return f&&(delete u.onClick,delete u.htmlFor,delete s.onClick),A$4({ourProps:u,theirProps:s,slot:p,attrs:i,slots:n,name:l})}}});

  function le$1(t,m){return t===m}let H=Symbol("RadioGroupContext");function N$1(t){let m=e$2.inject(H,null);if(m===null){let u=new Error(`<${t} /> is missing a parent <RadioGroup /> component.`);throw Error.captureStackTrace&&Error.captureStackTrace(u,N$1),u}return m}let he$1=e$2.defineComponent({name:"RadioGroup",emits:{"update:modelValue":t=>true},props:{as:{type:[Object,String],default:"div"},disabled:{type:[Boolean],default:false},by:{type:[String,Function],default:()=>le$1},modelValue:{type:[Object,String,Number,Boolean],default:void 0},defaultValue:{type:[Object,String,Number,Boolean],default:void 0},form:{type:String,optional:true},name:{type:String,optional:true},id:{type:String,default:null}},inheritAttrs:false,setup(t,{emit:m,attrs:u,slots:S,expose:g}){var O;let d=(O=t.id)!=null?O:`headlessui-radiogroup-${i$6()}`,p=e$2.ref(null),l=e$2.ref([]),R=E({name:"RadioGroupLabel"}),T=k$1({name:"RadioGroupDescription"});g({el:p,$el:p});let[f,G]=d$7(e$2.computed(()=>t.modelValue),e=>m("update:modelValue",e),e$2.computed(()=>t.defaultValue)),s={options:l,value:f,disabled:e$2.computed(()=>t.disabled),firstOption:e$2.computed(()=>l.value.find(e=>!e.propsRef.disabled)),containsCheckedOption:e$2.computed(()=>l.value.some(e=>s.compare(e$2.toRaw(e.propsRef.value),e$2.toRaw(t.modelValue)))),compare(e,a){if(typeof t.by=="string"){let n=t.by;return (e==null?void 0:e[n])===(a==null?void 0:a[n])}return t.by(e,a)},change(e){var n;if(t.disabled||s.compare(e$2.toRaw(f.value),e$2.toRaw(e)))return  false;let a=(n=l.value.find(i=>s.compare(e$2.toRaw(i.propsRef.value),e$2.toRaw(e))))==null?void 0:n.propsRef;return a!=null&&a.disabled?false:(G(e),true)},registerOption(e){l.value.push(e),l.value=O$2(l.value,a=>a.element);},unregisterOption(e){let a=l.value.findIndex(n=>n.id===e);a!==-1&&l.value.splice(a,1);}};e$2.provide(H,s),i$2({container:e$2.computed(()=>o$3(p)),accept(e){return e.getAttribute("role")==="radio"?NodeFilter.FILTER_REJECT:e.hasAttribute("role")?NodeFilter.FILTER_SKIP:NodeFilter.FILTER_ACCEPT},walk(e){e.setAttribute("role","none");}});function v(e){if(!p.value||!p.value.contains(e.target))return;let a=l.value.filter(n=>n.propsRef.disabled===false).map(n=>n.element);switch(e.key){case o$2.Enter:p$1(e.currentTarget);break;case o$2.ArrowLeft:case o$2.ArrowUp:if(e.preventDefault(),e.stopPropagation(),P(a,N$6.Previous|N$6.WrapAround)===T$3.Success){let i=l.value.find(r=>{var c;return r.element===((c=i$4(p))==null?void 0:c.activeElement)});i&&s.change(i.propsRef.value);}break;case o$2.ArrowRight:case o$2.ArrowDown:if(e.preventDefault(),e.stopPropagation(),P(a,N$6.Next|N$6.WrapAround)===T$3.Success){let i=l.value.find(r=>{var c;return r.element===((c=i$4(r.element))==null?void 0:c.activeElement)});i&&s.change(i.propsRef.value);}break;case o$2.Space:{e.preventDefault(),e.stopPropagation();let n=l.value.find(i=>{var r;return i.element===((r=i$4(i.element))==null?void 0:r.activeElement)});n&&s.change(n.propsRef.value);}break}}let b=e$2.computed(()=>{var e;return (e=o$3(p))==null?void 0:e.closest("form")});return e$2.onMounted(()=>{e$2.watch([b],()=>{if(!b.value||t.defaultValue===void 0)return;function e(){s.change(t.defaultValue);}return b.value.addEventListener("reset",e),()=>{var a;(a=b.value)==null||a.removeEventListener("reset",e);}},{immediate:true});}),()=>{let{disabled:e,name:a,form:n,...i}=t,r={ref:p,id:d,role:"radiogroup","aria-labelledby":R.value,"aria-describedby":T.value,onKeydown:v};return e$2.h(e$2.Fragment,[...a!=null&&f.value!=null?e$1({[a]:f.value}).map(([c,L])=>e$2.h(f$3,E$3({features:u$4.Hidden,key:c,as:"input",type:"hidden",hidden:true,readOnly:true,form:n,disabled:e,name:c,value:L}))):[],A$4({ourProps:r,theirProps:{...u,...T$2(i,["modelValue","defaultValue","by"])},slot:{},attrs:u,slots:S,name:"RadioGroup"})])}}});var ie=(u=>(u[u.Empty=1]="Empty",u[u.Active=2]="Active",u))(ie||{});let Oe=e$2.defineComponent({name:"RadioGroupOption",props:{as:{type:[Object,String],default:"div"},value:{type:[Object,String,Number,Boolean]},disabled:{type:Boolean,default:false},id:{type:String,default:null}},setup(t,{attrs:m,slots:u,expose:S}){var i;let g=(i=t.id)!=null?i:`headlessui-radiogroup-option-${i$6()}`,d=N$1("RadioGroupOption"),p=E({name:"RadioGroupLabel"}),l=k$1({name:"RadioGroupDescription"}),R=e$2.ref(null),T=e$2.computed(()=>({value:t.value,disabled:t.disabled})),f=e$2.ref(1);S({el:R,$el:R});let G=e$2.computed(()=>o$3(R));e$2.onMounted(()=>d.registerOption({id:g,element:G,propsRef:T})),e$2.onUnmounted(()=>d.unregisterOption(g));let s=e$2.computed(()=>{var r;return ((r=d.firstOption.value)==null?void 0:r.id)===g}),v=e$2.computed(()=>d.disabled.value||t.disabled),b=e$2.computed(()=>d.compare(e$2.toRaw(d.value.value),e$2.toRaw(t.value))),O=e$2.computed(()=>v.value?-1:b.value||!d.containsCheckedOption.value&&s.value?0:-1);function e(){var r;d.change(t.value)&&(f.value|=2,(r=o$3(R))==null||r.focus());}function a(){f.value|=2;}function n(){f.value&=-3;}return ()=>{let{value:r,disabled:c,...L}=t,K={checked:b.value,disabled:v.value,active:Boolean(f.value&2)},M={id:g,ref:R,role:"radio","aria-checked":b.value?"true":"false","aria-labelledby":p.value,"aria-describedby":l.value,"aria-disabled":v.value?true:void 0,tabIndex:O.value,onClick:v.value?void 0:e,onFocus:v.value?void 0:a,onBlur:v.value?void 0:n};return A$4({ourProps:M,theirProps:L,slot:K,attrs:m,slots:u,name:"RadioGroupOption"})}}}),ke=K,Ee=K$1;

  let C$1=Symbol("GroupContext"),oe=e$2.defineComponent({name:"SwitchGroup",props:{as:{type:[Object,String],default:"template"}},setup(l,{slots:c,attrs:i}){let r=e$2.ref(null),f=E({name:"SwitchLabel",props:{htmlFor:e$2.computed(()=>{var t;return (t=r.value)==null?void 0:t.id}),onClick(t){r.value&&(t.currentTarget.tagName==="LABEL"&&t.preventDefault(),r.value.click(),r.value.focus({preventScroll:true}));}}}),p=k$1({name:"SwitchDescription"});return e$2.provide(C$1,{switchRef:r,labelledby:f,describedby:p}),()=>A$4({theirProps:l,ourProps:{},slot:{},slots:c,attrs:i,name:"SwitchGroup"})}}),ue=e$2.defineComponent({name:"Switch",emits:{"update:modelValue":l=>true},props:{as:{type:[Object,String],default:"button"},modelValue:{type:Boolean,default:void 0},defaultChecked:{type:Boolean,optional:true},form:{type:String,optional:true},name:{type:String,optional:true},value:{type:String,optional:true},id:{type:String,default:null},disabled:{type:Boolean,default:false},tabIndex:{type:Number,default:0}},inheritAttrs:false,setup(l,{emit:c,attrs:i,slots:r,expose:f}){var h;let p=(h=l.id)!=null?h:`headlessui-switch-${i$6()}`,n=e$2.inject(C$1,null),[t,s]=d$7(e$2.computed(()=>l.modelValue),e=>c("update:modelValue",e),e$2.computed(()=>l.defaultChecked));function m(){s(!t.value);}let E=e$2.ref(null),o=n===null?E:n.switchRef,L=s$3(e$2.computed(()=>({as:l.as,type:i.type})),o);f({el:o,$el:o});function D(e){e.preventDefault(),m();}function R(e){e.key===o$2.Space?(e.preventDefault(),m()):e.key===o$2.Enter&&p$1(e.currentTarget);}function x(e){e.preventDefault();}let d=e$2.computed(()=>{var e,a;return (a=(e=o$3(o))==null?void 0:e.closest)==null?void 0:a.call(e,"form")});return e$2.onMounted(()=>{e$2.watch([d],()=>{if(!d.value||l.defaultChecked===void 0)return;function e(){s(l.defaultChecked);}return d.value.addEventListener("reset",e),()=>{var a;(a=d.value)==null||a.removeEventListener("reset",e);}},{immediate:true});}),()=>{let{name:e,value:a,form:K,tabIndex:y,...b}=l,T={checked:t.value},B={id:p,ref:o,role:"switch",type:L.value,tabIndex:y===-1?0:y,"aria-checked":t.value,"aria-labelledby":n==null?void 0:n.labelledby.value,"aria-describedby":n==null?void 0:n.describedby.value,onClick:D,onKeyup:R,onKeypress:x};return e$2.h(e$2.Fragment,[e!=null&&t.value!=null?e$2.h(f$3,E$3({features:u$4.Hidden,as:"input",type:"checkbox",hidden:true,readOnly:true,checked:t.value,form:K,disabled:b.disabled,name:e,value:a})):null,A$4({ourProps:B,theirProps:{...i,...T$2(b,["modelValue","defaultChecked"])},slot:T,attrs:i,slots:r,name:"Switch"})])}}}),de=K,ce$1=K$1;

  let d$1=e$2.defineComponent({props:{onFocus:{type:Function,required:true}},setup(t){let n=e$2.ref(true);return ()=>n.value?e$2.h(f$3,{as:"button",type:"button",features:u$4.Focusable,onFocus(o){o.preventDefault();let e,a=50;function r(){var u;if(a--<=0){e&&cancelAnimationFrame(e);return}if((u=t.onFocus)!=null&&u.call(t)){n.value=false,cancelAnimationFrame(e);return}e=requestAnimationFrame(r);}e=requestAnimationFrame(r);}}):null}});

  var te=(s=>(s[s.Forwards=0]="Forwards",s[s.Backwards=1]="Backwards",s))(te||{}),le=(d=>(d[d.Less=-1]="Less",d[d.Equal=0]="Equal",d[d.Greater=1]="Greater",d))(le||{});let U=Symbol("TabsContext");function C(a){let b=e$2.inject(U,null);if(b===null){let s=new Error(`<${a} /> is missing a parent <TabGroup /> component.`);throw Error.captureStackTrace&&Error.captureStackTrace(s,C),s}return b}let G=Symbol("TabsSSRContext"),me$1=e$2.defineComponent({name:"TabGroup",emits:{change:a=>true},props:{as:{type:[Object,String],default:"template"},selectedIndex:{type:[Number],default:null},defaultIndex:{type:[Number],default:0},vertical:{type:[Boolean],default:false},manual:{type:[Boolean],default:false}},inheritAttrs:false,setup(a,{slots:b,attrs:s,emit:d}){var E;let i=e$2.ref((E=a.selectedIndex)!=null?E:a.defaultIndex),l=e$2.ref([]),r=e$2.ref([]),p=e$2.computed(()=>a.selectedIndex!==null),R=e$2.computed(()=>p.value?a.selectedIndex:i.value);function y(t){var c;let n=O$2(u.tabs.value,o$3),o=O$2(u.panels.value,o$3),e=n.filter(I=>{var m;return !((m=o$3(I))!=null&&m.hasAttribute("disabled"))});if(t<0||t>n.length-1){let I=u$7(i.value===null?0:Math.sign(t-i.value),{[-1]:()=>1,[0]:()=>u$7(Math.sign(t),{[-1]:()=>0,[0]:()=>0,[1]:()=>1}),[1]:()=>0}),m=u$7(I,{[0]:()=>n.indexOf(e[0]),[1]:()=>n.indexOf(e[e.length-1])});m!==-1&&(i.value=m),u.tabs.value=n,u.panels.value=o;}else {let I=n.slice(0,t),h=[...n.slice(t),...I].find(W=>e.includes(W));if(!h)return;let O=(c=n.indexOf(h))!=null?c:u.selectedIndex.value;O===-1&&(O=u.selectedIndex.value),i.value=O,u.tabs.value=n,u.panels.value=o;}}let u={selectedIndex:e$2.computed(()=>{var t,n;return (n=(t=i.value)!=null?t:a.defaultIndex)!=null?n:null}),orientation:e$2.computed(()=>a.vertical?"vertical":"horizontal"),activation:e$2.computed(()=>a.manual?"manual":"auto"),tabs:l,panels:r,setSelectedIndex(t){R.value!==t&&d("change",t),p.value||y(t);},registerTab(t){var o;if(l.value.includes(t))return;let n=l.value[i.value];if(l.value.push(t),l.value=O$2(l.value,o$3),!p.value){let e=(o=l.value.indexOf(n))!=null?o:i.value;e!==-1&&(i.value=e);}},unregisterTab(t){let n=l.value.indexOf(t);n!==-1&&l.value.splice(n,1);},registerPanel(t){r.value.includes(t)||(r.value.push(t),r.value=O$2(r.value,o$3));},unregisterPanel(t){let n=r.value.indexOf(t);n!==-1&&r.value.splice(n,1);}};e$2.provide(U,u);let T=e$2.ref({tabs:[],panels:[]}),x=e$2.ref(false);e$2.onMounted(()=>{x.value=true;}),e$2.provide(G,e$2.computed(()=>x.value?null:T.value));let w=e$2.computed(()=>a.selectedIndex);return e$2.onMounted(()=>{e$2.watch([w],()=>{var t;return y((t=a.selectedIndex)!=null?t:a.defaultIndex)},{immediate:true});}),e$2.watchEffect(()=>{if(!p.value||R.value==null||u.tabs.value.length<=0)return;let t=O$2(u.tabs.value,o$3);t.some((o,e)=>o$3(u.tabs.value[e])!==o$3(o))&&u.setSelectedIndex(t.findIndex(o=>o$3(o)===o$3(u.tabs.value[R.value])));}),()=>{let t={selectedIndex:i.value};return e$2.h(e$2.Fragment,[l.value.length<=0&&e$2.h(d$1,{onFocus:()=>{for(let n of l.value){let o=o$3(n);if((o==null?void 0:o.tabIndex)===0)return o.focus(),true}return  false}}),A$4({theirProps:{...s,...T$2(a,["selectedIndex","defaultIndex","manual","vertical","onChange"])},ourProps:{},slot:t,slots:b,attrs:s,name:"TabGroup"})])}}}),pe$1=e$2.defineComponent({name:"TabList",props:{as:{type:[Object,String],default:"div"}},setup(a,{attrs:b,slots:s}){let d=C("TabList");return ()=>{let i={selectedIndex:d.selectedIndex.value},l={role:"tablist","aria-orientation":d.orientation.value};return A$4({ourProps:l,theirProps:a,slot:i,attrs:b,slots:s,name:"TabList"})}}}),xe=e$2.defineComponent({name:"Tab",props:{as:{type:[Object,String],default:"button"},disabled:{type:[Boolean],default:false},id:{type:String,default:null}},setup(a,{attrs:b,slots:s,expose:d}){var o;let i=(o=a.id)!=null?o:`headlessui-tabs-tab-${i$6()}`,l=C("Tab"),r=e$2.ref(null);d({el:r,$el:r}),e$2.onMounted(()=>l.registerTab(r)),e$2.onUnmounted(()=>l.unregisterTab(r));let p=e$2.inject(G),R=e$2.computed(()=>{if(p.value){let e=p.value.tabs.indexOf(i);return e===-1?p.value.tabs.push(i)-1:e}return  -1}),y=e$2.computed(()=>{let e=l.tabs.value.indexOf(r);return e===-1?R.value:e}),u=e$2.computed(()=>y.value===l.selectedIndex.value);function T(e){var I;let c=e();if(c===T$3.Success&&l.activation.value==="auto"){let m=(I=i$4(r))==null?void 0:I.activeElement,h=l.tabs.value.findIndex(O=>o$3(O)===m);h!==-1&&l.setSelectedIndex(h);}return c}function x(e){let c=l.tabs.value.map(m=>o$3(m)).filter(Boolean);if(e.key===o$2.Space||e.key===o$2.Enter){e.preventDefault(),e.stopPropagation(),l.setSelectedIndex(y.value);return}switch(e.key){case o$2.Home:case o$2.PageUp:return e.preventDefault(),e.stopPropagation(),T(()=>P(c,N$6.First));case o$2.End:case o$2.PageDown:return e.preventDefault(),e.stopPropagation(),T(()=>P(c,N$6.Last))}if(T(()=>u$7(l.orientation.value,{vertical(){return e.key===o$2.ArrowUp?P(c,N$6.Previous|N$6.WrapAround):e.key===o$2.ArrowDown?P(c,N$6.Next|N$6.WrapAround):T$3.Error},horizontal(){return e.key===o$2.ArrowLeft?P(c,N$6.Previous|N$6.WrapAround):e.key===o$2.ArrowRight?P(c,N$6.Next|N$6.WrapAround):T$3.Error}}))===T$3.Success)return e.preventDefault()}let w=e$2.ref(false);function E(){var e;w.value||(w.value=true,!a.disabled&&((e=o$3(r))==null||e.focus({preventScroll:true}),l.setSelectedIndex(y.value),t$6(()=>{w.value=false;})));}function t(e){e.preventDefault();}let n=s$3(e$2.computed(()=>({as:a.as,type:b.type})),r);return ()=>{var m,h;let e={selected:u.value,disabled:(m=a.disabled)!=null?m:false},{...c}=a,I={ref:r,onKeydown:x,onMousedown:t,onClick:E,id:i,role:"tab",type:n.value,"aria-controls":(h=o$3(l.panels.value[y.value]))==null?void 0:h.id,"aria-selected":u.value,tabIndex:u.value?0:-1,disabled:a.disabled?true:void 0};return A$4({ourProps:I,theirProps:c,slot:e,attrs:b,slots:s,name:"Tab"})}}}),Ie=e$2.defineComponent({name:"TabPanels",props:{as:{type:[Object,String],default:"div"}},setup(a,{slots:b,attrs:s}){let d=C("TabPanels");return ()=>{let i={selectedIndex:d.selectedIndex.value};return A$4({theirProps:a,ourProps:{},slot:i,attrs:s,slots:b,name:"TabPanels"})}}}),ye=e$2.defineComponent({name:"TabPanel",props:{as:{type:[Object,String],default:"div"},static:{type:Boolean,default:false},unmount:{type:Boolean,default:true},id:{type:String,default:null},tabIndex:{type:Number,default:0}},setup(a,{attrs:b,slots:s,expose:d}){var T;let i=(T=a.id)!=null?T:`headlessui-tabs-panel-${i$6()}`,l=C("TabPanel"),r=e$2.ref(null);d({el:r,$el:r}),e$2.onMounted(()=>l.registerPanel(r)),e$2.onUnmounted(()=>l.unregisterPanel(r));let p=e$2.inject(G),R=e$2.computed(()=>{if(p.value){let x=p.value.panels.indexOf(i);return x===-1?p.value.panels.push(i)-1:x}return  -1}),y=e$2.computed(()=>{let x=l.panels.value.indexOf(r);return x===-1?R.value:x}),u=e$2.computed(()=>y.value===l.selectedIndex.value);return ()=>{var n;let x={selected:u.value},{tabIndex:w,...E}=a,t={ref:r,id:i,role:"tabpanel","aria-labelledby":(n=o$3(l.tabs.value[y.value]))==null?void 0:n.id,tabIndex:u.value?w:-1};return !u.value&&a.unmount&&!a.static?e$2.h(f$3,{as:"span","aria-hidden":true,...t}):A$4({ourProps:t,theirProps:E,slot:x,attrs:b,slots:s,features:N$5.Static|N$5.RenderStrategy,visible:u.value,name:"TabPanel"})}}});

  function l(r){let e={called:false};return (...t)=>{if(!e.called)return e.called=true,r(...t)}}

  function m(e,...t){e&&t.length>0&&e.classList.add(...t);}function d(e,...t){e&&t.length>0&&e.classList.remove(...t);}var g$1=(i=>(i.Finished="finished",i.Cancelled="cancelled",i))(g$1||{});function F(e,t){let i=o$5();if(!e)return i.dispose;let{transitionDuration:n,transitionDelay:a}=getComputedStyle(e),[l,s]=[n,a].map(o=>{let[u=0]=o.split(",").filter(Boolean).map(r=>r.includes("ms")?parseFloat(r):parseFloat(r)*1e3).sort((r,c)=>c-r);return u});return l!==0?i.setTimeout(()=>t("finished"),l+s):t("finished"),i.add(()=>t("cancelled")),i.dispose}function L$1(e,t,i,n,a,l$1){let s=o$5(),o=l$1!==void 0?l(l$1):()=>{};return d(e,...a),m(e,...t,...i),s.nextFrame(()=>{d(e,...i),m(e,...n),s.add(F(e,u=>(d(e,...n,...t),m(e,...a),o(u))));}),s.add(()=>d(e,...t,...i,...n,...a)),s.add(()=>o("cancelled")),s.dispose}

  function g(e=""){return e.split(/\s+/).filter(t=>t.length>1)}let R=Symbol("TransitionContext");var pe=(a=>(a.Visible="visible",a.Hidden="hidden",a))(pe||{});function me(){return e$2.inject(R,null)!==null}function Te(){let e=e$2.inject(R,null);if(e===null)throw new Error("A <TransitionChild /> is used but it is missing a parent <TransitionRoot />.");return e}function ge(){let e=e$2.inject(N,null);if(e===null)throw new Error("A <TransitionChild /> is used but it is missing a parent <TransitionRoot />.");return e}let N=Symbol("NestingContext");function L(e){return "children"in e?L(e.children):e.value.filter(({state:t})=>t==="visible").length>0}function Q(e){let t=e$2.ref([]),a=e$2.ref(false);e$2.onMounted(()=>a.value=true),e$2.onUnmounted(()=>a.value=false);function s(n,r=S.Hidden){let l=t.value.findIndex(({id:f})=>f===n);l!==-1&&(u$7(r,{[S.Unmount](){t.value.splice(l,1);},[S.Hidden](){t.value[l].state="hidden";}}),!L(t)&&a.value&&(e==null||e()));}function h(n){let r=t.value.find(({id:l})=>l===n);return r?r.state!=="visible"&&(r.state="visible"):t.value.push({id:n,state:"visible"}),()=>s(n,S.Unmount)}return {children:t,register:h,unregister:s}}let W=N$5.RenderStrategy,he=e$2.defineComponent({props:{as:{type:[Object,String],default:"div"},show:{type:[Boolean],default:null},unmount:{type:[Boolean],default:true},appear:{type:[Boolean],default:false},enter:{type:[String],default:""},enterFrom:{type:[String],default:""},enterTo:{type:[String],default:""},entered:{type:[String],default:""},leave:{type:[String],default:""},leaveFrom:{type:[String],default:""},leaveTo:{type:[String],default:""}},emits:{beforeEnter:()=>true,afterEnter:()=>true,beforeLeave:()=>true,afterLeave:()=>true},setup(e,{emit:t,attrs:a,slots:s,expose:h}){let n=e$2.ref(0);function r(){n.value|=i$1.Opening,t("beforeEnter");}function l(){n.value&=~i$1.Opening,t("afterEnter");}function f(){n.value|=i$1.Closing,t("beforeLeave");}function S$1(){n.value&=~i$1.Closing,t("afterLeave");}if(!me()&&s$2())return ()=>e$2.h(Se,{...e,onBeforeEnter:r,onAfterEnter:l,onBeforeLeave:f,onAfterLeave:S$1},s);let d=e$2.ref(null),y=e$2.computed(()=>e.unmount?S.Unmount:S.Hidden);h({el:d,$el:d});let{show:v,appear:A}=Te(),{register:D,unregister:H}=ge(),i=e$2.ref(v.value?"visible":"hidden"),I={value:true},c=i$6(),b={value:false},P=Q(()=>{!b.value&&i.value!=="hidden"&&(i.value="hidden",H(c),S$1());});e$2.onMounted(()=>{let o=D(c);e$2.onUnmounted(o);}),e$2.watchEffect(()=>{if(y.value===S.Hidden&&c){if(v.value&&i.value!=="visible"){i.value="visible";return}u$7(i.value,{["hidden"]:()=>H(c),["visible"]:()=>D(c)});}});let j=g(e.enter),M=g(e.enterFrom),X=g(e.enterTo),_=g(e.entered),Y=g(e.leave),Z=g(e.leaveFrom),ee=g(e.leaveTo);e$2.onMounted(()=>{e$2.watchEffect(()=>{if(i.value==="visible"){let o=o$3(d);if(o instanceof Comment&&o.data==="")throw new Error("Did you forget to passthrough the `ref` to the actual DOM node?")}});});function te(o){let E=I.value&&!A.value,p=o$3(d);!p||!(p instanceof HTMLElement)||E||(b.value=true,v.value&&r(),v.value||f(),o(v.value?L$1(p,j,M,X,_,V=>{b.value=false,V===g$1.Finished&&l();}):L$1(p,Y,Z,ee,_,V=>{b.value=false,V===g$1.Finished&&(L(P)||(i.value="hidden",H(c),S$1()));})));}return e$2.onMounted(()=>{e$2.watch([v],(o,E,p)=>{te(p),I.value=false;},{immediate:true});}),e$2.provide(N,P),t$3(e$2.computed(()=>u$7(i.value,{["visible"]:i$1.Open,["hidden"]:i$1.Closed})|n.value)),()=>{let{appear:o,show:E,enter:p,enterFrom:V,enterTo:Ce,entered:ye,leave:be,leaveFrom:Ee,leaveTo:Ve,...U}=e,ne={ref:d},re={...U,...A.value&&v.value&&c$3.isServer?{class:e$2.normalizeClass([a.class,U.class,...j,...M])}:{}};return A$4({theirProps:re,ourProps:ne,slot:{},slots:s,attrs:a,features:W,visible:i.value==="visible",name:"TransitionChild"})}}}),ce=he,Se=e$2.defineComponent({inheritAttrs:false,props:{as:{type:[Object,String],default:"div"},show:{type:[Boolean],default:null},unmount:{type:[Boolean],default:true},appear:{type:[Boolean],default:false},enter:{type:[String],default:""},enterFrom:{type:[String],default:""},enterTo:{type:[String],default:""},entered:{type:[String],default:""},leave:{type:[String],default:""},leaveFrom:{type:[String],default:""},leaveTo:{type:[String],default:""}},emits:{beforeEnter:()=>true,afterEnter:()=>true,beforeLeave:()=>true,afterLeave:()=>true},setup(e,{emit:t,attrs:a,slots:s}){let h=l$2(),n=e$2.computed(()=>e.show===null&&h!==null?(h.value&i$1.Open)===i$1.Open:e.show);e$2.watchEffect(()=>{if(![true,false].includes(n.value))throw new Error('A <Transition /> is used but it is missing a `:show="true | false"` prop.')});let r=e$2.ref(n.value?"visible":"hidden"),l=Q(()=>{r.value="hidden";}),f=e$2.ref(true),S={show:n,appear:e$2.computed(()=>e.appear||!f.value)};return e$2.onMounted(()=>{e$2.watchEffect(()=>{f.value=false,n.value?r.value="visible":L(l)||(r.value="hidden");});}),e$2.provide(N,l),e$2.provide(R,S),()=>{let d=T$2(e,["show","appear","unmount","onBeforeEnter","onBeforeLeave","onAfterEnter","onAfterLeave"]),y={unmount:e.unmount};return A$4({ourProps:{...y,as:"template"},theirProps:{},slot:{},slots:{...s,default:()=>[e$2.h(ce,{onBeforeEnter:()=>t("beforeEnter"),onAfterEnter:()=>t("afterEnter"),onBeforeLeave:()=>t("beforeLeave"),onAfterLeave:()=>t("afterLeave"),...a,...y,...d},s.default)]},attrs:{},features:W,visible:r.value==="visible",name:"Transition"})}}});

  exports.Combobox = lt;
  exports.ComboboxButton = nt;
  exports.ComboboxInput = it;
  exports.ComboboxLabel = at;
  exports.ComboboxOption = rt;
  exports.ComboboxOptions = ut;
  exports.Dialog = Ye;
  exports.DialogBackdrop = ze;
  exports.DialogDescription = Je;
  exports.DialogOverlay = _e;
  exports.DialogPanel = Ge$1;
  exports.DialogTitle = Ve;
  exports.Disclosure = N$2;
  exports.DisclosureButton = Q$1;
  exports.DisclosurePanel = V;
  exports.FocusTrap = ue$2;
  exports.Listbox = Ie$1;
  exports.ListboxButton = je$1;
  exports.ListboxLabel = Ee$1;
  exports.ListboxOption = Fe;
  exports.ListboxOptions = Ae$1;
  exports.Menu = ge$2;
  exports.MenuButton = Se$2;
  exports.MenuItem = be;
  exports.MenuItems = Me;
  exports.Popover = ye$1;
  exports.PopoverButton = Ge;
  exports.PopoverGroup = Ae;
  exports.PopoverOverlay = $e;
  exports.PopoverPanel = je;
  exports.Portal = $$2;
  exports.PortalGroup = z;
  exports.RadioGroup = he$1;
  exports.RadioGroupDescription = Ee;
  exports.RadioGroupLabel = ke;
  exports.RadioGroupOption = Oe;
  exports.Switch = ue;
  exports.SwitchDescription = ce$1;
  exports.SwitchGroup = oe;
  exports.SwitchLabel = de;
  exports.Tab = xe;
  exports.TabGroup = me$1;
  exports.TabList = pe$1;
  exports.TabPanel = ye;
  exports.TabPanels = Ie;
  exports.TransitionChild = he;
  exports.TransitionRoot = Se;
  exports.provideUseId = s$5;

}));
