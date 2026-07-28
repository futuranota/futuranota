import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useDepartmentsStore } from "../../stores/departmentsStore.js";
import { findDepartmentById } from "../../lib/departments.js";

const DEPT_BG_SRC = "/uploads/department-img.png";

/**
 * Floating department table.
 * Create: Department name + Save → then categories unlock.
 * Edit: name locked (gray); tags emphasized; delete department.
 */
export function DepartmentsDashboardOverlay({ session, onSessionChange, onClose }) {
  const { t } = useI18n();
  const departments = useDepartmentsStore((s) => s.departments);
  const createDepartment = useDepartmentsStore((s) => s.createDepartment);
  const addSubcategory = useDepartmentsStore((s) => s.addSubcategory);
  const removeSubcategory = useDepartmentsStore((s) => s.removeSubcategory);
  const deleteDepartment = useDepartmentsStore((s) => s.deleteDepartment);

  const isCreate = session?.mode === "create";
  const existing = useMemo(
    () => (isCreate ? null : findDepartmentById(departments, session?.departmentId)),
    [departments, isCreate, session?.departmentId],
  );

  const [name, setName] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [draftTags, setDraftTags] = useState([]);

  useEffect(() => {
    if (!session) return;
    if (session.mode === "create") {
      setName("");
      setTagDraft("");
      setDraftTags([]);
      return;
    }
    const dept = findDepartmentById(
      useDepartmentsStore.getState().departments,
      session.departmentId,
    );
    setName(dept?.category || "");
    setTagDraft("");
    setDraftTags(Array.isArray(dept?.subcategories) ? [...dept.subcategories] : []);
  }, [session]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!session) return null;
  if (!isCreate && !existing) return null;

  const tags = isCreate ? [] : draftTags;
  const tagsEnabled = Boolean(existing);
  const recordedName = existing?.category || name;

  const addTag = () => {
    const label = tagDraft.trim().slice(0, 50);
    if (!label) return;
    setDraftTags((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setTagDraft("");
  };

  const removeTag = (label) => {
    setDraftTags((prev) => prev.filter((item) => item !== label));
  };

  const handleSaveCreate = () => {
    const category = name.trim();
    if (!category) return;
    const created = createDepartment({
      objectId: session.objectId ?? null,
      category,
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

  const handleSaveEdit = () => {
    if (!existing) return;
    const currentTags = Array.isArray(existing.subcategories) ? existing.subcategories : [];
    const toRemove = currentTags.filter((tag) => !draftTags.includes(tag));
    const toAdd = draftTags.filter((tag) => !currentTags.includes(tag));

    toRemove.forEach((tag) => removeSubcategory(existing.id, tag));
    toAdd.forEach((tag) => addSubcategory(existing.id, tag));
    onClose?.();
  };

  const title = isCreate
    ? t("sidebar.departmentCreateTitle")
    : t("sidebar.departmentOf", { name: recordedName || t("sidebar.departmentsTitle") });

  return createPortal(
    <div
      className={
        "departments-dashboard-overlay" +
        (isCreate ? "" : " departments-dashboard-overlay--edit")
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
            <div className="departments-dashboard-table__row">
              <span className="departments-dashboard-table__k">
                {t("sidebar.departmentFieldLabel")}:
              </span>
              {isCreate ? (
                <input
                  type="text"
                  className="departments-dashboard-table__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("sidebar.departmentCreatePlaceholder")}
                  autoFocus
                  aria-label={t("sidebar.departmentFieldLabel")}
                />
              ) : (
                <span
                  className="departments-dashboard-table__recorded"
                  title={t("sidebar.departmentNameLocked")}
                >
                  {recordedName}
                </span>
              )}
            </div>
            <div className="departments-dashboard-table__row departments-dashboard-table__row--tags">
              <span className="departments-dashboard-table__k">
                {t("sidebar.departmentCategoriesLabel")}:
              </span>
              <div className="departments-dashboard-table__tags">
                {tagsEnabled ? (
                  <>
                    <div className="lp-departments-subs">
                      {tags.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          className="lp-departments-sub-chip"
                          title={t("sidebar.departmentRemoveSub")}
                          onClick={() => removeTag(sub)}
                        >
                          {sub}
                          <span aria-hidden>×</span>
                        </button>
                      ))}
                    </div>
                    <div className="departments-dashboard-table__tag-add">
                      <input
                        type="text"
                        className="departments-dashboard-table__input"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          addTag();
                        }}
                        placeholder={t("sidebar.departmentTagPlaceholder")}
                        aria-label={t("sidebar.departmentTagPlaceholder")}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn xs"
                        disabled={!tagDraft.trim()}
                        onClick={addTag}
                      >
                        {t("sidebar.departmentAdd")}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="departments-dashboard-table__locked">
                    {t("sidebar.departmentTagsLocked")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="departments-dashboard-overlay__footer">
          {existing ? (
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
              disabled={isCreate ? !name.trim() : false}
              onClick={isCreate ? handleSaveCreate : handleSaveEdit}
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
