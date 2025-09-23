var UNIQUE_UID_LIST = new Set()
var ELEMENTS_WITHOUT_UID = new Set()

var ELEMENTS = {}

function addElementMetadata(uid) {
  ELEMENTS[uid] = {
    uid: uid,
    verbatimStyle: '',
  }
}

function getNewUid() {
  return Number(new Date().getTime())
}

function getElementUid(element) {
  const uid = element.getAttribute('uid')
  return ['', 'null', 'undefined', null, undefined].includes(uid) ? null : uid
}

var STR = {
  nullInput: '#NULL#',
  pageBuildArea: 'page-build-area',
  pageBuildToolbar: 'page-build-toolbar',
  newElementText: 'New Element',
}

// always re-scan before referencing UNIQUE_UID_LIST or ELEMENTS_WITHOUT_UID
function scanForUniqueIds(element) {
  const uid = getElementUid(element)
  if (uid !== null) {
    UNIQUE_UID_LIST.add(String(uid))
  } else {
    ELEMENTS_WITHOUT_UID.add(element)
  }
}

/** Only updates elements (NodeType 1) */
function forAllElements(updateFunc, rootNode = null) {
  rootNode = rootNode ? rootNode : getElement(STR.pageBuildArea)
  if (!rootNode || !updateFunc) return

  Array.from(rootNode.children).forEach((childElement) => {
    // execute per-node update logic
    updateFunc(childElement)
    // continue recursing
    forAllElements(updateFunc, childElement)
  })
}

function bulkAssignUids() {
  // re-check unique set of UIDs
  forAllElements(scanForUniqueIds)
  const baseUid = getNewUid()
  ELEMENTS_WITHOUT_UID.forEach((element, index) => {
    element.setAttribute('uid', baseUid + index)
  })
  ELEMENTS_WITHOUT_UID.clear()
}

function bulkReassignUids(rootNode) {
  UNIQUE_UID_LIST.clear()
  ELEMENTS_WITHOUT_UID.clear()
  // re-check unique set of UIDs
  forAllElements(scanForUniqueIds)
  // elements with UIDs within the specified node (e.g., a recently duplicated node)
  const elementsWithUid = rootNode.querySelectorAll('[uid]')  

  const baseUid = getNewUid()
  elementsWithUid.forEach((element, index) => {
    const existingUid = getElementUid(element)
    if (!UNIQUE_UID_LIST.has(existingUid)) return // skip if UID is unique

    const newUid = baseUid + index

    element.setAttribute('id', newUid) // overwrite ID with new UID

    const existingMetadata = ELEMENTS[existingUid]
    if (existingMetadata) {
      ELEMENTS[newUid] = deepClone(existingMetadata)
    } else {
      addElementMetadata(uid)
    }

    element.setAttribute('uid', newUid)
  })
}

function updateElementMetadata() {
  const elementsWithUid = document.querySelectorAll('[uid]')
  const uidList = new Set()
  elementsWithUid.forEach((element) => {
    const uid = getElementUid(element)
    uidList.add(uid)

    // add new metadata to ELEMENTS
    if (!ELEMENTS.hasOwnProperty(uid)) {
      addElementMetadata(uid)
    }
  })

  // clean up deleted element references
  Object.keys(ELEMENTS).forEach((uidKey) => {
    if (!uidList.has(uidKey)) {
      delete ELEMENTS[uidKey]
      UNIQUE_UID_LIST.delete(String(uidKey))
    }
  })
}

function manageUidsAndMetadata() {
  // reset global lists
  UNIQUE_UID_LIST.clear()
  ELEMENTS_WITHOUT_UID.clear()
  // assign UIDs to any elements without them
  bulkAssignUids()
  // create metadata in ELEMENTS for any new elements;
  // remove metadata for any deleted elements
  updateElementMetadata()
  // check for elements with duplicate UIDs and reassign new ones
  // bulkReassignUids()
}

