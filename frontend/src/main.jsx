import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./i18n.js";
import App from "./App.jsx";
import { AppDataProvider } from "./AppDataContext.jsx";
import { DisplayModeProvider } from "./DisplayModeContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <DisplayModeProvider>
        <AppDataProvider>
          <App />
        </AppDataProvider>
      </DisplayModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
