# WebRTC 원리

## 1. WebRTC란?

WebRTC는 브라우저나 앱 사이에서 실시간 음성, 영상, 데이터를 주고받기 위한 기술이다.

대표적으로 다음 기능에 사용한다.

- 화상 통화
- 음성 통화
- 화면 공유
- 실시간 데이터 전송
- 원격 상담

핵심은 가능하면 브라우저끼리 직접 연결하는 것이다.

```text
브라우저 A ⇄ 브라우저 B
```

다만 두 브라우저가 처음부터 서로의 연결 정보를 알 수는 없다.  
그래서 백엔드가 중간에서 연결 정보를 교환해준다. 이를 **시그널링**이라 한다.

---

## 2. WebSocket과 WebRTC의 차이

두 기술은 역할이 다르다.

```text
WebSocket
→ 클라이언트와 서버 사이의 실시간 메시지 통신

WebRTC
→ 클라이언트와 클라이언트 사이의 실시간 미디어 통신
```

화상 통화에서는 보통 다음처럼 함께 사용한다.

```text
WebSocket
→ SDP, ICE Candidate 교환

WebRTC
→ 실제 음성, 영상 전송
```

즉 WebSocket은 연결을 협상하는 통로이고, WebRTC는 실제 미디어가 흐르는 통로다.

---

## 3. 백엔드가 필요한 이유

브라우저 A와 B는 연결 전에 다음 정보를 서로 알아야 한다.

- 어떤 코덱을 사용할지
- 오디오와 비디오를 사용할지
- 어떤 IP와 포트로 연결할지
- NAT 환경에서 어떤 경로를 사용할지
- 누가 먼저 연결을 제안했는지

이 정보를 전달하는 서버를 **시그널링 서버**라 한다.

```text
브라우저 A
   │
   │ 연결 정보
   ▼
시그널링 서버
   │
   │ 연결 정보
   ▼
브라우저 B
```

시그널링이 끝나면 실제 미디어는 가능하면 브라우저끼리 직접 전달한다.

---

## 4. 시그널링 서버가 전달하는 정보

시그널링 서버는 보통 다음 이벤트를 전달한다.

```text
JOIN
LEAVE
OFFER
ANSWER
ICE_CANDIDATE
CALL_ACCEPT
CALL_REJECT
```

WebRTC 표준은 시그널링 방식을 정하지 않는다.

따라서 다음 중 하나를 직접 선택한다.

- WebSocket
- STOMP
- Socket.IO
- HTTP
- 메시지 브로커

실시간 양방향 통신이 필요하므로 WebSocket을 많이 사용한다.

---

## 5. SDP란?

SDP는 Session Description Protocol의 약자다.

통신에 사용할 미디어 조건을 설명하는 문자열이다.

SDP에는 다음 내용이 포함될 수 있다.

- 오디오 사용 여부
- 비디오 사용 여부
- 지원 코덱
- 미디어 전송 방향
- 네트워크 정보
- 암호화 정보

백엔드는 일반적으로 SDP를 직접 생성하거나 해석하지 않는다.

```text
브라우저
→ SDP 생성

백엔드
→ SDP를 상대 브라우저에게 전달
```

---

## 6. Offer와 Answer

한쪽 브라우저가 먼저 연결 조건을 제안한다. 이를 **Offer**라 한다.

상대방이 이에 응답하는 SDP를 **Answer**라 한다.

```text
브라우저 A
→ Offer 생성
→ 서버를 통해 B에게 전달

브라우저 B
→ Offer 적용
→ Answer 생성
→ 서버를 통해 A에게 전달

브라우저 A
→ Answer 적용
```

브라우저 내부 흐름은 다음과 같다.

```text
A: createOffer()
A: setLocalDescription(offer)

B: setRemoteDescription(offer)
B: createAnswer()
B: setLocalDescription(answer)

A: setRemoteDescription(answer)
```

백엔드는 Offer와 Answer를 올바른 대상에게 전달한다.

---

## 7. ICE Candidate란?

ICE Candidate는 상대방과 연결할 수 있는 네트워크 경로 후보다.

후보에는 다음 정보가 포함될 수 있다.

- 로컬 IP
- 공인 IP
- 포트
- 전송 프로토콜
- TURN 중계 주소

