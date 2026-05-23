export function CanvasConnection({ connection, fromNode, toNode }) {
  if (!fromNode || !toNode) return null;

  const x1 = fromNode.x + 100;
  const y1 = fromNode.y + 24;
  const x2 = toNode.x;
  const y2 = toNode.y + 24;

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="var(--cool)"
      strokeWidth="2"
      opacity="0.85"
    />
  );
}
