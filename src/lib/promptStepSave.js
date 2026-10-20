export function savedPromptCount(steps, hasWork) {
  return (steps || []).filter((item) => item.promptSaved && hasWork(item)).length;
}

export function stepsMarkedAfterSave(steps, hasWork) {
  return (steps || []).map((item) => {
    const work = Boolean(hasWork(item));
    if (Boolean(item.promptSaved) === work) return item;
    return { ...item, promptSaved: work };
  });
}
