# JPA 프록시란?

* 실제 엔티티 대신 사용되는 대리 객체이다.
* 데이터가 실제로 필요한 시점까지 DB 조회를 미룰 수 있다.
* 주로 연관관계의 지연 로딩을 구현할 때 사용된다.
* JPA는 표준 명세이고, 실제 프록시 생성과 동작은 Hibernate 같은 구현체가 담당한다.

---

## 1. `find()`와 `getReference()`

### 1.1. `find()`

```java
Member member = entityManager.find(Member.class, 1L);
```

* 조회 시점에 실제 엔티티를 반환한다.
* 1차 캐시에 엔티티가 없으면 `SELECT` 쿼리를 실행한다.
* 1차 캐시에 이미 존재하면 DB를 조회하지 않는다.

```text
find() 호출
    ↓
1차 캐시 확인
    ↓
엔티티가 없으면 SELECT 실행
    ↓
실제 엔티티 반환
```

### 1.2. `getReference()`

```java
Member member = entityManager.getReference(Member.class, 1L);
```

* 실제 엔티티 대신 프록시 객체를 반환할 수 있다.
* 호출 시점에는 일반적으로 `SELECT` 쿼리가 실행되지 않는다.
* 실제 데이터가 필요한 메서드를 호출할 때 프록시가 초기화된다.

```java
Member member = entityManager.getReference(Member.class, 1L);

System.out.println(member.getClass());
System.out.println("프록시 객체 조회 완료");

System.out.println(member.getName());
```

* `getName()` 호출 시 실제 데이터가 필요하므로 조회 쿼리가 실행된다.
* 프록시는 식별자 값을 이미 가지고 있으므로 일반적으로 `getId()` 호출만으로는 초기화되지 않는다.

```java
Member member = entityManager.getReference(Member.class, 1L);

Long id = member.getId();
```

* 실제 동작은 JPA 구현체나 엔티티의 접근 방식에 따라 달라질 수 있다.
* SQL 로그를 통해 쿼리 실행 시점을 확인하는 것이 좋다.

---

## 2. 프록시 객체의 특징

* 프록시는 실제 엔티티 클래스를 상속받아 생성된다.
* Hibernate가 런타임에 프록시 클래스를 동적으로 만든다.
* 외부에서는 실제 엔티티와 동일한 방식으로 사용할 수 있다.

```java
class MemberProxy extends Member {

    private Member target;
}
```

위 코드는 프록시의 구조를 이해하기 위한 단순화된 예시이다.

```text
Member
   ↑
Member 프록시 객체
```

```java
Member member = entityManager.getReference(Member.class, 1L);

String name = member.getName();
```

* 사용하는 쪽에서는 실제 엔티티인지 프록시인지 구분하지 않고 메서드를 호출할 수 있다.

---

## 3. 프록시 초기화 과정

```java
Member member = entityManager.getReference(Member.class, 1L);

String name = member.getName();
```

프록시 초기화 과정은 다음과 같다.

1. 프록시 객체의 메서드를 호출한다.
2. 프록시가 영속성 컨텍스트에 초기화를 요청한다.
3. 영속성 컨텍스트가 DB를 조회한다.
4. 실제 엔티티가 생성된다.
5. 프록시가 실제 엔티티를 참조한다.
6. 실제 엔티티의 메서드를 호출한다.

```java
Member member = entityManager.getReference(Member.class, 1L);

System.out.println(member.getClass());

member.getName();

System.out.println(member.getClass());
```

* 프록시가 초기화되어도 실제 엔티티 객체로 교체되지는 않는다.
* 초기화 전과 후 모두 같은 프록시 객체이다.
* 프록시 내부에 실제 엔티티에 대한 참조가 설정된다.

---

## 4. 영속성 컨텍스트와 프록시

* 프록시는 영속성 컨텍스트를 통해 초기화된다.
* 초기화되지 않은 프록시가 영속성 컨텍스트에서 분리되면 문제가 발생할 수 있다.

```java
Member member = entityManager.getReference(Member.class, 1L);

entityManager.detach(member);

member.getName();
```

* `detach()` 이후 프록시는 준영속 상태가 된다.
* 이 상태에서 초기화를 시도하면 `LazyInitializationException`이 발생할 수 있다.

```text
org.hibernate.LazyInitializationException
```

* 프록시의 실제 값을 사용할 때는 영속성 컨텍스트가 유지되어야 한다.
* Spring에서는 일반적으로 트랜잭션 안에서 엔티티를 조회하고 사용하는 것이 안전하다.

```java
@Transactional
public MemberResponse findMember(Long memberId) {
    Member member = memberRepository.getReferenceById(memberId);

    return new MemberResponse(
        member.getId(),
        member.getName()
    );
}
```

---

## 5. 1차 캐시와 프록시

* 같은 영속성 컨텍스트에서는 동일한 식별자의 엔티티를 동일한 객체로 관리한다.

### 5.1. 실제 엔티티를 먼저 조회한 경우

```java
Member member1 = entityManager.find(Member.class, 1L);
Member member2 = entityManager.getReference(Member.class, 1L);

System.out.println(member1 == member2);
```

* `find()`로 조회한 실제 엔티티가 1차 캐시에 저장된다.
* 이후 `getReference()`를 호출하면 같은 실제 엔티티를 반환한다.
* `member1 == member2`의 결과는 `true`이다.

### 5.2. 프록시를 먼저 조회한 경우

```java
Member member1 = entityManager.getReference(Member.class, 1L);
Member member2 = entityManager.find(Member.class, 1L);

System.out.println(member1 == member2);
```

