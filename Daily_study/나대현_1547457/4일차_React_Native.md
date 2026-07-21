# 0716 학습일지 - React Native 기초 학습

## 1. React Native란?

React Native는 하나의 JavaScript(TypeScript) 코드베이스로 iOS와 Android 네이티브 앱을 만드는 프레임워크다.

웹 React와 문법은 같지만 렌더링 대상이 다르다.

```text
웹 React
→ Virtual DOM → 실제 DOM(HTML 태그)

React Native
→ Virtual DOM → 네이티브 컴포넌트(iOS UIView, Android View)
```

그래서 `div`, `span`, `p` 같은 HTML 태그를 쓸 수 없고, RN이 제공하는 자체 컴포넌트를 사용한다.

---

## 2. 웹 개발자가 헷갈리는 지점

### 태그 체계

```text
웹
div → View
span, p → Text
img → Image
input → TextInput
ul/li, div 반복 → FlatList
```

텍스트는 반드시 `Text` 컴포넌트로 감싸야 한다. `View` 안에 문자열을 그냥 넣으면 에러가 난다.

```tsx
// 에러
<View>안녕하세요</View>

// 정상
<View>
  <Text>안녕하세요</Text>
</View>
```

### 스타일링

CSS 파일을 그대로 쓸 수 없다. `StyleSheet.create`로 객체를 만들어 사용한다.

```tsx
import { StyleSheet, View, Text } from 'react-native';

function Card() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>제목</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F2F4F6'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold'
  }
});
```

레이아웃 기본값이 웹과 다르다.

```text
웹
→ display: block이 기본값

React Native
→ display: flex가 기본값, flexDirection: column이 기본값
```

가로 정렬을 하려면 `flexDirection: 'row'`를 명시적으로 줘야 한다.

---

## 3. 프로젝트 구조

```text
App.tsx
→ 앱의 진입점, NavigationContainer로 감쌈

navigation/
→ Stack, Tab 등 화면 이동 구조 정의

screens/
→ 실제 화면 단위 컴포넌트

components/
→ 재사용 가능한 UI 조각

hooks/
→ 커스텀 훅

types/
→ 공용 타입 정의 (navigation param, API 응답 등)

api/
→ axios 인스턴스, API 호출 함수
```

---

## 4. React Navigation 기본 구조

화면 전환은 웹처럼 URL 기반 라우팅이 아니라 스택 구조로 관리한다.

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import DetailScreen from './screens/DetailScreen';

export type RootStackParamList = {
  Home: undefined;
  Detail: { id: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Detail" component={DetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

화면 이동은 `navigation.navigate`로 처리한다.

```tsx
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <Button
      title="상세보기"
      onPress={() => navigation.navigate('Detail', { id: 1 })}
    />
  );
}
```

`RootStackParamList`로 화면 이름과 파라미터 타입을 미리 정의해두면, 잘못된 파라미터를 넘길 때 컴파일 단계에서 오류를 잡을 수 있다.

---

## 5. 리스트 렌더링 - FlatList

`map()`으로 직접 리스트를 그리면 항목이 많아질 때 성능 문제가 생긴다. RN은 `FlatList`로 화면에 보이는 부분만 렌더링한다.

```tsx
import { FlatList, Text } from 'react-native';

type Todo = { id: number; text: string };

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <FlatList
      data={todos}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <Text>{item.text}</Text>}
    />
  );
}
```

```text
map()으로 직접 렌더링
→ 항목 전체를 한 번에 그림, 리스트가 길어지면 느려짐

FlatList
→ 화면에 보이는 항목만 렌더링(가상화), 스크롤 시 나머지를 순차 렌더링
```

---

## 6. 데이터 저장 - AsyncStorage

웹의 `localStorage`에 대응하는 저장소다. 단, 비동기로만 접근할 수 있다.

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

async function saveToken(token: string) {
  await AsyncStorage.setItem('accessToken', token);
}

async function loadToken() {
  const token = await AsyncStorage.getItem('accessToken');
  return token;
}
```

```text
localStorage (웹)
→ 동기 API, 즉시 값 반환

AsyncStorage (RN)
→ 비동기 API, Promise 반환
```

로그인 토큰처럼 민감한 값은 AsyncStorage보다 암호화 저장이 가능한 `SecureStore`(Expo) 또는 Keychain 기반 라이브러리를 쓰는 것이 안전하다.

---

## 7. API 통신 레이어

axios 인스턴스를 하나 만들어서 공통 설정(baseURL, 헤더, 인터셉터)을 모아둔다.

```tsx
// api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const apiClient = axios.create({
  baseURL: 'https://api.example.com'
});

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