/** Adds colored borders when hovering over editable elements */
function addCssHoverStyles(depth = 10, hueStep = 50, hueOffset = 77) {
  let styleTagString = ''
  for (let i = 0; i < depth; i++) {
    const hue = ((i * hueStep) + hueOffset) % 256
    styleTagString += `/* Depth ${i + 1} */\nbody > ${'* > '.repeat(i)}[uid]:hover {\n  border-color: hsl(${hue}, 70%, 50%) !important;\n}\n`
  }

  if(getElement('edit-hover-styles')) {
    getElement('edit-hover-styles').remove()
  }
  newElement({
    id: 'edit-hover-styles',
    tag: 'style',
    html: styleTagString,
  })
}

const editorDialog = newElement({
  tag: 'div',
  style: {
    position: 'absolute', right: '0', top: '0', padding: '5px', paddingTop: '33px',
    backgroundColor: 'slategrey', minWidth: '400px', height: '100vh', overflowY: 'scroll',
    visibility: 'hidden', pointerEvents: 'visible',
  },
})

const infoTooltip = newElement({ text: 'reeeeeeeeeeeeeeee', style: 'visibility: hidden; z-index: 333; position: absolute; left: 0; top: 0; background-color: white; padding: 3px; pointer-events: none; user-select: none; border-radius: 5px;' })

function pos2d(x, y) {
  return { x: x, y: y }
}

function addPos(pos1, pos2) {
  return pos2d(pos1.x + pos2.x, pos1.y + pos2.y)
}

function posInsideDomElement(posOrMouseEvent, element) {
  let pos = posOrMouseEvent
  if ('clientX' in posOrMouseEvent) {
    pos = pos2d(posOrMouseEvent.clientX, posOrMouseEvent.clientY)
  }
  if (!element) return false

  const domRect = element.getBoundingClientRect()
  if (pos.x < domRect.left) return false
  if (pos.x > domRect.right) return false
  if (pos.y < domRect.top) return false
  if (pos.y > domRect.bottom) return false

  return true
}

document.addEventListener('mousedown', (event) => {
  const contextMenu = getElement('context-menu')
  const outsideEditorDialog = !posInsideDomElement(event, editorDialog)

  if (contextMenu && !posInsideDomElement(event, contextMenu)) {
    removeContextMenu()
  }
  if (!posInsideDomElement(event, contextMenu) && outsideEditorDialog) {
    toggleVisible(editorDialog, false)
  }
})

function handleEmpty(inputValue) {
  if ([null, undefined, ''].includes(inputValue)) {
    return STR.nullInput
  }
  return inputValue
}

function renderElementSummary(targetElement, attrs = {}) {
  attrs.style = attrs.style ? attrs.style : 'margin: 5px; font-family: monospace; color: white;'
  const elementInfo = `_id:${targetElement.id}<br>uid:${getElementUid(targetElement)}`
  const dialogTitle = newElement({ tag: 'h5', parent: parent, html: elementInfo, ...attrs })
}

function removeContextMenu() {
  const contextMenu = getElement('context-menu')
  if (!contextMenu) return
  contextMenu.remove()
}

