import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Key, 
  Users, 
  Monitor, 
  ShieldCheck, 
  AlertTriangle,
  Activity,
  ArrowUpRight
} from 'lucide-react';

const DashboardCard = ({ title, value, icon, color }) => (
  <div className="stat-card">
    <div className={`stat-icon-wrapper ${color}`}>
      {React.createElement(icon, { size: 24 })}
    </div>
    <div className="stat-content">
      <p>{title}</p>
      <h3>{value}</h3>
    </div>
  </div>
);

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const stats = await api.get('/dashboard');
        setData(stats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading-screen" style={{ padding: '40px', textAlign: 'center' }}>Updating system telemetry...</div>;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Global Dashboard</h1>
        <p>Live overview of the independent LoomTrack control plane</p>
      </div>

      <div className="stats-grid">
        <DashboardCard 
          title="Active Licenses" 
          value={data.stats.licenses} 
          icon={Key} 
          color="indigo"
        />
        <DashboardCard 
          title="Clients Managed" 
          value={data.stats.clients} 
          icon={Users} 
          color="cyan"
        />
        <DashboardCard 
          title="Tracked Systems" 
          value={data.stats.systems} 
          icon={Monitor} 
          color="violet"
        />
        <DashboardCard 
          title="Blocked Installs" 
          value={data.stats.blockedSystems} 
          icon={AlertTriangle} 
          color="warning"
        />
      </div>

      <div className="dashboard-grid">
        <section className="table-container" style={{ padding: '32px' }}>
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Activity size={20} className="text-secondary" />
            <h2 style={{ fontSize: '1.25rem' }}>Recent Security Events</h2>
          </div>
          <div className="audit-table">
            {data.recentAudit.map((log) => (
              <div key={log.auditId} className="audit-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div className="audit-info">
                  <span className="audit-action" style={{ fontWeight: 600, marginRight: '16px', fontSize: '13px' }}>{log.action}</span>
                  <span className="audit-target" style={{ opacity: 0.6, fontSize: '13px' }}>{log.targetType}: {log.targetId}</span>
                </div>
                <div className="audit-meta" style={{ textAlign: 'right' }}>
                  <span className="audit-actor" style={{ display: 'block', fontSize: '12px', fontWeight: 500 }}>{log.actorEmail || 'System'}</span>
                  <span className="audit-time" style={{ fontSize: '11px', opacity: 0.5 }}>{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
