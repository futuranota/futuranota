import { useState } from "react";
import { useI18n } from "../../../i18n/useI18n.js";
import { LibraryFichaGrid } from "./LibraryFichaGrid.jsx";
import { LibraryWorkspaceTabs } from "./LibraryWorkspaceTabs.jsx";
import { LibraryWorkspaceScopeTabs } from "./LibraryWorkspaceScopeTabs.jsx";

/**
 * Workspace library body: Imágenes | Adjuntos tabs + ficha grid.
 * @param {Object} props
 * @param {Array<{ ownerKind: string, ownerId: string, item: object }>} props.imagePicks
 * @param {Array<{ ownerKind: string, ownerId: string, item: object }>} props.attachmentPicks
 * @param {(row: object) => void} props.onOpenPick
 * @param {(row: object) => void} [props.onEditPick]
 * @param {(row: object) => void} [props.onDeletePick]
 * @param {boolean} [props.showEditDelete]
 * @param {boolean} [props.workspaceHasContent] — true when unfiltered picks exist (search may empty tabs)
 * @param {"prompt-row"|"scope"} [props.tabBar] — scope = 2-button bar (toolbar workspace card)
 * @param {"visual"|"skill"} [props.initialTab]
 */
export function LibraryWorkspaceView({
  imagePicks = [],
  attachmentPicks = [],
  onOpenPick,
  onEditPick,
  onDeletePick,
  showEditDelete = false,
  workspaceHasContent,
  tabBar = "prompt-row",
  initialTab = "visual",
}) {
  const { t } = useI18n();
  const [filterTab, setFilterTab] = useState(initialTab);

  const hasContent = workspaceHasContent ?? (imagePicks.length > 0 || attachmentPicks.length > 0);
  const Tabs = tabBar === "scope" ? LibraryWorkspaceScopeTabs : LibraryWorkspaceTabs;

  if (!hasContent) {
    return (
      <>
        <Tabs filterTab={filterTab} onFilterTab={setFilterTab} />
        <div className="folder-library-overlay__empty">
          <p>{t("doc.library.emptyWorkspace")}</p>
        </div>
      </>
    );
  }

  const activePicks = filterTab === "visual" ? imagePicks : attachmentPicks;
  const emptyMessage = filterTab === "visual"
    ? t("doc.library.emptyWorkspaceImages")
    : t("doc.library.emptyWorkspaceAttachments");

  return (
    <>
      <Tabs filterTab={filterTab} onFilterTab={setFilterTab} />
      <LibraryFichaGrid
        picks={activePicks}
        faceTab={filterTab}
        onOpenItem={onOpenPick}
        onEditItem={onEditPick}
        onDeleteItem={onDeletePick}
        showEditDelete={showEditDelete}
        emptyMessage={emptyMessage}
      />
    </>
  );
}
