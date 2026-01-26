/**
 * DOM manipulation helpers for vanilla JS usage
 */

/**
 * Creates an HTML element with the given tag, attributes, and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | boolean | undefined>,
  children?: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === false) continue;
      if (value === true) {
        element.setAttribute(key, '');
      } else {
        element.setAttribute(key, value);
      }
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }

  return element;
}

/**
 * Sets multiple attributes on an element
 */
export function setAttributes(
  element: Element,
  attrs: Record<string, string | boolean | undefined>
): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) {
      element.removeAttribute(key);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, value);
    }
  }
}

/**
 * Adds event listeners to an element with automatic cleanup
 */
export function addEventListeners<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  events: Partial<{ [E in K]: (event: HTMLElementEventMap[E]) => void }>
): () => void {
  const cleanups: (() => void)[] = [];

  for (const [event, handler] of Object.entries(events)) {
    if (handler) {
      element.addEventListener(event, handler as EventListener);
      cleanups.push(() =>
        element.removeEventListener(event, handler as EventListener)
      );
    }
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}

/**
 * Queries a single element and throws if not found
 */
export function $(selector: string, parent: ParentNode = document): Element {
  const element = parent.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/**
 * Queries multiple elements
 */
export function $$(
  selector: string,
  parent: ParentNode = document
): Element[] {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Shows an element by removing hidden class or setting display
 */
export function show(element: HTMLElement): void {
  element.classList.remove('subauth-hidden');
  element.hidden = false;
}

/**
 * Hides an element
 */
export function hide(element: HTMLElement): void {
  element.classList.add('subauth-hidden');
  element.hidden = true;
}

/**
 * Toggles element visibility
 */
export function toggle(element: HTMLElement, show?: boolean): void {
  const shouldShow = show ?? element.hidden;
  if (shouldShow) {
    element.classList.remove('subauth-hidden');
    element.hidden = false;
  } else {
    element.classList.add('subauth-hidden');
    element.hidden = true;
  }
}
