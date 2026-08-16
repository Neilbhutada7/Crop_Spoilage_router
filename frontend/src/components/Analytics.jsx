import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Analytics() {
  const data = [
    { name: 'Mon', Tomatoes: 4000, Onions: 2400, Bananas: 2400 },
    { name: 'Tue', Tomatoes: 3000, Onions: 1398, Bananas: 2210 },
    { name: 'Wed', Tomatoes: 2000, Onions: 9800, Bananas: 2290 },
    { name: 'Thu', Tomatoes: 2780, Onions: 3908, Bananas: 2000 },
    { name: 'Fri', Tomatoes: 1890, Onions: 4800, Bananas: 2181 },
    { name: 'Sat', Tomatoes: 2390, Onions: 3800, Bananas: 2500 },
    { name: 'Sun', Tomatoes: 3490, Onions: 4300, Bananas: 2100 },
  ];

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Global Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Platform-wide insights and spoilage prevention metrics.</p>
      </div>

      <div className="grid grid-cols-3" style={{ marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Batches Routed</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text)' }}>1,432</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--risk-low)', marginTop: '0.5rem' }}>↑ 12% from last week</div>
        </div>
        <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Estimated Spoilage Saved</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>45.2 Tons</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--risk-low)', marginTop: '0.5rem' }}>↑ 8% from last week</div>
        </div>
        <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Avg. Net Profit Increase</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--risk-low)' }}>+ 18.5%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Compared to baseline routing</div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem' }}>Crop Volume Routed (kg) - Last 7 Days</h3>
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }}
            />
            <Bar dataKey="Tomatoes" fill="var(--risk-high)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Onions" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Bananas" fill="var(--risk-medium)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
