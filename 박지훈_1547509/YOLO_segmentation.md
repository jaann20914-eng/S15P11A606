# TIL - YOLO Segmentation

## 1. YOLO Segmentation이란?

YOLO Segmentation은 이미지나 영상에서 객체를 탐지하는 것뿐만 아니라, 객체의 실제 형태를 픽셀 단위로 구분하는 기술이다.

일반 YOLO 객체 탐지는 객체를 사각형 형태의 Bounding Box로 표시한다.

```text
Object Detection
- 사람의 위치를 사각형 박스로 탐지
```

YOLO Segmentation은 객체 영역을 Mask 형태로 추출한다.

```text
Instance Segmentation
- 사람의 실제 윤곽을 픽셀 단위로 분리
```

따라서 사람만 블러 처리하고 배경이나 주변 물체는 유지해야 하는 영상 처리 기능에 적합하다.

---

## 2. Object Detection과 Segmentation 차이

| 구분    | Object Detection  | Segmentation    |
| ----- | ----------------- | --------------- |
| 결과    | 사각형 Bounding Box  | 객체 형태의 Mask     |
| 정확도   | 객체 위치 확인          | 객체 영역 구분        |
| 처리 속도 | 비교적 빠름            | 비교적 느림          |
| 활용    | 사람 수 측정, 객체 위치 탐지 | 배경 제거, 사람 블러 처리 |

사람 블러 처리에 Object Detection을 사용하면 사람 주변의 좌석이나 배경까지 같이 가려질 수 있다.

Segmentation을 사용하면 사람 형태만 추출할 수 있어 공간 정보는 최대한 유지할 수 있다.

---

## 3. YOLO Segmentation 처리 과정

```text
이미지 또는 영상 입력
→ YOLO 모델이 객체 탐지
→ 객체별 Bounding Box 생성
→ 객체 형태의 Segmentation Mask 생성
→ 원하는 객체 영역만 후처리
```

예를 들어 사람 블러 기능은 다음과 같이 동작한다.

```text
영상 입력
→ person 클래스 탐지
→ 사람 Mask 생성
→ OpenCV로 Mask 영역 블러
→ 블러 처리된 영상 출력
```

---

## 4. 설치

```bash
pip install ultralytics
pip install opencv-python
```

설치 확인:

```bash
yolo checks
```

---

## 5. 이미지 Segmentation 실행

Python 코드:

```python
from ultralytics import YOLO

# Segmentation 모델 불러오기
model = YOLO("yolo11n-seg.pt")

# 이미지 추론
results = model("sample.jpg")

# 결과 화면 표시
results[0].show()
```

`yolo11n-seg.pt`에서 `seg`는 Segmentation 모델이라는 의미이다.

---

## 6. 결과 정보 확인

```python
from ultralytics import YOLO

model = YOLO("yolo11n-seg.pt")
results = model("sample.jpg")

result = results[0]

print(result.boxes)
print(result.masks)
```

주요 결과는 다음과 같다.

| 속성             | 설명                    |
| -------------- | --------------------- |
| `result.boxes` | 객체의 위치와 클래스 정보        |
| `result.masks` | 객체의 Segmentation Mask |
| `result.names` | 클래스 번호와 이름            |
| `box.cls`      | 탐지된 객체의 클래스 번호        |
| `box.conf`     | 탐지 신뢰도                |

---

## 7. 사람 객체만 확인하기

COCO 데이터셋에서 `person` 클래스 번호는 일반적으로 `0`이다.

```python
from ultralytics import YOLO

model = YOLO("yolo11n-seg.pt")
results = model("sample.jpg")

result = results[0]

for box in result.boxes:
    class_id = int(box.cls[0])

    if class_id == 0:
        print("사람이 탐지되었습니다.")
```

---

## 8. 사람 영역 블러 처리

YOLO Segmentation으로 생성한 사람 Mask를 이용하여 OpenCV 블러 처리를 적용할 수 있다.

