package com.ssafy.backend.stomp.chat;

public class ChatMessage {

    private String roomId;
    private String sender;
    private String content;
    private MessageType type;

    public ChatMessage() {
        // Jackson이 JSON을 Java 객체로 만들 때 기본 생성자로 만듦
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public MessageType getType() {
        return type;
    }

    public void setType(MessageType type) {
        this.type = type;
    }
}
