import React from 'react';

export default function RiskForecastChart({ forecastData }) {
  if (!forecastData || forecastData.length === 0) return null;

  const maxRisk = Math.max(...forecastData.map(d => d.risk_score), 100);

  return (
    <div className="card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
      <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '0.05em', fontWeight: '700' }}>
        7-Day Risk Forecast
      </h3>
      
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px', gap: '0.5rem' }}>
        {forecastData.map((day, idx) => {
          const heightPct = (day.risk_score / maxRisk) * 100;
          let color = 'var(--risk-low)';
          if (day.risk_score >= 33) color = 'var(--risk-medium)';
          if (day.risk_score >= 66) color = 'var(--risk-high)';
          
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: '100%', height: '100%' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                {Math.round(day.risk_score)}
              </div>
              <div 
                style={{ 
                  width: '100%', 
                  height: `${heightPct}%`, 
                  minHeight: '4px',
                  backgroundColor: color, 
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease'
                }} 
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {idx === 0 ? 'Today' : `+${idx}d`}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--surface-hover)', padding: '0.5rem', borderRadius: '6px' }}>
        Projected risk if not routed immediately.
      </div>
    </div>
  );
}
