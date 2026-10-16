import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader, AdminPanel } from '../../components/admin/AdminUI';

export default function AdminSettings() {
  const { t } = useTranslation();
  return (
    <>
      <AdminPageHeader title={t('admin.settings')} description={t('admin.settingsDescription')} />
      <AdminPanel className="overflow-hidden">
        <div className="border-b border-[var(--ns-border-subtle)] p-5">
          <h2 className="text-sm font-bold">{t('admin.securityDefaults')}</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--ns-text-muted)]">{t('admin.securityDefaultsDescription')}</p>
        </div>
        <ul className="divide-y divide-[var(--ns-border-subtle)] text-sm text-[var(--ns-text-secondary)]">
          {[
            t('admin.settingAdminOnly'),
            t('admin.settingCsrf'),
            t('admin.settingAudit'),
            t('admin.settingSecrets'),
          ].map((setting) => (
            <li key={setting} className="flex items-start gap-3 px-5 py-3">
              <span>{setting}</span>
            </li>
          ))}
        </ul>
      </AdminPanel>
    </>
  );
}
