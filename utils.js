const deepClone = obj => JSON.parse(JSON.stringify(obj));

/** Returns a string with all regex metacharacters .*+?^${}()|[] escaped. */
const escapeMeta = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Returns a regex pattern matching one or more digits wrapped inside 'prefix' and 'suffix'. */
function getNumericSuffixRegex({ prefix = '(', suffix = ')' } = {}) {
  return new RegExp(`${escapeMeta(prefix)}(\\d+)${escapeMeta(suffix)}$`);
}

/** Returns a string without a numeric suffix matching the defined pattern. */
function getUnenumeratedName(string, { prefix = '(', suffix = ')' } = {}) {
  return String(string).replace(getNumericSuffixRegex({ prefix, suffix }), '');
}

/** Return a Number() from the suffix if detected, else null. */
function getSuffixNumber(string, { prefix = '(', suffix = ')' } = {}) {
  const match = String(string).match(getNumericSuffixRegex({ prefix, suffix }));
  return match ? parseInt(match[1]) : null;
}

/** Returns a string with a new numeric suffix, or increments an existing one. */
function renameWithNumericSuffix(string, { prefix = '(', suffix = ')', startAt = 1 } = {}) {
  let number = getSuffixNumber(string, { prefix, suffix });
  number = number === null ? startAt : number + 1; // increment the suffix number if present
  const baseName = getUnenumeratedName(string, { prefix, suffix });
  return `${baseName}${prefix}${number}${suffix}`;
}

function isObject(variable) {
  return (
    typeof variable === 'object' &&
    variable !== null &&
    !Array.isArray(variable)
  )
}

function isEmptyObject(obj) {
  return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
}

function getObjValues(obj) {
  return Object.keys(obj).map((key) => {
    return obj[key];
  });
}

function styleObjectToString(styles) {
  return Object.entries(styles).reduce((acc, [key, value]) => {
    // Convert camelCase to kebab-case for CSS properties
    if (!value) return acc
    if (/^\d+$/.test(key)) return acc
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    return acc + `${cssKey}: ${value}; `;
  }, '').trim();
}

function kebabToCamelCase(string) {
  return string.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function parseStyleString(styleString) {
  const styleObj = {};
  styleString = styleString.replace(/;\n* */g, ';');
  styleString = styleString.replace(/: */g, ':');
  
  const propValStrings = styleString.split(';');
  propValStrings.forEach((propValString) => {
    if (propValString.includes(':')) {
      const pair = propValString.split(':');
      const key = kebabToCamelCase(pair[0])
      styleObj[key] = pair[1];
    }
  });

  return styleObj;
}

function parseClassString(classString) {
  if (Array.isArray(classString)) {
    return classString;
  }
  classString = classString.replace(/,/g, ' ');
  classString = classString.replace(/ +/g, ' ');
  return classString.split(' ');
}

function addProperty(keyName, destObj, donorObj) {
  if (!destObj.hasOwnProperty(keyName)) {
    destObj[keyName] = donorObj[keyName];
  }

  return destObj[keyName] === donorObj[keyName] ? "success" : "failure";
}

function removeProperty(keyName, destObj) {
  if (destObj.hasOwnProperty(keyName)) {
    delete destObj[keyName];
  }

  return !destObj.hasOwnProperty(keyName) ? "success" : "failure";
}

function overwriteProperty(keyName, destObj, donorObj) {
  destObj[keyName] = donorObj[keyName];

  return destObj[keyName] === donorObj[keyName] ? "success" : "failure";
}

function toggleProperty(keyName, destObj, donorObj) {
  let result;
  if (destObj.hasOwnProperty(keyName)) {
    const wasRemoved = removeProperty(keyName, destObj);
    result = wasRemoved === "success" ? "removed" : "failure";
  } else {
    const wasAdded = addProperty(keyName, destObj, donorObj);
    result = wasAdded === "success" ? "added" : "failure";
  }

  return result;
}

const updateObjProp = {
  add: (keyName, destObj, donorObj) => {
    return addProperty(keyName, destObj, donorObj);
  },
  remove: (keyName, destObj, donorObj) => {
    return removeProperty(keyName, destObj, donorObj);
  },
  overwrite: (keyName, destObj, donorObj) => {
    return overwriteProperty(keyName, destObj, donorObj);
  },
  toggle: (keyName, destObj, donorObj) => {
    return toggleProperty(keyName, destObj, donorObj);
  },
};

function updateObjProps(destObj, donorObj, mode = 'overwrite') {
  let objKeys;
  if (isObject(donorObj)) {
    objKeys = Object.keys(donorObj);
  } else if (Array.isArray(donorObj) && ['remove'].includes(mode)) {
    objKeys = donorObj;
  } else {
    return;
  }
  objKeys.forEach((keyName) => {
    updateObjProp[mode](keyName, destObj, donorObj);
  });
}

const updateCssClass = {
  add: (className, domElement) => {
    domElement.classList.add(className);
  },
  remove: (className, domElement) => {
    domElement.classList.remove(className);
  },
  toggle: (className, domElement) => {
    domElement.classList.toggle(className);
  },
};

function getDomSiblingIndex(element) {
  // Note: Only regards elements (NodeType 1); not text nodes, etc.
  if (!element || !element.parentNode || !element.parentNode.children) return
  const childElements = element.parentNode.children
  for (let i = 0; i < childElements.length; i++) {
    const childElement = childElements[i];
    if (childElement === element) {
      return i;
    }
  }
}

function formatHtml(htmlString, indentSize = 2, indentChar = ' ') {
  const indent = indentChar.repeat(indentSize);
  let formatted = '';
  let indentLevel = 0;
  
  // Split by tags while preserving them
  const tokens = htmlString.split(/(<[^>]*>)/g).filter(token => token.trim());
  
  tokens.forEach(token => {
    if (token.startsWith('<')) {
      // It's a tag
      if (token.startsWith('</')) {
        // Closing tag - decrease indent before adding
        indentLevel--;
        formatted += indent.repeat(indentLevel) + token + '\n';
      } else if (token.endsWith('/>')) {
        // Self-closing tag - no indent change
        formatted += indent.repeat(indentLevel) + token + '\n';
      } else {
        // Opening tag - add then increase indent
        formatted += indent.repeat(indentLevel) + token + '\n';
        indentLevel++;
      }
    } else {
      // It's text content
      const trimmed = token.trim();
      if (trimmed) {
        formatted += indent.repeat(indentLevel) + trimmed + '\n';
      }
    }
  });
  
  return formatted.trim();
}

/** Returns a concatenated string of all content in text nodes that are direct children */
function getTextNodeContent(element) {
  return [].reduce.call(element.childNodes, function (acc, el) { return acc + (el.nodeType === 3 ? el.textContent : ''); }, '');
}

/** Returns an HTML string of all child elements (no text nodes)*/
function getHtmlContent(element) {
  return [].reduce.call(element.childNodes, function (acc, el) { return acc + (el.nodeType === 1 ? el.outerHTML : ''); }, '');
}

function clearElementTextNodes(element) {
  element.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      node.remove()
    }
  })
}

