# JPA 영속성 컨텍스트

## 1. 영속성 컨텍스트란?

* 영속성 컨텍스트는 엔티티를 저장하고 관리하는 논리적인 공간이다.
* DB에서 조회한 데이터를 자바 엔티티 객체로 만들어 애플리케이션 메모리에서 관리한다.
* 단순한 캐시가 아니라 엔티티의 조회, 저장, 수정, 삭제 상태를 관리한다.
* JPA 표준에서는 영속성 컨텍스트의 동작 방식을 정의하고, Hibernate와 같은 구현체가 이를 실제로 구현한다.

```text
데이터베이스
    ↓ 조회
영속성 컨텍스트
    ↓ 관리
엔티티 객체
```

DB의 데이터와 메모리에 존재하는 엔티티 객체는 서로 다른 존재이다.

```java
Member member = entityManager.find(Member.class, 1L);
```

위 코드를 실행하면 DB의 회원 데이터를 조회한 뒤, 해당 데이터를 바탕으로 `Member` 객체가 생성된다. 생성된 객체는 영속성 컨텍스트의 관리 대상이 된다.

---

## 2. EntityManager와 영속성 컨텍스트의 관계

* 개발자는 `EntityManager`를 통해 영속성 컨텍스트에 접근한다.
* `EntityManager`는 엔티티 저장, 조회, 수정, 삭제와 관련된 기능을 제공한다.
* 대표적인 메서드로 `persist()`, `find()`, `remove()`, `detach()` 등이 있다.

```java
entityManager.persist(member);
entityManager.find(Member.class, memberId);
entityManager.remove(member);
entityManager.detach(member);
```

일반적인 Spring 환경에서는 트랜잭션이 시작될 때 현재 트랜잭션에서 사용할 `EntityManager`와 영속성 컨텍스트가 연결된다.

```java
@Transactional
public void updateMember(Long memberId) {
    Member member = entityManager.find(Member.class, memberId);
    member.changeName("성희");
}
```

```text
트랜잭션 시작
    ↓
EntityManager 사용
    ↓
영속성 컨텍스트가 엔티티 관리
    ↓
트랜잭션 종료
```

* 일반적으로 하나의 트랜잭션 안에서는 같은 영속성 컨텍스트를 사용한다.
* 서로 다른 요청이나 트랜잭션이 하나의 1차 캐시를 공용으로 사용하는 것은 아니다.

---

## 3. 엔티티의 생명주기

엔티티는 영속성 컨텍스트와의 관계에 따라 네 가지 상태로 나눌 수 있다.

### 3.1. 비영속

* 자바 객체는 생성되었지만 영속성 컨텍스트가 관리하지 않는 상태이다.
* DB와 직접적인 관련이 없는 일반 객체 상태이다.

```java
Member member = new Member();
member.changeName("성희");
```

### 3.2. 영속

* 엔티티가 영속성 컨텍스트의 관리 대상이 된 상태이다.
* `persist()`를 호출하거나 조회 메서드로 엔티티를 조회하면 영속 상태가 된다.
* 변경 감지와 1차 캐시의 대상이 된다.

```java
entityManager.persist(member);
```

```java
Member member = entityManager.find(Member.class, 1L);
```

### 3.3. 준영속

* 한 번 영속 상태였지만 현재는 영속성 컨텍스트에서 분리된 상태이다.
* 준영속 엔티티의 값이 변경되어도 변경 감지가 동작하지 않는다.

```java
entityManager.detach(member);
```

### 3.4. 삭제

* 엔티티를 DB에서 삭제하도록 등록한 상태이다.
* 트랜잭션이 커밋될 때 삭제 쿼리가 실행된다.

```java
entityManager.remove(member);
```

```text
비영속
  ↓ persist()
영속
  ↓ detach()
준영속

영속
  ↓ remove()
삭제
```

---

## 4. 1차 캐시와 엔티티 동일성 보장

영속성 컨텍스트 내부에는 엔티티를 저장하는 1차 캐시가 있다.

* 엔티티 타입과 식별자를 기준으로 엔티티를 관리한다.
* 같은 영속성 컨텍스트에서 같은 엔티티를 다시 조회하면 1차 캐시의 객체를 반환한다.
* 이미 조회한 엔티티에 대한 불필요한 DB 접근을 줄일 수 있다.

```java
Member member1 = entityManager.find(Member.class, 1L);
Member member2 = entityManager.find(Member.class, 1L);

System.out.println(member1 == member2); // true
```

첫 번째 조회 흐름은 다음과 같다.

```text
find() 호출
    ↓
1차 캐시 확인
    ↓
엔티티 없음
    ↓
SELECT 실행
    ↓
엔티티 생성 및 1차 캐시 저장
```

두 번째 조회 흐름은 다음과 같다.

```text
find() 호출
    ↓
1차 캐시 확인
    ↓
엔티티 존재
    ↓
DB 조회 없이 같은 객체 반환
```

같은 영속성 컨텍스트에서는 동일한 식별자를 가진 엔티티에 대해 객체 동일성을 보장한다.

```java
member1 == member2 // true
```

1차 캐시는 Redis처럼 애플리케이션 전체에서 공유되는 캐시가 아니다. 일반적으로 현재 영속성 컨텍스트 안에서만 사용할 수 있으며, 영속성 컨텍스트가 종료되면 함께 사라진다.

---

## 5. 쓰기 지연과 `flush()`

영속성 컨텍스트는 SQL을 즉시 DB에 전달하지 않고 일정 시점까지 모아 둘 수 있다. 이를 쓰기 지연이라고 한다.

