import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { getCreditsDisplay } from "../../lib/planConfig.js";
import { isAppSoundMuted, setAppSoundMuted } from "../../lib/appSoundPrefs.js";
import { getGinaPrefs, setGinaPrefs } from "../../lib/gina/ginaPrefs.js";
import { exportWorkspaceDataZip } from "../../lib/exportWorkspaceDataZip.js";
import { useI18n } from "../../i18n/useI18n.js";

function IconUser({ className = "" }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.25c1.6-3.1 4-4.75 6.5-4.75s4.9 1.65 6.5 4.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SETTINGS_ICON = "/uploads/settings.svg";

/** Shows the signed-in user popover (settings: mute + plan) for the dashboard topbar. */
export function UserMenu() {
  const { t } = useI18n();
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [soundMuted, setSoundMuted] = useState(() => isAppSoundMuted());
  const [ginaPrefs, setGinaPrefsState] = useState(() => getGinaPrefs());
  const [exportingData, setExportingData] = useState(false);
  const [exportDataError, setExportDataError] = useState("");
  const rootRef = useRef(null);
  const profile = usePlanStore((s) => s.profile);
  const searchCount = usePlanStore((s) => s.profile.searchCount);
  const tokensBalance = usePlanStore((s) => s.profile.tokensBalance);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const displayName = user.user_metadata?.first_name || user.email?.split("@")[0] || "Account";
  const initial = displayName[0]?.toUpperCase() || "A";
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const isAdmin = !!adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase();
  const planLabel = profile?.plan === "pro" ? "Pro" : "Starter";
  const { cap, counter } = getCreditsDisplay({
    ...profile,
    searchCount,
    tokensBalance,
  });

  const handleLogout = async () => {
    setOpen(false);
    const result = await signOut();
    if (result && result.ok === false) {
      window.alert(result.error || "No se pudo guardar en la nube. Intentá de nuevo antes de cerrar sesión.");
      return;
    }
    navigate("/login", { replace: true });
  };

  const handleMuteToggle = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setAppSoundMuted(next);
  };

  const patchGinaPrefs = (partial) => {
    setGinaPrefsState(setGinaPrefs(partial));
  };

  const handleExportMyData = async () => {
    if (exportingData) return;
    setExportDataError("");
    setExportingData(true);
    try {
      const result = await exportWorkspaceDataZip();
      if (!result?.ok) {
        setExportDataError(result?.error || t("account.exportMyDataFailed"));
      }
    } catch (err) {
      console.error("[exportMyData]", err);
      setExportDataError(err?.message || t("account.exportMyDataFailed"));
    } finally {
      setExportingData(false);
    }
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className={"user-menu__trigger" + (open ? " is-open" : "")}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="user-menu__avatar" aria-hidden>{initial}</span>
        <span className="user-menu__name">{displayName}</span>
      </button>
      {open ? (
        <div className="user-menu__card" role="dialog" aria-label="Account">
          <div className="user-menu__header">
            <span className="user-menu__avatar user-menu__avatar--lg" aria-hidden>{initial}</span>
            <div className="user-menu__identity">
              <p className="user-menu__title">{displayName}</p>
              <p className="user-menu__description">{user.email}</p>
            </div>
          </div>

          <div className="user-menu__body">
            <button
              type="button"
              className="user-menu__nav-item"
              onClick={() => {
                setOpen(false);
                navigate("/app/plans");
              }}
            >
              <IconUser className="user-menu__nav-icon" />
              <span>View Profile</span>
            </button>

            <button
              type="button"
              className={"user-menu__nav-item" + (settingsOpen ? " is-active" : "")}
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <img
                src={SETTINGS_ICON}
                alt=""
                aria-hidden
                className="user-menu__nav-icon user-menu__nav-icon--settings"
                draggable={false}
              />
              <span>Settings</span>
            </button>

            {settingsOpen ? (
              <div className="user-menu__settings-panel">
                <div className="user-menu__setting">
                  <div className="user-menu__setting-copy">
                    <span className="user-menu__setting-title">App sounds</span>
                    <span className="user-menu__setting-hint">
                      {soundMuted ? "Muted" : "On"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={"user-menu__switch" + (soundMuted ? "" : " is-on")}
                    role="switch"
                    aria-checked={!soundMuted}
                    aria-label="App sounds"
                    onClick={handleMuteToggle}
                  >
                    <span className="user-menu__switch-thumb" />
                  </button>
                </div>

                <div className="user-menu__setting user-menu__setting--stack">
                  <div className="user-menu__setting-copy">
                    <span className="user-menu__setting-title">Gina week starts</span>
                    <span className="user-menu__setting-hint">
                      Schedule “this week” range
                    </span>
                  </div>
                  <div className="user-menu__seg" role="group" aria-label="Gina week starts on">
                    <button
                      type="button"
                      className={"user-menu__seg-btn" + (ginaPrefs.weekStartsOn === 1 ? " is-on" : "")}
                      aria-pressed={ginaPrefs.weekStartsOn === 1}
                      onClick={() => patchGinaPrefs({ weekStartsOn: 1 })}
                    >
                      Monday
                    </button>
                    <button
                      type="button"
                      className={"user-menu__seg-btn" + (ginaPrefs.weekStartsOn === 0 ? " is-on" : "")}
                      aria-pressed={ginaPrefs.weekStartsOn === 0}
                      onClick={() => patchGinaPrefs({ weekStartsOn: 0 })}
                    >
                      Sunday
                    </button>
                  </div>
                </div>

                <div className="user-menu__setting user-menu__setting--stack">
                  <div className="user-menu__setting-copy">
                    <span className="user-menu__setting-title">Gina list column</span>
                    <span className="user-menu__setting-hint">
                      Default Doc + Category or Folder
                    </span>
                  </div>
                  <div className="user-menu__seg" role="group" aria-label="Gina secondary column">
                    <button
                      type="button"
                      className={"user-menu__seg-btn" + (ginaPrefs.secondaryColumn === "category" ? " is-on" : "")}
                      aria-pressed={ginaPrefs.secondaryColumn === "category"}
                      onClick={() => patchGinaPrefs({ secondaryColumn: "category" })}
                    >
                      Category
                    </button>
                    <button
                      type="button"
                      className={"user-menu__seg-btn" + (ginaPrefs.secondaryColumn === "folder" ? " is-on" : "")}
                      aria-pressed={ginaPrefs.secondaryColumn === "folder"}
                      onClick={() => patchGinaPrefs({ secondaryColumn: "folder" })}
                    >
                      Folder
                    </button>
                  </div>
                </div>

                <div className="user-menu__setting user-menu__setting--stack">
                  <div className="user-menu__setting-copy">
                    <span className="user-menu__setting-title">
                      {t("account.exportMyData")}
                    </span>
                    <span className="user-menu__setting-hint">
                      {exportDataError
                        || (exportingData
                          ? t("account.exportMyDataLoading")
                          : t("account.exportMyDataHint"))}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={
                      "user-menu__export-btn"
                      + (exportingData ? " is-loading" : "")
                      + (exportDataError ? " is-error" : "")
                    }
                    disabled={exportingData}
                    aria-busy={exportingData}
                    onClick={handleExportMyData}
                    title={exportDataError || t("account.exportMyDataTitle")}
                  >
                    {exportingData
                      ? t("account.exportMyDataLoading")
                      : t("account.exportMyDataAction")}
                  </button>
                </div>

                <button
                  type="button"
                  className="user-menu__plan"
                  onClick={() => {
                    setOpen(false);
                    navigate("/app/plans");
                  }}
                >
                  <div className="user-menu__plan-copy">
                    <span className="user-menu__setting-title">Plan</span>
                    <span className="user-menu__setting-hint">{planLabel}</span>
                  </div>
                  <span className="user-menu__plan-credits" aria-label={`${counter} of ${cap} credits`}>
                    {counter}
                    <span className="user-menu__plan-cap">/{cap}</span>
                  </span>
                </button>

                {isAdmin ? (
                  <button
                    type="button"
                    className="user-menu__plan"
                    onClick={() => {
                      setOpen(false);
                      navigate("/panel");
                    }}
                  >
                    <div className="user-menu__plan-copy">
                      <span className="user-menu__setting-title">Admin panel</span>
                    </div>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="user-menu__footer">
            <button type="button" className="user-menu__sign-out" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
