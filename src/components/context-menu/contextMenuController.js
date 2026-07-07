import { createContext, useContext } from 'react';

const noopController = {
  openContextMenu: () => {},
  closeContextMenu: () => {},
  openAddToPlaylist: () => {},
};

export const ContextMenuContext = createContext(noopController);

export function useContextMenuController() {
  return useContext(ContextMenuContext);
}
