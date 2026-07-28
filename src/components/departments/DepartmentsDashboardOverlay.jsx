import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useDepartmentsStore } from "../../stores/departmentsStore.js";
import { findDepartmentById } from "../../lib/departments.js";

const DEPT_BG_SRC = "/uploads/department-img.png";

/**
 * Floating department table.
 * Create: name first → Save records the room → then categories unlock.
 * Edit: rename, add/remove tags, delete department.
 *
 * @param {Object} props
 * @param {{ mode: 'create'|'edit', departmentId?: string|null, objectId?: string|null }|null} props.session
 * @param {(next: { mode: 'edit', departmentId: string, objectId?: string|null }) => void} [props.onSessionChange]
 * @param {() => void} props.onClose
 */
export function DepartmentsDashboardOverlay({ session, onSessionChange, onClose }) {
  const { t } = useI18n();
  const departments = useDepartmentsStore((s) => s.departments);
  const createDepartment = useDepartmentsStore((s) => s.createDepartment);
  const updateDepartment = useDepartmentsStore((s) => s.updateDepartment);
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

  useEffect(() => {
    if (!session) return;
    if (session.mode === "create") {
      setName("");
      setTagDraft("");
      return;
    }
    const dept = findDepartmentById(
      useDepartmentsStore.getState().departments,
      session.departmentId,
    );
    setName(dept?.category || "");
    setTagDraft("");
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

  const tags = existing?.subcategories || [];
  const tagsEnabled = Boolean(existing);

  const addTag = () => {
    if (!existing) return;
    const label = tagDraft.trim().slice(0, 50);
    if (!label) return;
    addSubcategory(existing.id, label);
    setTagDraft("");
  };

  const removeTag = (label) => {
    if (!existing) return;
    removeSubcategory(existing.id, label);
  };

  const handleSave = () => {
    const category = name.trim();
    if (!category) return;
    if (isCreate) {
      const created = createDepartment({
        objectId: session.objectId ?? null,
        category,
        subcategories: [],
      });
      // Stay open — unlock categories after the room is recorded.
      onSessionChange?.({
        mode: "edit",
        departmentId: created.id,
        objectId: session.objectId ?? null,
      });
      return;
    }
    updateDepartment(existing.id, { category });
    onClose?.();
  };

  const handleDelete = () => {
    if (!existing) return;
    deleteDepartment(existing.id);
    onClose?.();
  };

  const title = isCreate
    ? t("sidebar.departmentCreateTitle")
    : (existing?.category || t("sidebar.departmentsTitle"));

  return createPortal(
    <div
      className="departments-dashboard-overlay"
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
            <h2 className="departments-dashboard-overlay__title">
              {isCreate ? t("sidebar.departmentCreateTitle") : title}
            </h2>
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
              <span className="departments-dashboard-table__k">{t("meta.category")}</span>
              <input
                type="text"
                className="departments-dashboard-table__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("sidebar.departmentCreatePlaceholder")}
                autoFocus
                aria-label={t("meta.category")}
              />
            </div>
            <div className="departments-dashboard-table__row departments-dashboard-table__row--tags">
              <span className="departments-dashboard-table__k">{t("meta.subcategories")}</span>
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
                  <p className="departments-dashboard-table__locked dim">
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
            <button type="button" className="btn xs ghost" onClick={onClose}>
              {existing ? t("common.back") : t("common.cancel")}
            </button>
            <button
              type="button"
              className="departments-dashboard-overlay__save"
              disabled={!name.trim()}
              onClick={handleSave}
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
