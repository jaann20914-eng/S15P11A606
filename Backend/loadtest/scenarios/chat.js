// 채팅 부하테스트 — STOMP over WebSocket
//
// VU마다 (요청자 계정으로):
//   1) REST GET /api/v1/chat/rooms 로 자기 채팅방 확인 (VU당 최초 1회)
//   2) WS 연결 → STOMP CONNECT (Authorization 헤더) → 방 토픽 SUBSCRIBE
//   3) /app/chat/rooms/{roomId}/messages 로 메시지 N개 전송
//   4) 자기 브로드캐스트 수신을 확인하며 왕복 지연(chat_message_rtt) 측정
//
// 사전 준비: psql -f seed/seed.sql  (ACTIVE 채팅방이 회원당 1개 시드됨)
// 실행: k6 run -e BASE_URL=... -e JWT_SECRET=... scenarios/chat.js
//   -e MESSAGES=10       세션당 전송 메시지 수
//   -e SEND_INTERVAL=500 전송 간격(ms)
//
// k6 v0.48+ 필요 (k6/experimental/websockets)

import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { WebSocket } from 'k6/websockets';
import {
  BASE_URL, WS_URL, jsonParams, requesterId, uuid,
} from '../lib/config.js';
import { mintAccessToken } from '../lib/jwt.js';
import { buildFrame, parseFrame } from '../lib/stomp.js';

const messageRtt = new Trend('chat_message_rtt', true);
const delivered = new Rate('chat_message_delivered');
const stompErrors = new Counter('chat_stomp_errors');
const connectOk = new Rate('chat_connect_ok');

const MESSAGES = Number(__ENV.MESSAGES || 10);
const SEND_INTERVAL = Number(__ENV.SEND_INTERVAL || 500);
const SESSION_TIMEOUT_MS = 30000;

export const options = {
  scenarios: {
    chat: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.VUS || 30) },
        { duration: __ENV.DURATION || '2m', target: Number(__ENV.VUS || 30) },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    chat_message_rtt: ['p(95)<300'],
    chat_message_delivered: ['rate>0.99'],
    chat_connect_ok: ['rate>0.99'],
  },
};

let token = null;
let roomId = null;

export default function () {
  if (token === null) token = mintAccessToken(requesterId(__VU));

  // VU당 최초 1회: 내 채팅방 조회 (REST도 함께 가볍게 부하)
  if (roomId === null) {
    const res = http.get(
      `${BASE_URL}/api/v1/chat/rooms?limit=5`,
      { ...jsonParams(token), tags: { name: 'chat_rooms_list' } },
    );
    check(res, { '채팅방 목록 200': (r) => r.status === 200 });
    const items = res.status === 200 ? (res.json('data.items') || []) : [];
    if (items.length === 0) {
      fail(`VU ${__VU} (member ${requesterId(__VU)}) 의 채팅방이 없습니다. seed/seed.sql 을 실행했는지, MEMBERS(${__ENV.MEMBERS || 100}) <= 시드 개수인지 확인하세요.`);
    }
    roomId = items[0].roomId;
  }

  const ws = new WebSocket(WS_URL, ['v12.stomp']);
  const pendingSends = new Map(); // nonce -> 전송 시각
  let sentCount = 0;
  let ackedCount = 0;
  let sendTimer = null;
  let connected = false;

  function shutdown() {
    if (sendTimer !== null) { clearInterval(sendTimer); sendTimer = null; }
    try { ws.send(buildFrame('DISCONNECT', {})); } catch (e) { /* 이미 닫힘 */ }
    ws.close();
  }

  const watchdog = setTimeout(() => {
    stompErrors.add(1);
    shutdown();
  }, SESSION_TIMEOUT_MS);

  ws.onopen = () => {
    ws.send(buildFrame('CONNECT', {
      'accept-version': '1.2',
      host: '/',
      'heart-beat': '0,0',
      Authorization: `Bearer ${token}`,
    }));
  };

  ws.onmessage = (event) => {
    const frame = parseFrame(event.data);
    if (!frame) return; // 하트비트

    if (frame.command === 'CONNECTED') {
      connected = true;
      connectOk.add(true);
      ws.send(buildFrame('SUBSCRIBE', {
        id: `sub-room-${__VU}`,
        destination: `/topic/chat/rooms/${roomId}`,
      }));

      sendTimer = setInterval(() => {
        if (sentCount >= MESSAGES) { clearInterval(sendTimer); sendTimer = null; return; }
        const nonce = uuid();
        pendingSends.set(nonce, Date.now());
        ws.send(buildFrame(
          'SEND',
          {
            destination: `/app/chat/rooms/${roomId}/messages`,
            'content-type': 'application/json',
          },
          JSON.stringify({ content: `load-${nonce}`, client_message_id: uuid() }),
        ));
        sentCount++;
      }, SEND_INTERVAL);
      return;
    }

    if (frame.command === 'MESSAGE') {
      let payload;
      try { payload = JSON.parse(frame.body); } catch (e) { return; }
      if (payload.eventType !== 'MESSAGE_CREATED') return;

      const match = /^load-([0-9a-f-]{36})$/.exec(payload.data && payload.data.content);
      if (match && pendingSends.has(match[1])) {
        messageRtt.add(Date.now() - pendingSends.get(match[1]));
        delivered.add(true);
        pendingSends.delete(match[1]);
        ackedCount++;
        if (ackedCount >= MESSAGES) {
          clearTimeout(watchdog);
          shutdown();
        }
      }
      return;
    }

    if (frame.command === 'ERROR') {
      stompErrors.add(1);
      clearTimeout(watchdog);
      shutdown();
    }
  };

  ws.onclose = () => {
    clearTimeout(watchdog);
    if (!connected) connectOk.add(false);
    for (const _ of pendingSends) delivered.add(false); // 미수신분은 유실로 집계
  };

  ws.onerror = () => {
    stompErrors.add(1);
  };
}
