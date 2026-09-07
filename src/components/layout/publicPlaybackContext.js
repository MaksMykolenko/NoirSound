import { createContext, useContext } from 'react';

export const PublicPlaybackContext = createContext(null);

export function usePublicPlayback() {
  const context = useContext(PublicPlaybackContext);
  if (!context) throw new Error('Public layouts must be rendered inside PublicAppShell.');
  return context;
}
