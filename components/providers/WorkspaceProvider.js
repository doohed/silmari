'use client';

import { createContext, useContext } from 'react';

/** Ajustes del workspace accesibles en cliente (moneda de visualización, zona horaria). */
const WorkspaceSettingsContext = createContext({ currency: 'EUR', timezone: 'Europe/Madrid' });

export function WorkspaceProvider({ value, children }) {
  return (
    <WorkspaceSettingsContext.Provider value={value}>{children}</WorkspaceSettingsContext.Provider>
  );
}

/** @returns {{ currency: string, timezone: string }} */
export function useWorkspaceSettings() {
  return useContext(WorkspaceSettingsContext);
}
