import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import ControlPanel from "./control-panel";

function Router() {
  const route = window.location.hash.replace(/^#\/?/, "");

  if (route === "control") return <ControlPanel />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
);
