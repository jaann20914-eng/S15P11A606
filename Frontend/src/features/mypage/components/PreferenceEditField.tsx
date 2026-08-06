import { Text, View } from 'react-native';
import { MAX_PREFERENCES, preferenceCategories, preferenceCategoryLabel } from '@/constants/categories';
import type { PreferenceCategoryCode } from '@/constants/categories';
import { PreferenceCard } from '@/features/onboarding/components/PreferenceCard';
import { preferenceCategoryImages } from '@/features/onboarding/preferenceAssets';
import { mypageStyles as s } from '../styles';

export interface PreferenceEditFieldProps {
  /** 지금 고른 것. 배열 순서가 곧 순위다. */
  selected: PreferenceCategoryCode[];
  /** 읽기만 하는 상태인지. 수정하기를 누르기 전에는 고른 것을 보여주기만 한다. */
  readOnly?: boolean;
  onToggle: (code: PreferenceCategoryCode) => void;
}

/**
 * 관심 장소 고르기.
 *
 * 카드는 온보딩과 **같은 컴포넌트**를 쓴다(`features/onboarding/components/PreferenceCard`).
 * 처음 고를 때와 나중에 고칠 때의 모양이 갈리면 같은 선택으로 읽히지 않는다.
 *
 * 순위는 고른 순서로 정해진다. 색만으로는 몇 순위인지 알 수 없어 위에 문장으로 되짚어 준다.
 */
export function PreferenceEditField({ selected, readOnly = false, onToggle }: PreferenceEditFieldProps) {
  return (
    <View style={s.sectionGap}>
      <Text style={s.editSectionTitle}>선호 지역</Text>
      <Text style={s.editSectionDescription}>입력하는 순서대로 순위가 결정돼요.</Text>

      <Text style={s.rankHint}>
        {selected.length === 0
          ? `먼저 고른 순서대로 1~${MAX_PREFERENCES}순위가 정해져요`
          : selected.map((code, index) => `${index + 1}순위 ${preferenceCategoryLabel(code)}`).join('   ')}
      </Text>

      <View pointerEvents={readOnly ? 'none' : 'auto'} style={s.preferenceGrid}>
        {preferenceCategories.map(({ code, label }) => {
          const isSelected = selected.includes(code);

          return (
            <View key={code} style={s.preferenceCell}>
              <PreferenceCard
                label={label}
                selected={isSelected}
                image={preferenceCategoryImages[code]}
                /*
                  읽기 상태에서는 아무것도 눌리지 않는다. 다만 흐려 보이게 하지는 않는다
                  (`PreferenceCard`의 `disabled`는 반투명으로 그린다) — 지금 고른 것을
                  또렷하게 보여주는 자리라서다. 그래서 잠금은 `pointerEvents`로 건다.

                  고르는 중에는 이미 고른 카드가 언제나 눌린다 — 그래야 바꿔 고를 수 있다.
                */
                disabled={!readOnly && !isSelected && selected.length >= MAX_PREFERENCES}
                onPress={() => onToggle(code)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
