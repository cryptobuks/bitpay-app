import Modal from 'react-native-modal';
import React from 'react';

interface Props {
  isVisible: boolean;
  onBackdropPress: () => void;
}

const BottomPopupModal: React.FC<Props> = ({
  children,
  isVisible,
  onBackdropPress,
}) => {
  return (
    <Modal
      isVisible={isVisible}
      backdropOpacity={0.4}
      backdropTransitionOutTiming={0}
      hideModalContentWhileAnimating={true}
      useNativeDriverForBackdrop={true}
      useNativeDriver={true}
      onBackdropPress={onBackdropPress}
      // swipeDirection={'down'}
      // onSwipeComplete={hideModal}
      style={{
        justifyContent: 'flex-end',
        margin: 0,
      }}>
      {children}
    </Modal>
  );
};

export default BottomPopupModal;
