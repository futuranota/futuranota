import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore.js";

/** Shows the signed-in user's name + a log out action, for the dashboard topbar. */
export function UserMenu() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!user) return null;

  const displayName = user.user_metadata?.first_name || user.email?.split("@")[0] || "Account";

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className={"user-menu__trigger" + (open ? " is-open" : "")}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-menu__avatar" aria-hidden>{displayName[0]?.toUpperCase()}</span>
        <span className="user-menu__name">{displayName}</span>
      </button>
      {open ? (
        <div className="user-menu__menu" role="menu">
          <div className="user-menu__email">{user.email}</div>
          <button type="button" className="user-menu__item" role="menuitem" onClick={handleLogout}>
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
