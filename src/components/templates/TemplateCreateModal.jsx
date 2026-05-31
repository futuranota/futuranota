import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isoFromDateInput, todayDateInputValue } from "../../lib/docDates.js";
import { createDocBlock, DOC_BLOCK_TYPES, docBlocksToBody } from "../../lib/docBlocks.js";
import { TEMPLATE_KIND_CAMPAIGN } from "../../lib/templateDoc.js";
import { DocDocumentBox } from "../docs/DocDocumentBox.jsx";
import { useDocBlockNodeModal } from "../docs/useDocBlockNodeModal.jsx";

function TemplateCreateModal({ objects, allDocs, defaultParentId, onSubmit, onCancel }) {
  const [title, setTitle] = useState("Campaign analysis");
  const [blocks, setBlocks] = useState(() => [
    createDocBlock(DOC_BLOCK_TYPES.H1, { title: "Datos extraídos" }),
  ]);
  const fallbackParent = defaultParentId || "";
  const [parentId, setParentId] = useState(fallbackParent);
  const [createdDate, setCreatedDate] = useState(todayDateInputValue);
  const [templateSubcategoryDocIds, setTemplateSubcategoryDocIds] = useState([]);
  const [nodeLinkColor, setNodeLinkColor] = useState("dark");
  const titleRef = useRef(null);

  useEffect(() => {
    setParentId(fallbackParent);
  }, [fallbackParent]);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const parentObject = objects.find((o) => o.id === parentId);

  const {
    onOpenNodeForBlock,
    onBlockAnchorChange,
    onAnswerBelowH1Change,
    nodeModal,
  } = useDocBlockNodeModal({
    blocks,
    setBlocks,
    createdDate,
    docId: null,
    docTitle: title,
    nodeLinkColor,
  });

  const submitTemplate = () => {
    if (!parentId) return;
    const finalTitle = title.trim() || "Campaign analysis";
    const autoTags = parentObject?.name ? [parentObject.name, "template"] : ["template"];
    onSubmit({
      title: finalTitle,
      parentObjectId: parentId,
      tags: autoTags,
      body: docBlocksToBody(blocks),
      blocks,
      createdAt: isoFromDateInput(createdDate),
      docKind: "template",
      templateKind: TEMPLATE_KIND_CAMPAIGN,
      templateSubcategoryDocIds,
      nodeLinkColor,
    });
  };

  return (
    <div className="lp-overlay lp-overlay--solid lp-overlay--center">
      <div className="lp-modal doc-new-modal" onClick={(e) => e.stopPropagation()}>
        <DocDocumentBox
          headerLabel={parentObject?.name || ""}
          title={title}
          onTitleChange={setTitle}
          titleRef={titleRef}
          titlePlaceholder="Campaign analysis"
          body=""
          onBodyChange={() => {}}
          blocks={blocks}
          onBlocksChange={setBlocks}
          createdDate={createdDate}
          onCreatedDateChange={setCreatedDate}
          parentId={parentId}
          onParentIdChange={setParentId}
          objects={objects}
          docKind="template"
          templateKind={TEMPLATE_KIND_CAMPAIGN}
          templateSubcategoryDocIds={templateSubcategoryDocIds}
          onTemplateSubcategoryDocIdsChange={setTemplateSubcategoryDocIds}
          allDocs={allDocs}
          nodeLinkColor={nodeLinkColor}
          onNodeLinkColorChange={setNodeLinkColor}
          onDelete={onCancel}
          onSave={submitTemplate}
          saveDisabled={!parentId}
          onCloseExpand={onCancel}
          onOpenNodeForBlock={onOpenNodeForBlock}
          onAnswerBelowH1Change={onAnswerBelowH1Change}
          onBlockAnchorChange={onBlockAnchorChange}
          onTitleKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
        />
        {nodeModal}
      </div>
    </div>
  );
}

export function TemplateCreateModalPortal(props) {
  if (typeof document === "undefined") return null;
  return createPortal(<TemplateCreateModal {...props} />, document.body);
}
