/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { User } from "firebase/auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import ForceGraph2D from "react-force-graph-2d";
import {
  LogOut,
  BarChart3,
  Database,
  Network,
  Activity,
  Layers,
  ZoomIn,
  RefreshCw,
  AlertCircle,
  Share2,
  Maximize2,
  Search,
  Eye,
  EyeOff,
  Link,
  Target,
  Calendar,
  Users,
} from "lucide-react";
import { initAuth, googleSignIn, logout } from "./lib/firebase";
import {
  fetchSpreadsheetData,
  NetworkData,
  EdgeData,
} from "./services/sheetsService";
import { calculateLouvainCommunities } from "./services/louvainService";
import { cn } from "./lib/utils";

const METRICS = [
  { key: "Degree", label: "Degree", color: "#3b82f6" },
  { key: "WeightedDegree", label: "Weighted Degree", color: "#10b981" },
  { key: "Closeness", label: "Closeness", color: "#f59e0b" },
  { key: "Betweenness", label: "Betweenness", color: "#ef4444" },
  { key: "Eigenvector", label: "Eigenvector", color: "#8b5cf6" },
] as const;

const SPREADSHEET_ID = "1TqRayTN2RE8-96n4GOrzdHfqAKFIy39-sDCJG6jKW5Q";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [data, setData] = useState<NetworkData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [error, setError] = useState<{
    message: string;
    details?: string;
  } | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [groupingMode, setGroupingMode] = useState<"original" | "louvain">(
    "original",
  );
  const [viewMode, setViewMode] = useState<"charts" | "graph">("graph");
  const [hasLouvain, setHasLouvain] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NetworkData | null>(null);
  const [selectedLink, setSelectedLink] = useState<EdgeData | null>(null);
  const [connectionsViewMode, setConnectionsViewMode] = useState<
    "all" | "by-event"
  >("all");
  const [showLabels, setShowLabels] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const graphRef = useRef<any>(null);

  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const set = new Set<string>();
    edges.forEach((e) => {
      if (e.Source === selectedNode.Label) set.add(e.Target);
      if (e.Target === selectedNode.Label) set.add(e.Source);
    });
    return set;
  }, [selectedNode, edges]);

  const connections = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter(
        (e) =>
          e.Source === selectedNode.Label || e.Target === selectedNode.Label,
      )
      .map((e) => {
        const targetName =
          e.Source === selectedNode.Label ? e.Target : e.Source;
        const targetNode = data.find((n) => n.Label === targetName);
        return {
          name: targetName,
          weight: e.Weight || 1,
          node: targetNode,
          edge: e,
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [selectedNode, edges, data]);

  const connectionsByEvent = useMemo(() => {
    if (!selectedNode) return null;

    const projectsList = [
      "Liburnicon",
      "Coffee House Debates",
      "Archery Day",
      "Kreativni nered",
      "Team Building",
    ];
    const result: {
      [project: string]: {
        org: {
          name: string;
          count: number;
          node?: NetworkData;
          edge: EdgeData;
        }[];
        visit: {
          name: string;
          count: number;
          node?: NetworkData;
          edge: EdgeData;
        }[];
      };
    } = {};

    projectsList.forEach((proj) => {
      result[proj] = { org: [], visit: [] };
    });

    edges.forEach((e) => {
      const isSource = e.Source === selectedNode.Label;
      const isTarget = e.Target === selectedNode.Label;
      if (!isSource && !isTarget) return;

      const otherName = isSource ? e.Target : e.Source;
      const otherNode = data.find((n) => n.Label === otherName);

      if (e.Projects) {
        Object.entries(e.Projects).forEach(([projName, counts]) => {
          if (result[projName]) {
            const typedCounts = counts as { org: number; visit: number };
            if (typedCounts.org > 0) {
              result[projName].org.push({
                name: otherName,
                count: typedCounts.org,
                node: otherNode,
                edge: e,
              });
            }
            if (typedCounts.visit > 0) {
              result[projName].visit.push({
                name: otherName,
                count: typedCounts.visit,
                node: otherNode,
                edge: e,
              });
            }
          }
        });
      }
    });

    // Sort descending by count
    projectsList.forEach((proj) => {
      result[proj].org.sort((a, b) => b.count - a.count);
      result[proj].visit.sort((a, b) => b.count - a.count);
    });

    return result;
  }, [selectedNode, edges, data]);

  const filteredSearchNodes = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return data.filter((n) => n.Label.toLowerCase().includes(query));
  }, [data, searchQuery]);

  const focusOnNode = (node: any) => {
    const fg = graphRef.current;
    if (!fg) return;
    const graphNode = fg
      .getGraphData()
      .nodes.find((n: any) => n.id === node.Label);
    if (graphNode) {
      fg.centerAt(graphNode.x, graphNode.y, 800);
      fg.zoom(4.5, 800);
      setSelectedNode(node);
    }
  };

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
        setLoading(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { nodes, edges: fetchedEdges } = await fetchSpreadsheetData(
        token,
        SPREADSHEET_ID,
      );

      let finalNodes = nodes;
      if (fetchedEdges.length > 0) {
        finalNodes = calculateLouvainCommunities(nodes, fetchedEdges);
        setHasLouvain(true);
      } else {
        setHasLouvain(false);
      }

      setData(finalNodes);
      setEdges(fetchedEdges);
      if (finalNodes.length > 0) {
        const categories = Array.from(
          new Set(finalNodes.map((d) => d.Category)),
        );
        setActiveCategory(categories[0]);
      }
    } catch (err: any) {
      console.error(err);
      setError({
        message: "Failed to load spreadsheet data.",
        details: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (authLoading) return;
    setAuthLoading(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setError({
        message: "Sign in failed.",
        details: err.message,
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const currentCategories = Array.from(
    new Set(
      data.map((d) =>
        groupingMode === "original"
          ? d.Category
          : d.LouvainCommunity || "No Community",
      ),
    ),
  ).sort() as string[];

  const filteredData = activeCategory
    ? data.filter(
        (d) =>
          (groupingMode === "original" ? d.Category : d.LouvainCommunity) ===
          activeCategory,
      )
    : data;

  useEffect(() => {
    if (currentCategories.length > 0 && !activeCategory) {
      setActiveCategory(currentCategories[0]);
    }
  }, [groupingMode, currentCategories]);

  const graphData = useMemo(
    () => ({
      nodes: data.map((n) => {
        const cat =
          groupingMode === "original"
            ? n.Category
            : n.LouvainCommunity || "General";
        const idx = currentCategories.indexOf(cat);
        const hue = idx >= 0 ? (idx * 137.5) % 360 : 215;
        return {
          id: n.Label,
          label: n.Label,
          val: Math.sqrt(n.Degree + 1) * 2.5,
          color: `hsl(${hue}, 75%, 55%)`,
          ...n,
        };
      }),
      links: edges.map((e) => ({
        source: e.Source,
        target: e.Target,
        value: e.Weight || 1,
      })),
    }),
    [data, edges, groupingMode, currentCategories],
  );

  if (loading && !data.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium font-sans">
            Connecting to Google Workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Network className="w-8 h-8 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
              Network Analysis Viewer
            </h1>
            <p className="text-slate-500 font-sans">
              Sign in with your Google account to visualize the network metrics
              from the spreadsheet.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-left overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="font-bold text-sm">{error.message}</span>
              </div>
              {error.details && (
                <p className="text-xs opacity-80 break-words font-mono">
                  {error.details}
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={authLoading}
            className={cn(
              "w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl hover:bg-slate-50 transition-all duration-200 shadow-sm",
              authLoading && "opacity-50 cursor-not-allowed",
            )}
          >
            {authLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-5 h-5"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                ></path>
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                ></path>
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                ></path>
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                ></path>
              </svg>
            )}
            {authLoading ? "Signing in..." : "Sign in with Google"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-bottom border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Network className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg hidden sm:block tracking-tight text-slate-800">
              Udruga Kulturni Front Analiza
            </span>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("charts")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                viewMode === "charts"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Statistika
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                viewMode === "graph"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Share2 className="w-4 h-4" />
              Mrežni Graf
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium leading-none">
                {user.displayName}
              </span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-bold">{error.message}</p>
            </div>
            {error.details && (
              <p className="text-xs mt-1 ml-8 opacity-80 font-mono break-all leading-relaxed whitespace-pre-wrap">
                {error.details}
              </p>
            )}
          </div>
        )}

        {viewMode === "charts" ? (
          <>
            {/* Categories Navigation */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Layers className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    {groupingMode === "original"
                      ? "Original Groups"
                      : "Louvain Communities"}
                  </span>
                </div>

                {hasLouvain && (
                  <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
                    <button
                      onClick={() => setGroupingMode("original")}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                        groupingMode === "original"
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => setGroupingMode("louvain")}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                        groupingMode === "louvain"
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      Louvain (AI Discovery)
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {currentCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                      activeCategory === cat
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 scale-105"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {METRICS.map((metric) => (
                <div
                  key={metric.key}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-50">
                        <Activity className="w-5 h-5 text-slate-600" />
                      </div>
                      <h3 className="font-bold text-slate-800">
                        {metric.label}
                      </h3>
                    </div>
                    <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">
                      {filteredData.length} Nodes
                    </div>
                  </div>

                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={filteredData
                          .sort((a, b) => b[metric.key] - a[metric.key])
                          .slice(0, 20)}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis
                          dataKey="Label"
                          hide={filteredData.length > 10}
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          fontSize={12}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          }}
                        />
                        <Bar
                          dataKey={metric.key}
                          fill={metric.color}
                          radius={[4, 4, 0, 0]}
                          animationDuration={1000}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>

            {/* Global Metric Distribution (Scatter) */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">
                  Metric Relationships
                </h2>
                <p className="text-slate-500 text-sm italic">
                  Compare Betweenness vs Eigenvector Centrality across nodes
                </p>
              </div>

              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      dataKey="Betweenness"
                      name="Betweenness"
                      unit=""
                      label={{
                        value: "Betweenness",
                        position: "insideBottom",
                        offset: -10,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="Eigenvector"
                      name="Eigenvector"
                      unit=""
                      label={{
                        value: "Eigenvector",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <ZAxis
                      type="number"
                      dataKey="Degree"
                      range={[60, 400]}
                      name="Degree"
                    />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Legend />
                    {currentCategories.map((cat, idx) => (
                      <Scatter
                        key={cat}
                        name={cat}
                        data={data.filter(
                          (d) =>
                            (groupingMode === "original"
                              ? d.Category
                              : d.LouvainCommunity) === cat,
                        )}
                        fill={`hsl(${idx * 137.5}, 70%, 50%)`}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row h-[75vh] overflow-hidden">
            <div className="flex-1 min-h-0 relative bg-slate-900">
              <div className="absolute top-4 left-4 z-10 pointer-events-none space-y-2">
                <div className="bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 shadow-xl">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">
                    <Share2 className="w-3 h-3" />
                    Mrežne Veze Članova
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white/20"></div>
                      <span>Ime / Čvor</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 bg-slate-600"></div>
                      <span>Linije (Suradnja)</span>
                    </div>
                  </div>
                </div>
              </div>

              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeCanvasObject={(
                  node: any,
                  ctx: CanvasRenderingContext2D,
                  globalScale: number,
                ) => {
                  ctx.save();

                  const isSelected =
                    selectedNode && selectedNode.Label === node.id;
                  const isNeighbor =
                    selectedNode && selectedNeighbors.has(node.id);
                  const hasSelection = !!selectedNode;

                  // Apply alpha for highlighting target and its neighbors
                  if (hasSelection) {
                    if (isSelected || isNeighbor) {
                      ctx.globalAlpha = 1.0;
                    } else {
                      ctx.globalAlpha = 0.12;
                    }
                  } else {
                    ctx.globalAlpha = 1.0;
                  }

                  // Visual radius
                  const r = Math.max(5, Math.sqrt(node.Degree + 1) * 2.5);

                  // Glowing effect for isSelected
                  if (isSelected) {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
                    ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
                    ctx.fill();
                  }

                  // Node body
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                  ctx.fillStyle = node.color || "#3b82f6";
                  ctx.fill();

                  // Border ring
                  if (isSelected) {
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 1.8;
                    ctx.stroke();
                  } else if (isNeighbor) {
                    ctx.strokeStyle = "#93c5fd";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                  } else {
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                  }

                  // Always draw node label on graph if showLabels is true OR if it is in selected spotlight
                  if (showLabels || isSelected || isNeighbor) {
                    const label = node.id;
                    let fontSize = 10 / globalScale;
                    if (fontSize < 4.5) fontSize = 4.5;
                    if (fontSize > 15) fontSize = 15;

                    ctx.font = `${isSelected ? "bold" : "normal"} ${fontSize}px Inter, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";

                    const textWidth = ctx.measureText(label).width;
                    const padX = fontSize * 0.4;
                    const padY = fontSize * 0.25;

                    ctx.fillStyle = isSelected
                      ? "rgba(30, 41, 59, 0.95)"
                      : isNeighbor
                        ? "rgba(15, 23, 42, 0.85)"
                        : "rgba(15, 23, 42, 0.65)";

                    const bx = node.x - textWidth / 2 - padX;
                    const by = node.y + r + 3;
                    const bw = textWidth + padX * 2;
                    const bh = fontSize + padY * 2;

                    drawRoundedRect(ctx, bx, by, bw, bh, 3);
                    ctx.fill();

                    if (isSelected) {
                      ctx.strokeStyle = "rgba(96, 165, 250, 0.7)";
                      ctx.lineWidth = 0.6;
                      ctx.stroke();
                    }

                    ctx.fillStyle = isSelected ? "#60a5fa" : "#f8fafc";
                    ctx.fillText(label, node.x, node.y + r + 3 + padY);
                  }

                  ctx.restore();
                }}
                linkColor={(link) => {
                  const sId =
                    typeof link.source === "object"
                      ? (link.source as any).id
                      : link.source;
                  const tId =
                    typeof link.target === "object"
                      ? (link.target as any).id
                      : link.target;
                  if (selectedLink) {
                    const isSelectedLinkEdge =
                      (sId === selectedLink.Source &&
                        tId === selectedLink.Target) ||
                      (sId === selectedLink.Target &&
                        tId === selectedLink.Source);
                    return isSelectedLinkEdge
                      ? "#fbbf24"
                      : "rgba(255, 255, 255, 0.01)";
                  }
                  if (selectedNode) {
                    const isRelated =
                      sId === selectedNode.Label || tId === selectedNode.Label;
                    return isRelated ? "#3b82f6" : "rgba(255, 255, 255, 0.02)";
                  }
                  return "rgba(255, 255, 255, 0.15)";
                }}
                linkWidth={(link) => {
                  const sId =
                    typeof link.source === "object"
                      ? (link.source as any).id
                      : link.source;
                  const tId =
                    typeof link.target === "object"
                      ? (link.target as any).id
                      : link.target;
                  if (selectedLink) {
                    const isSelectedLinkEdge =
                      (sId === selectedLink.Source &&
                        tId === selectedLink.Target) ||
                      (sId === selectedLink.Target &&
                        tId === selectedLink.Source);
                    return isSelectedLinkEdge ? 4.0 : 0.8;
                  }
                  if (selectedNode) {
                    const isRelated =
                      sId === selectedNode.Label || tId === selectedNode.Label;
                    return isRelated ? 2.5 : 0.8;
                  }
                  return 0.8;
                }}
                linkDirectionalParticles={(link) => {
                  const sId =
                    typeof link.source === "object"
                      ? (link.source as any).id
                      : link.source;
                  const tId =
                    typeof link.target === "object"
                      ? (link.target as any).id
                      : link.target;
                  if (selectedLink) {
                    const isSelectedLinkEdge =
                      (sId === selectedLink.Source &&
                        tId === selectedLink.Target) ||
                      (sId === selectedLink.Target &&
                        tId === selectedLink.Source);
                    return isSelectedLinkEdge ? 6 : 0;
                  }
                  if (selectedNode) {
                    return sId === selectedNode.Label ||
                      tId === selectedNode.Label
                      ? 4
                      : 0;
                  }
                  return 0;
                }}
                linkDirectionalParticleWidth={1.5}
                linkDirectionalParticleSpeed={0.008}
                backgroundColor="#0f172a"
                onLinkClick={(link: any) => {
                  const sId =
                    typeof link.source === "object"
                      ? (link.source as any).id
                      : link.source;
                  const tId =
                    typeof link.target === "object"
                      ? (link.target as any).id
                      : link.target;
                  const foundEdge = edges.find(
                    (e) =>
                      (e.Source === sId && e.Target === tId) ||
                      (e.Source === tId && e.Target === sId),
                  );
                  if (foundEdge) {
                    setSelectedLink(foundEdge);
                    setSelectedNode(null);
                  }
                }}
                onNodeClick={(node: any) => {
                  const fg = graphRef.current;
                  if (fg) {
                    fg.centerAt(node.x, node.y, 400);
                    fg.zoom(4, 400);
                  }
                  const sourceNode = data.find((n) => n.Label === node.id);
                  setSelectedLink(null);
                  if (sourceNode) {
                    setSelectedNode(sourceNode);
                  }
                }}
              />
            </div>

            {/* Sidebar for Graph Info */}
            <div className="w-full md:w-80 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 overflow-y-auto flex flex-col">
              {/* Search Panel */}
              <div className="p-6 border-b border-slate-200 bg-white space-y-3 relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                  Pronađi člana (Pretraga)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Unesi ime člana..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
                  />
                </div>

                {filteredSearchNodes.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl max-h-40 overflow-y-auto shadow-lg divide-y divide-slate-100 absolute left-6 right-6 z-20 mt-1">
                    {filteredSearchNodes.map((node) => (
                      <button
                        key={node.Label}
                        onClick={() => {
                          focusOnNode(node);
                          setSearchQuery("");
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 font-sans transition-colors flex items-center justify-between"
                      >
                        <span className="truncate">{node.Label}</span>
                        <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 shrink-0 select-none ml-2">
                          {node.Category}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Configuration Controls */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Imena na grafu
                  </span>
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm",
                      showLabels
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-white text-slate-500 border-slate-200 hover:text-slate-700",
                    )}
                  >
                    {showLabels ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    {showLabels ? "Uključeno" : "Isključeno"}
                  </button>
                </div>

                {hasLouvain && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Grupacija / Otkrivanje
                    </span>
                    <div className="grid grid-cols-2 bg-slate-200 p-1 rounded-xl">
                      <button
                        onClick={() => setGroupingMode("original")}
                        className={cn(
                          "py-1 rounded-lg text-xs font-bold transition-all",
                          groupingMode === "original"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700",
                        )}
                      >
                        Sekcije
                      </button>
                      <button
                        onClick={() => setGroupingMode("louvain")}
                        className={cn(
                          "py-1 rounded-lg text-xs font-bold transition-all",
                          groupingMode === "louvain"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700",
                        )}
                      >
                        Louvain AI
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Metric Info Body */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {selectedNode ? (
                  <div className="p-6 space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Odabrani član (Čvor)
                        </span>
                        <button
                          onClick={() => setSelectedNode(null)}
                          className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                        >
                          ×
                        </button>
                      </div>
                      <h2 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                        {selectedNode.Label}
                      </h2>
                      <p className="text-sm font-medium text-blue-600 mt-1">
                        Sekcija: {selectedNode.Category}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {METRICS.slice(0, 4).map((m) => (
                        <div
                          key={m.key}
                          className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm"
                        >
                          <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                            {m.label}
                          </div>
                          <div className="text-lg font-bold text-slate-800 leading-none mt-1">
                            {typeof selectedNode[m.key] === "number"
                              ? selectedNode[m.key].toFixed(2)
                              : selectedNode[m.key]}
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedNode.LouvainCommunity && (
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl text-white shadow-md shadow-blue-100 space-y-1">
                        <h4 className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
                          Otkrivena Louvain Zajednica
                        </h4>
                        <p className="font-bold text-sm">
                          {selectedNode.LouvainCommunity}
                        </p>
                        <p className="text-[11px] text-white/80 leading-normal pt-1">
                          Louvain clustering povezuje članove na temelju njihove
                          intenzivne suradnje te kreira preporuke za radne
                          skupine.
                        </p>
                      </div>
                    )}

                    {/* Traverse connections list */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1.5">
                          <Link className="w-3.5 h-3.5 text-slate-400" />
                          Izravne Veze ({connections.length})
                        </h4>

                        {/* Segmented control for switching views */}
                        <div className="flex bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold shrink-0 select-none">
                          <button
                            type="button"
                            onClick={() => setConnectionsViewMode("all")}
                            className={cn(
                              "px-2 py-0.5 rounded-md transition-all",
                              connectionsViewMode === "all"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700",
                            )}
                          >
                            Sve
                          </button>
                          <button
                            type="button"
                            onClick={() => setConnectionsViewMode("by-event")}
                            className={cn(
                              "px-2 py-0.5 rounded-md transition-all",
                              connectionsViewMode === "by-event"
                                ? "bg-white text-blue-500 shadow-sm"
                                : "text-slate-500 hover:text-slate-700",
                            )}
                          >
                            Po Eventu
                          </button>
                        </div>
                      </div>

                      {connectionsViewMode === "all" ? (
                        connections.length > 0 ? (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {connections.map((conn) => (
                              <button
                                key={conn.name}
                                onClick={() => {
                                  const fullNode = data.find(
                                    (n) => n.Label === conn.name,
                                  );
                                  if (fullNode) {
                                    focusOnNode(fullNode);
                                  }
                                }}
                                className="w-full bg-white flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all text-left shadow-sm group"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-600">
                                    {conn.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {conn.node
                                      ? groupingMode === "original"
                                        ? conn.node.Category
                                        : conn.node.LouvainCommunity
                                      : "Aktivni član"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 select-none">
                                  <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                                    W: {conn.weight}
                                  </span>
                                  <Target className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-450 italic">
                            Član nema evidentiranih suradnji.
                          </p>
                        )
                      ) : (
                        /* Granular Event Breakdown View */
                        <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                          {Object.entries(connectionsByEvent || {}).some(
                            ([_, pData]: [string, any]) =>
                              pData.org.length > 0 || pData.visit.length > 0,
                          ) ? (
                            Object.entries(connectionsByEvent || {}).map(
                              ([projName, pData]: [string, any]) => {
                                const { org, visit } = pData;
                                if (org.length === 0 && visit.length === 0)
                                  return null;

                                return (
                                  <div
                                    key={projName}
                                    className="bg-slate-100/55 rounded-xl border border-slate-200/50 p-3 space-y-3"
                                  >
                                    <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5 select-none">
                                      <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider block truncate">
                                        {projName}
                                      </span>
                                    </div>

                                    {/* Organizacija Column/List inside Project */}
                                    {org.length > 0 && (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase tracking-widest pl-0.5 select-none">
                                          <Users className="w-3 h-3 text-emerald-500" />
                                          <span>
                                            Organizacija ({org.length})
                                          </span>
                                        </div>
                                        <div className="space-y-1 pl-1">
                                          {org.map((item) => (
                                            <button
                                              key={item.name}
                                              onClick={() => {
                                                const fullNode = data.find(
                                                  (n) => n.Label === item.name,
                                                );
                                                if (fullNode)
                                                  focusOnNode(fullNode);
                                              }}
                                              className="w-full bg-white flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/10 transition-all text-left shadow-sm group"
                                            >
                                              <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-emerald-700">
                                                {item.name}
                                              </span>
                                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono shrink-0 select-none">
                                                W: {item.count}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Visit Column/List inside Project */}
                                    {visit.length > 0 && (
                                      <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-purple-600 uppercase tracking-widest pl-0.5 select-none">
                                          <Target className="w-3 h-3 text-purple-500" />
                                          <span>
                                            Posjet / Soc ({visit.length})
                                          </span>
                                        </div>
                                        <div className="space-y-1 pl-1">
                                          {visit.map((item) => (
                                            <button
                                              key={item.name}
                                              onClick={() => {
                                                const fullNode = data.find(
                                                  (n) => n.Label === item.name,
                                                );
                                                if (fullNode)
                                                  focusOnNode(fullNode);
                                              }}
                                              className="w-full bg-white flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50/10 transition-all text-left shadow-sm group"
                                            >
                                              <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-purple-700">
                                                {item.name}
                                              </span>
                                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono shrink-0 select-none">
                                                W: {item.count}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              },
                            )
                          ) : (
                            <p className="text-xs text-slate-400 italic">
                              Ciljni član nema evidentiranih aktivnosti po
                              eventima.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : selectedLink ? (
                  <div className="p-6 space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                          Odabrana Veza (Linija)
                        </span>
                        <button
                          onClick={() => setSelectedLink(null)}
                          className="text-slate-450 hover:text-slate-600 text-lg font-bold"
                        >
                          ×
                        </button>
                      </div>

                      {/* Connection heading */}
                      <div className="bg-slate-100/90 rounded-xl p-3.5 border border-slate-200 mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              const found = data.find(
                                (n) => n.Label === selectedLink.Source,
                              );
                              if (found) focusOnNode(found);
                            }}
                            className="text-xs font-bold text-slate-700 hover:text-blue-600 truncate max-w-[110px] text-left transition-colors"
                            title={selectedLink.Source}
                          >
                            {selectedLink.Source}
                          </button>
                          <span className="text-xs text-slate-400 font-bold shrink-0 px-2 font-mono">
                            ⟷
                          </span>
                          <button
                            onClick={() => {
                              const found = data.find(
                                (n) => n.Label === selectedLink.Target,
                              );
                              if (found) focusOnNode(found);
                            }}
                            className="text-xs font-bold text-slate-700 hover:text-blue-600 truncate max-w-[110px] text-right transition-colors"
                            title={selectedLink.Target}
                          >
                            {selectedLink.Target}
                          </button>
                        </div>
                        <div className="h-px bg-slate-200 my-1"></div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Ukupna težina veze:</span>
                          <span className="font-mono font-bold text-slate-800 bg-slate-200/70 px-2.5 py-0.5 rounded-full">
                            W = {selectedLink.Weight}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown by event project and type */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        Povezanost po Eventima
                      </h4>

                      {selectedLink.Projects &&
                      Object.keys(selectedLink.Projects).length > 0 ? (
                        <div className="space-y-3">
                          {Object.entries(selectedLink.Projects).map(
                            ([projName, counts]) => {
                              const { org, visit } = counts as {
                                org: number;
                                visit: number;
                              };
                              if (org === 0 && visit === 0) return null;

                              return (
                                <div
                                  key={projName}
                                  className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-3"
                                >
                                  <div className="flex items-start gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 leading-snug">
                                        {projName}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
                                    {/* Organizacija Column */}
                                    <div className="bg-slate-50/70 rounded-lg p-2 flex flex-col justify-between">
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                        <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Organizacija</span>
                                      </div>
                                      <div className="text-lg font-black text-emerald-600 mt-1 leading-tight">
                                        {org > 0 ? org : "—"}
                                      </div>
                                      {org > 0 && (
                                        <span className="text-[9px] text-slate-400 leading-none mt-1">
                                          aktivne suradnje
                                        </span>
                                      )}
                                    </div>

                                    {/* Posjeti Column */}
                                    <div className="bg-slate-50/70 rounded-lg p-2 flex flex-col justify-between">
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                        <Target className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                        <span>Posjet / Soc.</span>
                                      </div>
                                      <div className="text-lg font-black text-purple-600 mt-1 leading-tight">
                                        {visit > 0 ? visit : "—"}
                                      </div>
                                      {visit > 0 && (
                                        <span className="text-[9px] text-slate-400 leading-none mt-1">
                                          zajednički posjet
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Ova veza nema upisanih pojedinačnih aktivnosti.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                      <Network className="w-6 h-6 text-blue-500 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-700">
                        Traži i Istraži
                      </h3>
                      <p className="text-xs text-slate-450 mt-1 max-w-[200px] mx-auto leading-normal">
                        Unesite ime u pretragu ili kliknite čvor na mrežnom
                        grafu za detaljne metrike, snagu i povezane članove.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
