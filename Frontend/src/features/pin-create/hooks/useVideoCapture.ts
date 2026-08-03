import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
  type CameraView,
} from 'expo-camera';
import { MAX_VIDEO_SECONDS } from '@/types/pinCreate';
import type { PinDraftVideo } from '@/types/pinCreate';
import { readCurrentCoordinate } from '@/utils/location';

export type CaptureState = 'idle' | 'recording' | 'done';

export interface VideoCapture {
  /** `CameraView`에 연결할 ref. */
  cameraRef: React.RefObject<CameraView | null>;
  state: CaptureState;
  /** 전면 · 후면. */
  facing: CameraType;
  /** 녹화 경과 시간(초). 타이머 표시에 쓴다. */
  elapsedSeconds: number;
  /** 카메라와 마이크 권한이 모두 허용됐는지. */
  ready: boolean;
  /** 권한이 거부됐을 때 안내할 문구. 문제가 없으면 null. */
  permissionMessage: string | null;
  /** 권한을 요청한다. 화면 진입 시 한 번 부른다. */
  requestPermissions: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  toggleFacing: () => void;
  /** 촬영 결과를 버리고 처음으로 되돌린다. */
  retake: () => void;
}

/**
 * 기기 카메라로 짧은 영상을 녹화한다.
 *
 * 최대 길이는 `MAX_VIDEO_SECONDS`이고 그 시간이 되면 카메라가 스스로 멈춘다.
 * 타이머는 화면 표시용이며 정지 판단은 `recordAsync`의 `maxDuration`이 한다.
 * 소리를 함께 담으므로 카메라와 마이크 권한이 둘 다 필요하다.
 */
export function useVideoCapture(onCaptured: (video: PinDraftVideo | null) => void): VideoCapture {
  const cameraRef = useRef<CameraView | null>(null);
  const [state, setState] = useState<CaptureState>('idle');
  const [facing, setFacing] = useState<CameraType>('back');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  /** 녹화를 멈춘 뒤 도착한 결과가 새 녹화를 덮지 않도록 확인한다. */
  const recordingId = useRef(0);

  useEffect(
    () => () => {
      recordingId.current += 1;
      cameraRef.current?.stopRecording();
      onCaptured(null);
    },
    [onCaptured],
  );

  // 화면 표시용 경과 시간. 실제 정지는 maxDuration이 담당한다.
  useEffect(() => {
    if (state !== 'recording') return;

    setElapsedSeconds(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(Math.min(seconds, MAX_VIDEO_SECONDS));
    }, 250);

    return () => clearInterval(timer);
  }, [state]);

  const requestPermissions = useCallback(() => {
    if (!cameraPermission?.granted) void requestCameraPermission();
    if (!microphonePermission?.granted) void requestMicrophonePermission();
  }, [
    cameraPermission?.granted,
    microphonePermission?.granted,
    requestCameraPermission,
    requestMicrophonePermission,
  ]);

  const startRecording = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera || state === 'recording') return;

    const id = recordingId.current + 1;
    recordingId.current = id;

    setState('recording');
    onCaptured(null);

    /*
      찍는 동안 위치를 함께 읽는다.

      등록 요청의 촬영 좌표가 이 값이다. 나중에(등록 직전에) 읽어도 되지만, 그사이 사용자가
      자리를 옮기면 "찍은 자리"가 아니게 된다. 서버가 장소와 50m 이내인지 검증하므로 이
      차이가 등록 성공 여부를 가른다.

      실패해도 촬영은 그대로 끝낸다. 좌표는 등록 직전에 다시 시도한다.
    */
    const coordinate = readCurrentCoordinate().then((result) =>
      'coordinate' in result ? result.coordinate : null,
    );

    camera
      .recordAsync({ maxDuration: MAX_VIDEO_SECONDS })
      .then(async (result) => {
        if (recordingId.current !== id) return;

        setState(result?.uri ? 'done' : 'idle');
        if (result?.uri) {
          onCaptured({
            uri: result.uri,
            durationSeconds: MAX_VIDEO_SECONDS,
            coordinate: await coordinate,
          });
        }
      })
      .catch(() => {
        if (recordingId.current !== id) return;
        setState('idle');
        onCaptured(null);
      });
  }, [state, onCaptured]);

  /**
   * 사용자가 5초 전에 끊는 경우.
   * `stopRecording`은 `recordAsync`를 완료시키므로 결과 처리는 그쪽에서 이어진다.
   */
  const stopRecording = useCallback(() => {
    if (state !== 'recording') return;
    cameraRef.current?.stopRecording();
  }, [state]);

  const retake = useCallback(() => {
    recordingId.current += 1;
    setState('idle');
    setElapsedSeconds(0);
    onCaptured(null);
  }, [onCaptured]);

  const toggleFacing = useCallback(() => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const cameraDenied = cameraPermission !== null && !cameraPermission.granted;
  const microphoneDenied = microphonePermission !== null && !microphonePermission.granted;

  return {
    cameraRef,
    state,
    facing,
    elapsedSeconds,
    ready: Boolean(cameraPermission?.granted && microphonePermission?.granted),
    permissionMessage: cameraDenied
      ? '카메라 권한이 필요해요. 설정에서 허용해 주세요.'
      : microphoneDenied
        ? '현장 소리를 담으려면 마이크 권한이 필요해요.'
        : null,
    requestPermissions,
    startRecording,
    stopRecording,
    toggleFacing,
    retake,
  };
}
