import React, { useRef, useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 후면 카메라 우선
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolution, setResolution] = useState('');
  const [envInfo, setEnvInfo] = useState({
    gum: null,
    https: null,
    mobile: null,
  });

  // 환경 체크
  useEffect(() => {
    setEnvInfo({
      gum: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      https:
        location.protocol === 'https:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1',
      mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    });
  }, []);

  // 카메라 시작
  const startCamera = useCallback(async (mode) => {
    setLoading(true);
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      videoRef.current.onloadedmetadata = () => {
        const w = videoRef.current.videoWidth;
        const h = videoRef.current.videoHeight;
        setResolution(`${w} × ${h}`);
      };

      setIsStreaming(true);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setIsStreaming(false);

      if (err.name === 'NotAllowedError') {
        setError('카메라 권한이 거부됐어요. 브라우저 설정에서 카메라 권한을 허용해주세요.');
      } else if (err.name === 'NotFoundError') {
        setError('카메라를 찾을 수 없어요. 기기에 카메라가 연결돼 있는지 확인해주세요.');
      } else if (err.name === 'NotReadableError') {
        setError('카메라가 이미 다른 앱에서 사용 중이에요. 다른 앱을 닫고 다시 시도해주세요.');
      } else {
        setError(`카메라 오류: ${err.message}`);
      }
    }
  }, []);

  // 카메라 끄기
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setResolution('');
    setSnapshot(null);
  }, []);

  // 카메라 토글
  const handleToggle = () => {
    if (isStreaming) {
      stopCamera();
    } else {
      startCamera(facingMode);
    }
  };

  // 카메라 전환 (전면 ↔ 후면)
  const handleFlip = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    stopCamera();
    await startCamera(newMode);
  };

  // 스냅샷
  const handleSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setSnapshot(dataUrl);
  };

  // 스냅샷 다운로드
  const handleDownload = () => {
    if (!snapshot) return;
    const a = document.createElement('a');
    a.href = snapshot;
    a.download = `viewreal_${Date.now()}.jpg`;
    a.click();
  };

  // 언마운트 시 카메라 정리
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="app">
      {/* 헤더 */}
      <header className="header">
        <div className="logo">
          View<span>Real</span>
        </div>
        <div className="badge">카메라 테스트</div>
      </header>

      {/* 비디오 영역 */}
      <div className="video-wrap">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`video ${isStreaming ? 'visible' : ''}`}
        />

        {/* 카메라 꺼진 상태 */}
        {!isStreaming && (
          <div className="placeholder">
            <div className="cam-icon">📷</div>
            <p>{loading ? '카메라 연결 중...' : '카메라 시작 버튼을 눌러주세요'}</p>
          </div>
        )}

        {/* 스트리밍 중 오버레이 */}
        {isStreaming && (
          <>
            <div className="status-badge">
              <span className="dot" />
              카메라 작동 중
            </div>
            <div className="cam-label">
              {facingMode === 'environment' ? '후면 카메라 🔍' : '전면 카메라 🤳'}
            </div>
            {resolution && <div className="resolution">{resolution}</div>}
          </>
        )}

        {/* 스냅샷 미리보기 */}
        {snapshot && isStreaming && (
          <button className="snapshot-preview" onClick={handleDownload}>
            <img src={snapshot} alt="스냅샷" />
          </button>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 컨트롤 */}
      <div className="controls">
        {/* 메인 버튼 */}
        <button
          className={`btn-main ${isStreaming ? 'stop' : 'start'}`}
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? '⏳ 연결 중...' : isStreaming ? '⏹ 카메라 끄기' : '📷 카메라 시작'}
        </button>

        {/* 보조 버튼 */}
        <div className="btn-row">
          <button
            className="btn-secondary"
            onClick={handleFlip}
            disabled={!isStreaming || loading}
          >
            🔄 카메라 전환
          </button>
          <button
            className="btn-secondary"
            onClick={handleSnapshot}
            disabled={!isStreaming}
          >
            📸 스냅샷
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && <div className="error-box">❌ {error}</div>}

        {/* 디바이스 정보 카드 */}
        <div className="info-card">
          <p className="info-title">디바이스 정보</p>
          <div className="info-rows">
            <InfoRow
              label="getUserMedia 지원"
              value={envInfo.gum === null ? '확인 중...' : envInfo.gum ? '지원됨 ✓' : '미지원 ✗'}
              status={envInfo.gum === null ? 'pending' : envInfo.gum ? 'ok' : 'err'}
            />
            <InfoRow
              label="현재 카메라"
              value={isStreaming ? (facingMode === 'environment' ? '후면' : '전면') : '-'}
              status={isStreaming ? 'ok' : 'pending'}
            />
            <InfoRow
              label="해상도"
              value={resolution || '-'}
              status={resolution ? 'ok' : 'pending'}
            />
            <InfoRow
              label="HTTPS 환경"
              value={envInfo.https === null ? '확인 중...' : envInfo.https ? '안전 ✓' : 'HTTP (카메라 제한)'}
              status={envInfo.https === null ? 'pending' : envInfo.https ? 'ok' : 'err'}
            />
            <InfoRow
              label="모바일 기기"
              value={envInfo.mobile === null ? '확인 중...' : envInfo.mobile ? '모바일 ✓' : 'PC'}
              status={envInfo.mobile === null ? 'pending' : envInfo.mobile ? 'ok' : 'pending'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// InfoRow 컴포넌트
function InfoRow({ label, value, status }) {
  return (
    <div className="info-row">
      <span className="info-key">{label}</span>
      <span className={`info-val ${status}`}>{value}</span>
    </div>
  );
}

export default App;
