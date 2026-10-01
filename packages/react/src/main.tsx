import React from "react";
import { createRoot } from "react-dom/client";
import { App, useUi } from "@atw/react";
import "./styles/app.css";

function Root(): JSX.Element {
  const theme = useUi((s) => s.theme);
  // Theme is applied on store init but reapply here to survive HMR.
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  return <App />;
}

const el = document.getElementById("root");
if (!el) throw new Error("#root not found");

createRoot(el).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
