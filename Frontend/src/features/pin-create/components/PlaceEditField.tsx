import { Text, View } from 'react-native';
import type { PinDraftPlace } from '@/types/pinCreate';
import { pinCreateStyles as s } from '../styles';

export interface PlaceEditFieldProps {
  place: PinDraftPlace | null;
}

/**
 * 수정 화면의 장소. **보여주기만 하고 고칠 수 없다.**
 *
 * 예전에는 원래 장소 주변의 우리 장소를 목록으로 띄워 옮길 수 있게 했다. 그런데 등록 화면이
 * 쓰는 주변 조회(`GET /places/nearby`)는 카카오 식별자만 주고, 수정 API는 우리 DB의
 * `placeId`만 받는다 — 두 목록이 서로 다른 곳을 보여줄 수밖에 없었고, 같은 자리에서 같은 일을
 * 하는데 화면마다 다른 후보가 뜨는 것이 더 혼란스러웠다(2026-08-07 결정).
 *
 * 그래서 옮기는 기능을 걷어냈다. 장소를 잘못 골랐다면 지우고 다시 올리는 편이 분명하다.
 * 나중에 수정 API가 등록과 같은 카카오 식별자를 받게 되면, 그때 등록 화면의 `PlaceField`를
 * 그대로 가져다 쓰면 된다 — 이 화면만의 목록을 다시 만들 이유는 없다.
 *
 * 누를 수 없으므로 화살표를 두지 않는다. 화살표는 "여기서 더 갈 데가 있다"는 뜻이라, 눌러도
 * 아무 일이 없으면 고장으로 읽힌다.
 */
export function PlaceEditField({ place }: PlaceEditFieldProps) {
  return (
    <>
      <Text style={s.label}>내 위치</Text>

      <View style={s.placeSelected}>
        <Text style={s.placeSelectedText}>{place?.name ?? '장소 없음'}</Text>
      </View>
    </>
  );
}
