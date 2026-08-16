export default function ActiveRoutes() {
  const routes = [
    { id: 'R-7392', batchId: 'B-104', crop: 'Tomato', dest: 'Lasalgaon Mandi', driver: 'Ramesh Singh', status: 'In Transit', eta: '45 mins' },
    { id: 'R-7393', batchId: 'B-105', crop: 'Onion', dest: 'Pimpalgaon Storage', driver: 'Suresh Patil', status: 'Loading', eta: 'N/A' },
    { id: 'R-7394', batchId: 'B-106', crop: 'Banana', dest: 'Mumbai APMC', driver: 'Vikram Desai', status: 'Delayed', eta: '3 hrs 15 mins' },
  ];

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Active Routes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Monitor real-time status of dispatched batches.</p>
        </div>
        <button className="btn">Add New Route</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <th style={{ padding: '1rem' }}>Route ID</th>
              <th style={{ padding: '1rem' }}>Crop</th>
              <th style={{ padding: '1rem' }}>Destination</th>
              <th style={{ padding: '1rem' }}>Driver</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem' }}>ETA</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{r.id}</td>
                <td style={{ padding: '1rem' }}>{r.crop} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({r.batchId})</span></td>
                <td style={{ padding: '1rem' }}>{r.dest}</td>
                <td style={{ padding: '1rem' }}>{r.driver}</td>
                <td style={{ padding: '1rem' }}>
                  <span className="badge" style={{ 
                    backgroundColor: r.status === 'In Transit' ? 'rgba(16, 185, 129, 0.1)' : r.status === 'Delayed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: r.status === 'In Transit' ? 'var(--risk-low)' : r.status === 'Delayed' ? 'var(--risk-high)' : 'var(--risk-medium)'
                  }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>{r.eta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