function renderContextMenu(event) {
  const eventTarget = event.target
  
  removeContextMenu() // clear any existing context menu
  const contextMenu = newElement({
    id: 'context-menu',
    tag: 'div',
    style: {
      position: 'absolute', left: 0, top: 0, padding: '5px',
      backgroundColor: 'slategrey', minWidth: '100px', borderRadius: '5px',
    },
  })

  renderElementSummary(eventTarget, { parent: contextMenu })

  const contextOptions = newElement({
    parent: contextMenu,
    style: 'display: flex; flex-flow: column nowrap;',
  })

  function addContextButton(buttonDef) {
    const contextButton = newElement({ tag: 'div', parent: contextOptions, class: 'context-button' })
    const svg = newSvgElement(`./assets/svg/${buttonDef.mdi}.svg`, { parent: contextButton, style: 'height: 1.3em; width: 1.3em; margin-right: 0.3em;' })
    const btnText = newElement({ tag: 'span', parent: contextButton, text: buttonDef.text, style: 'font-size: 1.3em; white-space: nowrap;' })
    contextButton.addEventListener('mouseup', () => {
      buttonDef.action() // perform defined actions
      if (buttonDef.closeAfter) {
        removeContextMenu()
      } else {
        renderContextMenu(event) // rerender, since some options depend on sibling count/order
      }
    })
  }

  addContextButton({ mdi: 'text-box-plus-outline', text: 'Insert Element', action: () => { renderEditor(addNewDefaultElement({ parent: eventTarget })) }, closeAfter: true })

  const totalSiblings = eventTarget.parentNode.children.length
  const hasSiblings = totalSiblings > 1
  const hasNextSibling = getDomSiblingIndex(eventTarget) < totalSiblings - 1
  const atBuildAreaRoot = getElementUid(eventTarget.parentNode) === STR.pageBuildArea

  if (getElementUid(eventTarget) !== STR.pageBuildArea) {
    buttonDefs = [
      { mdi: 'application-edit-outline', text: 'Edit', action: () => { renderEditor(eventTarget) }, closeAfter: true },
      { mdi: 'content-copy', text: 'Duplicate', action: () => { duplicateElement(eventTarget); toggleVisible(editorDialog, false) }, closeAfter: true },
      { mdi: 'pan-up', text: 'Move Up', action: () => { changeSiblingIndex(eventTarget, -1) }, show: () => { return hasSiblings } },
      { mdi: 'pan-down', text: 'Move Down', action: () => { changeSiblingIndex(eventTarget, 1) }, show: () => { return hasSiblings } },
      { mdi: 'export-variant', text: 'Move Outside', action: () => { eventTarget.parentNode.parentNode.append(eventTarget) }, show: () => { return !atBuildAreaRoot } },
      { mdi: 'import', text: 'Move Inside Next', action: () => { moveInsideSibling(eventTarget) }, show: () => { return hasNextSibling } },
      { mdi: 'trash-can-outline', text: 'Delete', action: () => { eventTarget.remove(); toggleVisible(editorDialog, false) }, closeAfter: true },
    ]

    buttonDefs.forEach((buttonDef) => {
      if (!('show' in buttonDef) || buttonDef.show()) {
        addContextButton(buttonDef)
      }
    })
  }

  // update position after content renders, to know the final height
  moveToMousePos(contextMenu, event)
}

function displayElementStyle(element) {
  const uid = getElementUid(element)
  if (uid && ELEMENTS[uid]) {
    const verbatim = ELEMENTS[uid].verbatimStyle
    if (isObject(verbatim)) {
      return styleObjectToString(verbatim).replace(/; /g, ';\n')
    } else if (typeof verbatim === 'string') {
      return verbatim.replace(/; /g, ';\n')
    }
  } else {
    return styleObjectToString(element.style).replace(/; /g, ';\n')
  }
}

