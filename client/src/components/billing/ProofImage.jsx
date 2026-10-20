import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api.js';

export function ProofImage({ proofId, className = 'max-h-80 rounded-lg border border-slate-200' }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    api
      .get(`/payments/proof/${proofId}`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proofId]);

  if (failed) return <p className="text-sm text-slate-500">{t('billing.proof_unavailable')}</p>;
  if (!url) return <div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />;
  return <img src={url} alt={t('billing.proof')} className={className} />;
}

export default ProofImage;
