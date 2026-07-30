import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useDepartmentsStore } from "../../stores/departmentsStore.js";
import { findDepartmentById, normalizeDescription } from "../../lib/departments.js";

const DEPT_BG_SRC = "/uploads/department-img.png";

/**
 * @typedef {{ label: string, description: string, originLabel: string|null }} DraftTag
 */

/**
 * Floating department table.
 * Create: name + optional description → Save → categories unlock.
 * Tags phase: name/description recorded (soft meta); Edit steps back to change them.
 * Tags: category chips with optional description.
 */
export function DepartmentsDashboardOverlay({ session, onSessionChange, onClose }) {
  const { t } = useI18n();
  const departments = useDepartmentsStore((s) => s.departments);
  const createDepartment = useDepartmentsStore((s) => s.createDepartment);
  const updateDepartment = useDepartmentsStore((s) => s.updateDepartment);
  const updateSubcategory = useDepartmentsStore((s) => s.updateSubcategory);
  const deleteDepartment = useDepartmentsStore((s) => s.deleteDepartment);

  const isCreate = session?.mode === "create";
  const existing = useMemo(
    () => (isCreate ? null : findDepartmentById(departments, session?.departmentId)),
    [departments, isCreate, session?.departmentId],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  /** Step back to edit recorded department name + description */
  const [editingDeptMeta, setEditingDeptMeta] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagDescriptionDraft, setTagDescriptionDraft] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  /** @type {[DraftTag[], Function]} */
  const [draftTags, setDraftTags] = useState([]);
  /** @type {[string|null, Function]} draft key (= originLabel || label) being edited */
  const [editingKey, setEditingKey] = useState(null);
  const [editLabelDraft, setEditLabelDraft] = useState("");
  const [editDescriptionDraft, setEditDescriptionDraft] = useState("");

  useEffect(() => {
    if (!session) return;
    if (session.mode === "create") {
      setName("");
      setDescription("");
      setEditingDeptMeta(false);
      setTagDraft("");
      setTagDescriptionDraft("");
      setAddingCategory(false);
      setDraftTags([]);
      setEditingKey(null);
      return;
    }
    const dept = findDepartmentById(
      useDepartmentsStore.getState().departments,
      session.departmentId,
    );
    setName(dept?.category || "");
    setDescription(dept?.description || "");
    setEditingDeptMeta(false);
    setTagDraft("");
    setTagDescriptionDraft("");
    setAddingCategory(false);
    setDraftTags(
      Array.isArray(dept?.subcategories)
        ? dept.subcategories.map((s) => ({
            label: s.label,
            description: s.description || "",
            originLabel: s.label,
          }))
        : [],
    );
    setEditingKey(null);
  }, [session]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (addingCategory) {
        setTagDraft("");
        setTagDescriptionDraft("");
        setAddingCategory(false);
        return;
      }
      if (editingDeptMeta) {
        const dept = findDepartmentById(
          useDepartmentsStore.getState().departments,
          session?.departmentId,
        );
        setName(dept?.category || "");
        setDescription(dept?.description || "");
        setEditingDeptMeta(false);
        return;
      }
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, addingCategory, editingDeptMeta, session?.departmentId]);

  if (!session) return null;
  if (!isCreate && !existing) return null;

  const tagsPhase = !isCreate && !editingDeptMeta;
  const tagsEnabled = tagsPhase;
  const recordedName = existing?.category || name;

  const draftKeyOf = (tag) => tag.originLabel || tag.label;

  const beginEditDeptMeta = () => {
    if (!existing) return;
    setAddingCategory(false);
    setName(existing.category || "");
    setDescription(existing.description || "");
    setEditingKey(null);
    setEditingDeptMeta(true);
  };

  const cancelEditDeptMeta = () => {
    if (!existing) {
      setEditingDeptMeta(false);
      return;
    }
    setName(existing.category || "");
    setDescription(existing.description || "");
    setEditingDeptMeta(false);
  };

  const handleSaveDeptMeta = () => {
    if (!existing) return;
    const category = name.trim();
    if (!category) return;
    updateDepartment(existing.id, {
      category,
      description: normalizeDescription(description),
    });
    setEditingDeptMeta(false);
  };

  const addTag = () => {
    const label = tagDraft.trim().slice(0, 50);
    if (!label) return false;
    if (draftTags.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      return false;
    }
    const desc = normalizeDescription(tagDescriptionDraft);
    setDraftTags((prev) => [
      ...prev,
      { label, description: desc, originLabel: null },
    ]);
    setTagDraft("");
    setTagDescriptionDraft("");
    return true;
  };

  const beginAddCategory = () => {
    setEditingKey(null);
    setTagDraft("");
    setTagDescriptionDraft("");
    setAddingCategory(true);
  };

  const commitAddCategory = () => {
    if (!addTag()) return;
    setAddingCategory(false);
  };

  const removeTag = (tag) => {
    const key = draftKeyOf(tag).toLowerCase();
    setDraftTags((prev) =>
      prev.filter((item) => draftKeyOf(item).toLowerCase() !== key),
    );
    if (editingKey && editingKey.toLowerCase() === key) {
      setEditingKey(null);
    }
  };

  const beginEditTag = (tag) => {
    setEditingKey(draftKeyOf(tag));
    setEditLabelDraft(tag.label);
    setEditDescriptionDraft(tag.description || "");
  };

  const commitEditTag = () => {
    if (!editingKey) return;
    const nextLabel = editLabelDraft.trim().slice(0, 50);
    if (!nextLabel) return;
    const nextDesc = normalizeDescription(editDescriptionDraft);
    const oldKey = editingKey.toLowerCase();
    setDraftTags((prev) => {
      const duplicate = prev.some(
        (item) =>
          draftKeyOf(item).toLowerCase() !== oldKey &&
          item.label.toLowerCase() === nextLabel.toLowerCase(),
      );
      if (duplicate) return prev;
      return prev.map((item) =>
        draftKeyOf(item).toLowerCase() === oldKey
          ? { ...item, label: nextLabel, description: nextDesc }
          : item,
      );
    });
    setEditingKey(null);
  };

  const cancelEditTag = () => {
    setEditingKey(null);
  };

  const handleSaveCreate = () => {
    const category = name.trim();
    if (!category) return;
    const created = createDepartment({
      objectId: session.objectId ?? null,
      category,
      description: normalizeDescription(description),
      subcategories: [],
    });
    onSessionChange?.({
      mode: "edit",
      departmentId: created.id,
      objectId: session.objectId ?? null,
    });
  };

  const handleDelete = () => {
    if (!existing) return;
    deleteDepartment(existing.id);
    onClose?.();
  };

  const handleSaveTags = () => {
    if (!existing) return;

    // Commit any tag still sitting in the input (user typed + Save without Add).
    let tagsToSave = draftTags;
    const pendingLabel = tagDraft.trim().slice(0, 50);
    if (pendingLabel) {
      const pendingDesc = normalizeDescription(tagDescriptionDraft);
      const exists = tagsToSave.some(
        (item) => item.label.toLowerCase() === pendingLabel.toLowerCase(),
      );
      if (!exists) {
        tagsToSave = [
          ...tagsToSave,
          { label: pendingLabel, description: pendingDesc, originLabel: null },
        ];
      }
    }

    // Cascade renames before replacing the full list.
    tagsToSave.forEach((tag) => {
      if (
        tag.originLabel &&
        tag.originLabel.toLowerCase() !== tag.label.toLowerCase()
      ) {
        updateSubcategory(existing.id, tag.originLabel, {
          label: tag.label,
          description: tag.description,
        });
      }
    });

    // Atomic write — avoids multi-step remove/add races wiping tags.
    updateDepartment(existing.id, {
      subcategories: tagsToSave.map((tag) => ({
        label: tag.label,
        description: tag.description || "",
      })),
    });

    onClose?.();
  };

  const title = isCreate
    ? t("sidebar.departmentCreateTitle")
    : t("sidebar.departmentOf", {
        name: recordedName || t("sidebar.departmentsTitle"),
      });

  const showDeptEditors = isCreate || editingDeptMeta;
  const displayName = (existing?.category || name || "").trim();
  const displayDescription = (existing?.description || description || "").trim();

  return createPortal(
    <div
      className={
        "departments-dashboard-overlay" +
        (isCreate ? "" : " departments-dashboard-overlay--edit") +
        (editingDeptMeta ? " departments-dashboard-overlay--meta-edit" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="departments-dashboard-overlay__backdrop"
        aria-label={t("common.cancel")}
        onClick={onClose}
      />
      <div className="departments-dashboard-overlay__card">
        <div
          className="departments-dashboard-overlay__bg"
          style={{ backgroundImage: `url(${DEPT_BG_SRC})` }}
          aria-hidden
        />
        <header className="departments-dashboard-overlay__header">
          <div className="departments-dashboard-overlay__title-row">
            <img
              src="/uploads/Departments.svg"
              alt=""
              aria-hidden
              className="departments-dashboard-overlay__icon"
            />
            <h2 className="departments-dashboard-overlay__title">{title}</h2>
          </div>
          <button
            type="button"
            className="departments-dashboard-overlay__close"
            onClick={onClose}
            aria-label={t("common.cancel")}
          >
            ×
          </button>
        </header>

        <div className="departments-dashboard-overlay__body">
          {isCreate ? (
            <div className="departments-dashboard-overlay__hero" aria-hidden>
              <img
                src={DEPT_BG_SRC}
                alt=""
                className="departments-dashboard-overlay__hero-img"
              />
            </div>
          ) : null}

          <div className="departments-dashboard-table">
            {showDeptEditors ? (
              <>
                <div className="departments-dashboard-table__row">
                  <span className="departments-dashboard-table__k">
                    {t("sidebar.departmentFieldLabel")}:
                  </span>
                  <input
                    type="text"
                    className="departments-dashboard-table__input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("sidebar.departmentCreatePlaceholder")}
                    autoFocus
                    aria-label={t("sidebar.departmentFieldLabel")}
                  />
                </div>
                <div className="departments-dashboard-table__row">
                  <span className="departments-dashboard-table__k">
                    {t("sidebar.departmentDescriptionLabel")}:
                  </span>
                  <textarea
                    className="departments-dashboard-table__textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("sidebar.departmentDescriptionPlaceholder")}
                    rows={4}
                    aria-label={t("sidebar.departmentDescriptionLabel")}
                  />
                </div>
              </>
            ) : (
              <div className="departments-dashboard-table__recorded-block">
                <div className="departments-dashboard-table__row departments-dashboard-table__row--meta">
                  <span className="departments-dashboard-table__k departments-dashboard-table__k--meta">
                    {t("sidebar.departmentFieldLabel")}:
                  </span>
                  <div className="departments-dashboard-table__meta-line">
                    <p className="departments-dashboard-table__meta-text departments-dashboard-table__meta-text--name">
                      {displayName}
                    </p>
                    <button
                      type="button"
                      className="departments-dashboard-table__meta-edit"
                      onClick={beginEditDeptMeta}
                    >
                      {t("sidebar.departmentEditMeta")}
                    </button>
                  </div>
                </div>
                {displayDescription ? (
                  <div className="departments-dashboard-table__row departments-dashboard-table__row--meta">
                    <span className="departments-dashboard-table__k departments-dashboard-table__k--meta">
                      {t("sidebar.departmentDescriptionLabel")}:
                    </span>
                    <p className="departments-dashboard-table__meta-text">
                      {displayDescription}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {!editingDeptMeta ? (
              <div className="departments-dashboard-table__row departments-dashboard-table__row--tags">
                <span className="departments-dashboard-table__k">
                  {t("sidebar.departmentCategoriesLabel")}:
                </span>
                <div className="departments-dashboard-table__tags">
                  {tagsEnabled && !addingCategory ? (
                    <div className="departments-dashboard-table__category-list">
                      <div className="lp-departments-subs">
                        {draftTags.map((sub) => {
                          const key = draftKeyOf(sub);
                          const isEditing =
                            editingKey &&
                            editingKey.toLowerCase() === key.toLowerCase();
                          if (isEditing) {
                            return (
                              <div
                                key={`edit-${key}`}
                                className="departments-dashboard-table__tag-edit"
                              >
                                <input
                                  type="text"
                                  className="departments-dashboard-table__input"
                                  value={editLabelDraft}
                                  onChange={(e) => setEditLabelDraft(e.target.value)}
                                  aria-label={t("sidebar.departmentTagPlaceholder")}
                                  autoFocus
                                />
                                <textarea
                                  className="departments-dashboard-table__textarea"
                                  value={editDescriptionDraft}
                                  onChange={(e) =>
                                    setEditDescriptionDraft(e.target.value)
                                  }
                                  placeholder={t(
                                    "sidebar.departmentCategoryDescriptionPlaceholder",
                                  )}
                                  rows={2}
                                  aria-label={t(
                                    "sidebar.departmentCategoryDescriptionLabel",
                                  )}
                                />
                                <div className="departments-dashboard-table__tag-edit-actions">
                                  <button
                                    type="button"
                                    className="btn xs"
                                    disabled={!editLabelDraft.trim()}
                                    onClick={commitEditTag}
                                  >
                                    {t("common.save")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn xs ghost"
                                    onClick={cancelEditTag}
                                  >
                                    {t("common.cancel")}
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <span key={key} className="lp-departments-sub-chip">
                              <button
                                type="button"
                                className="lp-departments-sub-chip__label"
                                title={t("sidebar.departmentEditSub")}
                                onClick={() => beginEditTag(sub)}
                              >
                                {sub.label}
                              </button>
                              <button
                                type="button"
                                className="lp-departments-sub-chip__remove"
                                title={t("sidebar.departmentRemoveSub")}
                                aria-label={t("sidebar.departmentRemoveSub")}
                                onClick={() => removeTag(sub)}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="departments-dashboard-table__add-category-trigger"
                        onClick={beginAddCategory}
                      >
                        {t("sidebar.departmentAddNewCategory")}
                      </button>
                    </div>
                  ) : tagsEnabled && addingCategory ? (
                    <div className="departments-dashboard-table__category-create">
                      <input
                        type="text"
                        className="departments-dashboard-table__input"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          commitAddCategory();
                        }}
                        placeholder={t("sidebar.departmentTagPlaceholder")}
                        aria-label={t("sidebar.departmentTagPlaceholder")}
                        autoFocus
                      />
                      <textarea
                          className="departments-dashboard-table__textarea"
                          value={tagDescriptionDraft}
                          onChange={(e) => setTagDescriptionDraft(e.target.value)}
                          placeholder={t(
                            "sidebar.departmentCategoryDescriptionPlaceholder",
                          )}
                          rows={2}
                          aria-label={t(
                            "sidebar.departmentCategoryDescriptionLabel",
                          )}
                      />
                      <div className="departments-dashboard-table__category-create-actions">
                        <button
                          type="button"
                          className="departments-dashboard-table__category-add"
                          disabled={!tagDraft.trim()}
                          onClick={commitAddCategory}
                        >
                          {t("sidebar.departmentAddCategory")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="departments-dashboard-table__locked">
                      {t("sidebar.departmentTagsLocked")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="departments-dashboard-table__locked">
                {t("sidebar.departmentTagsLockedWhileMetaEdit")}
              </p>
            )}
          </div>
        </div>

        <footer className="departments-dashboard-overlay__footer">
          {editingDeptMeta ? (
            <button
              type="button"
              className="btn xs ghost"
              onClick={cancelEditDeptMeta}
            >
              {t("common.cancel")}
            </button>
          ) : existing ? (
            <button
              type="button"
              className="btn xs ghost"
              onClick={handleDelete}
            >
              {t("sidebar.departmentDelete")}
            </button>
          ) : (
            <span />
          )}
          <div className="departments-dashboard-overlay__footer-actions">
            <button
              type="button"
              className="departments-dashboard-overlay__save"
              disabled={
                isCreate || editingDeptMeta ? !name.trim() : false
              }
              onClick={
                isCreate
                  ? handleSaveCreate
                  : editingDeptMeta
                    ? handleSaveDeptMeta
                    : handleSaveTags
              }
            >
              {t("common.save")}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