function renderEditor(_targetElement) {
  editorDialog.textContent = '' // clear innerHTML of editor

  const _targetUid = getElementUid(_targetElement)
  const _targetMetadata = ELEMENTS[_targetUid] || {}

  removeContextMenu()
  toggleVisible(editorDialog, true)

  renderElementSummary(_targetElement, { parent: editorDialog })
  
  function renderEditForm() {
    const tagTypes = ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'big', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'small', 'source', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'svg', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr']
    // tagSelector.value = event.target.nodeName.toLowerCase()

    const fieldDefs = [
      // { attr: 'parent', label: 'Parent Element ID:', dom: { tag: 'input' }, setValue(fieldElem) { fieldElem.value = _targetElement.parentNode.id }, getValue(fieldElem) { return fieldElem.value } },
      // { attr: 'siblingIndex', label: 'Sibling Index:', dom: { tag: 'input', type: 'number' }, setValue(fieldElem) { fieldElem.value = getDomSiblingIndex(_targetElement) }, getValue(fieldElem) { return fieldElem.value } },
      { attr: 'tag', label: 'Tag Type:', dom: { tag: 'select', style: 'width: 100px;' }, setValue(fieldElem) { fieldElem.value = _targetElement.nodeName.toLowerCase() }, getValue(fieldElem) { return fieldElem.value } },
      { attr: 'id', label: 'Element ID:', dom: { tag: 'input' }, setValue(fieldElem) { fieldElem.value = _targetElement.id }, getValue(fieldElem) { return fieldElem.value } },
      { attr: 'text', label: 'Text Content:', dom: { tag: 'input' }, setValue(fieldElem) { fieldElem.value = getTextNodeContent(_targetElement) }, getValue(fieldElem) { return handleEmpty(fieldElem.value) } },
      { attr: 'href', label: 'Hyperlink:', dom: { tag: 'input' }, setValue(fieldElem) { fieldElem.value = _targetElement.href || '' }, getValue(fieldElem) { return handleEmpty(fieldElem.value) } },
      { attr: 'src', label: 'File/Img Path:', dom: { tag: 'input' }, setValue(fieldElem) { fieldElem.value = _targetElement.src || '' }, getValue(fieldElem) { return handleEmpty(fieldElem.value) } },
      { attr: 'class', label: 'CSS Classes:', dom: { tag: 'input' }, setValue(fieldElem) { fieldElem.value = _targetElement.className }, getValue(fieldElem) { return handleEmpty(fieldElem.value) } },
      { attr: 'style', label: 'CSS Styles:', dom: { tag: 'textarea', wrap: 'off', rows: '7', style: 'width: 100%; padding: 5px; font-size: 0.7em;' }, setValue(fieldElem) { fieldElem.value = displayElementStyle(_targetElement) }, getValue: (fieldElem) => { _targetMetadata.verbatimStyle = parseStyleString(fieldElem.value); return handleEmpty(fieldElem.value.replace(/;\n/g, '; ')) } },
      { attr: 'html', label: 'Inner HTML:', dom: { tag: 'textarea', wrap: 'off', rows: '11', style: 'width: 100%; padding: 5px; font-size: 0.7em;' }, setValue(fieldElem) { fieldElem.value = formatHtml(getHtmlContent(_targetElement)) }, getValue(fieldElem) { return handleEmpty(fieldElem.value) } },
    ]
    
    const fieldRefs = []
  
    function updateTargetElement() {
      const domAttrs = { uid: _targetUid || getNewUid() }
      fieldRefs.forEach((field) => {
        const fieldValue = field.value()
        if (fieldValue === STR.nullInput) {
          domAttrs[field.attr] = '' // TODO: need to properly handle nulling in newElement() / updateElement()
        } else if (fieldValue) {
          domAttrs[field.attr] = fieldValue
        }
      })
  
      const newTargetElem = updateElement(_targetElement, domAttrs)
      renderEditor(newTargetElem)
    }
  
    fieldDefs.forEach((field) => {
      const labelElem = newElement({ tag: 'h6', parent: editorDialog, text: field.label, style: 'color: white; margin-top: .3em;' })
      const fieldElem = newElement({ parent: editorDialog, ...field.dom })
      fieldElem.style.width = '100%'
      
      if (field.attr === 'tag') {
        tagTypes.forEach((tagName) => {
          newElement({ tag: 'option', parent: fieldElem, value: tagName, text: `<${tagName}>`})
        })
      }
      
      field.setValue(fieldElem)
  
      fieldRefs.push({ fieldElem: fieldElem, attr: field.attr, value() { return field.getValue(fieldElem) } })
      
      fieldElem.addEventListener('change', updateTargetElement)
    })
  }

  function renderCssGui() {

    const parseCssValue = (cssString) => {
      const numericValue = parseFloat(cssString)
      return Number.isFinite(numericValue) ? numericValue : 0
    }

    const parseCssUnit = (cssString) => {
      if (!cssString) return 'px'
      // simply strips numeric chars and '-' and '.'; no unit validation
      const parsedUnit = cssString.replace(/[0-9 \-\.]/g, '')
      return parsedUnit || 'px'
    }

    const cssInputFields = [
      // TODO: add default units per property
      { propName: 'color', label: 'Text Color', dom: { tag: 'input', type: 'color' } },
      { propName: 'backgroundColor', label: 'Background Color', dom: { tag: 'input', type: 'color' } },
      { propName: 'fontSize', label: 'Font Size', dom: { tag: 'input', type: 'range' } },
      { propName: 'minWidth', label: 'Min Width', dom: { tag: 'input', type: 'range' } },
      { propName: 'minHeight', label: 'Min Height', dom: { tag: 'input', type: 'range' } },
      { propName: 'borderRadius', label: 'Border Radius', dom: { tag: 'input', type: 'range' } },
      { propName: 'display', label: 'Display Type', dom: { tag: 'select' }, default: 'flex', choices: ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'flow-root', 'none', 'contents', 'block flex', 'block flow', 'block flow-root', 'block grid', 'inline flex', 'inline flow', 'inline flow-root', 'inline grid', 'table', 'table-row', 'list-item'] },
      { propName: 'flex-direction', label: 'Flex Direction', dom: { tag: 'select' }, default: 'row', choices: ['row', 'row-reverse', 'column', 'column-reverse'] },
    ]

    cssInputFields.forEach((field) => {
      const labelRow = newElement({ parent: editorDialog, style: 'width: 100%; margin-top: .5em; display: flex; justify-content: space-between; align-items: center; flex-wrap: nowrap;' })
      const labelAndUnit = newElement({ parent: labelRow, style: 'display: flex; justify-content: space-between; align-items: center; flex-wrap: nowrap;' })
      const labelElem = newElement({ tag: 'h6', parent: labelAndUnit, text: field.label, style: 'color: white;' })
      const fieldRow = newElement({ parent: editorDialog, style: 'width: 100%; margin-top: .3em; display: flex; align-items: center; flex-wrap: nowrap;' })
      const fieldElem = newElement({ parent: fieldRow, style: 'flex-grow: 1;', ...field.dom })

      if (_targetMetadata.verbatimStyle[field.propName]) {
        const deleteStyleButton = newSvgElement('./assets/svg/close.svg', { parent: labelRow, style: 'border-radius: 5px; background-color: red; padding: 3px; height: 30px; width: 30px; fill: white; cursor: pointer;' })
        
        deleteStyleButton.addEventListener('mouseup', () => {
          delete _targetMetadata.verbatimStyle[field.propName]
          const newTargetElem = updateElement(_targetElement, {
            style: styleObjectToString(_targetMetadata.verbatimStyle),
          })
          renderEditor(newTargetElem)
        })
      }

      const getVerbatim = () => _targetMetadata.verbatimStyle[field.propName]
      const getVerbatimNum = () => parseCssValue(_targetMetadata.verbatimStyle[field.propName])
      const getVerbatimUnit = () => parseCssUnit(_targetMetadata.verbatimStyle[field.propName])

      function updateTargetElementCss(rerender = false) {
        // update the global state from the 'newValue' property on the loop variable (obj)
        // when undefined, set 'newValue' directly from the input element value (see universal 'change' event below)
        _targetMetadata.verbatimStyle[field.propName] = field.newValue

        const newTargetElem = updateElement(_targetElement, {
          style: styleObjectToString(_targetMetadata.verbatimStyle),
        })
        if (rerender) {
          renderEditor(newTargetElem)
        }
      }

      if (field.dom.tag === 'select') {
        const globalCssProps = ['inherit', 'initial', 'revert', 'revert-layer', 'unset']
        const allChoices = [...field.choices, ...globalCssProps]
        allChoices.forEach((choiceName) => {
          newElement({ tag: 'option', parent: fieldElem, value: choiceName, text: choiceName })
        })
        fieldElem.value = allChoices.includes(getVerbatim()) ? getVerbatim() : ''
      } else if (field.dom.type === 'range') {
        // handle slider-type input
        fieldElem.addEventListener('input', () => {
          field.newValue = `${parseCssValue(fieldElem.value)}${getVerbatimUnit()}`
          updateTargetElementCss()

          // show tooltip
          updateElement(infoTooltip, { text: getVerbatim() || 0 })
          moveToMousePos(infoTooltip, MOUSE_STATE.pos, { offset: pos2d(0, -33) })
          toggleVisible(infoTooltip, true)
        })

        // hide tooltip
        fieldElem.addEventListener('mouseup', (event) => {
          toggleVisible(infoTooltip, false)          
        })

        const numInputBox = newElement({ tag: 'input', parent: labelAndUnit, siblingIndex: 1, value: getVerbatimNum(), style: 'margin-left: 10px; width: 77px; height: 0.7em font-size: 0.6em; text-align: center; border-radius: 5px;' })
        numInputBox.addEventListener('change', () => {
          field.newValue = `${parseCssValue(numInputBox.value)}${getVerbatimUnit()}`
          updateTargetElementCss(rerender = true)
        })

        const unitInputBox = newElement({ tag: 'input', parent: labelAndUnit, siblingIndex: 2, value: getVerbatimUnit(), style: 'margin-left: 10px; width: 77px; height: 0.7em font-size: 0.6em; text-align: center; border-radius: 5px;' })
        unitInputBox.addEventListener('change', () => {
          const escapedUnit = getVerbatimUnit().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const replaceUnitExp = new RegExp(`${escapedUnit}$`)
          const currentVerbatim = getVerbatim() || '0px'
          field.newValue = currentVerbatim.replace(replaceUnitExp, unitInputBox.value)
          updateTargetElementCss(rerender = true)
        })

        const settingsByUnit = {
          default: { step: 0.01, range: 100 },
          px: { step: 1, range: 500 },
          em: { step: 0.01, range: 10 },
          '%': { step: 0.01, range: 100 },
        }

        const unitSettings = settingsByUnit[getVerbatimUnit()] || settingsByUnit.default

        fieldElem.min = getVerbatimNum() - unitSettings.range
        fieldElem.max = getVerbatimNum() + unitSettings.range
        fieldElem.step = unitSettings.step
        fieldElem.value = getVerbatimNum()
        const minLabelnewElement = newElement({ parent: fieldRow, text: `${Number(fieldElem.min).toFixed(2)}${getVerbatimUnit()}`, siblingIndex: 0, style: 'color: white; font-size: 0.7em; margin-inline: 5px;' })
        const maxLabelnewElement = newElement({ parent: fieldRow, text: `${Number(fieldElem.max).toFixed(2)}${getVerbatimUnit()}`, siblingIndex: 2, style: 'color: white; font-size: 0.7em; margin-inline: 5px;' })
      } else {
        // generic case: for CSS properties set directly with the input field value
        fieldElem.value = getVerbatim()
      }

      // universally added 'change' event that updates the form (terminates user input because of re-render)
      fieldElem.addEventListener('change', () => {
        if (field.newValue === undefined) {
          field.newValue = fieldElem.value // generic case (direct input)
        }
        updateTargetElementCss(rerender = true)
      })
    })
  }

  renderCssGui()
  renderEditForm()
}

