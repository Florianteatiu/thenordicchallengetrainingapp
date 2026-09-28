import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { initials } from "../lib/format";

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function PageLoader({ label }) {
  return (
    <div className="page-center">
      <Spinner />
      {label && <div className="muted small">{label}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  const msg = typeof error === "string" ? error : error.message || "Something went wrong.";
  return (
    <div className="error-box row between">
      <span>{msg}</span>
      {onRetry && (
        <button className="link-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Avatar({ name, url, size = 40 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {url ? <img src={url} alt="" /> : initials(name) || "?"}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="h2">{title}</div>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>
        {children}
        {footer && <div className="row mt-16" style={{ justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

// Runs an async loader on mount (and whenever deps change) with loading/error state.
export function useAsync(loader, deps) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      setState({ loading: false, error: null, data });
      return data;
    } catch (error) {
      console.error(error);
      setState({ loading: false, error, data: null });
    }
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater })), []);

  return { ...state, reload: run, setData };
}

// Text input that only reports its value when the user is done editing
// (blur or Enter), so every keystroke doesn't hit the database.
export function CommitInput({ value, onCommit, multiline, className = "input", ...rest }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const commit = () => {
    if ((draft ?? "") !== (value ?? "")) onCommit(draft);
  };
  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag
      className={multiline ? "textarea" : className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline) e.currentTarget.blur();
      }}
      {...rest}
    />
  );
}

export function ProgressBar({ value }) {
  return (
    <div className="bar">
      <div style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}
