import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUserStore } from '../../store/userStore';
import AddToPlaylistModal from '../playlists/AddToPlaylistModal';
import ContextMenu from './ContextMenu';
import { ContextMenuContext } from './contextMenuController';

export default function ContextMenuProvider({ children }) {
  const user = useUserStore((state) => state.user);
  const setAuthModalOpen = useUserStore((state) => state.setAuthModalOpen);
  const [menu, setMenu] = useState(null);
  const [addTrack, setAddTrack] = useState(null);

  const closeContextMenu = useCallback(() => setMenu(null), []);
  const openContextMenu = useCallback((items, anchor, invoker) => {
    const visibleItems = (items || []).filter(Boolean);
    if (!visibleItems.some((item) => item.type !== 'separator')) return;
    setMenu({ items: visibleItems, anchor, invoker });
  }, []);
  const openAddToPlaylist = useCallback((track) => {
    closeContextMenu();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setAddTrack(track);
  }, [closeContextMenu, setAuthModalOpen, user]);

  useEffect(() => {
    const close = () => closeContextMenu();
    window.addEventListener('blur', close);
    return () => window.removeEventListener('blur', close);
  }, [closeContextMenu]);

  const value = useMemo(() => ({
    openContextMenu,
    closeContextMenu,
    openAddToPlaylist,
  }), [closeContextMenu, openAddToPlaylist, openContextMenu]);

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      {menu && (
        <ContextMenu
          items={menu.items}
          anchor={menu.anchor}
          invoker={menu.invoker}
          onClose={closeContextMenu}
        />
      )}
      {addTrack && <AddToPlaylistModal track={addTrack} onClose={() => setAddTrack(null)} />}
    </ContextMenuContext.Provider>
  );
}