function getPosFromMouseEvent(posOrEvent) {
  let x = posOrEvent && posOrEvent.x ? posOrEvent.x : null
  let y = posOrEvent && posOrEvent.y ? posOrEvent.y : null
  x = x ? x : posOrEvent.clientX
  y = y ? y : posOrEvent.clientY
  return pos2d(Number(x), Number(y))
}

function adjustForViewBottom(element, mouseEvent) {
  const pos = getPosFromMouseEvent(mouseEvent)
  const rect = element.getBoundingClientRect()
  if (pos.y + rect.height > window.innerHeight) {
    pos.y -= rect.height
  }
  return pos
}

function moveToMousePos(element, mouseEvent, { keepInView = true, offset = pos2d(0, 0) } = {}) {
  let pos = getPosFromMouseEvent(mouseEvent)
  pos = addPos(pos, offset)
  
  const rect = element.getBoundingClientRect()
  if (keepInView && pos.y + rect.height > window.innerHeight) {
    pos.y -= rect.height
  }
  element.style.left = `${pos.x}px`
  element.style.top = `${pos.y}px`
}

function changeSiblingIndex(element, offset) {
    const siblingIndex = getDomSiblingIndex(element) || 0
    updateElement(element, { siblingIndex: siblingIndex + offset })
}

