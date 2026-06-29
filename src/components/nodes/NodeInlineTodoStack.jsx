import { createTodoItem } from "../../lib/docBlocks.js";
import { DocTodoPlanBlockView } from "../docs/blocks/DocTodoPlanBlockView.jsx";

export function NodeInlineTodoStack({
  todoBlocks,
  onTodoBlocksChange,
  focusTarget = null,
  onFocusTargetChange,
  className = "",
}) {
  const updateBlock = (index, patch) => {
    onTodoBlocksChange?.(
      todoBlocks.map((block, blockIndex) => (
        blockIndex === index ? { ...block, ...patch } : block
      )),
    );
  };

  const handleItemKeyDown = (blockIndex, itemIndex, e) => {
    const block = todoBlocks[blockIndex];
    if (!block) return;
    const items = block.items || [];
    const item = items[itemIndex];
    if (!item) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const newItem = createTodoItem({ text: "" });
      const nextItems = [
        ...items.slice(0, itemIndex + 1),
        newItem,
        ...items.slice(itemIndex + 1),
      ];
      updateBlock(blockIndex, { items: nextItems });
      onFocusTargetChange?.({ blockIndex, itemId: newItem.id });
    }
  };

  if (!todoBlocks.length) return null;

  return (
    <div className={`node-inline-todo-stack${className ? ` ${className}` : ""}`}>
      {todoBlocks.map((block, blockIndex) => (
        <div key={block.id} className="node-inline-todo-stack__block">
          <DocTodoPlanBlockView
            listTitle={block.listTitle}
            onListTitleChange={(listTitle) => updateBlock(blockIndex, { listTitle })}
            linksEnabled={false}
            showDragHandle={false}
            items={block.items}
            focusItemId={
              focusTarget?.blockIndex === blockIndex ? focusTarget.itemId : null
            }
            onItemsChange={(items) => updateBlock(blockIndex, { items })}
            onItemKeyDown={(itemIndex, e) => handleItemKeyDown(blockIndex, itemIndex, e)}
            onAddItem={() => {
              const newItem = createTodoItem({ text: "" });
              updateBlock(blockIndex, { items: [...block.items, newItem] });
              onFocusTargetChange?.({ blockIndex, itemId: newItem.id });
            }}
          />
        </div>
      ))}
    </div>
  );
}
