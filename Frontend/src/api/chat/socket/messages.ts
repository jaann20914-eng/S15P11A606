import { createUuid } from '@/utils/uuid';
import { publish } from './client';
import { chatRoomSendDestination } from './destinations';

/**
 * 서버가 받는 전송 본문.
 *
 * `client_message_id`만 snake_case다. 프로젝트에 전역 네이밍 전략이 없어 서버가 이 필드 하나만
 * 명시 매핑해 두었다(`ChatMessageSendRequest`). camelCase로 보내면 값이 비어 들어간다.
 */
interface ChatMessageSendBody {
  content: string;
  client_message_id: string;
}

export interface SentChatMessage {
  /** 같은 메시지의 재시도를 알아보는 키. 되돌아오는 이벤트와 짝을 맞출 때도 쓴다. */
  clientMessageId: string;
  /** 연결이 끊겨 있어 보내지 못했으면 거짓. */
  delivered: boolean;
}

/**
 * 채팅방으로 메시지를 보낸다.
 *
 * 보낸 것이 그대로 화면에 붙지 않는다. 서버가 저장한 뒤 `MESSAGE_CREATED`로 되돌려 주고,
 * 화면은 그때 붙인다. 그래야 목록의 순서와 내용이 서버가 가진 것과 어긋나지 않는다.
 *
 * `clientMessageId`를 돌려주는 이유는 두 가지다. 재시도할 때 같은 값을 다시 보내면 서버가
 * 중복으로 저장하지 않고, 되돌아온 이벤트가 내가 보낸 것인지 알아볼 수 있다.
 */
export function sendChatMessage(roomId: number, content: string, retryOf?: string): SentChatMessage {
  const clientMessageId = retryOf ?? createUuid();

  const body: ChatMessageSendBody = { content, client_message_id: clientMessageId };
  const delivered = publish(chatRoomSendDestination(roomId), body);

  return { clientMessageId, delivered };
}
