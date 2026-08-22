import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import AiAssistant from "./pages/AiAssistant";
import PhotoAnalyzer from "./pages/PhotoAnalyzer";
import BatchAnalysis from "./pages/BatchAnalysis";
import DestinationOptimizer from "./pages/DestinationOptimizer";
import RoutePlanner from "./pages/RoutePlanner";
import ModelPerformance from "./pages/ModelPerformance";
import BenchmarkComparison from "./pages/BenchmarkComparison";
import DataSources from "./pages/DataSources";
import Settings from "./pages/Settings";
import AppShell from "./components/AppShell";

export default function App() {
  const [search, setSearch] = useState("");

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppShell search={search} onSearchChange={setSearch} />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assistant" element={<AiAssistant />} />
        <Route path="/photo-analyzer" element={<PhotoAnalyzer />} />
        <Route path="/batch-analysis" element={<BatchAnalysis />} />
        <Route path="/destination-optimizer" element={<DestinationOptimizer />} />
        <Route path="/route-planner" element={<RoutePlanner />} />
        <Route path="/model-performance" element={<ModelPerformance />} />
        <Route path="/benchmark" element={<BenchmarkComparison />} />
        <Route path="/data-sources" element={<DataSources />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
