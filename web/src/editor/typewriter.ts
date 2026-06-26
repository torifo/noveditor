/**
 * Typewriter scrolling: keep the caret's line vertically centered in a <textarea>.
 *
 * The caret's pixel offset is measured with a mirror <div> that copies the textarea's box +
 * font metrics, mirrors the text up to the caret, and reads the offset of a marker span. This is
 * accurate even with soft-wrapped lines (line-height × line-index would not be).
 */

// Style properties that affect text layout and therefore caret position.
const MIRROR_PROPS = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordSpacing',
  'tabSize',
] as const

/** Pixel offset of the caret's top edge from the top of the textarea's content. */
function measureCaretTop(textarea: HTMLTextAreaElement): number {
  const doc = textarea.ownerDocument
  const style = doc.defaultView!.getComputedStyle(textarea)

  const mirror = doc.createElement('div')
  const ms = mirror.style
  ms.position = 'absolute'
  ms.visibility = 'hidden'
  ms.whiteSpace = 'pre-wrap'
  ms.wordWrap = 'break-word'
  ms.overflow = 'hidden'
  ms.top = '0'
  ms.left = '-9999px'
  for (const prop of MIRROR_PROPS) {
    // Copy each computed layout property onto the mirror.
    ms[prop as never] = style[prop as never]
  }

  const caretIndex = textarea.selectionStart
  mirror.textContent = textarea.value.slice(0, caretIndex)
  const marker = doc.createElement('span')
  // A non-empty marker so it has a layout box even at the very end / on an empty line.
  marker.textContent = textarea.value.slice(caretIndex) || '.'
  mirror.appendChild(marker)

  doc.body.appendChild(mirror)
  const top = marker.offsetTop
  doc.body.removeChild(mirror)
  return top
}

/**
 * Scroll `textarea` so the caret line sits at the vertical center. Does nothing if measurement
 * fails. Honors reduced-motion (jumps instead of smooth-scrolling).
 */
export function centerCaret(textarea: HTMLTextAreaElement, reducedMotion: boolean): void {
  let caretTop: number
  try {
    caretTop = measureCaretTop(textarea)
  } catch {
    return
  }
  const style = getComputedStyle(textarea)
  const lineHeight = parseFloat(style.lineHeight) || textarea.clientHeight / 2
  const target = caretTop - textarea.clientHeight / 2 + lineHeight / 2
  const max = textarea.scrollHeight - textarea.clientHeight
  const top = Math.max(0, Math.min(target, max))

  if (reducedMotion || typeof textarea.scrollTo !== 'function') {
    textarea.scrollTop = top
  } else {
    textarea.scrollTo({ top, behavior: 'smooth' })
  }
}
