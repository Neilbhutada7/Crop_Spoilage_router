import { useState } from 'react';

const FARMS = [
  { name: 'Nashik Village (Pimpalgaon)', lat: 20.1650, lon: 73.9850 },
  { name: 'Nashik Village (Lasalgaon)', lat: 20.1416, lon: 74.2255 },
  { name: 'Pune Village (Manchar)', lat: 18.9950, lon: 73.9450 },
  { name: 'Pune Village (Narayangaon)', lat: 19.1170, lon: 73.9740 },
  { name: 'Nagpur Village (Kalmeshwar)', lat: 21.2330, lon: 78.9160 }
];

export default function BatchEntryForm({ onSubmit, isLoading, isHindi }) {
  const [formData, setFormData] = useState({
    crop_type: 'tomato',
    harvest_date: new Date().toISOString().split('T')[0],
    quantity_kg: 500,
    farm_index: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const farm = FARMS[formData.farm_index];
    onSubmit({
      crop_type: formData.crop_type,
      harvest_date: formData.harvest_date,
      quantity_kg: formData.quantity_kg,
      farm_latitude: farm.lat,
      farm_longitude: farm.lon
    }, farm);
  };

  return (
    <div className="card">
      <div style={{ marginBottom: '1.25rem', fontSize: '1.125rem', fontWeight: '600' }}>{isHindi ? 'नया फसल बैच' : 'New Harvest Batch'}</div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">{isHindi ? 'फसल का प्रकार' : 'Crop Type'}</label>
          <select 
            className="form-control"
            value={formData.crop_type}
            onChange={e => setFormData({...formData, crop_type: e.target.value})}
          >
            <option value="tomato">Tomato</option>
            <option value="onion">Onion</option>
            <option value="banana">Banana</option>
            <option value="potato">Potato</option>
            <option value="lemon">Lemon</option>
            <option value="mango">Mango</option>
            <option value="leafy greens">Leafy Greens</option>
            <option value="pineapple">Pineapple</option>
            <option value="orange">Orange</option>
            <option value="strawberry">Strawberry</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">{isHindi ? 'कटाई की तारीख' : 'Harvest Date'}</label>
          <input 
            type="date" 
            className="form-control"
            value={formData.harvest_date}
            onChange={e => setFormData({...formData, harvest_date: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">{isHindi ? 'मात्रा (किग्रा)' : 'Quantity (kg)'}</label>
          <input 
            type="number" 
            className="form-control"
            value={formData.quantity_kg}
            onChange={e => setFormData({...formData, quantity_kg: e.target.value})}
            min="1"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">{isHindi ? 'खेत का स्थान' : 'Farm Location'}</label>
          <select 
            className="form-control"
            value={formData.farm_index}
            onChange={e => setFormData({...formData, farm_index: e.target.value})}
          >
            {FARMS.map((farm, idx) => (
              <option key={idx} value={idx}>{farm.name}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-full" disabled={isLoading}>
          {isLoading ? (isHindi ? 'प्रसंस्करण...' : 'Processing...') : (isHindi ? 'जोखिम का विश्लेषण करें और मार्ग खोजें' : 'Analyze Risk & Find Destinations')}
        </button>
      </form>
    </div>
  );
}
