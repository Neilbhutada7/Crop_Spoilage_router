import { createContext, useCallback, useContext, useState } from "react";
import { api } from "./api";

const AppDataContext = createContext(null);

const DEMO_BATCH = {
  crop_type: "tomato",
  quantity_kg: 500,
  harvest_date_offset_days: 2,
  farm_name_hint: "Niphad", // matched against /api/farm-locations by name
  temperature_c: 32,
  humidity_pct: 82,
};

export function AppDataProvider({ children }) {
  const [batch, setBatch] = useState(null);
  const [risk, setRisk] = useState(null);
  const [riskForecast, setRiskForecast] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [valueUplift, setValueUplift] = useState(null);
  const [farmLocation, setFarmLocation] = useState(null);
  const [cropType, setCropType] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  const runBatch = useCallback(async (payload) => {
    const created = await api.createBatch(payload);
    const [riskResult, destResult, forecastResult] = await Promise.all([
      api.getBatchRisk(created.id),
      api.getBatchDestinations(created.id),
      api.getRiskForecast(created.id),
    ]);
    setBatch(created);
    setRisk(riskResult);
    setRiskForecast(forecastResult.forecast);
    setDestinations(destResult.destinations);
    setValueUplift(destResult.value_uplift);
    setCropType(payload.crop_type);
    setFarmLocation({ latitude: payload.farm_latitude, longitude: payload.farm_longitude, name: payload.farm_name });
    return { batch: created, risk: riskResult, destinations: destResult.destinations };
  }, []);

  const loadDemoBatch = useCallback(async () => {
    setIsDemo(true);
    const farms = await api.getFarmLocations();
    const farm = farms.find((f) => f.name.includes(DEMO_BATCH.farm_name_hint)) || farms[0];
    const harvestDate = new Date();
    harvestDate.setDate(harvestDate.getDate() - DEMO_BATCH.harvest_date_offset_days);
    const payload = {
      crop_type: DEMO_BATCH.crop_type,
      harvest_date: harvestDate.toISOString().slice(0, 10),
      quantity_kg: DEMO_BATCH.quantity_kg,
      farm_latitude: farm.latitude,
      farm_longitude: farm.longitude,
      farm_name: farm.name,
    };
    return runBatch(payload);
  }, [runBatch]);

  const value = {
    batch, risk, riskForecast, destinations, valueUplift, farmLocation, cropType, isDemo,
    runBatch, loadDemoBatch, setIsDemo,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
