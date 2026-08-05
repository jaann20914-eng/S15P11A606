import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { MAX_TAG_COUNT, MAX_TAG_LENGTH } from '@/types/pinCreate';
import { countGraphemes, truncateGraphemes } from '@/utils/graphemes';
import { pinCreateStyles as s } from '../styles';

export interface TagFieldProps {
  tags: string[];
  onAdd: (raw: string) => void;
  onRemove: (tag: string) => void;
  /** 키보드가 이 칸을 가리지 않도록 화면이 스크롤을 맞출 때 쓴다. */
  onFocus?: () => void;
}

/** 태그 입력. 최대 개수에 닿으면 입력창을, 최대 길이에 닿으면 글자 입력을 잠근다. */
export function TagField({ tags, onAdd, onRemove, onFocus }: TagFieldProps) {
  const [input, setInput] = useState('');
  const full = tags.length >= MAX_TAG_COUNT;

  // 길이가 가득 찼는지. 테두리와 안내 문구를 켜고, 네이티브 입력을 잠그는 기준이다(메모와 같은 방식).
  const atLimit = countGraphemes(input) >= MAX_TAG_LENGTH;

  const submit = () => {
    onAdd(input);
    setInput('');
  };

  return (
    <>
      <Text style={s.label}>
        태그 <Text style={s.subLabel}>(선택 · 최대 {MAX_TAG_COUNT}개)</Text>
      </Text>

      <View style={s.tags}>
        {tags.map((tag) => (
          <View key={tag} style={s.tag}>
            {/*
              긴 태그는 줄임표로 접는다(최대 30자까지 들어온다). 그대로 두면 알약이 줄을
              넘어가며 배치가 깨졌다. 전체 내용은 상세 화면이 보여준다 — 여기는 지울 것을
              고르는 자리라 어느 태그인지 알아볼 만큼이면 된다. 삭제 버튼은 접히지 않는다.
            */}
            <Text numberOfLines={1} style={s.tagText}>
              #{tag}
            </Text>
            <Pressable
              accessibilityLabel={`${tag} 태그 삭제`}
              onPress={() => onRemove(tag)}
              // 삭제 버튼은 접히지 않고, 아이콘이 작아 눌리는 영역을 넓힌다.
              style={s.tagRemove}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color="#8A9D37" />
            </Pressable>
          </View>
        ))}
      </View>

      {/*
        길이 한도 안내. 가득 찼을 때만 글자를 보여주고 줄 자체는 늘 자리를 잡아 둔다 —
        줄이 끼어들었다 빠지면 입력칸이 오르내린다(메모의 안내 문구와 같은 이유).
      */}
      <Text style={s.tagLimitNotice}>{atLimit ? `최대 ${MAX_TAG_LENGTH}자까지 입력할 수 있어요` : ' '}</Text>

      <View style={s.tagInputRow}>
        <TextInput
          value={input}
          // 붙여넣기 초과분을 위한 안전망. 평소 입력은 아래 maxLength가 먼저 막는다.
          onChangeText={(text) => setInput(truncateGraphemes(text, MAX_TAG_LENGTH))}
          onSubmitEditing={submit}
          onFocus={onFocus}
          editable={!full}
          placeholder="태그를 입력하세요"
          placeholderTextColor={colors.gray400}
          /*
            가득 찼으면 네이티브가 입력을 막는다(지우기·바꾸기는 된다). 잘라내서 되돌리면
            초과 글자가 들어왔다 지워지는 왕복이 생긴다 — 메모 입력(`MemoField`)과 같은 방식.
          */
          maxLength={atLimit ? input.length : undefined}
          style={[s.tagInput, atLimit && s.tagInputAtLimit]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={full}
          style={[s.addButton, full && s.disabled]}
        >
          <Text style={s.addText}>입력</Text>
        </Pressable>
      </View>
    </>
  );
}
