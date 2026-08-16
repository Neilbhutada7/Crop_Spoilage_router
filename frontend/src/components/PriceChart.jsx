import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function PriceChart({ destinationId, cropType }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/destinations/${destinationId}/prices?crop_type=${cropType}`);
        // format dates for better display
        const formatted = res.data.map(d => ({
          ...d,
          dateShort: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }));
        setData(formatted);
      } catch (err) {
        console.error("Failed to fetch price history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrices();
  }, [destinationId, cropType]);

  if (loading) return <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading chart...</div>;
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: 120, marginTop: '1rem', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', padding: '0.5rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center' }}>30-Day Price Trend (₹/kg)</div>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data}>
          <XAxis dataKey="dateShort" hide />
          <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--primary)' }}
            labelStyle={{ color: 'var(--text-muted)' }}
          />
          <Line type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
