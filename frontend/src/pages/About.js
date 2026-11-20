import { Box, Container, Link, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { PageHeading } from '../components/wallet-ui';

const SOURCES = [
  ['Banco Central: instituições de pagamento', 'https://www.bcb.gov.br/estabilidadefinanceira/instituicaopagamento'],
  ['Banco Central: Pix', 'https://www.bcb.gov.br/estabilidadefinanceira/pix'],
  ['Open Finance Brasil', 'https://openfinancebrasil.org.br/'],
];

export default function About() {
  const { t } = useTranslation();
  return (
    <>
      <Helmet>
        <title>{t('app.about')} | Wall.ia</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('app.about')} description={t('app.demoNotice')} />
        {/* Reading, not doing: plain sections with a rule between them, no panels. */}
        <Box sx={{ maxWidth: 680 }}>
          {['simulation', 'apple', 'bcb'].map((section) => (
            <Box component="section" key={section} sx={{ py: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">
                {t(`app.aboutSections.${section}.title`)}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {t(`app.aboutSections.${section}.body`)}
              </Typography>
            </Box>
          ))}
          <Box component="section" sx={{ py: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" component="h2">
              {t('app.sources')}
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 1, p: 0, listStyle: 'none' }}>
              {SOURCES.map(([label, href]) => (
                <Box component="li" key={href} sx={{ py: 0.75 }}>
                  <Link href={href} target="_blank" rel="noreferrer">
                    {label}
                  </Link>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Container>
    </>
  );
}