응답 타입은 백엔드 스펙에 맞춰 인터페이스로 정의해둔다.

```tsx
// types/api.ts
export interface UserResponse {
  id: number;
  nickname: string;
  age: number;
}
```

```tsx
import { apiClient } from './client';
import type { UserResponse } from '../types/api';

export async function fetchUser(id: number): Promise<UserResponse> {
  const res = await apiClient.get<UserResponse>(`/users/${id}`);
  return res.data;
}
```

---

## 8. TypeScript와 함께 쓸 때 주의할 점

### Props 타입

```tsx
type CardProps = {
  title: string;
  onPress?: () => void;
};

function Card({ title, onPress }: CardProps) {
  return (
    <Pressable onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  );
}
```

### 네비게이션 파라미터

화면별로 전달받는 파라미터가 다르므로, `RootStackParamList`에 정의한 타입을 각 화면에서 가져와 써야 한다.

```tsx
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

function DetailScreen({ route }: Props) {
  const { id } = route.params; // number 타입으로 추론됨
  return <Text>{id}</Text>;
}
```

---

## 9. 웹 React와의 차이 정리

```text
렌더링 대상
웹 → DOM
RN → 네이티브 컴포넌트

레이아웃 기본값
웹 → block
RN → flex, column

스타일 작성
웹 → CSS 파일, className
RN → StyleSheet.create, style prop

라우팅
웹 → URL 기반(React Router)
RN → 스택 기반(React Navigation)

저장소
웹 → localStorage(동기)
RN → AsyncStorage(비동기)

리스트 렌더링
웹 → map() 그대로 사용 가능
RN → FlatList로 가상화 필요
```

---

## 10. 장점

```text
1. iOS/Android 코드베이스를 하나로 관리할 수 있다.
2. 웹 React 문법을 그대로 재사용할 수 있어 학습 곡선이 상대적으로 낮다.
3. TypeScript와 결합하면 네비게이션 파라미터, API 응답까지 타입으로 검증할 수 있다.
4. FlatList, Expo 등 생태계가 성숙해 있다.
```

---

## 11. 단점

```text
1. 네이티브 기능(카메라, 푸시 등)은 결국 네이티브 모듈 연동이 필요할 수 있다.
2. 웹과 스타일링 방식이 달라 초반에 flex 레이아웃에 적응하는 시간이 든다.
3. 디버깅 시 네이티브 로그와 JS 로그를 같이 봐야 하는 경우가 있다.
4. 라이브러리 버전 호환성 문제(RN 버전 업그레이드 시)가 종종 발생한다.
```

---

## 12. 핵심 정리

```text
View / Text / FlatList
→ 웹의 div, span, 리스트 반복을 대체하는 RN 전용 컴포넌트

StyleSheet.create
→ CSS 대신 객체로 스타일을 정의, flex가 기본 레이아웃

React Navigation
→ URL 대신 스택 구조로 화면 전환을 관리

AsyncStorage
→ localStorage에 대응하는 비동기 저장소

RootStackParamList
→ 화면 이름과 파라미터를 타입으로 고정해 컴파일 시점에 오류 확인
```

전체 흐름은 다음과 같다.

```text
화면 컴포넌트 작성(screens/)
→ 네비게이션 스택에 등록
→ 타입(RootStackParamList)으로 파라미터 검증
→ API 레이어(api/)에서 서버 데이터 요청
→ FlatList 등으로 화면에 렌더링
```