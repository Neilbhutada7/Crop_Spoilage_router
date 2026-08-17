import { useState, useEffect } from 'react';
import axios from 'axios';
import BatchEntryForm from './components/BatchEntryForm';
import RiskScoreCard from './components/RiskScoreCard';
import MapOverview from './components/MapOverview';
import DestinationList from './components/DestinationList';
import ActiveRoutes from './components/ActiveRoutes';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import RiskForecastChart from './components/RiskForecastChart';
import CropAssistant from './components/CropAssistant';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isHindi, setIsHindi] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [riskData, setRiskData] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [farmLocation, setFarmLocation] = useState(null);
  const [error, setError] = useState(null);
  
  const [currentBatchId, setCurrentBatchId] = useState(null);
  const [cropType, setCropType] = useState('tomato');
  const [batchQuantity, setBatchQuantity] = useState(500);
  
  const [simulatedDays, setSimulatedDays] = useState(0);
  const [toastMsg, setToastMsg] = useState(null);
  const [riskForecastData, setRiskForecastData] = useState(null);

  const [localWeather, setLocalWeather] = useState(null);
  const [weatherForecast, setWeatherForecast] = useState(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [showWeatherDropdown, setShowWeatherDropdown] = useState(false);

  const fetchLocalWeather = () => {
    setIsFetchingWeather(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const [weatherRes, forecastRes] = await Promise.all([
            axios.get(`${API_URL}/api/weather?lat=${latitude}&lon=${longitude}`),
            axios.get(`${API_URL}/api/weather/forecast?lat=${latitude}&lon=${longitude}`)
          ]);
          setLocalWeather(weatherRes.data);
          setWeatherForecast(forecastRes.data);
        } catch (err) {
          console.error("Failed to fetch local weather", err);
        } finally {
          setIsFetchingWeather(false);
        }
      }, (error) => {
        console.error("Geolocation error", error);
        setIsFetchingWeather(false);
      });
    } else {
      console.error("Geolocation not available");
      setIsFetchingWeather(false);
    }
  };

  const handleBatchSubmit = async (batchData, farmInfo) => {
    setIsLoading(true);
    setError(null);
    setFarmLocation(farmInfo);
    setCropType(batchData.crop_type);
    setBatchQuantity(batchData.quantity_kg);
    
    try {
      const batchRes = await axios.post(`${API_URL}/api/batches`, batchData);
      const batchId = batchRes.data.id;
      setCurrentBatchId(batchId);
      setSimulatedDays(0);

      await fetchRiskAndDestinations(batchId, 0);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'An error occurred during processing.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRiskAndDestinations = async (batchId, offset) => {
    const riskRes = await axios.get(`${API_URL}/api/batches/${batchId}/risk?simulated_days_offset=${offset}`);
    setRiskData(riskRes.data);

    const destRes = await axios.get(`${API_URL}/api/batches/${batchId}/destinations?simulated_days_offset=${offset}`);
    setDestinations(destRes.data);
    
    if (offset === 0) {
      try {
        const forecastRes = await axios.get(`${API_URL}/api/batches/${batchId}/risk/forecast`);
        setRiskForecastData(forecastRes.data);
      } catch (err) {
        console.error("Failed to fetch risk forecast", err);
      }
    }
  };

  useEffect(() => {
    if (currentBatchId) {
      fetchRiskAndDestinations(currentBatchId, simulatedDays).catch(err => {
        console.error("Failed to update simulation", err);
      });
    }
  }, [simulatedDays]);

  const handleSendSMS = async (destId) => {
    try {
      await axios.post(`${API_URL}/api/notifications/sms`, { destination_id: destId, batch_id: currentBatchId });
      setToastMsg("Route SMS Dispatched to Farmer!");
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error("SMS Failed", err);
    }
  };

  return (
    <div className="dashboard-layout">
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '2rem',
          backgroundColor: '#10b981', color: 'white', padding: '1rem 2rem',
          borderRadius: '8px', zIndex: 9999, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          {toastMsg}
        </div>
      )}

      <div style={{ position: 'fixed', top: '2rem', left: '2rem', zIndex: 60, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.25rem', color: 'var(--text)' }}>
        <div style={{ color: 'var(--primary)', display: 'flex' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        {isHindi ? 'स्पॉइलेज राउटर' : 'SPOILAGE ROUTER'}
      </div>

      <CropAssistant isHindi={isHindi} />

      <aside className="sidebar">
        
        <nav style={{ flex: 1 }}>
          <div className="nav-header">{isHindi ? 'नेविगेशन' : 'Navigation'}</div>
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <svg style={{ marginRight: '10px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            {isHindi ? 'डैशबोर्ड' : 'Dashboard'}
          </div>
          <div className={`nav-item ${activeTab === 'routes' ? 'active' : ''}`} onClick={() => setActiveTab('routes')}>
            <svg style={{ marginRight: '10px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            {isHindi ? 'सक्रिय मार्ग' : 'Active Routes'}
          </div>
          <div className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <svg style={{ marginRight: '10px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            {isHindi ? 'एनालिटिक्स' : 'Analytics'}
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <svg style={{ marginRight: '10px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            {isHindi ? 'सेटिंग्स' : 'Settings'}
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <input type="text" className="topbar-search" placeholder={isHindi ? 'खोजें...' : 'Search batches, mandis...'} />
          <div className="flex items-center gap-4" style={{ position: 'relative' }}>
            
            <button 
              onClick={() => setIsHindi(!isHindi)}
              style={{
                backgroundColor: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text)',
                cursor: 'pointer'
              }}
            >
              {isHindi ? 'English' : 'हिंदी'}
            </button>

            {localWeather ? (
              <div 
                style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--surface)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => setShowWeatherDropdown(!showWeatherDropdown)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19c-2.3 0-4.5-1.3-5.5-3.5a6.5 6.5 0 1 0-7-10.5 7 7 0 0 0 11.8 7.3"></path></svg>
                {localWeather.location_name} • {localWeather.temperature_c}°C
              </div>
            ) : (
              <button 
                className="btn" 
                onClick={fetchLocalWeather} 
                disabled={isFetchingWeather}
                style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: 'none' }}
              >
                {isFetchingWeather ? (isHindi ? 'खोज रहा है...' : 'Locating...') : (isHindi ? 'स्थानीय मौसम' : 'Get Local Weather')}
              </button>
            )}
            
            <img src="https://ui-avatars.com/api/?name=NB&background=0f172a&color=fff&rounded=true&bold=true" alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--border)', cursor: 'pointer' }} />
            
            {showWeatherDropdown && localWeather && weatherForecast && (
              <div style={{ position: 'absolute', top: 'calc(100% + 0.5rem)', right: '0', width: '300px', backgroundColor: 'var(--surface)', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--border)', padding: '1.5rem', zIndex: 100 }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Current Conditions
                  <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>{localWeather.location_name}</span>
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--surface-hover)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Humidity</div>
                    <div style={{ fontWeight: '600' }}>{localWeather.humidity_pct}%</div>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--surface-hover)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Wind</div>
                    <div style={{ fontWeight: '600' }}>{localWeather.wind_speed_kmh} km/h</div>
                  </div>
                </div>

                <h3 style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>3-Day Forecast</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {weatherForecast.map((day, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                      <div style={{ width: '80px', fontWeight: '500' }}>{day.day}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{day.emoji}</span>
                        <span>{day.temp}°C</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '80px', textAlign: 'right' }}>{day.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="dashboard-container">
          {activeTab === 'dashboard' && (
            <>
              <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{isHindi ? 'राउटिंग अवलोकन' : 'Routing Overview'}</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{isHindi ? 'जोखिम के आधार पर फसल बैचों की निगरानी और मार्ग तय करें।' : 'Monitor and route harvest batches optimally based on risk.'}</p>
                </div>
                <button className="btn" onClick={() => window.location.reload()}>{isHindi ? 'डेटा ताज़ा करें' : 'Refresh Data'}</button>
              </div>

              {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--risk-high)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              {riskData && destinations.length > 0 && (
                <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--risk-low)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spoilage Risk</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{riskData.risk_score}/100</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{riskData.risk_label} risk</div>
                  </div>
                  <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recommended</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>{destinations[0].name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{destinations[0].type === 'storage_facility' ? 'Storage Facility' : 'Mandi'}</div>
                  </div>
                  <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expected Price</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>₹{destinations[0].expected_price}/kg</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{destinations[0].distance_km} km away</div>
                  </div>
                  <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--text-muted)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Destinations Found</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{destinations.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>within search radius</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3">
                <div className="flex-col gap-4">
                  <BatchEntryForm onSubmit={handleBatchSubmit} isLoading={isLoading} isHindi={isHindi} />
                  
                  {riskData && (
                    <>
                      <div className="card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <label className="form-label" style={{ margin: 0 }}>{isHindi ? 'भविष्य का अनुकरण' : 'Simulate Future'}</label>
                          <span style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 'bold' }}>+{simulatedDays} {isHindi ? 'दिन' : 'Days'}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="14" 
                          value={simulatedDays} 
                          onChange={e => setSimulatedDays(parseInt(e.target.value))}
                        />
                        <div style={{ textAlign: 'center', fontSize: '0.75rem', marginTop: '0.75rem', color: 'var(--text-muted)' }}>
                          {isHindi ? 'अगर आप बैच को रोके रखते हैं तो जोखिम और कीमतों में बदलाव देखने के लिए एडजस्ट करें।' : 'Adjust to see how risk & prices change if you hold the batch.'}
                        </div>
                      </div>
                      <RiskScoreCard riskData={riskData} isHindi={isHindi} />
                      <RiskForecastChart forecastData={riskForecastData} />
                    </>
                  )}
                </div>
                
                <div className="flex-col gap-4" style={{ gridColumn: 'span 2' }}>
                  <MapOverview farmLocation={farmLocation} destinations={destinations} />
                  {destinations.length > 0 && (
                    <DestinationList destinations={destinations} cropType={cropType} onSendSMS={handleSendSMS} batchQuantity={batchQuantity} isHindi={isHindi} />
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'routes' && <ActiveRoutes />}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

export default App;
