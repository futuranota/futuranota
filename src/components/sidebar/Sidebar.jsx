import { ObjectsFolder } from "../folders/ObjectsFolder.jsx";
import { DocsFolder } from "../folders/DocsFolder.jsx";
import { NodesFolder } from "../folders/NodesFolder.jsx";

/** Sidebar — 3 folders (Parte 3) */
export function Sidebar() {
  return (
    <div className="sidebar-folders">
      <ObjectsFolder />
      <DocsFolder />
      <NodesFolder />
    </div>
  );
}
