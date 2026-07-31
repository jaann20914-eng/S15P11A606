import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { mypageStyles as s } from '../styles';

const COIN_IMAGE = require('../../../../assets/images/credit-reward.png');

export interface CreditBalanceCardProps {
  balance: number;
}

/** 보유 크레딧 카드. 적립 방법을 함께 안내한다. */
export function CreditBalanceCard({ balance }: CreditBalanceCardProps) {
  return (
    <LinearGradient
      colors={['#F6FBD8', '#FBFCDC', '#F2F7BD']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.balanceCard}
    >
      <View style={s.balanceCopy}>
        <Text style={s.balanceLabel}>보유 크레딧</Text>
        <Text style={s.balanceValue}>
          {balance} <Text style={s.unit}>크레딧</Text>
        </Text>
        <Text style={s.balanceHelp}>영상 평가와 채팅 응답으로 적립할 수 있어요.</Text>
      </View>
      <Image source={COIN_IMAGE} style={s.coinImage} />
    </LinearGradient>
  );
}
