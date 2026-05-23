import { useDocsStore } from "../stores/index.js";

export function useDocs() {
  const docs = useDocsStore((state) => state.docs);
  const getDoc = useDocsStore((state) => state.getDoc);
  const getDocsByObject = useDocsStore((state) => state.getDocsByObject);
  const addDoc = useDocsStore((state) => state.addDoc);
  const updateDocTitle = useDocsStore((state) => state.updateDocTitle);
  const updateDocContent = useDocsStore((state) => state.updateDocContent);
  const updateDocBody = useDocsStore((state) => state.updateDocBody);
  const addDataProperty = useDocsStore((state) => state.addDataProperty);
  const updateDataProperty = useDocsStore((state) => state.updateDataProperty);
  const setSyncedWithCanvas = useDocsStore((state) => state.setSyncedWithCanvas);
  const deleteDoc = useDocsStore((state) => state.deleteDoc);

  return {
    docs,
    getDoc,
    getDocsByObject,
    addDoc,
    updateDocTitle,
    updateDocContent,
    updateDocBody,
    addDataProperty,
    updateDataProperty,
    setSyncedWithCanvas,
    deleteDoc,
  };
}
