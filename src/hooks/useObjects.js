import { useObjectsStore } from "../stores/index.js";

export function useObjects() {
  const objects = useObjectsStore((state) => state.objects);
  const getObject = useObjectsStore((state) => state.getObject);
  const getAllObjects = useObjectsStore((state) => state.getAllObjects);
  const addObject = useObjectsStore((state) => state.addObject);
  const createObject = useObjectsStore((state) => state.createObject);
  const updateObject = useObjectsStore((state) => state.updateObject);
  const deleteObject = useObjectsStore((state) => state.deleteObject);
  const addChildDoc = useObjectsStore((state) => state.addChildDoc);
  const removeChildDoc = useObjectsStore((state) => state.removeChildDoc);

  return {
    objects,
    getObject,
    getAllObjects,
    addObject,
    createObject,
    updateObject,
    deleteObject,
    addChildDoc,
    removeChildDoc,
  };
}
