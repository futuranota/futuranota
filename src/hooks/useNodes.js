import { useNodesStore } from "../stores/index.js";

export function useNodes() {
  const nodes = useNodesStore((state) => state.nodes);
  const getNode = useNodesStore((state) => state.getNode);
  const getNodesByDoc = useNodesStore((state) => state.getNodesByDoc);
  const addNode = useNodesStore((state) => state.addNode);
  const addNodeFromDoc = useNodesStore((state) => state.addNodeFromDoc);
  const updateNode = useNodesStore((state) => state.updateNode);
  const setLinkedToCanvas = useNodesStore((state) => state.setLinkedToCanvas);
  const deleteNode = useNodesStore((state) => state.deleteNode);

  return {
    nodes,
    getNode,
    getNodesByDoc,
    addNode,
    addNodeFromDoc,
    updateNode,
    setLinkedToCanvas,
    deleteNode,
  };
}
