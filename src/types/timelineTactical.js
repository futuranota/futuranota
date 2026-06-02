/**
 * Tactical timeline (panel inferior) — types for Bloque A logic layer.
 * @module timelineTactical
 */

/** @typedef {'free' | 'queue' | 'inherit-obj'} CanvasMode */

/** @typedef {'family' | 'doc' | 'children'} TimelineFocusLevel */

/**
 * @typedef {Object} TimelineFocus
 * @property {TimelineFocusLevel} level
 * @property {string} [objectId]
 * @property {string} [docId]
 * @property {string} [canvasNodeId]
 */

/**
 * @typedef {'intra-doc' | 'intra-family-doc' | 'intra-family-child' | 'cross-family-doc' | 'cross-family-date' | 'cross-family-other' | 'type-mismatch' | 'ignored-for-timeline'} ConnectionKind
 */

/**
 * @typedef {'document' | 'date' | 'metric' | 'text' | 'other'} TimelineWireType
 */

/**
 * @typedef {Object} ClassifiedConnection
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {ConnectionKind} kind
 * @property {TimelineWireType} [wireType]
 * @property {string|null} [fromObjectId]
 * @property {string|null} [toObjectId]
 * @property {string|null} [fromDocId]
 * @property {string|null} [toDocId]
 */

/**
 * @typedef {Object} TacticalWireAnchorResult
 * @property {Map<string, Date>} anchors
 * @property {ClassifiedConnection[]} classifiedConnections
 * @property {Set<string>} crossFamilyDocPairKeys
 */

export {};