function getElement(elem) {
  if (typeof elem === 'string') {
    elem = document.getElementById(elem);
  }
  return elem;
}

function newElement(attrs = {}) {
  // determine which HTML tag to use for the new DOM element (<div> by default)
  const tag = attrs.hasOwnProperty("tag") ? attrs["tag"] : "div";
  const newElem = document.createElement(tag);
  delete attrs.tag; // clear 'tag' from attr here; only pass in to updateElement() with direct call

  return updateElement(newElem, attrs);
}

function updateElement(updateElem, attrs = {}) {
  updateElem = getElement(updateElem);

  // record and clear all text content
  const _innerText = attrs.hasOwnProperty("text") ? attrs.text : getTextNodeContent(updateElem);
  clearElementTextNodes(updateElem);
  
  // record and clear all html/text content
  const _innerHTML = attrs.html ? attrs.html : getHtmlContent(updateElem);
  updateElem.textContent = '';

  // determine the parent element in which the new element should be nested (<body> by default)
  let parent = document.body;
  if (attrs.hasOwnProperty("parent")) {
    parent = getElement(attrs.parent);
  } else if (updateElem.parentNode) {
    parent = updateElem.parentNode;
  }

  let siblingIndex = getDomSiblingIndex(updateElem);

  parent.append(updateElem);

  // set position within parent element, using an index
  if (attrs.hasOwnProperty("siblingIndex")) {
    siblingIndex = Math.floor(parseFloat(String(attrs.siblingIndex)));
  }

  if (siblingIndex < parent.children.length) {
    const nextSibling = parent.children[siblingIndex]
    parent.insertBefore(updateElem, nextSibling)
  } else {
    parent.append(updateElem);
  }

  // the 'nodeName' property is immutable, so create a new element if changing tags
  const isNewTagType = attrs.tag !== updateElem.nodeName.toLowerCase();
  if (attrs.hasOwnProperty("tag") && isNewTagType) {
    attrs.text = _innerText;
    attrs.html = _innerHTML;
    attrs.parent = parent;
    attrs.siblingIndex = siblingIndex;
    const elementWithNewTag = newElement(attrs);
    updateElem.remove();
    return elementWithNewTag;
  }

  // convert the style property to an HTML-friendly string if expressed as a JavaScript Object
  // e.g. { color: "black", fontSize: "13px" } ==> "color: black; font-size: 10px;"
  if (attrs.hasOwnProperty("style") && isObject(attrs.style)) {
    attrs.style = styleObjectToString(attrs.style);
  }

  // use one of four methods for updating CSS style props and classes:
  // "add", "remove", "toggle", and "overwrite" (styles only)
  if (attrs.hasOwnProperty("updateMode") && updateObjProp[attrs.updateMode]) {
    if (attrs.hasOwnProperty("style")) {
      const destStyle = parseStyleString(updateElem.getAttribute("style"));
      const donorStyle = parseStyleString(attrs.style);
      // Update style object according to the selected mode
      updateObjProps(destStyle, donorStyle, attrs.updateMode);
      attrs.style = styleObjectToString(destStyle);
    }
    if (attrs.hasOwnProperty("class") && updateCssClass[attrs.updateMode]) {
      const newClasses = parseClassString(attrs.class);
      newClasses.forEach((className) => {
        updateCssClass[attrs.updateMode](className, updateElem);
      });
      delete attrs.class;
    }
  }

  // remove keys from object that are not valid HTML tag attributes
  const nonHtmlAttrs = ["tag", "parent", "text", "html", "updateMode", "siblingIndex"];
  nonHtmlAttrs.forEach((key) => {
    delete attrs[key];
  });

  // add all other specified attributes to the new element
  for (const key in attrs) {
    updateElem.setAttribute(key, attrs[key]);
  }

  // attach text as a text node (NodeType 3) if provided
  if (_innerText.length > 0) {
    updateElem.append(document.createTextNode(_innerText));
  }

  // assign innerHTML with += to ensure text node is first; preserve child elements
  updateElem.innerHTML += _innerHTML;

  return updateElem;
}

