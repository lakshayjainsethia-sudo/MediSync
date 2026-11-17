/**
 * AiCompanionPage.tsx
 *
 * Full-page wrapper for the AI Care Companion.
 * Route: /patient/ai-companion (patient role only, guarded by PrivateRoute)
 *
 * Renders inside the standard layout (Header + Sidebar) just like
 * PatientDashboard — no layout changes required.
 */

import React from "react";
import AiCompanion from "../components/AiCompanion/AiCompanion";

export default function AiCompanionPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">AI Care Companion</h1>
          <p className="text-slate-600 mt-1">
            Your personal AI health information assistant — ask about your records, prescriptions, or appointments.
          </p>
        </div>
        {/* Chat takes up a fixed-height panel */}
        <div style={{ height: "75vh" }}>
          <AiCompanion />
        </div>
      </div>
    </div>
  );
}
