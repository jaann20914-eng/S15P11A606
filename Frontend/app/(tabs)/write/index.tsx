import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

export default function WriteEntry() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Ionicons name="videocam-outline" size={32} color={colors.dark} />
        </View>
        <Text style={styles.title}>지금 현장을 알려주세요</Text>
        <Text style={styles.description}>현재 위치에서 직접 촬영한 영상으로 주변 사용자에게 혼잡도를 알려줄 수 있어요.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이 위치에서 제보하기"
          onPress={() => router.push('/pin-create/camera')}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>이 위치에서 제보하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.gutter, paddingBottom: 72 },
  icon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.limeSoft },
  title: { ...type.h2, color: colors.dark, marginTop: spacing.x5 },
  description: { ...type.body, color: colors.gray600, marginTop: spacing.x2, marginBottom: spacing.x8 },
  button: { minHeight: layout.buttonHeight, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime },
  buttonPressed: { backgroundColor: colors.limeActive },
  buttonText: { ...type.body, fontWeight: '600', color: colors.dark },
});
