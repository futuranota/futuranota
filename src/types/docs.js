/**
 * @typedef {Object} DataProperty
 * @property {string} id
 * @property {string} name
 * @property {'text'|'date'|'checkbox'|'select'|'number'} type
 * @property {string} [value]
 */

/**
 * @typedef {Object} Doc
 * @property {string} id
 * @property {string} title
 * @property {string|null} parentObjectId
 * @property {string} content
 * @property {string} [body]
 * @property {DataProperty[]} dataProperties
 * @property {string[]} [nodeIds]
 * @property {boolean} syncedWithCanvas
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export {};
