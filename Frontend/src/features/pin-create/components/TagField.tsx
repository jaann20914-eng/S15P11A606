import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { MAX_TAG_COUNT } from '@/types/pinCreate';
import { pinCreateStyles as s } from '../styles';

export interface TagFieldProps {
  tags: string[];
  onAdd: (raw: string) => void;
  onRemove: (tag: string) => void;
}

/** 태그 입력. 최대 개수에 닿으면 입력창을 잠근다. */
export function TagField({ tags, onAdd, onRemove }: TagFieldProps) {
  const [input, setInput] = useState('');
  const full = tags.length >= MAX_TAG_COUNT;

  const submit = () => {
    onAdd(input);
    setInput('');
  };

  return (
    <>
      <Text style={s.label}>
        태그 <Text style={s.subLabel}>(최대 {MAX_TAG_COUNT}개)</Text>
      </Text>

      <View style={s.tags}>
        {tags.map((tag) => (
          <View key={tag} style={s.tag}>
            <Text style={s.tagText}>#{tag}</Text>
            <Pressable accessibilityLabel={`${tag} 태그 삭제`} onPress={() => onRemove(tag)}>
              <Ionicons name="close" size={14} color="#8A9D37" />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={s.tagInputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
          editable={!full}
          placeholder="태그를 입력하세요"
          placeholderTextColor={colors.gray400}
          style={s.tagInput}
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
