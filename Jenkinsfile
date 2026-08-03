pipeline {
    agent any

    options {
        // 같은 Job의 배포가 동시에 실행되는 것을 방지한다.
        disableConcurrentBuilds()

        // 자동 Checkout 대신 Checkout 단계를 명시적으로 사용한다.
        skipDefaultCheckout(true)
    }

    environment {
        IMAGE_NAME     = 'wagglewaggle-backend'
        CONTAINER_NAME = 'waggle-backend'
        NETWORK_NAME   = 'waggle-network'

        DB_HOST = 'waggle-postgis'
        DB_NAME = 'wagglewaggle'
        DB_USER = 'waggle'

        DB_URL = 'jdbc:postgresql://waggle-postgis:5432/wagglewaggle'
        DB_USERNAME = 'waggle'
        ES_URIS = 'http://waggle-elasticsearch:9200'

        HOST_PORT = '8990'

        // Jenkins Global Credentials
        DB_PASSWORD           = credentials('waggle-db-password')
        KAKAO_REST_API_KEY    = credentials('waggle-kakao-rest-api-key')
        KAKAO_CLIENT_SECRET   = credentials('waggle-kakao-client-secret')
        NAVER_CLIENT_ID       = credentials('waggle-naver-client-id')
        NAVER_CLIENT_SECRET   = credentials('waggle-naver-client-secret')
        JWT_SECRET            = credentials('waggle-jwt-secret')
        AWS_ACCESS_KEY_ID     = credentials('waggle-aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('waggle-aws-secret-access-key')

        // 비밀값이 아니므로 직접 작성 가능
        KAKAO_REDIRECT_URI = 'https://i15a606.p.ssafy.io/oauth/callback/kakao'
        NAVER_REDIRECT_URI = 'https://i15a606.p.ssafy.io/oauth/callback/naver'

        AWS_S3_BUCKET = 'waggle-waggle'
        AWS_REGION    = 'ap-northeast-2'

        // 웹 OAuth 콜백을 앱으로 되돌릴 커스텀 스킴 (Frontend app.json의 scheme와 일치)
        OAUTH_CALLBACK_SCHEME = 'waglewagle'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '=== GitLab 코드 가져오기 ==='

                checkout scm

                script {
                    env.IMAGE_TAG = sh(
                        script: 'git rev-parse --short=8 HEAD',
                        returnStdout: true
                    ).trim()

                    env.NEW_IMAGE =
                        "${env.IMAGE_NAME}:${env.IMAGE_TAG}"
                }

                sh 'git log -1 --oneline'
            }
        }

        stage('Test') {
            steps {
                echo '=== Backend 테스트 ==='

                dir('Backend') {
                    sh '''
                        set -eu

                        # DooD 호스트에서 published 포트가 브리지 게이트웨이로 안 닿으므로(hairpin 불가),
                        # 호스트 네트워크를 쓰는 사이드카 컨테이너 안에서 테스트를 실행한다.
                        #  --network host      : 테스트 JVM이 호스트 네트워크 공유 → localhost 로 컨테이너 포트 접근 가능
                        #  --volumes-from      : Jenkins의 워크스페이스와 도커 소켓을 같은 경로로 물려받음(DooD 볼륨 경로 문제 회피)
                        #  -v ...:/gradle      : 그래들 캐시를 전용 볼륨에 유지(재다운로드 최소화)
                        docker run --rm \
                            --network host \
                            --volumes-from "$(hostname)" \
                            -v waggle-gradle-cache:/gradle \
                            -w "$PWD" \
                            -e GRADLE_USER_HOME=/gradle \
                            -e TESTCONTAINERS_RYUK_DISABLED=true \
                            eclipse-temurin:21-jdk \
                            sh -c "chmod +x gradlew && ./gradlew clean test --no-daemon"
                    '''
                }
            }
        }

        stage('Docker Build') {
            steps {
                echo '=== Backend Docker 이미지 생성 ==='

                dir('Backend') {
                    sh '''
                        set -eu

                        docker build \
                          --tag "$NEW_IMAGE" \
                          --tag "$IMAGE_NAME:latest" \
                          .
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                echo '=== Backend 컨테이너 교체 ==='

                sh '''
                    set -eu

                    OLD_IMAGE_ID=""

                    run_backend() {
                        IMAGE_TO_RUN="$1"

                        docker run -d \
                        --name "$CONTAINER_NAME" \
                        --restart unless-stopped \
                        --network "$NETWORK_NAME" \
                        -e DB_URL="jdbc:postgresql://${DB_HOST}:5432/${DB_NAME}" \
                        -e DB_USERNAME="$DB_USER" \
                        -e DB_PASSWORD="$DB_PASSWORD" \
                        -e ES_URIS="$ES_URIS" \
                        -e KAKAO_REST_API_KEY="$KAKAO_REST_API_KEY" \
                        -e KAKAO_CLIENT_SECRET="$KAKAO_CLIENT_SECRET" \
                        -e KAKAO_REDIRECT_URI="$KAKAO_REDIRECT_URI" \
                        -e NAVER_CLIENT_ID="$NAVER_CLIENT_ID" \
                        -e NAVER_CLIENT_SECRET="$NAVER_CLIENT_SECRET" \
                        -e NAVER_REDIRECT_URI="$NAVER_REDIRECT_URI" \
                        -e OAUTH_CALLBACK_SCHEME="$OAUTH_CALLBACK_SCHEME" \
                        -e JWT_SECRET="$JWT_SECRET" \
                        -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
                        -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
                        -e AWS_S3_BUCKET="$AWS_S3_BUCKET" \
                        -e AWS_REGION="$AWS_REGION" \
                        -e SPRING_JPA_OPEN_IN_VIEW="false" \
                        -p "127.0.0.1:${HOST_PORT}:8080" \
                        "$IMAGE_TO_RUN"
                    }

                    # 기존 백엔드가 있다면 현재 이미지 ID를 저장한다.
                    if docker container inspect "$CONTAINER_NAME" \
                        >/dev/null 2>&1
                    then
                        OLD_IMAGE_ID="$(
                            docker inspect \
                              --format '{{.Image}}' \
                              "$CONTAINER_NAME"
                        )"

                        echo "기존 컨테이너를 제거합니다."
                        docker rm -f "$CONTAINER_NAME"
                    else
                        echo "기존 백엔드 컨테이너가 없습니다."
                    fi

                    echo "새 컨테이너를 실행합니다."
                    run_backend "$NEW_IMAGE"

                    echo "Spring Boot 시작을 확인합니다."

                    STARTED="false"
                    COUNT=0

                    while [ "$COUNT" -lt 30 ]; do
                        RUNNING="$(
                            docker inspect \
                              --format '{{.State.Running}}' \
                              "$CONTAINER_NAME" 2>/dev/null \
                            || echo "false"
                        )"

                        if [ "$RUNNING" != "true" ]; then
                            break
                        fi

                        if docker logs "$CONTAINER_NAME" 2>&1 \
                            | grep -q "Started WagglewaggleApplication"
                        then
                            STARTED="true"
                            break
                        fi

                        sleep 1
                        COUNT=$((COUNT + 1))
                    done

                    if [ "$STARTED" != "true" ]; then
                        echo "새 버전 실행에 실패했습니다."

                        docker logs --tail 100 "$CONTAINER_NAME" \
                            || true

                        docker rm -f "$CONTAINER_NAME" \
                            >/dev/null 2>&1 || true

                        if [ -n "$OLD_IMAGE_ID" ]; then
                            echo "이전 이미지로 복구합니다."
                            run_backend "$OLD_IMAGE_ID"
                        else
                            echo "복구할 이전 이미지가 없습니다."
                        fi

                        exit 1
                    fi

                    echo "새 버전 실행에 성공했습니다."

                    docker ps \
                      --filter "name=${CONTAINER_NAME}" \
                      --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
                '''
            }
        }
    }

    post {
        success {
            mattermostSend(
                color: '#2EB67D',
                message: """
### ✅ 와글와글 Backend 배포 성공

**브랜치:** `${env.GIT_BRANCH ?: 'dev'}`  
**Docker 이미지:** `${env.NEW_IMAGE ?: '-'}`  
**빌드:** [${env.JOB_NAME} #${env.BUILD_NUMBER}](${env.BUILD_URL})

Spring Boot와 PostgreSQL 연결을 확인하고 새 컨테이너로 교체했습니다.
"""
            )
        }

        failure {
            mattermostSend(
                color: '#E01E5A',
                message: """
### ❌ 와글와글 Backend 배포 실패

**브랜치:** `${env.GIT_BRANCH ?: 'dev'}`  
**Docker 이미지:** `${env.NEW_IMAGE ?: '-'}`  
**빌드:** [실패 로그 확인](${env.BUILD_URL}console)

테스트, 이미지 생성 또는 컨테이너 실행 로그를 확인해 주세요.
"""
            )
        }
    }
}
