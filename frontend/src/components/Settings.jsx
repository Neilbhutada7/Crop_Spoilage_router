export default function Settings() {
  return (
    <div className="card" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Platform Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Configure routing defaults and integrations.</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>General Preferences</h3>
        
        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: '500' }}>Auto-Approve Optimal Routes</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Automatically dispatch if destination score &gt; 15.0</div>
          </div>
          <div style={{ width: '40px', height: '24px', backgroundColor: 'var(--primary)', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', right: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
          </div>
        </div>

        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: '500' }}>Strict Cold-Chain Mode</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Only recommend facilities with active cold storage</div>
          </div>
          <div style={{ width: '40px', height: '24px', backgroundColor: 'var(--border)', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Integrations (Phase 3)</h3>
        
        <div className="form-group">
          <label className="form-label">Twilio SMS API Key</label>
          <input type="password" value="************************" readOnly className="form-control" style={{ opacity: 0.7 }} />
        </div>
        
        <div className="form-group">
          <label className="form-label">Agmarknet Data Sync Interval</label>
          <select className="form-control" defaultValue="daily">
            <option value="hourly">Hourly (API Limit)</option>
            <option value="daily">Daily at 06:00 AM</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>
      
      <button className="btn" style={{ marginTop: '1rem' }}>Save Settings</button>
    </div>
  );
}
