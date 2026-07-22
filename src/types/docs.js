/**
 * @typedef {Object} DataProperty
 * @property {string} id
 * @property {string} name
 * @property {'text'|'date'|'checkbox'|'select'|'number'} type
 * @property {string} [value]
 */

/**
 * @typedef {'text'|'h1'|'todo'|'step_sequence'|string} DocBlockType
 */

/**
 * @typedef {Object} TodoItem
 * @property {string} id
 * @property {string} text
 * @property {boolean} checked
 */

/**
 * Snapshot of a URL-table tag mention inserted into a text block.
 * Visible text stays plain `@tag`; hover uses frozen name + description.
 * @typedef {Object} DocMention
 * @property {string} id
 * @property {string|null} sourceEntryId
 * @property {string} tag
 * @property {string} [name]
 * @property {string} description
 * @property {number} start
 * @property {number} end
 * @property {string} insertedAt
 */

/**
 * Highlighter stroke over a slice of a text block (plumón ink).
 * @typedef {Object} DocMarkerRange
 * @property {number} start
 * @property {number} end
 * @property {string} colorId — id from DOC_TEXT_MARKER_COLORS
 */

/**
 * @typedef {Object} DocBlock
 * @property {string} id
 * @property {DocBlockType} type
 * @property {string} [title]
 * @property {string} [nodeId]
 * @property {string} [sourceQuery]
 * @property {string} [text]
 * @property {DocMention[]} [mentions]
 * @property {DocMarkerRange[]} [markerRanges]
 * @property {{ start: number, end: number }[]} [boldRanges]
 * @property {string} [listTitle]
 * @property {TodoItem[]} [items]
 * @property {boolean} [showIntroAnim]
 */

/**
 * @typedef {Object} Doc
 * @property {string} id
 * @property {string} title
 * @property {string|null} parentObjectId
 * @property {string} content
 * @property {string} [body]
 * @property {DocBlock[]} [blocks]
 * @property {DataProperty[]} dataProperties
 * @property {string[]} [nodeIds]
 * @property {boolean} syncedWithCanvas
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} [version]
 * @property {string} [category]
 * @property {string} [icon] — custom folder icon (URL or WebP data URL); empty = default boxes
 * @property {string|null} [launchAt]
 * @property {string|null} [scheduleStartAt] — folder reservation start (timeline anchor)
 * @property {string|null} [scheduleFinishAt] — folder reservation end (inclusive)
 * @property {boolean} [campaignActive]
 * @property {string|null} [timelineSourceNodeId] — active campaign doc driving folder timeline date
 * @property {import('../lib/launchRadarSnapshot.js').LaunchRadarSnapshot} [launchRadarSnapshot]
 * @property {{ kind?: string, animateOnOpen?: boolean, animatedAt?: string|null }} [reportPresentation]
 */

export {};
