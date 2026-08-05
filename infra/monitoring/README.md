# infra/monitoring — 모니터링 스택 (Prometheus / Grafana)

와글와글 서비스를 관찰하는 모니터링 스택. `infra/`(지원 서비스)와 같은
`waggle-network` 위에 올라가서 각 서비스를 컨테이너 이름으로 긁어온다(scrape).

## 구성

| 서비스 | 컨테이너 이름 | 역할 | 호스트 노출 |
|---|---|---|---|
| Prometheus | `waggle-prometheus` | 지표 수집·저장 | `127.0.0.1:9091` |
| Grafana | `waggle-grafana` | 대시보드 시각화 | `127.0.0.1:3000` |
| node-exporter | `waggle-node-exporter` | EC2 호스트 지표 | (내부) |
| cAdvisor | `waggle-cadvisor` | 컨테이너별 지표 | (내부) |

- 수집 대상은 [`prometheus/prometheus.yml`](prometheus/prometheus.yml) 에서 관리한다.
- Grafana Prometheus 데이터소스는 부팅 시 자동 등록된다(provisioning).
- 포트는 `127.0.0.1` 에만 열어 외부에 직접 노출하지 않는다. 브라우저 접근은 SSH 터널.

## 준비

```bash
cp infra/monitoring/.env.example infra/monitoring/.env
vi infra/monitoring/.env    # GRAFANA_ADMIN_PASSWORD 설정
```

> 전제: `waggle-network` 는 이미 존재한다(앱/지원 서비스가 쓰는 그 네트워크).
> 없다면: `docker network create waggle-network`

## 실행

```bash
docker compose -f infra/monitoring/docker-compose.yml up -d
docker compose -f infra/monitoring/docker-compose.yml ps      # 상태 확인
```

## 브라우저로 접근 (SSH 터널)

포트를 외부에 열지 않으므로, 로컬 PC 에서 터널을 뚫어 접속한다.

```bash
# 로컬 PC 에서 실행 (키 경로/호스트는 환경에 맞게)
# 호스트 9090 은 Jenkins 가 쓰므로 Prometheus 는 9091 로 노출된다.
ssh -N -L 3000:127.0.0.1:3000 -L 9091:127.0.0.1:9091 ubuntu@<EC2-퍼블릭-IP>
```

- Grafana:    http://localhost:3000  (id: `admin`, pw: `.env` 에 넣은 값)
- Prometheus: http://localhost:9091  (Status → Targets 에서 수집 상태 확인)

## 잘 붙었는지 확인

Prometheus `Status → Targets` 에서 아래가 모두 **UP** 이면 1단계 완료:
`prometheus`, `node`, `cadvisor`, `rabbitmq`

## 대시보드 붙이기 (Grafana)

Grafana 좌측 `Dashboards → New → Import` 에서 아래 ID 입력:

| 대상 | 대시보드 ID |
|---|---|
| Node Exporter Full (호스트) | `1860` |
| cAdvisor (컨테이너) | `14282` |
| RabbitMQ | `10991` |

## 일상 운영

```bash
docker compose -f infra/monitoring/docker-compose.yml logs -f
docker compose -f infra/monitoring/docker-compose.yml up -d     # 설정 변경 반영
docker compose -f infra/monitoring/docker-compose.yml stop      # 중지
```

## 다음 단계 (대상 추가)

`prometheus/prometheus.yml` 의 주석 블록을 순서대로 열면 된다.

- **2단계 Spring Boot**: `micrometer-registry-prometheus` 의존성 + actuator `prometheus` 엔드포인트 노출 → `spring-boot` job 주석 해제
- **3단계 PostGIS**: `postgres_exporter` 컨테이너 추가 → `postgres` job 주석 해제
- **3단계 Elasticsearch**: `elasticsearch-exporter` 컨테이너 추가 → `elasticsearch` job 주석 해제
- **4단계 AI 서버**: FastAPI/Flask 계측 추가 → `ai-server` job 주석 해제

주석 해제 후 반영:

```bash
docker compose -f infra/monitoring/docker-compose.yml up -d
# 또는 무중단 리로드:
# curl -X POST http://127.0.0.1:9090/-/reload
```
