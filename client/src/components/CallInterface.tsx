/**
 * Call Interface Component
 */

import React, { useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Pause, Play } from "lucide-react";

interface CallState {
  status: "idle" | "connecting" | "active" | "ended";
  duration: number;
  isRecording: boolean;
  isMuted: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function CallInterface() {
  const [callState, setCallState] = useState<CallState>({
    status: "idle",
    duration: 0,
    isRecording: false,
    isMuted: false,
  });
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");

  let durationInterval: NodeJS.Timeout | null = null;

  const startCall = () => {
    setCallState((prev) => ({ ...prev, status: "connecting" }));
    
    // Simulate connection
    setTimeout(() => {
      setCallState((prev) => ({ 
        ...prev, 
        status: "active",
        isRecording: true 
      }));
      
      // Start duration counter
      durationInterval = setInterval(() => {
        setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }, 2000);
  };

  const endCall = async () => {
    if (durationInterval) {
      clearInterval(durationInterval);
    }

    const finalDuration = callState.duration;

    // Log the call
    if (selectedLeadId) {
      try {
        await fetch(`${API_BASE}/api/calls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            leadId: parseInt(selectedLeadId),
            direction: "outbound",
            duration: finalDuration,
          }),
        });
      } catch (err) {
        console.error("Failed to log call:", err);
      }
    }

    setCallState({
      status: "ended",
      duration: 0,
      isRecording: false,
      isMuted: false,
    });
  };

  const toggleMute = () => {
    setCallState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6">
        {/* Call Status */}
        <div className="text-center mb-8">
          <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 ${
            callState.status === "active" ? "bg-green-100" :
            callState.status === "connecting" ? "bg-yellow-100" :
            callState.status === "ended" ? "bg-gray-100" :
            "bg-blue-100"
          }`}>
            <Phone size={32} className={
              callState.status === "active" ? "text-green-600" :
              callState.status === "connecting" ? "text-yellow-600" :
              "text-blue-600"
            } />
          </div>
          
          <h3 className="text-lg font-semibold mb-2">
            {callState.status === "idle" && "Ready to Call"}
            {callState.status === "connecting" && "Connecting..."}
            {callState.status === "active" && "Call in Progress"}
            {callState.status === "ended" && "Call Ended"}
          </h3>

          {callState.status === "active" && (
            <p className="text-2xl font-mono text-gray-600">
              {formatDuration(callState.duration)}
            </p>
          )}
        </div>

        {/* Recording indicator */}
        {callState.isRecording && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Recording</span>
          </div>
        )}

        {/* Lead selection */}
        {callState.status === "idle" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Lead (optional)
            </label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            >
              <option value="">No lead selected</option>
              <option value="1">John Smith - 0412 345 678</option>
              <option value="2">Jane Doe - 0456 789 012</option>
            </select>
          </div>
        )}

        {/* Call controls */}
        <div className="flex items-center justify-center gap-4">
          {callState.status === "idle" && (
            <button
              onClick={startCall}
              className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition"
            >
              <Phone size={24} />
            </button>
          )}

          {callState.status === "connecting" && (
            <button
              disabled
              className="w-16 h-16 bg-yellow-500 text-white rounded-full flex items-center justify-center"
            >
              <Phone size={24} className="animate-pulse" />
            </button>
          )}

          {callState.status === "active" && (
            <>
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                  callState.isMuted ? "bg-gray-300" : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                {callState.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button
                onClick={endCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition"
              >
                <PhoneOff size={24} />
              </button>
            </>
          )}

          {callState.status === "ended" && (
            <button
              onClick={() => setCallState({
                status: "idle",
                duration: 0,
                isRecording: false,
                isMuted: false,
              })}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              New Call
            </button>
          )}
        </div>

        {/* Tips */}
        {callState.status === "idle" && (
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Tips for successful calls</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Always introduce yourself and Variety Solar</li>
              <li>• Ask open-ended questions to understand needs</li>
              <li>• Take notes during the call for follow-up</li>
              <li>• Confirm next steps before ending the call</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}