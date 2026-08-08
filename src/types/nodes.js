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
 * @property {string|null} [anchorAt] — optional schedule start ISO for text/checkbox (wires + canvas)
 * @property {string|null} [anchorFinishAt] — optional schedule finish ISO for text/checkbox timeframe
 * @property {'not_started'|'reserved'|'flexible'|'in_progress'|'submitted'|'past_due'|'completed'|null} [status] — folder-doc work status
 * @property {boolean} [completed] — derived: true iff status === 'completed' (timeline / folder pie)
 * @property {string|null} [sourceId] — Source catalog id (uploads/source icons)
 */

export {};
