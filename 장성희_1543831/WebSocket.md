## 들어가며

WebRTC는 브라우저 간 영상과 음성을 전달할 수 있지만, 연결을 생성하기 전에는 SDP와 ICE Candidate 등의 연결 정보를 먼저 교환해야 한다(시그널링).

이 과정을 실시간 양방향 통신으로 구현하기 위해 WebSocket을 사용하기 때문에, WebRTC 연결을 구현하기 전에 WebSocket의 개념을 학습하고 실습을 통해 이해도를 높이려고 했다.

WebSocket의 동작 원리를 제대로 이해하기 위해서 STOMP 없이 Raw WebSocket으로 텍스트를 echo/broadcast하는 것부터, STOMP 프로토콜을 적용해서 room 개념이 있는 채팅 기능까지 실습해보았다.

# WebSocket 개념 이해

## 1. HTTP 통신의 특징과 한계

HTTP는 기본적으로 클라이언트가 요청을 보내고 서버가 응답하는 방식이다.

```text
Client ── Request ──> Server
Client <─ Response ── Server
```

서버에 새로운 정보가 생겨도 클라이언트가 요청하지 않으면 즉시 전달하기 어렵다.

이를 보완하기 위해 클라이언트가 일정한 간격으로 서버에 새로운 데이터가 있는지 확인하는 Polling 방식을 사용할 수 있다. 그러나 변경 사항이 없어도 요청이 반복되며, 요청 주기에 따라 데이터 전달이 지연될 수 있다.

따라서 채팅, 실시간 알림, 게임, WebRTC 시그널링처럼 클라이언트와 서버가 즉시 메시지를 주고받아야 하는 기능에는 지속적인 양방향 연결이 적합하다.

---

## 2. WebSocket이란

WebSocket은 클라이언트와 서버가 하나의 연결을 유지하면서 **양방향으로 메시지를 주고받을 수 있도록 지원**하는 통신 프로토콜이다.

```text
Client <──────── 지속적인 연결 ────────> Server
```

WebSocket의 주요 특징은 다음과 같다.

* 최초 연결 이후 연결을 계속 유지한다.
* 클라이언트와 서버가 모두 메시지를 전송할 수 있다.
* 메시지를 보낼 때마다 새로운 HTTP 요청을 생성하지 않는다.
* 텍스트와 바이너리 데이터를 모두 전송할 수 있다.
* 전이중 통신(한쪽의 메시지 전송이 끝나기를 기다리지 않고 양쪽이 독립적으로 메시지를 전송)을 지원한다.

---

## 3. WebSocket 연결 과정

WebSocket 연결은 처음에 HTTP 요청으로 시작한다.

클라이언트는 HTTP 요청에 다음 헤더를 포함하여 WebSocket 프로토콜로의 전환을 요청한다.

```http
Connection: Upgrade
Upgrade: websocket
```

서버가 요청을 수락하면 `101 Switching Protocols` 응답을 반환한다. 이후에는 일반적인 HTTP 요청과 응답이 아니라 WebSocket 프레임을 사용하여 메시지를 교환한다.

```text
HTTP Upgrade 요청
        ↓
WebSocket 핸드셰이크
        ↓
101 Switching Protocols
        ↓
WebSocket 메시지 교환
```

- 결론: **WebSocket은 HTTP를 이용하여 최초 연결을 협상한 뒤 WebSocket 프로토콜로 전환하는 구조이다.**

---

## 4. Spring에서의 WebSocket 처리

- Spring MVC에서 일반적인 HTTP 요청은 `DispatcherServlet`을 거쳐 `@RestController`가 처리하지만, 
- WebSocket 핸드셰이크가 완료된 후 전달되는 메시지는 별도의 `WebSocketHandler`가 처리한다.


`WebSocketSession`은 서버와 하나의 클라이언트 사이에 생성된 WebSocket 연결을 나타낸다. 브라우저 탭 두 개가 서버에 접속하면 각각 별도의 세션이 생성된다.

```text
브라우저 A ── Session A ── 서버
브라우저 B ── Session B ── 서버
```

서버는 세션이 연결되면 등록하고, 연결이 종료되면 제거해야 한다. 종료된 세션을 제거하지 않으면 불필요한 연결 정보가 남거나 닫힌 세션으로 메시지를 전송하는 오류가 발생할 수 있다.

---

## 5. Raw WebSocket의 한계

WebSocket은 양방향으로 메시지를 전달할 수 있는 통신 통로를 제공한다. 그러나 메시지를 어떤 기준으로 분류하고 누구에게 전달할지는 정의하지 않는다.

예를 들어 채팅방 기능을 구현하려면 서버가 직접 다음 내용을 관리해야 한다.

* 각 세션이 어떤 방에 속하는지 관리한다.
* 메시지의 종류를 구분한다.
* 메시지를 전달할 세션을 선택한다.
* 방 입장과 퇴장에 따라 세션 정보를 갱신한다.

이러한 메시징 규칙을 구조화하기 위해 WebSocket 위에서 STOMP를 사용할 수 있다.

---

## 6. STOMP란

STOMP는 클라이언트와 서버가 일정한 형식과 규칙에 따라 메시지를 주고받도록 지원하는 메시징 프로토콜이다.

WebSocket과 STOMP의 관계는 다음과 같다.

```text
STOMP: 메시지 형식과 목적지 규칙
──────────────────────────────
WebSocket: 양방향 메시지 전달 통로
──────────────────────────────
TCP: 실제 네트워크 연결
```