브라우저는 후보를 찾을 때마다 시그널링 서버로 전송한다.

```text
브라우저 A
→ ICE Candidate
→ 시그널링 서버
→ 브라우저 B
```

상대 브라우저는 받은 후보를 연결 객체에 추가한다.

```javascript
peerConnection.addIceCandidate(candidate);
```

---

## 8. ICE란?

ICE는 Interactive Connectivity Establishment의 약자다.

두 피어 사이에서 실제로 연결 가능한 네트워크 경로를 찾는 절차다.

브라우저는 여러 후보를 수집한다.

```text
로컬 주소
공인 주소
TURN 중계 주소
```

그 뒤 연결 검사를 수행하고 실제로 통신 가능한 경로를 선택한다.

---

## 9. NAT 문제

대부분의 사용자는 사설 IP를 사용한다.

```text
192.168.0.10
```

이 주소는 외부 인터넷에서 직접 접근할 수 없다.

공유기나 라우터가 내부 사설 IP를 공인 IP로 변환한다. 이를 NAT라 한다.

```text
사설 IP
→ NAT
→ 공인 IP
```

WebRTC는 상대방이 실제로 접근 가능한 주소를 찾아야 한다.

이를 위해 STUN과 TURN을 사용한다.

---

## 10. STUN 서버

STUN 서버는 클라이언트가 외부에서 보이는 자신의 공인 IP와 포트를 확인하도록 도와준다.

```text
브라우저
→ STUN 서버에 요청

STUN 서버
→ 외부에서 보이는 IP와 포트 응답
```

STUN은 미디어를 중계하지 않는다.

```text
STUN
→ 주소 확인만 수행
```

## 11. TURN 서버

STUN으로 직접 연결하지 못하는 경우 TURN 서버를 사용한다.

예를 들면 다음과 같다.

- 강한 방화벽
- 대칭형 NAT
- 기업망
- 특정 포트 차단
- 직접 연결 정책 제한

TURN 서버는 실제 미디어를 중계한다.

```text
브라우저 A
→ TURN 서버
→ 브라우저 B
```

따라서 STUN보다 네트워크 비용이 크다.

```text
STUN
→ 주소 확인
→ 비용이 적음

TURN
→ 음성·영상 중계
→ 비용이 큼
```

실제 서비스에서는 STUN과 TURN을 함께 설정하는 경우가 많다.

---

## 12. 전체 연결 흐름

```text
1. 브라우저 A와 B가 시그널링 서버에 연결
2. 두 사용자가 같은 통화방에 입장
3. A가 Offer SDP 생성
4. A → 서버 → B로 Offer 전달
5. B가 Answer SDP 생성
6. B → 서버 → A로 Answer 전달
7. A와 B가 ICE Candidate 수집
8. 서버를 통해 Candidate 교환
9. ICE 연결 검사
10. 직접 연결 또는 TURN 경로 선택
11. WebRTC 연결 성립
12. 음성·영상 전송 시작
```

---

## 13. 시그널링 메시지 예시

Offer 메시지는 다음처럼 만들 수 있다.

```json
{
  "type": "OFFER",
  "roomId": 1,
  "targetId": 20,
  "sdp": "..."
}
```

ICE Candidate 메시지는 다음처럼 만들 수 있다.

```json
{
  "type": "ICE_CANDIDATE",
  "roomId": 1,
  "targetId": 20,
  "candidate": {
    "candidate": "...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

`senderId`는 요청 body의 값을 그대로 믿지 않고 인증된 사용자 정보에서 가져오는 것이 안전하다.

---

## 14. Spring WebSocket 시그널링 예시

클라이언트가 다음 destination으로 시그널링 메시지를 보낸다고 가정한다.

```text
/app/webrtc/rooms/{roomId}/signal
```

서버는 다음과 같이 받을 수 있다.

```java
@MessageMapping("/webrtc/rooms/{roomId}/signal")
public void signal(
        @DestinationVariable Long roomId,
        WebRtcSignalRequest request,
        Principal principal
) {
    signalingService.relay(
            roomId,
            principal,
            request
    );
}
```

서버가 하는 핵심 작업은 다음과 같다.

```text
1. 보낸 사용자 인증
2. 방 참여 여부 검증
3. targetId 검증
4. Offer, Answer, Candidate 전달
```

---

## 15. 대상 사용자 지정

1대1 통화에서는 Offer와 Answer를 상대방 한 명에게만 보내야 한다.

```text
roomId
senderId
targetId
type
```

방 전체에 SDP를 브로드캐스트하면 다른 참여자가 잘못 처리할 수 있다.

백엔드는 다음을 확인해야 한다.

```text
sender가 실제 로그인 사용자인가?
sender와 target이 같은 방 참여자인가?
해당 방에서 통화가 허용되는가?
```

---

## 16. WebSocket 상태와 WebRTC 상태

두 연결 상태는 서로 다르다.

```text
WebSocket 연결 상태
≠
WebRTC 연결 상태
```

WebSocket이 연결되어 있어도 WebRTC 연결은 실패할 수 있다.

반대로 WebRTC 연결이 잠시 유지되는 동안 시그널링 WebSocket이 끊길 수도 있다.

따라서 상태를 구분해서 관리해야 한다.

```text
WebSocket
→ CONNECTED, DISCONNECTED