```java
Member member1 = new Member("member1");
Member member2 = new Member("member2");

entityManager.persist(member1);
entityManager.persist(member2);
```

`persist()`를 호출하면 엔티티가 영속 상태가 되고, 필요한 `INSERT` SQL이 쓰기 지연 저장소에 보관될 수 있다.

```text
persist(member1)
    ↓
INSERT SQL 보관

persist(member2)
    ↓
INSERT SQL 보관

flush()
    ↓
SQL을 DB에 전달
```

`flush()`는 영속성 컨텍스트의 변경 내용을 DB와 맞추는 작업이다.

```java
entityManager.flush();
```

다음과 같은 경우 `flush()`가 발생할 수 있다.

* 트랜잭션 커밋 직전
* `entityManager.flush()`를 직접 호출한 경우
* JPQL 실행 전 자동 플러시가 필요한 경우

`flush()`와 커밋은 같은 개념이 아니다.

* `flush()`: SQL을 DB에 전달한다.
* `commit`: 트랜잭션을 확정한다.

따라서 `flush()` 이후에도 트랜잭션이 롤백되면 변경 내용은 최종 반영되지 않을 수 있다.

---

## 6. 변경 감지와 트랜잭션

영속성 컨텍스트는 영속 엔티티의 값이 변경되었는지 확인할 수 있다. 이를 변경 감지 또는 더티 체킹이라고 한다.

```java
@Transactional
public void updateMember(Long memberId) {
    Member member = entityManager.find(Member.class, memberId);
    member.changeName("성희");
}
```

위 코드에서는 수정 후 별도의 `save()`나 `update()`를 호출하지 않았다. 하지만 트랜잭션이 끝날 때 변경 내용이 DB에 반영된다.

변경 감지 과정은 다음과 같다.

```text
엔티티 조회
    ↓
최초 상태를 스냅샷으로 보관
    ↓
엔티티 값 변경
    ↓
flush()
    ↓
현재 상태와 스냅샷 비교
    ↓
변경된 경우 UPDATE 실행
```

* 변경 감지는 영속 상태의 엔티티에만 적용된다.
* 비영속 객체나 준영속 엔티티의 변경은 자동으로 DB에 반영되지 않는다.
* 변경 감지가 동작하려면 일반적으로 트랜잭션 안에서 엔티티를 조회하고 수정해야 한다.

---

## 7. 준영속 상태와 영속성 컨텍스트 초기화

엔티티가 영속성 컨텍스트의 관리에서 벗어나면 준영속 상태가 된다.

### 7.1. `detach()`

특정 엔티티 하나만 영속성 컨텍스트에서 분리한다.

```java
Member member = entityManager.find(Member.class, 1L);

entityManager.detach(member);
member.changeName("변경된 이름");
```

`detach()` 이후의 변경은 변경 감지 대상이 아니다.

### 7.2. `clear()`

영속성 컨텍스트에 관리되고 있던 모든 엔티티를 분리한다.

```java
entityManager.clear();
```

`clear()` 이후 같은 엔티티를 다시 조회하면 1차 캐시가 비어 있으므로 다시 `SELECT` 쿼리가 실행된다.

### 7.3. `close()`

`EntityManager`와 영속성 컨텍스트를 종료한다.

```java
entityManager.close();
```

영속성 컨텍스트가 종료된 뒤에는 관리하던 엔티티가 준영속 상태가 된다.

준영속 상태에서는 다음 기능을 사용할 수 없다.

* 변경 감지
* 1차 캐시를 통한 재조회
* 초기화되지 않은 프록시의 지연 로딩

초기화되지 않은 프록시에서 실제 값을 사용하면 `LazyInitializationException`이 발생할 수 있다.

```text
org.hibernate.LazyInitializationException
```

---

## 8. 영속성 컨텍스트와 프록시·지연 로딩

영속성 컨텍스트에는 실제로 조회된 엔티티만 저장된다. 아직 조회하지 않은 연관 엔티티까지 모두 메모리에 존재하는 것은 아니다.

```java
@Entity
public class Member {

    @ManyToOne(fetch = FetchType.LAZY)
    private Team team;
}
```

`Member`만 조회하면 연관된 `Team`은 바로 조회되지 않을 수 있다.

```java
Member member = entityManager.find(Member.class, 1L);
```

이때 `team` 필드에는 실제 `Team` 엔티티 대신 프록시 객체가 들어갈 수 있다.

```text
영속성 컨텍스트
├── Member 실제 엔티티
└── Team 프록시
```

프록시는 실제 연관 엔티티가 필요한 시점까지 DB 조회를 미루는 대리 객체이다.

```java
Team team = member.getTeam();
```

프록시 객체만 반환하는 시점에는 `Team` 조회 쿼리가 실행되지 않을 수 있다.

```java
String teamName = member.getTeam().getName();
```

실제 데이터가 필요한 메서드를 호출하면 프록시가 영속성 컨텍스트에 초기화를 요청한다.

```text
Team 프록시의 실제 값 사용
    ↓
영속성 컨텍스트에 초기화 요청
    ↓
Team SELECT 실행
    ↓
실제 Team 엔티티 생성 및 관리
```

* 영속성 컨텍스트는 실제 엔티티와 프록시를 관리하는 관리자 역할을 한다.
* 프록시는 아직 조회하지 않은 엔티티의 자리를 대신하는 대리 객체이다.
* 프록시를 초기화하려면 영속성 컨텍스트와의 연결이 유지되어야 한다.
* 트랜잭션이 끝난 뒤 초기화되지 않은 프록시를 사용하면 예외가 발생할 수 있다.
