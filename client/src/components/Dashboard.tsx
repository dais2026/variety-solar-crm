/**
 * Main Dashboard Component
 * Standalone CRM Dashboard replacing Manus frontend
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import LeadsList from "./LeadsList";
import LeadDetail from "./LeadDetail";
import CallInterface from "./CallInterface";
import AIAssistant from "./AIAssistant";
import SheetImport from "./SheetImport";
import { Search, Plus, Settings, LogOut, Menu, X } from "lucide-react";

type View = "leads" | "calls" | "ai" | "import" | "settings";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>("leads");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/auth/login";
  };

  const handleLeadSelect = (leadId: number) => {
    setSelectedLeadId(leadId);
  };

  const handleBackToList = () => {
    setSelectedLeadId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                Variety Solar CRM
              </h1>
            </div>

            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-gray-600">
                {user?.name || user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="md:hidden mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Navigation tabs */}
        <nav className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm overflow-x-auto">
          <TabButton
            active={currentView === "leads"}
            onClick={() => setCurrentView("leads")}
          >
            Leads
          </TabButton>
          <TabButton
            active={currentView === "calls"}
            onClick={() => setCurrentView("calls")}
          >
            Calls
          </TabButton>
          <TabButton
            active={currentView === "ai"}
            onClick={() => setCurrentView("ai")}
          >
            AI Assistant
          </TabButton>
          <TabButton
            active={currentView === "import"}
            onClick={() => setCurrentView("import")}
          >
            Import
          </TabButton>
          <TabButton
            active={currentView === "settings"}
            onClick={() => setCurrentView("settings")}
          >
            Settings
          </TabButton>
        </nav>

        {/* Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {selectedLeadId ? (
            <div className="lg:col-span-2">
              <LeadDetail leadId={selectedLeadId} onBack={handleBackToList} />
            </div>
          ) : (
            <div className="lg:col-span-2">
              {currentView === "leads" && (
                <LeadsList searchQuery={searchQuery} onLeadSelect={handleLeadSelect} />
              )}
              {currentView === "calls" && <CallInterface />}
              {currentView === "ai" && <AIAssistant />}
              {currentView === "import" && <SheetImport />}
              {currentView === "settings" && <SettingsPanel />}
            </div>
          )}

          {/* Sidebar - Quick actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setCurrentView("ai")}
                  className="w-full flex items-center gap-3 p-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                >
                  <span className="text-2xl">🤖</span>
                  <span>Ask AI Assistant</span>
                </button>
                <button
                  onClick={() => setCurrentView("import")}
                  className="w-full flex items-center gap-3 p-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                >
                  <span className="text-2xl">📊</span>
                  <span>Import from Sheets</span>
                </button>
                <button
                  onClick={() => setCurrentView("calls")}
                  className="w-full flex items-center gap-3 p-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                >
                  <span className="text-2xl">📞</span>
                  <span>Start Call</span>
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-lg shadow-sm p-4 mt-4">
              <h3 className="font-semibold text-gray-900 mb-4">Today's Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Calls" value="0" />
                <StatCard label="Leads" value="0" />
                <StatCard label="Conversions" value="0" />
                <StatCard label="Pending" value="0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
        active
          ? "bg-blue-500 text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className="text-2xl font-bold text-blue-600">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Settings</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">API Configuration</h3>
          <p className="text-sm text-gray-500">
            Configure your API keys in the server .env file.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">OpenAI</h3>
          <p className="text-sm text-gray-500">
            Status: {import.meta.env.VITE_OPENAI_KEY ? "Configured" : "Not configured"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Google Sheets</h3>
          <p className="text-sm text-gray-500">
            Status: {import.meta.env.VITE_GOOGLE_SHEETS_ID ? "Connected" : "Not connected"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">AWS S3</h3>
          <p className="text-sm text-gray-500">
            Status: {import.meta.env.VITE_S3_BUCKET ? "Configured" : "Not configured"}
          </p>
        </div>
      </div>
    </div>
  );
}