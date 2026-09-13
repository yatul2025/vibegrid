import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';

export default function StatusDashboard() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get('/health');
      setHealthData(data);
    } catch (err) {
      console.error('[Health Check Failed]', err);
      setError(err.message || 'Could not connect to Express server');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const isServerOnline = !error && healthData !== null;
  const isDbConnected = healthData?.database?.connected === true;

  return (
    <div className="dashboard-container">
      {/* Brand Header */}
      <div className="brand-header">
        <div className="brand-logo">V</div>
        <h1 className="brand-title">VibeGrid</h1>
        <p className="brand-tagline">Phase 1: 3-Tier Architecture & Connectivity Verification</p>
      </div>

      {/* Main Status Card */}
      <div className="status-card">
        <div className="card-title-row">
          <h2>System Health & Connectivity</h2>
          <button onClick={fetchHealth} disabled={loading} className="refresh-btn">
            {loading ? 'Testing...' : '🔄 Re-test Connection'}
          </button>
        </div>

        {/* 3-Tier Status Grid */}
        <div className="tier-grid">
          {/* Tier 1: React Frontend */}
          <div className="tier-box">
            <div className="tier-header">
              <span>Tier 1: Frontend</span>
              <span className="status-pill online">● Online</span>
            </div>
            <div className="tier-detail">React 18 (Vite SPA)</div>
            <div className="tier-subdetail">Port: 5173 (JavaScript JSX)</div>
          </div>

          {/* Tier 2: Express Backend */}
          <div className="tier-box">
            <div className="tier-header">
              <span>Tier 2: Backend API</span>
              <span className={`status-pill ${isServerOnline ? 'online' : 'offline'}`}>
                ● {isServerOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="tier-detail">
              {isServerOnline ? `Express.js (${healthData?.server?.environment || 'dev'})` : 'Server Unreachable'}
            </div>
            <div className="tier-subdetail">
              {isServerOnline ? `Port: ${healthData?.server?.port || 5000} (Uptime: ${healthData?.server?.uptimeSeconds}s)` : 'Run: npm run server'}
            </div>
          </div>

          {/* Tier 3: PostgreSQL Database */}
          <div className="tier-box">
            <div className="tier-header">
              <span>Tier 3: Database</span>
              <span className={`status-pill ${isDbConnected ? 'online' : 'pending'}`}>
                ● {isDbConnected ? 'Connected' : 'Pending Setup'}
              </span>
            </div>
            <div className="tier-detail">
              {isDbConnected ? 'PostgreSQL (Active)' : 'PostgreSQL (Waiting)'}
            </div>
            <div className="tier-subdetail">
              {isDbConnected ? `Time: ${new Date(healthData.database.currentTime).toLocaleTimeString()}` : (healthData?.database?.error || 'Check server/.env DATABASE_URL')}
            </div>
          </div>
        </div>

        {/* Diagnostic Status Box */}
        {isDbConnected ? (
          <div className="info-box" style={{ borderLeftColor: 'var(--success)' }}>
            <h3 style={{ color: 'var(--success)' }}>🎉 All 3 Tiers Connected Successfully!</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Your React Frontend, Express Backend, and PostgreSQL Database are communicating seamlessly.
              You are 100% ready to build <strong>Phase 2: User Registration & Authentication</strong>!
            </p>
          </div>
        ) : (
          <div className="info-box">
            <h3>⚡ Next Step: Configure your PostgreSQL Database</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Your React frontend and Express server are ready. Connect your database using either method:
            </p>
            <ol>
              <li>
                <strong>Option A: Free Cloud PostgreSQL (Recommended & Instant)</strong><br />
                Create a free database at <a href="https://neon.tech" target="_blank" rel="noreferrer">Neon.tech</a> or <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>, copy your connection string, and paste it into <code>server/.env</code>:
                <pre style={{ margin: '6px 0', padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.8rem', overflowX: 'auto' }}>
                  DATABASE_URL=postgresql://user:password@ep-cool-db.us-east-2.aws.neon.tech/vibegrid_db?sslmode=require
                </pre>
              </li>
              <li>
                <strong>Option B: Local PostgreSQL (via Homebrew)</strong><br />
                Run <code>brew install postgresql@16 && brew services start postgresql@16</code> and create the database: <code>createdb vibegrid_db</code>.
              </li>
              <li>Click <strong>"Re-test Connection"</strong> above once your database is connected!</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