* 프록시를 먼저 조회하면 이후 `find()`를 호출해도 같은 프록시 객체를 반환할 수 있다.
* 같은 영속성 컨텍스트에서 엔티티의 동일성을 보장하기 위한 동작이다.

---

## 6. 프록시와 타입 비교

* 프록시는 실제 엔티티를 상속한 하위 타입이다.
* 실제 엔티티와 프록시의 클래스는 서로 다를 수 있다.

```java
Member member = entityManager.getReference(Member.class, 1L);

System.out.println(member.getClass() == Member.class);
```

* 프록시 객체의 클래스는 Hibernate가 동적으로 생성한 클래스이다.
* 따라서 위 비교 결과는 `false`가 될 수 있다.

```java
System.out.println(member instanceof Member);
```

* 프록시는 `Member`를 상속하므로 `instanceof`의 결과는 `true`이다.
* 프록시가 사용될 수 있는 엔티티는 단순한 `getClass()` 비교에 주의해야 한다.

Hibernate에서는 다음과 같이 실제 엔티티 타입을 확인할 수 있다.

```java
Hibernate.getClass(member);
```

* `equals()`와 `hashCode()`를 구현할 때도 프록시 객체를 고려해야 한다.

---

## 7. 지연 로딩과 프록시

```java
@Entity
public class Member {

    @Id
    @GeneratedValue
    private Long id;

    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    private Team team;
}
```

* `Member`를 조회할 때 연관된 `Team`을 바로 조회하지 않는다.
* `team` 필드에는 실제 `Team` 대신 프록시가 들어갈 수 있다.

```java
Member member = entityManager.find(Member.class, 1L);
```

```java
Team team = member.getTeam();
```

* `getTeam()`은 프록시 객체를 반환하므로 쿼리가 실행되지 않을 수 있다.

```java
String teamName = member.getTeam().getName();
```

* `getName()`처럼 실제 데이터가 필요한 메서드를 호출하면 `Team` 조회 쿼리가 실행된다.

```text
Member 조회
    ↓
Team 필드에 프록시 저장
    ↓
Team의 실제 값 사용
    ↓
Team SELECT 실행
```

* 지연 로딩을 사용하면 필요하지 않은 연관 엔티티의 조회를 미룰 수 있다.

---

## 8. 컬렉션의 지연 로딩

```java
@OneToMany(mappedBy = "team", fetch = FetchType.LAZY)
private List<Member> members = new ArrayList<>();
```

* 컬렉션 연관관계도 지연 로딩할 수 있다.
* 컬렉션은 일반적인 엔티티 프록시가 아니라 Hibernate의 컬렉션 래퍼를 사용한다.

```java
Team team = entityManager.find(Team.class, 1L);

System.out.println(team.getMembers().getClass());
```

* `getMembers()` 호출만으로는 컬렉션 내부 데이터가 조회되지 않을 수 있다.

```java
int size = team.getMembers().size();
```

* `size()`처럼 컬렉션의 실제 데이터가 필요한 연산을 수행하면 컬렉션이 초기화된다.
* 이 시점에 `SELECT` 쿼리가 실행된다.

---

## 9. 즉시 로딩과 지연 로딩

### 9.1. 즉시 로딩

```java
@ManyToOne(fetch = FetchType.EAGER)
private Team team;
```

* 엔티티를 조회할 때 연관된 엔티티도 함께 로딩한다.
* 조회 방식에 따라 조인 쿼리 또는 추가 `SELECT` 쿼리가 실행될 수 있다.

### 9.2. 지연 로딩

```java
@ManyToOne(fetch = FetchType.LAZY)
private Team team;
```

* 연관된 엔티티가 실제로 사용될 때 조회한다.
* 실무에서는 연관관계를 기본적으로 지연 로딩으로 설정하는 경우가 많다.
* 연관 데이터를 함께 조회해야 할 때는 페치 조인이나 `EntityGraph`를 사용할 수 있다.

```sql
SELECT m
FROM Member m
JOIN FETCH m.team
WHERE m.id = :memberId
```

* 즉시 로딩을 사용하면 예상하지 못한 추가 쿼리가 발생할 수 있다.
* 여러 연관관계가 한꺼번에 로딩되어 성능 문제가 발생할 수도 있다.

---

## 10. 프록시 사용 시 주의할 점

* 프록시 초기화 시 영속성 컨텍스트가 필요하다.
* 준영속 상태에서 프록시를 초기화하면 `LazyInitializationException`이 발생할 수 있다.
* 실제 엔티티와 프록시의 클래스가 다를 수 있으므로 `getClass()` 비교에 주의해야 한다.
* 반복문에서 지연 로딩이 연속으로 발생하면 N+1 문제가 나타날 수 있다.

```java
List<Member> members = memberRepository.findAll();

for (Member member : members) {
    System.out.println(member.getTeam().getName());
}
```

위 코드에서 실행될 수 있는 쿼리는 다음과 같다.

```text
Member 목록 조회 쿼리 1번
        +
각 Member의 Team 조회 쿼리 N번
        =
총 N + 1번의 쿼리
```

* 프록시 자체가 N+1 문제를 만드는 것은 아니다.
* 연관 엔티티를 반복해서 지연 로딩하는 과정에서 N+1 문제가 발생할 수 있다.
* 지연 로딩은 불필요한 조회를 줄일 수 있지만, 쿼리 실행 시점을 파악하지 못하면 성능 문제가 생길 수 있다.
