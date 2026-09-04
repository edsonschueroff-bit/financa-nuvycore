import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const BrandingContext = createContext({});

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState({
    nome_sistema: "Nuvy Finance",
    cor_primaria: "#059669",
    cor_secundaria: "#2563eb",
    logo_url: null,
    favicon_url: null,
  });

  const carregarBranding = async () => {
    try {
      const { data } = await api.get("/branding");
      if (data) {
        setBranding(data);
        if (data.cor_primaria) {
          document.documentElement.style.setProperty("--color-primary", data.cor_primaria);
        }
      }
    } catch {
      // silencioso fallback
    }
  };

  useEffect(() => {
    carregarBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, recarregarBranding: carregarBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => useContext(BrandingContext);
