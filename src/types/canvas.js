/**
 * @typedef {Object} CanvasNode
 * @property {string} id
 * @property {string} [nodeId]
 * @property {string} title
 * @property {string} dataType
 * @property {*} [content]
 * @property {number} x
 * @property {number} y
 * @property {boolean} hidden
 * @property {boolean} selected
 */

/**
 * @typedef {Object} CanvasConnection
 * @property {string} id
 * @property {string} fromCanvasNodeId
 * @property {string} toCanvasNodeId
 * @property {string} [from]
 * @property {string} [to]
 */

/**
 * @typedef {Object} Grouping
 * @property {string} id
 * @property {string} name
 * @property {string[]} canvasNodeIds
 * @property {string|null} parentDocId
 * @property {string} createdAt
 */

export {};
