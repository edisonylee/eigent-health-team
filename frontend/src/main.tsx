import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "reactflow/dist/style.css";
import App from "./App";
import Layout from "./Layout";
import "./index.css";
import Agents from "./routes/Agents";
import CheckIn from "./routes/CheckIn";
import Evals from "./routes/Evals";
import MemoryGraph from "./routes/MemoryGraph";
import Settings from "./routes/Settings";
import Timeline from "./routes/Timeline";

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<App />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/evals" element={<Evals />} />
            <Route path="/check-in" element={<CheckIn />} />
            <Route path="/memory-graph" element={<MemoryGraph />} />
            <Route path="/runs/:taskId/timeline" element={<Timeline />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
