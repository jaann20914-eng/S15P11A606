pipeline {
    agent any

    options {
        // 같은 Job의 배포가 동시에 실행되는 것을 방지한다.
        disableConcurrentBuilds()

        // 자동 Checkout 대신 Checkout 단계를 명시적으로 사용한다.
        skipDefaultCheckout(true)
    }

    environment {
        IMAGE_NAME    = 'wagglewaggle-backend'
        CONTAINER_NAME = 'waggle-backend'
        NETWORK_NAME  = 'waggle-network'

        DB_HOST = 'waggle-postgis'
        DB_NAME = 'wagglewaggle'
        DB_USER = 'waggle'

        HOST_PORT = '8990'

        // Jenkins Credentials에 저장한 Secret Text의 ID
        DB_PASSWORD = credentials('waggle-db-password')
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

                        chmod +x gradlew
                        ./gradlew clean test --no-daemon
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
                          -e SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_HOST}:5432/${DB_NAME}" \
                          -e SPRING_DATASOURCE_USERNAME="$DB_USER" \
                          -e SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
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