import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { useDepartmentsStore } from "../../stores/departmentsStore.js";
import { listDepartmentsForObject } from "../../lib/departments.js";
import { DepartmentsDashboardOverlay } from "./DepartmentsDashboardOverlay.jsx";

/**
 * Departments list (rooms). +new / card click opens floating table overlay.
 */
export function DepartmentsPanel({
  objectId = null,
  onBack,
  createRequested = false,
  onCreateRequestHandled,
}) {
  const { t } = useI18n();
  const departments = useDepartmentsStore((s) => s.departments);

  const rows = useMemo(
    () => listDepartmentsForObject(departments, objectId),
    [departments, objectId],
  );

  const [session, setSession] = useState(null);

  const openCreate = useCallback(() => {
    setSession({ mode: "create", objectId });
  }, [objectId]);

  useEffect(() => {
    if (!createRequested) return;
    openCreate();
    onCreateRequestHandled?.();
  }, [createRequested, onCreateRequestHandled, openCreate]);

  return (
    <div className="lp-click-folder-detail lp-departments-panel">
      <div className="lp-workspace-head">
        <button
          type="button"
          className="lp-click-folder-back lp-click-folder-back--inline"
          onClick={onBack}
          aria-label={t("sidebar.departmentsTitle")}
          title={t("sidebar.departmentsTitle")}
        >
          <span className="lp-click-folder-back-icon" aria-hidden />
          <span className="lp-click-folder-back-label">
            {t("sidebar.departmentsTitle")}
          </span>
        </button>
      </div>

      <div className="lp-departments-rooms">
        {rows.length ? (
          rows.map((dept) => (
            <button
              key={dept.id}
              type="button"
              className="lp-departments-room-card"
              onClick={() => setSession({ mode: "edit", departmentId: dept.id, objectId })}
            >
              <img
                src="/uploads/Departments.svg"
                alt=""
                aria-hidden
                className="lp-departments-room-card__icon"
              />
              <span className="lp-departments-room-card__body">
                <span className="lp-departments-room-card__title">
                  {dept.category || t("sidebar.departmentsTitle")}
                </span>
              </span>
              <span className="lp-departments-room-card__chevron" aria-hidden>
                ›
              </span>
            </button>
          ))
        ) : (
          <button
            type="button"
            className="lp-departments-empty"
            onClick={openCreate}
            aria-label={t("sidebar.departmentCreateTitle")}
          >
            <img
              src="/uploads/department-img.png"
              alt=""
              className="lp-departments-empty__img"
            />
          </button>
        )}
      </div>

      {session ? (
        <DepartmentsDashboardOverlay
          session={session}
          onSessionChange={setSession}
          onClose={() => setSession(null)}
        />
      ) : null}
    </div>
  );
}