WebRTC
→ NEW, CONNECTING, CONNECTED, FAILED, CLOSED
```

---

## 17. 서버가 여러 대일 때

사용자 A와 B가 서로 다른 서버에 연결될 수 있다.

```text
사용자 A → 서버 1
사용자 B → 서버 2
```

이때 서버 1이 받은 Offer를 서버 2로 전달해야 한다.

다음 기술을 사용할 수 있다.

- Redis Pub/Sub
- RabbitMQ
- Kafka

구조는 다음과 같다.

```text
사용자 A
→ 서버 1
→ 메시지 브로커
→ 서버 2
→ 사용자 B
```

실제 영상은 여전히 브라우저끼리 직접 전달하거나 TURN 서버를 거친다.

---

## 18. 재연결과 재협상

WebSocket 연결과 WebRTC 연결은 각각 끊길 수 있다.

```text
시그널링 연결 재연결
→ WebSocket 재접속

미디어 연결 재협상
→ 새로운 Offer와 Answer 교환
```

네트워크가 바뀌면 ICE Restart가 필요할 수 있다.

```javascript
peerConnection.restartIce();
```

백엔드는 새 Offer, Answer, Candidate를 다시 상대방에게 전달한다.

## 19. P2P의 한계

1대1 통화에서는 P2P가 단순하다.

```text
A ⇄ B
```

하지만 참여자가 많아지면 각 브라우저가 여러 연결을 유지해야 한다.

```text
A ⇄ B
A ⇄ C
A ⇄ D
```

이를 Mesh 구조라 한다.

참여자가 늘수록 업로드 대역폭과 CPU 사용량이 크게 증가한다.

---

## 20. SFU란?

SFU는 Selective Forwarding Unit의 약자다.

각 사용자가 미디어를 SFU 서버로 한 번 보내면 SFU가 다른 참여자에게 전달한다.

```text
사용자 A ─┐
사용자 B ─┼→ SFU → 다른 참여자
사용자 C ─┘
```

다자간 통화에서는 Mesh보다 SFU가 적합한 경우가 많다.

구조는 다음과 같이 나뉜다.

```text
애플리케이션 백엔드
→ 인증, 방 관리, 시그널링

미디어 서버
→ 실제 음성·영상 전달
```

## 핵심 정리

```text
WebRTC
→ 브라우저 간 실시간 음성·영상·데이터 통신

시그널링 서버
→ 연결 정보를 중계하는 백엔드

SDP
→ 사용할 미디어와 통신 조건 설명

Offer
→ 먼저 보내는 연결 제안

Answer
→ Offer에 대한 응답

ICE Candidate
→ 연결 가능한 네트워크 경로 후보

STUN
→ 공인 IP와 포트 확인

TURN
→ 직접 연결 실패 시 미디어 중계
```

전체 흐름은 다음과 같다.

```text
WebSocket 연결
→ 방 입장
→ Offer 전달
→ Answer 전달
→ ICE Candidate 교환
→ 연결 경로 선택
→ WebRTC 연결 성립
→ 음성·영상 전송
```

백엔드의 핵심 역할은 영상을 직접 처리하는 것이 아니라, 인증된 사용자들이 올바른 상대와 연결되도록 시그널링 정보를 안전하게 전달하는 것이다.
