/**
 * @typedef {Object} DataProperty
 * @property {string} id
 * @property {string} name
 * @property {'text'|'date'|'checkbox'|'select'|'number'} type
 * @property {string} [value]
 */

/**
 * @typedef {'text'|'h1'|'todo'} DocBlockType
 */

/**
 * @typedef {Object} TodoItem
 * @property {string} id
 * @property {string} text
 * @property {boolean} checked
 */

/**
 * @typedef {Object} DocBlock
 * @property {string} id
 * @property {DocBlockType} type
 * @property {string} [title]
 * @property {string} [nodeId]
 * @property {string} [sourceQuery]
 * @property {string} [text]
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
 * @property {string|null} [launchAt]
 * @property {boolean} [campaignActive]
 * @property {import('../lib/launchRadarSnapshot.js').LaunchRadarSnapshot} [launchRadarSnapshot]
 * @property {{ kind?: string, animateOnOpen?: boolean, animatedAt?: string|null }} [reportPresentation]
 */

export {};
