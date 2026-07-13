# WebSocket과 STOMP 원리 정리

## 1. WebSocket이 필요한 이유

일반 HTTP는 클라이언트가 요청하고 서버가 응답하는 구조다.

```text
클라이언트 요청
→ 서버 응답
→ 통신 종료
```

채팅처럼 서버가 새 메시지를 즉시 보내야 하는 기능에서는 이 방식이 불편하다.

이를 해결하기 위해 WebSocket을 사용한다.

WebSocket은 클라이언트와 서버가 연결을 유지하면서 양방향으로 메시지를 주고받는 프로토콜이다.

```text
클라이언트 ⇄ 서버
```

---

## 2. WebSocket 연결 과정

WebSocket 연결은 처음부터 WebSocket으로 시작하지 않는다.

먼저 HTTP 요청을 보낸 뒤, 연결을 WebSocket으로 전환한다.

이를 WebSocket Handshake라 한다.

```http
GET /ws HTTP/1.1
Upgrade: websocket
Connection: Upgrade
```

서버가 연결을 허용하면 다음과 같이 응답한다.

```http
HTTP/1.1 101 Switching Protocols
```

전체 흐름은 다음과 같다.

```text
HTTP GET /ws
→ WebSocket Upgrade 요청
→ 101 Switching Protocols
→ WebSocket 연결 성립
```

---

## 3. STOMP란?

WebSocket은 데이터를 주고받는 통로만 제공한다.

하지만 다음과 같은 규칙은 직접 정해주지 않는다.

- 어느 주소로 메시지를 보낼지
- 어떤 메시지를 구독할지
- 어떤 채팅방의 메시지인지
- 메시지 전송과 구독을 어떻게 구분할지

STOMP는 WebSocket 위에서 메시지를 주고받는 규칙을 제공하는 프로토콜이다.

```text
WebSocket
→ 통신 통로

STOMP
→ 메시지 전송과 구독 규칙
```

쉽게 말하면 다음과 같다.

```text
WebSocket = 도로
STOMP = 도로 위의 목적지와 교통 규칙
```

---

## 4. WebSocket 연결과 STOMP CONNECT

WebSocket 연결과 STOMP `CONNECT`는 서로 다른 단계다.

먼저 WebSocket 연결을 만든다.

```text
GET /ws
→ Upgrade
→ WebSocket 연결
```

그 다음 WebSocket 연결 위로 STOMP `CONNECT` 프레임을 보낸다.

```text
CONNECT
accept-version:1.2
```

서버는 `CONNECTED` 프레임으로 응답한다.

```text
CONNECTED
version:1.2
```

전체 흐름은 다음과 같다.

```text
1. WebSocket Handshake
2. WebSocket 연결 성립
3. STOMP CONNECT
4. STOMP CONNECTED
5. SUBSCRIBE 또는 SEND
```

---

## 5. 주요 STOMP 명령

| 명령 | 의미 |
|---|---|
| `CONNECT` | STOMP 연결 시작 |
| `CONNECTED` | 서버가 연결을 승인 |
| `SUBSCRIBE` | 특정 destination 구독 |
| `SEND` | 특정 destination으로 메시지 전송 |
| `MESSAGE` | 서버가 구독자에게 메시지 전달 |
| `DISCONNECT` | 연결 종료 |

---

## 6. destination이란?

destination은 STOMP 메시지를 보내거나 구독하는 논리적 주소다.

예시는 다음과 같다.

```text
/app/chat
/topic/chat
```

REST API의 URL과 모양은 비슷하지만 역할은 다르다.

```text
REST URL
→ HTTP 요청을 처리할 주소

STOMP destination
→ 메시지를 보내거나 구독할 주소
```

---

## 7. `/ws`, `/app`, `/topic`

### `/ws`

WebSocket 연결을 시작하는 주소다.

```text
/ws
```

### `/app`

클라이언트가 서버의 `@MessageMapping`으로 메시지를 보낼 때 사용한다.

```text
/app/chat
```

### `/topic`

클라이언트가 메시지를 받기 위해 구독하는 주소다.

```text
/topic/chat
```

정리하면 다음과 같다.

| 주소 | 역할 |
|---|---|
| `/ws` | WebSocket 연결 |
| `/app/...` | 클라이언트가 서버로 메시지 전송 |
| `/topic/...` | 서버가 구독자에게 메시지 발행 |

---

## 8. `@MessageMapping`