```python
import cv2
import numpy as np
from ultralytics import YOLO

model = YOLO("yolo11n-seg.pt")

image = cv2.imread("sample.jpg")
results = model(image)

result = results[0]

if result.masks is not None:
    for box, mask in zip(result.boxes, result.masks.data):
        class_id = int(box.cls[0])

        # person 클래스만 처리
        if class_id != 0:
            continue

        mask = mask.cpu().numpy()
        mask = cv2.resize(
            mask,
            (image.shape[1], image.shape[0])
        )

        binary_mask = mask > 0.5

        blurred_image = cv2.GaussianBlur(
            image,
            (51, 51),
            0
        )

        image[binary_mask] = blurred_image[binary_mask]

cv2.imwrite("blurred_result.jpg", image)
```

전체 이미지에 블러를 적용한 뒤, 사람 Mask에 해당하는 픽셀만 원본 이미지에 덮어쓰는 방식이다.

---

## 9. 모델 이름 의미

```text
yolo11n-seg.pt
```

| 부분       | 의미              |
| -------- | --------------- |
| `yolo11` | YOLO 모델 버전      |
| `n`      | Nano 크기 모델      |
| `seg`    | Segmentation 모델 |
| `.pt`    | PyTorch 모델 파일   |

모델 크기는 일반적으로 다음과 같이 구분된다.

```text
n → s → m → l → x
```

왼쪽으로 갈수록 가볍고 빠르며, 오른쪽으로 갈수록 모델이 크고 정확도가 높아진다.

MVP에서는 속도가 빠른 `n` 또는 `s` 모델이 적합하다.

---

## 10. 영상 처리 시 고려할 점

영상은 여러 이미지 프레임으로 구성되어 있기 때문에 각 프레임마다 Segmentation을 수행해야 한다.

```text
영상 불러오기
→ 프레임 단위 분리
→ 각 프레임에서 사람 Segmentation
→ 사람 Mask 블러 처리
→ 프레임을 다시 영상으로 결합
```

프레임마다 탐지 결과가 달라지면 블러가 깜빡이는 현상이 발생할 수 있다.

이를 줄이기 위해 객체 추적 기술을 함께 사용할 수 있다.

```text
YOLO Segmentation
+ ByteTrack 또는 BoT-SORT
+ OpenCV Blur
```

---

## 11. 장점

* 사람의 실제 형태에 맞춰 블러 처리가 가능하다.
* 좌석, 대기줄, 배경 등 필요한 공간 정보를 유지할 수 있다.
* 이미지와 영상 모두 적용할 수 있다.
* 사람뿐 아니라 차량, 동물 등 다른 객체에도 활용할 수 있다.
* 사전 학습 모델을 사용하면 별도 학습 없이 테스트할 수 있다.

---

## 12. 단점 및 주의사항

* 일반 객체 탐지보다 처리 속도가 느리다.
* 사람이 가려져 있거나 멀리 있으면 탐지하지 못할 수 있다.
* 사람이 누락되면 개인정보가 그대로 노출될 위험이 있다.
* GPU가 없으면 영상 처리 속도가 느릴 수 있다.
* 실시간 서비스에서는 모델 크기와 해상도를 조절해야 한다.

개인정보 보호 기능에서는 Segmentation 결과만 완전히 신뢰하기보다 얼굴 탐지 모델을 추가하여 이중으로 블러 처리하는 것이 안전하다.

---

## 13. 프로젝트 적용 방법

실시간 장소 현황 공유 서비스에서는 다음과 같이 활용할 수 있다.

```text
사용자가 5초 영상 촬영
→ 서버에 영상 업로드
→ YOLO Segmentation으로 사람 탐지
→ 사람 Mask 영역 블러 처리
→ 블러 영상 미리보기 제공
→ 사용자 확인 후 게시
→ 원본 영상 삭제
```

추천 기술 조합:

```text
YOLO Segmentation
+ OpenCV
+ FastAPI
+ FFmpeg
+ GPU 서버
```

---

## 14. 오늘 배운 점

YOLO Segmentation은 객체를 단순히 사각형으로 탐지하는 것이 아니라 객체의 실제 영역을 Mask로 구분하는 기술이다.

사람 블러 처리와 같이 특정 객체만 정확하게 가려야 하는 기능에서는 Object Detection보다 Segmentation이 적합하다.

다만 탐지 누락이 발생할 수 있으므로 실제 개인정보 보호 서비스에서는 얼굴 탐지, 사용자 미리보기, 수동 재블러 기능 등을 함께 구현해야 한다.
