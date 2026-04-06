"use client";

import { useEffect, useState } from "react";

const FULL_NAME = "Dawwi R.D.M.";
const CYCLE_MS = 8000;
const TYPE_MS = 2800;
const HOLD_MS = 3300;
const DELETE_MS = 1400;

function getVisibleLength(elapsed) {
  if (elapsed < TYPE_MS) {
    return Math.max(1, Math.floor((elapsed / TYPE_MS) * FULL_NAME.length));
  }

  if (elapsed < TYPE_MS + HOLD_MS) {
    return FULL_NAME.length;
  }

  if (elapsed < TYPE_MS + HOLD_MS + DELETE_MS) {
    const deleteElapsed = elapsed - TYPE_MS - HOLD_MS;
    const remaining = FULL_NAME.length - Math.floor((deleteElapsed / DELETE_MS) * FULL_NAME.length);
    return Math.max(0, remaining);
  }

  return 0;
}

export default function TypingName() {
  const [visibleText, setVisibleText] = useState(FULL_NAME.slice(0, 1));

  useEffect(() => {
    const startedAt = Date.now();

    const update = () => {
      const elapsed = (Date.now() - startedAt) % CYCLE_MS;
      const length = getVisibleLength(elapsed);
      setVisibleText(FULL_NAME.slice(0, length));
    };

    update();
    const timer = window.setInterval(update, 90);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="typing-live" aria-label={FULL_NAME}>
      {visibleText}
      <span className="typing-caret" aria-hidden="true" />
    </span>
  );
}
