package com.ssafy.backend.signaling;

import com.fasterxml.jackson.databind.JsonNode;

public class SignalMessage {
    private String roomId;
    private String senderId;
    private SignalType type;
    private JsonNode payload;

    public SignalMessage() {
        // Jackson이 JSON을 Java 객체로 변환할 때 사용할 기본 생성자
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public SignalType getType() {
        return type;
    }

    public void setType(SignalType type) {
        this.type = type;
    }

    public JsonNode getPayload() {
        return payload;
    }

    public void setPayload(JsonNode payload) {
        this.payload = payload;
    }
}
