import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader, AdminPanel } from '../../components/admin/AdminUI';

export default function AdminSettings() {
  const { t } = useTranslation();
  return (
    <>
      <AdminPageHeader title={t('admin.settings')} description={t('admin.settingsDescription')} />
      <AdminPanel className="p-5">
        <h2 className="text-sm font-bold">{t('admin.securityDefaults')}</h2>
        <p className="mt-2 text-sm text-[var(--ns-text-muted)]">{t('admin.securityDefaultsDescription')}</p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-xs text-[var(--ns-text-secondary)]">
          <li>{t('admin.settingAdminOnly')}</li>
          <li>{t('admin.settingCsrf')}</li>
          <li>{t('admin.settingAudit')}</li>
          <li>{t('admin.settingSecrets')}</li>
        </ul>
      </AdminPanel>
    </>
  );
}
