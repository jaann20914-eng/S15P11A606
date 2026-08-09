package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Point;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 핀 태그 검색 인덱스 반영 애플리케이션 서비스.
 *
 * <p>핀 라이프사이클을 소유한 트랜잭션 서비스들(AI 블러 결과 반영·핀 수정·핀 삭제)이
 * 커밋 이후 이 서비스에 pinId만 넘겨 색인/제거 "의도"를 표현하도록 한다. 핀으로부터
 * 색인 문서를 조립하는 방법(태그 조회·좌표·만료 시각)은 이 한 곳에 응집한다.</p>
 *
 * <p>실제 ES 쓰기는 {@link PinTagSearchIndexPort}에 위임하며, 색인은 best-effort다
 * (Port 구현이 실패를 삼키고 로깅한다).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinTagIndexingService {

    private final PinRepository pinRepository;
    private final PinTagRepository pinTagRepository;
    private final PinTagSearchIndexPort pinTagSearchIndexPort;

    /**
     * 지정한 핀의 현재 태그를 검색 인덱스에 반영한다(최초 색인·갱신 공통).
     * 커밋 이후 최신 상태를 재조회해 색인하며, 핀이 없거나 삭제됐거나 비공개(ACTIVE 아님)면 색인하지 않는다
     * (검색 대상은 ACTIVE·미삭제 핀뿐이므로 여기서 확인한다).
     */
    @Transactional(readOnly = true)
    public void indexPinTags(UUID pinId) {
        Pin pin = pinRepository.findById(pinId).orElse(null);
        if (pin == null || pin.isDeleted() || pin.getVideoStatus() != VideoStatus.ACTIVE) {
            log.info("태그 색인 대상 아님(없음·삭제·비ACTIVE) - 색인 생략 (pinId={})", pinId);
            return;
        }
        List<String> tags = pinTagRepository.findByPin_Id(pinId).stream()
                .map(PinTag::getTag)
                .toList();
        Point location = pin.getCaptureLocation();
        pinTagSearchIndexPort.index(pinId, tags, location.getY(), location.getX(), pin.getExpiresAt());
    }

    /**
     * 지정한 핀의 태그 문서를 검색 인덱스에서 제거한다(핀 삭제 시). 이미 없으면 멱등하게 무시된다.
     */
    public void removePinTags(UUID pinId) {
        pinTagSearchIndexPort.removeByPin(pinId);
    }

    /**
     * DB(ACTIVE·미삭제 핀) 기준으로 태그 검색 인덱스를 전체 재구성한다(마이그레이션/시연용 일괄 작업).
     * 각 핀을 {@link #indexPinTags(UUID)}와 동일 경로로 재색인하므로:
     * <ul>
     *   <li>정상 색인 경로를 거치지 못한 핀(예: DB 직접 INSERT)도 이때 ES에 반영되고,</li>
     *   <li>기존 문서는 delete-first로 다시 색인되어 자모/초성 필드까지 채워진다(멱등).</li>
     * </ul>
     * 개별 핀 색인 실패는 로깅 후 건너뛰어 전체 작업을 중단하지 않는다.
     *
     * @return 재색인에 성공한 핀 수
     */
    public int reindexAllActivePins() {
        List<UUID> pinIds = pinRepository.findAllActivePinIds();
        int success = 0;
        for (UUID pinId : pinIds) {
            try {
                indexPinTags(pinId);
                success++;
            } catch (Exception e) {
                log.error("태그 재색인 실패 (pinId={})", pinId, e);
            }
        }
        log.info("DB 기준 태그 재색인 완료: 성공 {}/{}건", success, pinIds.size());
        return success;
    }
}
