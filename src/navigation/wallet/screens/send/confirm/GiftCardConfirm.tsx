import React, {useEffect, useMemo, useState} from 'react';
import {useNavigation, useRoute, CommonActions} from '@react-navigation/native';
import {Hr} from '../../../../../components/styled/Containers';
import {RouteProp} from '@react-navigation/core';
import {WalletStackParamList} from '../../../WalletStack';
import {
  useAppDispatch,
  useAppSelector,
  useLogger,
} from '../../../../../utils/hooks';
import {H4, TextAlign} from '../../../../../components/styled/Text';
import {
  InvoiceCreationParams,
  Recipient,
  TransactionProposal,
  TxDetails,
  Wallet,
} from '../../../../../store/wallet/wallet.models';
import SwipeButton from '../../../../../components/swipe-button/SwipeButton';
import {
  createInvoiceAndTxProposal,
  startSendPayment,
} from '../../../../../store/wallet/effects/send/send';
import PaymentSent from '../../../components/PaymentSent';
import {sleep, formatFiatAmount} from '../../../../../utils/helper-methods';
import {startOnGoingProcessModal} from '../../../../../store/app/app.effects';
import {OnGoingProcessMessages} from '../../../../../components/modal/ongoing-process/OngoingProcess';
import {dismissOnGoingProcessModal} from '../../../../../store/app/app.actions';
import RemoteImage from '../../../../tabs/shop/components/RemoteImage';
import SheetModal from '../../../../../components/modal/base/sheet/SheetModal';
import {
  WalletSelectMenuBodyContainer,
  WalletSelectMenuContainer,
  WalletSelectMenuHeaderContainer,
} from '../../GlobalSelect';
import KeyWalletsRow, {
  KeyWalletsRowProps,
} from '../../../../../components/list/KeyWalletsRow';
import {ShopActions, ShopEffects} from '../../../../../store/shop';
import {BuildKeysAndWalletsList} from '../../../../../store/wallet/utils/wallet';
import {
  Amount,
  ConfirmContainer,
  DetailContainer,
  DetailRow,
  DetailsList,
  Header,
  SendingFrom,
} from './Shared';

export interface GiftCardConfirmParamList {
  wallet?: Wallet;
  recipient?: Recipient;
  txp?: Partial<TransactionProposal>;
  txDetails?: TxDetails;
  invoiceCreationParams?: InvoiceCreationParams;
}

const GiftCardHeader = ({
  invoiceCreationParams,
}: {
  invoiceCreationParams: InvoiceCreationParams | undefined;
}): JSX.Element | null => {
  if (invoiceCreationParams?.cardConfig) {
    return (
      <>
        <Header hr>
          <>{invoiceCreationParams.cardConfig.displayName} Gift Card</>
        </Header>
        <DetailContainer height={73}>
          <DetailRow>
            <H4>
              {formatFiatAmount(
                invoiceCreationParams.amount,
                invoiceCreationParams.cardConfig.currency,
              )}{' '}
              {invoiceCreationParams.cardConfig.currency}
            </H4>
            <RemoteImage
              uri={invoiceCreationParams.cardConfig.icon}
              height={40}
              borderRadius={40}
            />
          </DetailRow>
        </DetailContainer>
        <Hr style={{marginBottom: 40}} />
      </>
    );
  } else {
    return null;
  }
};

