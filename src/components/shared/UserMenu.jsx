import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { getCreditsDisplay } from "../../lib/planConfig.js";
import { isAppSoundMuted, setAppSoundMuted } from "../../lib/appSoundPrefs.js";

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

function IconSettings({ className = "" }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 13.1a1.5 1.5 0 0 0 .3 1.65l.06.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37V18.6a1.8 1.8 0 1 1-3.6 0v-.09a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.06.06a1.8 1.8 0 1 1-2.55-2.55l.06-.06a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H5.4a1.8 1.8 0 1 1 0-3.6h.09a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.06-.06a1.8 1.8 0 1 1 2.55-2.55l.06.06a1.5 1.5 0 0 0 1.65.3h.1A1.5 1.5 0 0 0 11.1 5.4V5.4a1.8 1.8 0 1 1 3.6 0v.09a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.06-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.06a1.5 1.5 0 0 0-.3 1.65v.1a1.5 1.5 0 0 0 1.37.9h.09a1.8 1.8 0 1 1 0 3.6h-.09a1.5 1.5 0 0 0-1.37.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shows the signed-in user popover (settings: mute + plan) for the dashboard topbar. */
export function UserMenu() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [soundMuted, setSoundMuted] = useState(() => isAppSoundMuted());
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
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleMuteToggle = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setAppSoundMuted(next);
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
              <IconSettings className="user-menu__nav-icon" />
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
