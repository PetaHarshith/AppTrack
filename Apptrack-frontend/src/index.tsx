import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { initAppearance } from "./lib/appearance";

// Stamp the persisted appearance onto <html> before React mounts.
// Prevents a flash of unstyled appearance on first paint.
initAppearance();

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
