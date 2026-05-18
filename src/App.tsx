/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { 
  LogOut, 
  BarChart3, 
  Database, 
  Network, 
  Activity, 
  Layers, 
  ZoomIn, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { initAuth, googleSignIn, logout } from './lib/firebase';
import { fetchSpreadsheetData, NetworkData } from './services/sheetsService';
import { cn } from './lib/utils';

const METRICS = [
  { key: 'Degree', label: 'Degree', color: '#3b82f6' },
  { key: 'WeightedDegree', label: 'Weighted Degree', color: '#10b981' },
  { key: 'Closeness', label: 'Closeness', color: '#f59e0b' },
  { key: 'Betweenness', label: 'Betweenness', color: '#ef4444' },
  { key: 'Eigenvector', label: 'Eigenvector', color: '#8b5cf6' },
] as const;

const SPREADSHEET_ID = '1TqRayTN2RE8-96n4GOrzdHfqAKFIy39-sDCJG6jKW5Q';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NetworkData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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
      }
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
      const fetchedData = await fetchSpreadsheetData(token, SPREADSHEET_ID);
      setData(fetchedData);
      if (fetchedData.length > 0) {
        // Get unique categories and pick the first one
        const categories = Array.from(new Set(fetchedData.map(d => d.Category)));
        setActiveCategory(categories[0]);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load spreadsheet data. Make sure you have access to the file.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const categories = Array.from(new Set(data.map(d => d.Category)));
  const filteredData = activeCategory ? data.filter(d => d.Category === activeCategory) : data;

  if (loading && !data.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium font-sans">Connecting to Google Workspace...</p>
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
            <h1 className="text-2xl font-bold text-slate-900 font-sans tracking-tight">Network Analysis Viewer</h1>
            <p className="text-slate-500 font-sans">
              Sign in with your Google account to visualize the network metrics from the spreadsheet.
            </p>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl hover:bg-slate-50 transition-all duration-200 shadow-sm"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            Sign in with Google
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
              <BarChart3 className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg hidden sm:block tracking-tight">Metrics Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium leading-none">{user.displayName}</span>
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
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Categories Navigation */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Layers className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Clusters / Categories</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                  activeCategory === cat
                    ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 scale-105"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
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
                  <h3 className="font-bold text-slate-800">{metric.label}</h3>
                </div>
                <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">
                  {filteredData.length} Nodes
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredData.sort((a, b) => b[metric.key] - a[metric.key]).slice(0, 20)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
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
            <h2 className="text-xl font-bold tracking-tight">Metric Relationships</h2>
            <p className="text-slate-500 text-sm italic">Compare Betweenness vs Eigenvector Centrality across nodes</p>
          </div>
          
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  type="number" 
                  dataKey="Betweenness" 
                  name="Betweenness" 
                  unit="" 
                  label={{ value: 'Betweenness', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="Eigenvector" 
                  name="Eigenvector" 
                  unit="" 
                  label={{ value: 'Eigenvector', angle: -90, position: 'insideLeft' }}
                />
                <ZAxis type="number" dataKey="Degree" range={[60, 400]} name="Degree" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                {categories.map((cat, idx) => (
                  <Scatter
                    key={cat}
                    name={cat}
                    data={data.filter(d => d.Category === cat)}
                    fill={`hsl(${idx * 137.5}, 70%, 50%)`}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