const Confirm = () => {
  const dispatch = useAppDispatch();
  const logger = useLogger();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<WalletStackParamList, 'GiftCardConfirm'>>();
  const {
    wallet: _wallet,
    recipient: _recipient,
    txDetails: _txDetails,
    txp: _txp,
    invoiceCreationParams,
  } = route.params!;
  const keys = useAppSelector(({WALLET}) => WALLET.keys);

  const [walletSelectModalVisible, setWalletSelectModalVisible] =
    useState(false);
  const [key, setKey] = useState(keys[_wallet ? _wallet.keyId : '']);
  const [wallet, setWallet] = useState(_wallet);
  const [recipient, setRecipient] = useState(_recipient);
  const [txDetails, updateTxDetails] = useState(_txDetails);
  const [txp, updateTxp] = useState(_txp);
  const [showPaymentSentModal, setShowPaymentSentModal] = useState(false);
  const [keyWallets, setKeysWallets] = useState<KeyWalletsRowProps[]>();
  const {fee, networkCost, sendingFrom, total} = txDetails || {};

  const memoizedKeysAndWalletsList = useMemo(
    () => BuildKeysAndWalletsList(keys),
    [keys],
  );

  useEffect(() => {
    return () => {
      if (invoiceCreationParams?.cardConfig && txp) {
        dispatch(
          ShopActions.deletedUnsoldGiftCard({
            invoiceId: txp.invoiceID!,
          }),
        );
      }
    };
  }, []);

  const openKeyWalletSelector = () => {
    setKeysWallets(memoizedKeysAndWalletsList);
    setWalletSelectModalVisible(true);
  };

  const onWalletSelect = async (selectedWallet: Wallet) => {
    setWalletSelectModalVisible(false);
    setWallet(selectedWallet);
    setKey(keys[selectedWallet.keyId]);
    if (!invoiceCreationParams) {
      return;
    }
    // not ideal - will dive into why the timeout has to be this long
    await sleep(1000);
    dispatch(
      startOnGoingProcessModal(OnGoingProcessMessages.FETCHING_PAYMENT_INFO),
    );
    const {txDetails: newTxDetails, txp: newTxp} = await dispatch(
      createInvoiceAndTxProposal(selectedWallet, invoiceCreationParams),
    );
    await sleep(500);
    dispatch(dismissOnGoingProcessModal());
    updateTxDetails(newTxDetails);
    updateTxp(newTxp);
    setRecipient({address: newTxDetails.sendingTo.recipientAddress} as {
      address: string;
    });
  };

  useEffect(() => {
    if (!invoiceCreationParams || !invoiceCreationParams.cardConfig) {
      return;
    }
    openKeyWalletSelector();
  }, []);

  return (
    <ConfirmContainer>
      <DetailsList>
        <GiftCardHeader invoiceCreationParams={invoiceCreationParams} />
        {txp && recipient && wallet ? (
          <>
            <Header hr>Summary</Header>
            <SendingFrom
              sender={sendingFrom!}
              onPress={openKeyWalletSelector}
              hr
            />
            <Amount description={'Network Cost'} amount={networkCost} hr />
            <Amount description={'Miner fee'} amount={fee} fiatOnly hr />
            <Amount description={'Total'} amount={total} />
          </>
        ) : null}
      </DetailsList>
      {txp && recipient && wallet ? (
        <>
          <SwipeButton
            title={'Slide to send'}
            onSwipeComplete={async () => {
              try {
                dispatch(
                  startOnGoingProcessModal(
                    OnGoingProcessMessages.SENDING_PAYMENT,
                  ),
                );
                await sleep(400);
                await dispatch(startSendPayment({txp, key, wallet, recipient}));
                if (invoiceCreationParams?.cardConfig && txp.invoiceID) {
                  const giftCard = await dispatch(
                    ShopEffects.startRedeemGiftCard(txp.invoiceID),
                  );
                  dispatch(dismissOnGoingProcessModal());
                  await sleep(400);
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 2,
                      routes: [
                        {
                          name: 'Tabs',
                          params: {screen: 'Shop'},
                        },
                        {
                          name: 'GiftCard',
                          params: {
                            screen: 'GiftCardDetails',
                            params: {
                              giftCard,
                              cardConfig: invoiceCreationParams.cardConfig,
                            },
                          },
                        },
                      ],
                    }),
                  );
                  return;
                }
                dispatch(dismissOnGoingProcessModal());
                await sleep(400);
                setShowPaymentSentModal(true);
              } catch (err) {}
            }}
          />
        </>
      ) : null}

      <SheetModal
        isVisible={walletSelectModalVisible}
        onBackdropPress={() => setWalletSelectModalVisible(false)}>
        <WalletSelectMenuContainer>
          <WalletSelectMenuHeaderContainer>
            <TextAlign align={'center'}>
              <H4>Select a wallet</H4>
            </TextAlign>
          </WalletSelectMenuHeaderContainer>
          <WalletSelectMenuBodyContainer>
            <KeyWalletsRow keyWallets={keyWallets!} onPress={onWalletSelect} />
          </WalletSelectMenuBodyContainer>
        </WalletSelectMenuContainer>
      </SheetModal>

      <PaymentSent
        isVisible={showPaymentSentModal}
        onCloseModal={async () => {
          navigation.navigate('Wallet', {
            screen: 'WalletDetails',
            params: {
              walletId: wallet!.id,
              key,
            },
          });
          await sleep(300);
          setShowPaymentSentModal(false);
        }}
      />
    </ConfirmContainer>
  );
};

export default Confirm;