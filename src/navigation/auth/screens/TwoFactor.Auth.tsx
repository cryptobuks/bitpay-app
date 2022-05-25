import {yupResolver} from '@hookform/resolvers/yup';
import {StackScreenProps} from '@react-navigation/stack';
import React, {useEffect, useState} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {useDispatch, useSelector} from 'react-redux';
import * as yup from 'yup';
import Button from '../../../components/button/Button';
import BoxInput from '../../../components/form/BoxInput';
import {RootState} from '../../../store';
import {AppActions} from '../../../store/app';
import {BitPayIdActions, BitPayIdEffects} from '../../../store/bitpay-id';
import {TwoFactorAuthStatus} from '../../../store/bitpay-id/bitpay-id.reducer';
import {AuthStackParamList} from '../AuthStack';
import AuthFormContainer, {
  AuthActionsContainer,
  AuthFormParagraph,
  AuthRowContainer,
} from '../components/AuthFormContainer';

export type TwoFactorAuthenticationParamList = {} | undefined;

type TwoFactorAuthenticationScreenProps = StackScreenProps<
  AuthStackParamList,
  'TwoFactorAuthentication'
>;

interface TwoFactorAuthFieldValues {
  code: string;
}

const schema = yup.object().shape({
  code: yup.string().required('Required'),
});

const TwoFactorAuthentication: React.FC<
  TwoFactorAuthenticationScreenProps
> = props => {
  const {navigation} = props;
  const dispatch = useDispatch();
  const twoFactorAuthStatus = useSelector<RootState, TwoFactorAuthStatus>(
    ({BITPAY_ID}) => BITPAY_ID.twoFactorAuthStatus,
  );
  const twoFactorAuthError = useSelector<RootState, string>(
    ({BITPAY_ID}) => BITPAY_ID.twoFactorAuthError || '',
  );
  const {
    control,
    formState: {errors, isValid},
    handleSubmit,
    getValues,
    resetField,
  } = useForm<TwoFactorAuthFieldValues>({
    resolver: yupResolver(schema),
    mode: 'onChange',
  });

  useEffect(() => {
    return () => {
      dispatch(BitPayIdActions.updateTwoFactorAuthStatus(null));
    };
  }, [dispatch]);

  useEffect(() => {
    switch (twoFactorAuthStatus) {
      case 'success':
        const {code} = getValues();
        resetField('code');
        navigation.navigate('TwoFactorPairing', {prevCode: code});

        return;

      case 'failed':
        const done = () => {
          dispatch(BitPayIdActions.updateTwoFactorAuthStatus(null));
        };

        dispatch(
          AppActions.showBottomNotificationModal({
            type: 'error',
            title: 'Login failed',
            message: twoFactorAuthError || 'An unexpected error occurred.',
            enableBackdropDismiss: true,
            onBackdropDismiss: done,
            actions: [
              {
                text: 'OK',
                action: done,
              },
            ],
          }),
        );
        return;
    }
  }, [
    dispatch,
    resetField,
    getValues,
    navigation,
    twoFactorAuthStatus,
    twoFactorAuthError,
  ]);

  const onSubmit = handleSubmit(({code}) => {
    if (!code) {
      return;
    }

    dispatch(BitPayIdEffects.startTwoFactorAuth(code));
  });

  return (
    <AuthFormContainer>
      <AuthFormParagraph>
        Enter the code generated by your authenticator app.
      </AuthFormParagraph>

      <AuthRowContainer>
        <Controller
          control={control}
          render={({field: {onChange, onBlur, value}}) => (
            <BoxInput
              placeholder={'eg. 123456'}
              label={'Code'}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.code?.message}
              value={value}
              keyboardType="numeric"
              onSubmitEditing={onSubmit}
            />
          )}
          name="code"
          defaultValue=""
        />
      </AuthRowContainer>

      <AuthActionsContainer>
        <Button onPress={onSubmit} disabled={!isValid}>
          Submit
        </Button>
      </AuthActionsContainer>
    </AuthFormContainer>
  );
};

export default TwoFactorAuthentication;