Spring에서는 STOMP 메시지를 `@MessageMapping`으로 받는다.

```java
@MessageMapping("/chat")
public void sendMessage(ChatMessageRequest request) {
}
```

클라이언트는 다음 주소로 메시지를 보낸다.

```text
/app/chat
```

Spring은 `/app`을 제거하고 `/chat`에 해당하는 `@MessageMapping`을 찾는다.

```text
/app/chat
→ @MessageMapping("/chat")
```

`@MessageMapping`에는 `/app`을 적지 않는다.

---

## 9. SUBSCRIBE와 SEND

### SUBSCRIBE

특정 destination의 메시지를 받겠다고 등록하는 동작이다.

```javascript
client.subscribe(
    "/topic/chat",
    message => {
        console.log(message.body);
    }
);
```

### SEND

특정 destination으로 메시지를 보내는 동작이다.

```javascript
client.publish({
    destination: "/app/chat",
    body: JSON.stringify({
        content: "안녕하세요"
    })
});
```

정리하면 다음과 같다.

```text
SUBSCRIBE
→ 메시지를 받기 위한 등록

SEND
→ 메시지를 보내는 동작
```

---

## 10. 전체 메시지 흐름

브라우저 A와 B가 같은 채팅방을 구독한다고 가정한다.

```text
브라우저 A
1. /ws로 WebSocket 연결
2. STOMP CONNECT
3. /topic/chat 구독
4. /app/chat으로 메시지 전송

서버
5. @MessageMapping("/chat")에서 메시지 수신
6. 메시지 처리
7. /topic/chat으로 메시지 발행

브라우저 A, B
8. /topic/chat을 구독 중이므로 메시지 수신
```

그림으로 보면 다음과 같다.

```text
브라우저 A
   │
   │ SEND /app/chat
   ▼
@MessageMapping("/chat")
   │
   ▼
/topic/chat
   │
   ├───────────┐
   ▼           ▼
브라우저 A   브라우저 B
```

---

## 11. 메시지 브로커

메시지 브로커는 서버가 발행한 메시지를 구독자에게 전달한다.

```text
서버
→ 메시지 브로커
→ 구독자
```

Spring의 Simple Broker를 사용하면 `/topic`을 구독한 사용자들에게 메시지를 전달할 수 있다.

```java
registry.enableSimpleBroker("/topic");
```

---

## 12. Spring 기본 설정

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig
        implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(
            StompEndpointRegistry registry
    ) {
        registry.addEndpoint("/ws")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(
            MessageBrokerRegistry registry
    ) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.enableSimpleBroker("/topic");
    }
}
```

각 설정의 의미는 다음과 같다.

```text
/ws
→ WebSocket 연결 주소

/app
→ @MessageMapping으로 전달할 prefix

/topic
→ 구독자에게 메시지를 전달할 prefix
```

---

## 13. SockJS

SockJS는 WebSocket을 사용할 수 없는 환경에서도 비슷한 통신을 제공하는 라이브러리다.

```java
registry.addEndpoint("/ws")
        .withSockJS();
```

프론트에서는 다음과 같이 사용할 수 있다.

```javascript
const socket = new SockJS("/ws");
```

관계를 정리하면 다음과 같다.

```text
SockJS 또는 WebSocket
→ 실제 통신 연결

STOMP
→ 연결 위에서 사용하는 메시지 규칙
```

---

## 14. REST와 WebSocket

WebSocket이 REST API를 완전히 대체하는 것은 아니다.

보통 역할을 다음과 같이 나눈다.

```text
REST API
→ 기존 데이터 조회

WebSocket
→ 새 데이터 실시간 수신
```

채팅에서는 다음 구조를 사용할 수 있다.

```text
REST
→ 이전 메시지 조회

WebSocket
→ 새 메시지 실시간 수신
```

---

## 15. 핵심 정리

```text
WebSocket
→ 클라이언트와 서버 사이의 양방향 통신 연결

STOMP
→ WebSocket 위에서 메시지를 보내고 구독하는 규칙
```

주소별 역할은 다음과 같다.

```text
/ws
→ WebSocket 연결

/app/...
→ 클라이언트가 서버로 메시지 전송

/topic/...
→ 클라이언트가 서버 메시지를 구독
```

전체 흐름은 다음과 같다.

```text
WebSocket Handshake
→ STOMP CONNECT
→ SUBSCRIBE
→ SEND
→ @MessageMapping
→ topic 발행
→ 구독자 수신
```
