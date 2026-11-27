import { useTranslation } from 'react-i18next';
import StatusPage from '../../components/status-page';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <StatusPage
      code="404"
      pageTitle={t('errors.notFound.pageTitle')}
      title={t('errors.notFound.title')}
      description={t('errors.notFound.description')}
    />
  );
}
