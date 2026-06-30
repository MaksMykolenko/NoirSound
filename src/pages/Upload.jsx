import React from 'react';
import { useTranslation } from 'react-i18next';
import UploadForm from '../components/upload/UploadForm';

export default function Upload() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Title */}
      <div className="text-center space-y-2">
        <span className="ns-eyebrow text-brand-red">Creator release flow</span>
        <h1 className="ns-page-title mt-2">{t('nav.upload')}</h1>
        <p className="ns-page-lede max-w-lg mx-auto">
          Send your original release through NoirSound’s private processing pipeline.
        </p>
      </div>

      {/* Upload Box wrapper */}
      <div className="pt-2">
        <UploadForm />
      </div>
    </div>
  );
}
