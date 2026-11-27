import { Box, Button, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();

  const currentLanguage = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'pt';

  const changeLanguage = (language) => {
    i18n.changeLanguage(language);
  };

  const renderButton = (language, label, tooltip) => {
    const selected = currentLanguage === language;

    return (
      <Tooltip title={tooltip}>
        <Button
          type="button"
          aria-pressed={selected}
          onClick={() => changeLanguage(language)}
          sx={{
            minWidth: 42,
            height: 32,
            px: 1.25,
            borderRadius: '999px',
            color: selected ? 'text.primary' : 'text.secondary',
            bgcolor: selected ? 'background.neutral' : 'transparent',

            '&:hover': {
              color: 'text.primary',
              bgcolor: selected ? 'background.neutral' : 'action.hover',
              textDecoration: 'none',
            },
          }}
        >
          {label}
        </Button>
      </Tooltip>
    );
  };

  return (
    <Box
      role="group"
      aria-label={t('language.selector')}
      sx={{
        p: '3px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '999px',
        bgcolor: 'background.default',
        width: 'fit-content',
      }}
    >
      {renderButton('pt', 'PT', t('language.portuguese'))}

      {renderButton('en', 'EN', t('language.english'))}
    </Box>
  );
}
