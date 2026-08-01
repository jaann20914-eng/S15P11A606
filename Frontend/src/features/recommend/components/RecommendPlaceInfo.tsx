import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { BusinessStatus, RecommendedPlace } from '@/types/recommend';
import { recommendStyles as s } from '../styles';

export interface RecommendPlaceInfoProps {
  place: RecommendedPlace;
}

/** 영업 상태 배지 문구. `UNKNOWN`은 알 수 없다는 뜻이라 배지를 아예 그리지 않는다. */
const statusLabel: Record<BusinessStatus, string | null> = {
  OPEN: '영업중',
  CLOSED: '영업 종료',
  UNKNOWN: null,
};

/** 기본정보 — 이름·영업 상태·주소·연락처. 값이 없는 줄은 그리지 않는다. */
export function RecommendPlaceInfo({ place }: RecommendPlaceInfoProps) {
  const badge = statusLabel[place.businessStatus];

  return (
    <View style={s.infoCard}>
      <View style={s.infoHead}>
        <Text style={s.infoName}>{place.name}</Text>
        {badge !== null && (
          <View style={[s.statusBadge, place.businessStatus === 'CLOSED' && s.statusBadgeClosed]}>
            <Text style={s.statusText}>{badge}</Text>
          </View>
        )}
      </View>

      {/*
        영업시간 문구는 `영업중 · 오후 10:00까지`처럼 상태까지 붙어서 온다. 확인할 수 없으면
        서버가 null을 주고, 그때는 배지도 `UNKNOWN`이라 이 줄만 빠진다.
      */}
      {place.businessHoursText !== null && (
        <View style={s.infoRow}>
          <Ionicons name="time-outline" size={16} color={colors.gray400} />
          <Text style={s.infoText}>{place.businessHoursText}</Text>
        </View>
      )}

      <View style={s.infoRow}>
        <Ionicons name="location-outline" size={16} color={colors.gray400} />
        <Text style={s.infoText}>{place.address}</Text>
      </View>

      {/* 연락처는 받을 곳이 없는 장소(공원·산책로)도 있어 선택 값이다. */}
      {place.phone != null && place.phone !== '' && (
        <View style={s.infoRow}>
          <Ionicons name="call-outline" size={16} color={colors.gray400} />
          <Text style={s.infoText}>{place.phone}</Text>
        </View>
      )}
    </View>
  );
}
