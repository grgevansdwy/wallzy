import React, { createContext, useContext, useState } from "react";

export interface RadarResultData {
  merchantName: string;
  bestCardKeys: string[];
  bestCardName: string;
  estimatedRewards: number;
  isSignupBonus: boolean;
}

interface ContextType {
  radarResult: RadarResultData | null;
  setRadarResult: (result: RadarResultData | null) => void;
}

const RadarResultContext = createContext<ContextType>({
  radarResult: null,
  setRadarResult: () => {},
});

export function RadarResultProvider({ children }: { children: React.ReactNode }) {
  const [radarResult, setRadarResult] = useState<RadarResultData | null>(null);
  return (
    <RadarResultContext.Provider value={{ radarResult, setRadarResult }}>
      {children}
    </RadarResultContext.Provider>
  );
}

export function useRadarResult() {
  return useContext(RadarResultContext);
}
