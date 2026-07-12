/**
 * @typedef {Object} Node
 * @property {string} id
 * @property {string} title
 * @property {'text'|'date'|'checkbox'|'metric'} dataType
 * @property {string|Date|boolean|{value:number,unit:string}} content
 * @property {string|null} parentDocId
 * @property {string[]} canvasConnections
 * @property {boolean} linkedToCanvas
 * @property {boolean} [linkedToDoc]
 * @property {string|null} [canvasNodeId]
 * @property {string} createdAt
 * @property {string} [updatedAt]
 * @property {string|null} [anchorAt] — optional schedule ISO for text/checkbox (wires + canvas)
 * @property {boolean} [completed] — user-marked schedule completion (overrides past-due on timeline)
 * @property {string|null} [sourceId] — Source catalog id (uploads/source icons)
 */

export {};
