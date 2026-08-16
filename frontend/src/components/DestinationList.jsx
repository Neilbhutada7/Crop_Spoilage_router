import PriceChart from './PriceChart';

export default function DestinationList({ destinations, cropType, onSendSMS }) {
  if (!destinations || destinations.length === 0) return null;

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Top Route Recommendations</h2>
      
      <div className="flex-col gap-4">
        {destinations.map((dest, idx) => (
          <div 
            key={dest.id} 
            style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius)',
              border: `1px solid ${idx === 0 ? 'var(--primary)' : 'var(--border)'}`,
              backgroundColor: idx === 0 ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
              position: 'relative',
              boxShadow: idx === 0 ? '0 0 20px rgba(99, 102, 241, 0.1)' : 'none'
            }}
          >
            {idx === 0 && (
              <span className="badge premium" style={{ position: 'absolute', top: '-0.75rem', right: '1.5rem' }}>
                #1 Optimal Route
              </span>
            )}
            
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: idx === 0 ? 'var(--primary)' : 'var(--text)' }}>{dest.name}</h3>
              <span className="badge">
                {dest.type === 'storage_facility' ? 'Storage' : 'Mandi'}
              </span>
            </div>
            
            <div className="grid grid-cols-2" style={{ gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Distance:</span> {dest.distance_km} km
              </div>
              <div>
                {dest.type === 'storage_facility' ? (
                  <><span style={{ color: 'var(--text-muted)' }}>Storage Cost:</span> ₹1/kg/day</>
                ) : (
                  <><span style={{ color: 'var(--text-muted)' }}>Est. Price:</span> ₹{dest.expected_price}/kg</>
                )}
              </div>
            </div>
            
            <div style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
              {dest.one_line_rationale}
            </div>

            {dest.type === 'mandi' && (
              <PriceChart destinationId={dest.id} cropType={cropType} />
            )}

            {idx === 0 && (
              <button 
                onClick={() => onSendSMS(dest.id)}
                className="btn" 
                style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', fontSize: '0.875rem' }}
              >
                Send Route via SMS to Farmer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
