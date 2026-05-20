import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "reactflow/dist/style.css";
import App from "./App";
import Layout from "./Layout";
import "./index.css";
import Ask from "./routes/Ask";
import Memory from "./routes/Memory";
import Plan from "./routes/Plan";
import Settings from "./routes/Settings";
import Timeline from "./routes/Timeline";
import Today from "./routes/Today";

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<Today />} />
            <Route path="/memory" element={<Memory />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/plan/new" element={<App />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/runs/:taskId/timeline" element={<Timeline />} />
            {/* Old routes — redirect to new homes. */}
            <Route path="/check-in" element={<Navigate to="/today" replace />} />
            <Route path="/profile" element={<Navigate to="/memory" replace />} />
            <Route path="/memory-graph" element={<Navigate to="/memory" replace />} />
            <Route path="/agents" element={<Navigate to="/settings" replace />} />
            <Route path="/evals" element={<Navigate to="/settings" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
