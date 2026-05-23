/**
 * @typedef {Object} TimelineEntry
 * @property {string} id
 * @property {string} itemId
 * @property {'object'|'doc'|'node'} itemType
 * @property {string} date
 * @property {number|null} [duration]
 */

/**
 * @typedef {Object} Timeline
 * @property {string} id
 * @property {string} name
 * @property {'objects'|'docs'|'nodes'} tier
 * @property {TimelineEntry[]} entries
 * @property {string} createdAt
 */

export {};