STOMP는 WebSocket을 대체하지 않는다. WebSocket 위에 메시지의 형식과 전달 목적지에 관한 규칙을 추가한다.

STOMP에서 주로 사용하는 명령은 다음과 같다.

* `CONNECT`: STOMP 연결을 시작한다.
* `SUBSCRIBE`: 특정 목적지를 구독한다.
* `SEND`: 특정 목적지로 메시지를 전송한다.
* `MESSAGE`: 구독자에게 메시지를 전달한다.
* `DISCONNECT`: 연결을 종료한다.

---

## 7. Publish/Subscribe 구조

Publish/Subscribe는 메시지를 보내는 주체와 받는 주체를 분리하는 구조이다.

* Publisher는 특정 Topic에 메시지를 발행한다.
* Subscriber는 관심 있는 Topic을 구독한다.
* Message Broker는 Topic을 구독한 클라이언트에게 메시지를 전달한다.

```text
Publisher
    │
    │ publish
    ▼
/topic/rooms/room-a
    │
    ├── Subscriber A
    └── Subscriber B
```

Publisher는 메시지를 받을 구독자를 직접 알 필요가 없다. 메시지를 발행할 Topic만 지정하면 된다.

이 구조를 사용하면 서버가 모든 세션을 직접 순회하여 전달 대상을 선택하지 않아도 된다.

---

## 8. STOMP의 Destination

STOMP에서는 메시지를 보내거나 구독할 위치를 Destination으로 표현한다.

실습에서 사용하는 Destination은 다음과 같다.

| Destination  | 역할                                      |
| ------------ | --------------------------------------- |
| `/ws-stomp`  | WebSocket과 STOMP 연결을 시작하는 엔드포인트이다.      |
| `/app/...`   | 클라이언트가 서버의 메시지 처리 로직으로 메시지를 전송하는 목적지이다. |
| `/topic/...` | 여러 클라이언트가 서버에서 발행한 메시지를 구독하는 목적지이다.     |

`/ws-stomp`는 최초 연결을 시작하는 실제 엔드포인트이다. `/app`과 `/topic`은 연결이 완료된 이후 STOMP 메시지에서 사용하는 논리적인 목적지이다.

---

## 9. Spring의 STOMP 메시지 처리

`@MessageMapping`은 클라이언트가 `/app` Destination으로 전송한 STOMP 메시지를 Spring의 특정 메서드와 연결한다.

HTTP의 `@PostMapping`과 유사해 보이지만, HTTP 요청이 아니라 WebSocket 연결을 통해 전달된 STOMP 메시지를 처리한다는 차이가 있다.

`SimpMessagingTemplate`은 서버가 특정 Topic으로 메시지를 발행할 때 사용한다.

```text
Client
  │
  │ SEND /app/rooms/{roomId}/messages
  ▼
@MessageMapping
  │
  │ convertAndSend()
  ▼
/topic/rooms/{roomId}
  │
  ▼
Subscribers
```

클라이언트가 `/app` 경로로 메시지를 보내면 서버의 메시지 처리 로직이 실행된다. 서버는 처리 결과를 `/topic` 경로로 발행하고, 해당 Topic을 구독한 클라이언트들이 메시지를 전달받는다.

---

## 10. Room을 Topic으로 표현하기

채팅방별로 메시지를 분리하려면 Room ID를 Topic Destination에 포함할 수 있다.

```text
/topic/rooms/room-a
/topic/rooms/room-b
```

각 클라이언트는 자신이 참여한 방의 Topic을 구독한다.

```text
Client A ── 구독 ──> /topic/rooms/room-a
Client B ── 구독 ──> /topic/rooms/room-a
Client C ── 구독 ──> /topic/rooms/room-b
```

`room-a` Topic으로 발행된 메시지는 `room-a`를 구독한 클라이언트에게만 전달된다.

이때 Room은 반드시 서버가 별도의 세션 컬렉션으로 관리하는 물리적인 객체일 필요는 없다. 동일한 Destination을 구독하는 클라이언트들의 논리적인 그룹으로 표현할 수 있다.

다만 참여 권한 확인, 현재 참여자 조회, 강제 퇴장과 같은 기능이 필요하다면 서버에서 별도의 방과 사용자 상태를 관리해야 한다.

---

## 11. Raw WebSocket과 STOMP 비교

| 구분        | Raw WebSocket             | STOMP                        |
| --------- | ------------------------- | ---------------------------- |
| 주요 역할     | 양방향 통신을 제공한다.             | 메시징 규칙을 제공한다.                |
| 메시지 처리    | `WebSocketHandler`를 사용한다. | `@MessageMapping`을 사용한다.     |
| 전달 대상     | 서버가 세션을 직접 선택한다.          | Destination과 구독 관계로 결정한다.    |
| 메시지 구분    | 애플리케이션에서 직접 정의한다.         | STOMP 명령과 Destination을 사용한다. |
| Broadcast | 세션을 직접 순회한다.              | Topic으로 메시지를 발행한다.           |
| Room 분리   | 세션과 Room의 관계를 직접 관리한다.    | Room별 Topic을 구독한다.           |

Raw WebSocket은 단순한 통신이나 세밀한 제어가 필요한 경우에 적합하다. STOMP는 채팅방처럼 메시지를 목적지별로 분리하고 여러 구독자에게 전달해야 하는 기능에 적합하다.

---


## 실습 코드 참고 사항

실습 진행은 Raw WebSocket의 echo부터 진행했는데, broadcast로 바꾸면서 echo와 관련된 코드는 현재 없다.