function moveInsideSibling(element, offset = 1) {
    const totalSiblings = element.parentNode.children.length
    const siblingIndex = getDomSiblingIndex(element) || 0
    const nextSiblingIndex = siblingIndex + offset < totalSiblings ? siblingIndex + offset : 0
    const nextSibling = element.parentNode.children[nextSiblingIndex]
    if (siblingIndex !== nextSiblingIndex && element !== nextSibling)
    nextSibling.prepend(element)
  }

function duplicateElement(element) {
  const uid = getNewUid() // persistent unique ID
  const siblingIndex = getDomSiblingIndex(element)
  
  let newElem = element.cloneNode(true)
  newElem = updateElement(newElem, {
    id: `${element.id}-copy`,
    uid: String(uid),
    parent: element.parentNode,
    siblingIndex: siblingIndex + 1,
  })

  bulkReassignUids(newElem)
}

function addNewDefaultElement(customAttrs = {}) {
  const uid = getNewUid() // persistent unique ID
  const attrs = {
    tag: 'div',
    parent: STR.pageBuildArea,
    uid: uid,
    id: uid,
    text: STR.newElementText,
  }

  updateObjProps(attrs, customAttrs)

  const defaultStyle = {
    fontSize: '0.8em',
    minHeight: '33px',
    minWidth: '117px',
    backgroundColor: 'transparent',
    display: 'flex',
    flexFlow: 'column nowrap',
    justifyContent: 'center',
    alignItems: 'center',
  }

  // set the style via the 'verbatimStyle' metadata, to prevent computed styles like "webkit-____" from being added
  addElementMetadata(uid)
  // ELEMENTS[uid].verbatimStyle = styleObjectToString(defaultStyle).replace(/; /g, ';\n')
  ELEMENTS[uid].verbatimStyle = defaultStyle

  if (attrs.parent.nodeName === 'HTML') {
    parent = STR.pageBuildArea
  }
  const newEl = newElement(attrs)

  newEl.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    renderContextMenu(e)
  })

  return newEl
}

