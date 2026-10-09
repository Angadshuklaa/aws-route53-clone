"use client";

import { usePreferences } from "@/lib/preferences";
import { EXTERNAL_LINKS } from "@/lib/routes";

export function ConsoleFooter() {
  const { setCloudShellVisible, setShortcutsVisible } = usePreferences();
  return (
    <footer id="console-footer">
      <div className="console-footer__group">
        <button type="button" onClick={() => setCloudShellVisible(true)}>
          CloudShell
        </button>
        <a href={EXTERNAL_LINKS.issues} target="_blank" rel="noopener noreferrer">
          Feedback
        </a>
        <button type="button" className="console-footer__optional" onClick={() => setShortcutsVisible(true)}>
          Keyboard shortcuts
        </button>
      </div>
      <div className="console-footer__group console-footer__group--secondary">
        <span>© 2026 Route 53 Clone. Not affiliated with Amazon Web Services.</span>
        <a href={EXTERNAL_LINKS.readme} target="_blank" rel="noopener noreferrer">
          Documentation
        </a>
        <a href={EXTERNAL_LINKS.repository} target="_blank" rel="noopener noreferrer">
          Source code
        </a>
      </div>
    </footer>
  );
}
