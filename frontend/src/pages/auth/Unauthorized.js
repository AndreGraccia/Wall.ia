import { useTranslation } from 'react-i18next';
import StatusPage from '../../components/status-page';

export default function Unauthorized() {
  const { t } = useTranslation();
  return (
    <StatusPage
      code="401"
      pageTitle={t('auth.unauthorized.pageTitle')}
      title={t('auth.unauthorized.title')}
      description={t('auth.unauthorized.description')}
    />
  );
}