const pageBuildArea = addNewDefaultElement({
  uid: STR.pageBuildArea,
  id: STR.pageBuildArea,
  parent: document.body,
  text: '',
  style: {
    fontSize: '1em',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: 'transparent',
    display: 'flex',
    flexFlow: 'column nowrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
})

function savePage() {
  try {
    manageUidsAndMetadata()
    const pageBuildArea = getElement(STR.pageBuildArea)
    if (pageBuildArea) {
      localStorage.setItem('ELEMENTS', JSON.stringify(ELEMENTS))
      localStorage.setItem('userContent', pageBuildArea.innerHTML)
    }
  } catch (error) {
    console.warn('Error saving user content:\n', error)
  }
}

function loadPage() {
  addCssHoverStyles()

  try {
    const userContent = localStorage.getItem('userContent')
    if (userContent) {
      const pageBuildArea = getElement(STR.pageBuildArea)
      pageBuildArea.innerHTML = userContent
    }
    const elementList = localStorage.getItem('ELEMENTS')
    if (elementList) {
      ELEMENTS = JSON.parse(elementList)
    }
    manageUidsAndMetadata()
  } catch (error) {
    console.warn('Error loading user content:\n', error)
  }
}

loadPage()
setInterval(() => {
  savePage()
}, 5000);

const toolbar = newElement({
  id: STR.pageBuildToolbar,
  style: { position: 'absolute', top: '0', left: '0', width: '100%' },
})

const resetBuildArea = newElement({
  id: STR.pageBuildToolbar,
  tag: 'button',
  style: { position: 'absolute', top: '0', left: '0', width: '100%' },
  text: 'Reset'
})

resetBuildArea.addEventListener('click', () => {
  getElement(STR.pageBuildArea).textContent = ''
})

var MOUSE_STATE = {
  pos: pos2d(0, 0)
}

document.addEventListener('mousemove', (mouseEvent) => {
  MOUSE_STATE.pos = pos2d(mouseEvent.clientX, mouseEvent.clientY)
})