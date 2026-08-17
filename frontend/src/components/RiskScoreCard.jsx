export default function RiskScoreCard({ riskData, isHindi }) {
  if (!riskData) return null;

  // Map backend color labels to CSS variables
  const colorVar = `var(--risk-${riskData.risk_label.toLowerCase()})`;

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: colorVar }}></div>
      <div style={{ marginBottom: '1.25rem', fontSize: '1.125rem', fontWeight: '600' }}>{isHindi ? 'एआई स्पॉइलेज जोखिम' : 'AI Spoilage Risk'}</div>
      
      <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3rem', fontWeight: '700', color: colorVar, lineHeight: '1' }}>
          {riskData.risk_score}%
        </div>
        <span className="badge" style={{ backgroundColor: `${colorVar}20`, color: colorVar, fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
          {riskData.risk_label} {isHindi ? 'जोखिम' : 'Risk'}
        </span>
      </div>

      <div className="grid grid-cols-3" style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '1rem', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isHindi ? 'तापमान' : 'Temp'}</div>
          <div style={{ fontWeight: '600' }}>{riskData.temperature_c}°C</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isHindi ? 'नमी' : 'Humidity'}</div>
          <div style={{ fontWeight: '600' }}>{riskData.humidity_pct}%</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isHindi ? 'उम्र' : 'Age'}</div>
          <div style={{ fontWeight: '600' }}>{riskData.days_since_harvest} {isHindi ? 'दिन' : 'days'}</div>
        </div>
      </div>
      
      {riskData.risk_factors && riskData.risk_factors.length > 0 && (
        <div style={{ width: '100%', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', textAlign: 'left' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text)' }}>
            {isHindi ? 'यह स्कोर क्यों' : 'Why This Score'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
            <span style={{ fontWeight: '600', color: 'var(--text)' }}>{riskData.risk_label} risk ({Math.round(riskData.risk_score)}/100)</span> {isHindi ? '— कटाई के बाद का समय और स्थानीय परिस्थितियाँ प्रेरक कारक हैं।' : '— time since harvest and local conditions are driving factors. Point values below represent relative impact against ideal baseline conditions.'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {riskData.risk_factors.map((factor, idx) => {
              // Handle legacy string array or new object array
              const isObject = typeof factor === 'object';
              const icon = isObject ? factor.icon : '•';
              const text = isObject ? factor.text : factor;
              
              return (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <span style={{ color: icon === '▲' ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }}>{icon}</span>
                  <span>
                    {text.split('—').map((part, i, arr) => (
                      <span key={i}>
                        {i === 0 && arr.length > 1 ? <span style={{ color: 'var(--text)' }}>{part}</span> : part}
                        {i === 0 && arr.length > 1 ? ' — ' : ''}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          
          <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border)', lineHeight: '1.4' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text)' }}>{isHindi ? 'लाइव ओपन-मेटियो डेटा · मॉडल xgb-v1' : 'Live Open-Meteo data · model xgb-v1'}</div>
            {isHindi ? 'स्कोर एक XGBoost ग्रैडिएंट-बूस्टेड ट्री द्वारा निर्मित है।' : 'Score is produced by an XGBoost gradient-boosted trees (XGBRegressor), trained on 3,000 real-world samples, then evaluated on a held-out 20% split.'}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontWeight: '600' }}>
              <span>0.978 <span style={{ fontWeight: 'normal' }}>Test R²</span></span>
              <span>±3.55 <span style={{ fontWeight: 'normal' }}>Test MAE (risk pts)</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
