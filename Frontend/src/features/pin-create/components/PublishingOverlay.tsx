import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoView } from 'expo-video';
import { useAutoplayVideo } from '@/hooks/useAutoplayVideo';
import { warmedVideoSource } from '@/utils/videoWarmup';
import type { VideoUploadPhase } from '@/types/pinCreate';
import { pinCreateStyles as s } from '../styles';
import { AiLoadingCircle } from './AiLoadingCircle';

/** 배경에 깔리는 파스텔 구체. 소리 없이 계속 돈다. */
const BACKDROP = require('../../../../assets/videos/publishing-backdrop.mp4');

export interface PublishingOverlayProps {
  phase: VideoUploadPhase;
  /** 업로드 진행률 0~1. `uploading` 단계에서만 표시한다. */
  progress: number;
  /** 업로드를 중단한다. 등록 요청까지 간 뒤에는 되돌릴 수 없어 숨긴다. */
  onCancel: () => void;
}

/** 링 안에 들어갈 문구. 무게를 달리해 읽는 순서를 만든다. */
interface PhaseMessage {
  /** 본문 앞머리. 없으면 본문만 보여준다. */
  lead?: string;
  main: string;
  /** 알아 둬야 할 것. 가장 작게 쓴다. */
  note?: string;
}

/**
 * 단계별 안내. 지금 무엇을 기다리는지 알 수 있어야 한다.
 *
 * 다른 화면으로 이동해도 업로드는 계속된다. 앱을 종료할 때만 중단되므로 그렇게 안내한다.
 */
const messageByPhase: Record<VideoUploadPhase, PhaseMessage> = {
  idle: { main: '' },
  issuing: { main: '업로드를 준비하고 있어요' },
  uploading: { main: '영상을 올리고 있어요', note: '다른 화면으로 이동해도\n계속 올라가요' },
  registering: { main: '등록을 접수하고 있어요' },
  processing: {
    lead: 'AI를 이용하여',
    main: '블러 처리 중입니다',
    note: '앱을 종료하면 업로드가\n중단될 수 있습니다',
  },
  done: { main: '처리가 끝났어요' },
};

/**
 * 등록 진행 화면.
 *
 * 발급 → 업로드 → 등록을 거치는 동안 이 화면에 머문다. 업로드 중에는 퍼센트를 보여주고
 * 중단할 수 있게 한다. 등록 요청을 보낸 뒤에는 서버에 이미 접수되었을 수 있어 취소를 막는다.
 *
 * 배경은 천천히 도는 파스텔 구체 영상이다. AI 처리까지 수십 초를 기다리는 화면이라 완전히
 * 멈춰 있으면 앱이 멈춘 것처럼 읽힌다.
 */
export function PublishingOverlay({ phase, progress, onCancel }: PublishingOverlayProps) {
  const backdrop = useAutoplayVideo(warmedVideoSource(BACKDROP), { loop: true, muted: true });
  const uploading = phase === 'uploading';
  const message = messageByPhase[phase];

  return (
    <View style={s.publishing}>
      <VideoView
        player={backdrop}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        pointerEvents="none"
      />

      <AiLoadingCircle>
        {message.lead !== undefined && <Text style={s.publishingLead}>{message.lead}</Text>}
        <Text style={s.publishingText}>{message.main}</Text>
        {uploading && <Text style={s.publishingProgress}>{Math.round(progress * 100)}%</Text>}
        {message.note !== undefined && <Text style={s.publishingNote}>{message.note}</Text>}
      </AiLoadingCircle>

      {(phase === 'issuing' || uploading) && (
        <Pressable accessibilityRole="button" onPress={onCancel} style={s.publishingCancel}>
          <Text style={s.publishingCancelText}>취소</Text>
        </Pressable>
      )}
    </View>
  );
}
