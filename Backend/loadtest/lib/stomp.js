// 최소 STOMP 1.2 프레임 빌더/파서. (채팅 WebSocket 테스트용)

const NULL_BYTE = String.fromCharCode(0);

export function buildFrame(command, headers = {}, body = '') {
  let frame = command + '\n';
  for (const [key, value] of Object.entries(headers)) {
    frame += `${key}:${value}\n`;
  }
  return frame + '\n' + body + NULL_BYTE;
}

// 하트비트(개행만 오는 메시지)는 null 반환
export function parseFrame(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.replace(/^\n+/, '');
  if (trimmed.length === 0) return null;

  const end = trimmed.indexOf(NULL_BYTE);
  const text = end >= 0 ? trimmed.slice(0, end) : trimmed;
  const headerEnd = text.indexOf('\n\n');
  const head = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  const body = headerEnd >= 0 ? text.slice(headerEnd + 2) : '';

  const lines = head.split('\n');
  const command = lines[0].trim();
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const sep = lines[i].indexOf(':');
    if (sep > 0) headers[lines[i].slice(0, sep)] = lines[i].slice(sep + 1);
  }
  return { command, headers, body };
}