var SVG_CACHE = {}

function attachSvgContent(parent, svgText) {
  const svgElement = newElement({
    parent: parent, html: svgText,
    style: {
      // define svg-related properties on the parent element ('svgContainer')
      fill: 'inherit', stroke: 'inherit', color: 'inherit',
      // define size properties on parent, since svg will completely fill container
      width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%',
    },
  })
}

async function fetchSvg(filePath, svgContainer) {
  try {
    const response = await fetch(filePath)
    const fetchedSvgText = await response.text()
    SVG_CACHE[filePath] = fetchedSvgText
    attachSvgContent(svgContainer, fetchedSvgText)
  } catch (error) {
    console.error('Error loading SVG:\n', error)
  }
}

function newSvgElement(filePath, attrs = {}) {
  // immediately (synchronously) create 'svgContainer' to preserve layout
  const svgContainer = newElement(attrs)

  if (SVG_CACHE.hasOwnProperty(filePath)) {
    svgText = SVG_CACHE[filePath]
    attachSvgContent(svgContainer, svgText)
  } else {
    // if not cached, fetch and attach to 'svgContainer' reference using async
    fetchSvg(filePath, svgContainer)
  }
  return svgContainer
}

function toggleVisible(element, setVisible = null) {
  const e = getElement(element);
  if (setVisible === null) {
    e.style.visibility = e.style.visibility === "hidden" ? null : "hidden";
  } else {
    e.style.visibility = setVisible === true ? null : "hidden";
  }
}

const randInt = (min, max) => Math.floor(Math.random() * (max - min)) + min; // min: inc; max: exc
const randItem = (list) => list[randInt(0, list.length)];
const removeItemByValue = (arr, value) => arr.filter(item => item !== value);

function wrappedIndex(list, index, offset) {
  const targetIndex = index + offset;
  const negative = targetIndex < 0;
  const wrapped = Math.abs(targetIndex) % list.length;
  return negative ? list.length - wrapped : wrapped;
}

function itemByOffset(list, item, offset) {
  return list[wrappedIndex(list, list.indexOf(item), offset)];
}

function copyToClipboard(inputField, onSuccess = () => { console.log("Copied!"); }) {
  inputField.select();
  try {
    document.execCommand('copy');
    onSuccess();
  } catch (err) {
    console.error('Unable to copy text', err);
  }
}

function fetchJSON(url, updateFunction) {
  fetch(url)
    .then(function (promise) {
      return promise.json();
    })
    .then(function (data) {
      updateFunction(data);
    })
    .catch(function (error) {
      console.error('Error:', error);
    });
}

// // Aggregate API
// const vinocent = {
//   deepClone,
//   isObject,
//   getObjValues,
//   styleObjectToString,
//   parseStyleString,
//   parseClassString,
//   addProperty,
//   removeProperty,
//   overwriteProperty,
//   toggleProperty,
//   updateObjProp,
//   updateObjProps,
//   updateCssClass,
//   getElement,
//   newElement,
//   updateElement,
//   toggleVisible,
//   randInt,
//   randItem,
//   removeItemByValue,
//   wrappedIndex,
//   itemByOffset,
//   copyToClipboard,
//   fetchJSON,
// };

// // CommonJS export
// if (typeof module !== 'undefined' && module.exports) {
//   module.exports = vinocent;
// }

// // Attach to global (browser)
// if (typeof window !== 'undefined') {
//   window.vinocent = Object.assign({}, window.vinocent, vinocent);
// }