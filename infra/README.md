# infra — 지원 서비스 (PostGIS / Elasticsearch / RabbitMQ)

와글와글의 상태를 가진 지원 서비스를 코드로 정의한다.
앱(Backend / AI / AI Worker)은 여전히 Jenkins 파이프라인이 배포하며, 이 파일은 건드리지 않는다.

## 구성

| 서비스 | 컨테이너 이름 | 이미지 | 데이터 볼륨 |
|---|---|---|---|
| PostGIS | `waggle-postgis` | `postgis/postgis:16-3.5` | `waggle-postgis-data` |
| Elasticsearch | `waggle-elasticsearch` | `docker.elastic.co/elasticsearch/elasticsearch:9.2.8` | `waggle-elasticsearch-data` |
| RabbitMQ | `waggle-rabbitmq` | `rabbitmq:4-management` | `waggle-rabbitmq-data` |

- 네트워크 `waggle-network`는 **external**(compose 밖에서 관리). Jenkins 앱 배포가 만들어 두는 네트워크를 그대로 공유하며, compose 는 직접 만들지 않는다.
- 데이터 볼륨도 **external**(compose 밖에서 관리). 실수로 빈 볼륨을 새로 만들어 데이터를 가리는 사고를 막기 위함이다.
- PostGIS/RabbitMQ 포트는 호스트에 공개하지 않는다. 앱은 `waggle-network` 안에서 컨테이너 이름으로 접근한다.

## 준비

```bash
cp infra/.env.example infra/.env
# infra/.env 에 "현재 운영 중인" DB / RabbitMQ 비밀번호를 그대로 채운다.
```

## 기존 수동 컨테이너 → compose 전환 (EC2, 최초 1회)

데이터는 named volume 에 있으므로 컨테이너만 교체하면 유지된다. 안전하게 한 서비스씩 진행한다.

```bash
# 0) 코드/설정 준비
cd ~/S15P11A606       # 저장소 경로에 맞게
git pull
cp infra/.env.example infra/.env && vi infra/.env   # 실제 비밀번호 입력

# 1) 기존 수동 컨테이너 제거 (-v 를 절대 붙이지 말 것 → 볼륨 유지)
docker rm -f waggle-postgis waggle-elasticsearch waggle-rabbitmq

# 2) compose 로 기동 (같은 볼륨/네트워크를 물고 올라온다)
docker compose -f infra/docker-compose.yml up -d

# 3) 상태 확인 (healthy 될 때까지 잠시 대기)
docker compose -f infra/docker-compose.yml ps
```

네트워크 `waggle-network`는 external 이라 compose 가 **기존 것을 그대로 참조**한다.
이미 EC2 에서 Jenkins 배포가 만들어 둔 네트워크가 있으므로 별도 작업이 필요 없다.
(네트워크가 없는 새 호스트라면 "새 호스트에서 처음부터" 절 참고.)

앱 컨테이너(Backend/AI)는 재시작 정책이 있어 DB/브로커 재연결 시 자동 복구되지만,
전환 중 잠깐 연결이 끊길 수 있으니 트래픽이 적은 시간에 진행한다.
특히 DB 가 내려가 있는 사이 Jenkins 앱 배포가 돌면 부팅 실패로 롤백될 수 있으니,
전환 중에는 앱 파이프라인을 트리거하지 않는 것이 좋다.

## 일상 운영

```bash
docker compose -f infra/docker-compose.yml ps        # 상태
docker compose -f infra/docker-compose.yml logs -f   # 로그
docker compose -f infra/docker-compose.yml up -d     # 설정 변경 반영
docker compose -f infra/docker-compose.yml stop      # 중지 (down 은 쓰지 않는다: 아래 참고)
```

> `down` 은 네트워크까지 정리하려 하고 external 이면 경고가 난다. 서비스만 내릴 땐 `stop` 을 쓴다.
> 볼륨은 external 이라 `down -v` 로도 삭제되지 않지만, 습관적으로 `-v` 를 쓰지 않는다.

## 새 호스트에서 처음부터 (참고)

external 네트워크와 볼륨은 미리 존재해야 한다.

```bash
docker network create waggle-network
docker volume create waggle-postgis-data
docker volume create waggle-elasticsearch-data
docker volume create waggle-rabbitmq-data
docker compose -f infra/docker-compose.yml up -d
```
