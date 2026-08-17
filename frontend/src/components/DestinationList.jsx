import PriceChart from './PriceChart';

export default function DestinationList({ destinations, cropType, onSendSMS, batchQuantity, isHindi }) {
  if (!destinations || destinations.length === 0) return null;

  // Calculate Value Uplift
  const mandiDestinations = destinations.filter(d => d.type === 'mandi' && d.expected_price != null);
  let valueUplift = null;
  if (mandiDestinations.length > 1) {
    const prices = mandiDestinations.map(d => d.expected_price);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    valueUplift = (maxPrice - minPrice) * batchQuantity;
  }

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>{isHindi ? 'शीर्ष मार्ग सुझाव' : 'Top Route Recommendations'}</h2>
      
      {valueUplift && valueUplift > 0 && (
        <div style={{ backgroundColor: '#10b981', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🚀 {isHindi ? `एआई राउटिंग मूल्य: इस बैच के लिए ₹${valueUplift.toLocaleString()} का अनुमानित लाभ!` : `AI Routing Value: Expected Uplift of ₹${valueUplift.toLocaleString()} for this batch!`}
        </div>
      )}

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
                {isHindi ? '#1 सर्वोत्तम मार्ग' : '#1 Optimal Route'}
              </span>
            )}
            
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: idx === 0 ? 'var(--primary)' : 'var(--text)' }}>{dest.name}</h3>
              <span className="badge">
                {dest.type === 'storage_facility' ? (isHindi ? 'भंडारण' : 'Storage') : (isHindi ? 'मंडी' : 'Mandi')}
              </span>
            </div>
            
            <div className="grid grid-cols-2" style={{ gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>{isHindi ? 'दूरी:' : 'Distance:'}</span> {dest.distance_km} km
              </div>
              <div>
                {dest.type === 'storage_facility' ? (
                  <><span style={{ color: 'var(--text-muted)' }}>{isHindi ? 'भंडारण लागत:' : 'Storage Cost:'}</span> ₹1/kg/day</>
                ) : (
                  <><span style={{ color: 'var(--text-muted)' }}>{isHindi ? 'अनुमानित मूल्य:' : 'Est. Price:'}</span> ₹{dest.expected_price}/kg</>
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
                {isHindi ? 'किसान को मार्ग SMS द्वारा भेजें' : 'Send Route via SMS to Farmer'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
