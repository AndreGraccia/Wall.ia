import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { dateTime, money } from '../../utils/wallet';

export default function TransactionDetail({ transaction, onClose }) {
  const { t, i18n } = useTranslation();
  if (!transaction) return null;
  const rows = [
    ['transfer.senderWallet', transaction.fromWallet?.name],
    ['transfer.receiverWallet', transaction.toWallet?.name],
    ['transactions.columns.createdAt', dateTime(transaction.createdAt, i18n.language)],
    [
      'transactions.columns.status',
      t(`transactions.status.${transaction.status}`, { defaultValue: transaction.status }),
    ],
    [
      'transfer.description',
      transaction.description === 'Initial balance' ? t('app.types.Initial balance') : transaction.description || '—',
    ],
    ['app.reference', transaction.referenceNumber],
  ];
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="detail-title">
      <DialogTitle id="detail-title">{t('app.details')}</DialogTitle>
      <DialogContent>
        <Typography variant="h3" sx={{ py: 2, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
          {money(transaction.amount, i18n.language)}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {/* How it moved: the Open Finance method (Pix, boleto...) when the bank sent one; the list row leaves it here. */}
          {transaction.paymentType
            ? t(`paymentMethods.${transaction.paymentType}`, { defaultValue: transaction.paymentType })
            : t(`app.types.${transaction.type?.name}`, { defaultValue: t('app.types.Transfer') })}
        </Typography>
        <Stack divider={<Divider />} spacing={1.5}>
          {rows.map(([label, value]) => (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary">
                {t(label)}
              </Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
          {t('app.demoNotice')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
TransactionDetail.propTypes = { transaction: PropTypes.object, onClose: PropTypes.func.isRequired };
