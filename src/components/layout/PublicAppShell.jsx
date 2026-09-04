import React from 'react';
import { Outlet } from 'react-router-dom';
import AppLayout from './AppLayout';
import ContextMenuProvider from '../context-menu/ContextMenuProvider';

export default function PublicAppShell() {
  return (
    <ContextMenuProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ContextMenuProvider>
  );
}
