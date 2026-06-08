/**
 * Lead Detail Component
 */

import React, { useState, useEffect } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Edit2, Save, X } from "lucide-react";

interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadDetailProps {
  leadId: number;
  onBack: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function LeadDetail({ leadId, onBack }: LeadDetailProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({});

  useEffect(() => {
    fetchLead();
  }, [leadId]);

  const fetchLead = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/api/leads/${leadId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setLead(data.lead);
        setFormData(data.lead);
      }
    } catch (err) {
      console.error("Failed to fetch lead:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsEditing(false);
        fetchLead();
      }
    } catch (err) {
      console.error("Failed to update lead:", err);
    }
  };

  const getStatusOptions = () => [
    "new", "contacted", "qualified", "proposal", "won", "lost"
  ];

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500">Loading lead...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-500">Lead not found</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Back to List
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">
            {lead.first_name} {lead.last_name}
          </h2>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            lead.status === "won" ? "bg-green-200 text-green-900" :
            lead.status === "lost" ? "bg-red-100 text-red-800" :
            "bg-blue-100 text-blue-800"
          }`}>
            {lead.status}
          </span>
        </div>
        <div>
          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600"
              >
                <Save size={16} />
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Edit2 size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">Contact Information</h3>
            <div className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-gray-400" />
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  ) : (
                    <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                      {lead.email}
                    </a>
                  )}
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-gray-400" />
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  ) : (
                    <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                      {lead.phone}
                    </a>
                  )}
                </div>
              )}
              {(lead.address || lead.suburb) && (
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-gray-400 mt-1" />
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Address"
                        value={formData.address || ""}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Suburb"
                          value={formData.suburb || ""}
                          onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="State"
                          value={formData.state || ""}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          className="w-20 px-3 py-2 border border-gray-200 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Postcode"
                          value={formData.postcode || ""}
                          onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                          className="w-24 px-3 py-2 border border-gray-200 rounded-lg"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-600">
                      {[lead.address, lead.suburb, lead.state, lead.postcode].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status & Source */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">Lead Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Status</label>
                {isEditing ? (
                  <select
                    value={formData.status || "new"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg mt-1"
                  >
                    {getStatusOptions().map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-900">{lead.status}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Source</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.source || ""}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg mt-1"
                  />
                ) : (
                  <p className="text-gray-900">{lead.source || "Not specified"}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Created</label>
                <p className="text-gray-900">{new Date(lead.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Notes</h3>
          {isEditing ? (
            <textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg h-32"
              placeholder="Add notes about this lead..."
            />
          ) : (
            <p className="text-gray-600 whitespace-pre-wrap">
              {lead.notes || "No notes yet"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}