'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ShieldAlert, Activity, TrendingUp, AlertTriangle } from 'lucide-react';

export default function FraudDashboard() {
  const [fraudData, setFraudData] = useState({
    flagged: 12,
    fraudPercent: 2.4,
    riskScore: 78,
    recentAlerts: [
      { id: 1, type: "High Value", amount: "₹45,000", time: "10 mins ago", risk: "CRITICAL" },
      { id: 2, type: "Location Anomaly", amount: "₹500", time: "1 hour ago", risk: "HIGH" },
      { id: 3, type: "Velocity Check", amount: "₹1,200", time: "3 hours ago", risk: "MEDIUM" },
    ]
  });

  return (
    <div className="p-4 safe-top pb-24 space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
          Security & Fraud Control
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Real-time AI/ML Risk Assessment
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
          <ShieldAlert className="w-6 h-6 text-red-500 mb-2" />
          <h3 className="text-2xl font-bold text-red-700 dark:text-red-400">{fraudData.flagged}</h3>
          <p className="text-xs text-red-600/80 dark:text-red-400/80">Flagged Txns</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30">
          <Activity className="w-6 h-6 text-orange-500 mb-2" />
          <h3 className="text-2xl font-bold text-orange-700 dark:text-orange-400">{fraudData.fraudPercent}%</h3>
          <p className="text-xs text-orange-600/80 dark:text-orange-400/80">Fraud Rate</p>
        </div>
      </div>

      {/* Risk Graph Placeholder */}
      <div className="bg-surface-0 dark:bg-surface-900 rounded-2xl p-5 shadow-sm border border-surface-100 dark:border-surface-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-surface-900 dark:text-surface-50">Global Risk Score</h2>
          <TrendingUp className="w-5 h-5 text-blue-500" />
        </div>
        
        <div className="h-32 flex items-end gap-2 pb-4 border-b border-surface-100 dark:border-surface-800">
          {/* Simple CSS bars for mock graph */}
          {[40, 65, 30, 85, 45, 90, 78].map((val, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end items-center group">
              <div 
                className={`w-full rounded-t-sm transition-all duration-500 ${val > 75 ? 'bg-red-500' : val > 50 ? 'bg-orange-400' : 'bg-primary-500'}`}
                style={{ height: `${val}%` }}
              ></div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-surface-400">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Today</span>
        </div>
      </div>

      {/* Recent Alerts */}
      <div>
        <h2 className="font-semibold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Recent Anomalies
        </h2>
        <div className="space-y-3">
          {fraudData.recentAlerts.map((alert) => (
            <div key={alert.id} className="bg-surface-0 dark:bg-surface-900 p-4 rounded-xl border border-surface-100 dark:border-surface-800 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm text-surface-900 dark:text-surface-50">{alert.type}</p>
                <p className="text-xs text-surface-500">{alert.time}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-surface-900 dark:text-surface-50">{alert.amount}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  alert.risk === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                  alert.risk === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {alert.risk}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
