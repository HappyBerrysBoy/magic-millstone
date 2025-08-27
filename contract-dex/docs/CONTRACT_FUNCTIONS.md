# MillstoneAIVault 스마트 컨트랙트 함수 설명서

## 📋 개요
MillstoneAIVault는 USDT를 AAVE와 Morpho 프로토콜에 분산 투자하는 vault 컨트랙트입니다.
- **Performance Fee 모델**: 수익의 10%를 자동 수집
- **Yield-bearing Token**: 사용자에게 수익률을 반영하는 share 토큰 발행
- **Multi-Protocol**: AAVE V3와 Morpho(Steakhouse USDT Vault) 지원
- **Upgradeable**: UUPS 프록시 패턴으로 업그레이드 가능

---

## 🔧 관리자 함수들

### `initialize(address _owner)`
**설명**: 컨트랙트 초기화 (프록시 배포 시 호출)
- Performance Fee 기본값: 10%
- Fee 수취인: 배포자로 기본 설정

### `setSupportedToken(address token, bool supported)`
**설명**: 지원 토큰 설정
- 새 토큰 추가 시 기본 50:50 분배 비율로 설정
- `TokenSupported` 이벤트 발생

**매개변수**:
- `token`: 토큰 컨트랙트 주소
- `supported`: 지원 여부 (true/false)

### `setProtocolAllocations(address token, uint256 aavePercentage, uint256 morphoPercentage)`
**설명**: 프로토콜 분배 비율 설정
- 두 비율의 합은 반드시 10000 (100%)이어야 함
- Basis Points 단위 (7000 = 70%)

**매개변수**:
- `token`: 대상 토큰 주소
- `aavePercentage`: AAVE 분배 비율 (basis points)
- `morphoPercentage`: Morpho 분배 비율 (basis points)

### `setAaveConfig(address _aavePool, address token, address aToken)`
**설명**: AAVE 설정
**매개변수**:
- `_aavePool`: AAVE Pool V3 주소
- `token`: 원본 토큰 주소 (USDT)
- `aToken`: AAVE에서 발행하는 aToken 주소 (aUSDT)

### `setMorphoVault(address token, address vault)`
**설명**: Morpho vault 설정
**매개변수**:
- `token`: 대상 토큰 주소
- `vault`: Morpho vault 주소 (ERC4626 호환)

### `setBridgeAuthorization(address bridge, bool authorized)`
**설명**: Bridge 권한 설정
**매개변수**:
- `bridge`: Bridge 컨트랙트 주소
- `authorized`: 권한 부여 여부

### `setPerformanceFeeRate(uint256 _feeRate)`
**설명**: Performance Fee 비율 설정
- 최대 2000 (20%)까지 설정 가능
- Basis Points 단위 (1000 = 10%)

### `setFeeRecipient(address _feeRecipient)`
**설명**: Fee 수취인 설정

---

## 💰 사용자 함수들

### `deposit(address token, uint256 assets)`
**설명**: Yield-bearing token 예치
**프로세스**:
1. Performance fee 자동 수집
2. 토큰을 vault로 전송
3. Share 계산 및 발행 (fee 제외 가치 기준)
4. 설정된 비율로 AAVE/Morpho에 분산 투자
5. `SharesMinted` 이벤트 발생

**매개변수**:
- `token`: 예치할 토큰 주소
- `assets`: 예치할 토큰 수량

**반환값**:
- `shares`: 발행된 share 수량

### `redeem(address token, uint256 shares)`
**설명**: Share를 통한 출금
**프로세스**:
1. Performance fee 자동 수집
2. Share를 asset으로 변환 계산
3. 프로토콜에서 비례적으로 출금
4. Share 소각
5. 사용자에게 토큰 전송

**매개변수**:
- `token`: 출금할 토큰 주소
- `shares`: 출금할 share 수량

**반환값**:
- `assets`: 실제 출금된 토큰 수량

### `receiveFromBridge(address token, uint256 amount)`
**설명**: Bridge에서 자금 수신 (기존 방식 하위 호환)
- 권한 있는 bridge만 호출 가능
- Performance fee 자동 수집 후 프로토콜에 분산 투자

---

## 📊 조회 함수들

### `getTotalValue(address token)`
**설명**: 전체 vault 가치 조회
**계산 방식**:
- 컨트랙트 직접 보유 잔액
- AAVE aToken 잔액
- Morpho vault shares의 asset 가치

### `getProtocolBalances(address token)`
**설명**: 프로토콜별 잔액 조회
**반환값**:
- `aaveBalance`: AAVE에 예치된 수량
- `morphoBalance`: Morpho에 예치된 수량  
- `totalBalance`: 총 프로토콜 예치 수량

### `getUserInfo(address user, address token)`
**설명**: 사용자 정보 조회 (fee 제외 가치 기준)
**반환값**:
- `shares`: 보유 share 수량
- `assets`: share의 현재 asset 가치
- `shareValue`: share 단가 (18 decimals)

### `getAllocations(address token)`
**설명**: 프로토콜 분배 비율 조회
**반환값**:
- `aave`: AAVE 분배 비율 (basis points)
- `morpho`: Morpho 분배 비율 (basis points)

---

## 💎 Performance Fee 함수들

### `_collectPerformanceFee(address token)` (내부 함수)
**설명**: Performance fee 자동 수집
**수집 로직**:
1. 현재 총 가치와 원금 비교
2. 전체 수익 계산 (현재 가치 - 원금)
3. 예상 total fee 계산 (수익 × fee 비율)
4. 이미 수집된 fee와 비교하여 추가 수집
5. `PerformanceFeeCollected` 이벤트 발생

### `withdrawPerformanceFee(address token, uint256 amount)`
**설명**: Performance fee 부분 인출
- Fee 수취인 또는 owner만 호출 가능
- 프로토콜에서 실제 토큰 인출 후 전송

### `withdrawAllFees(address token)`
**설명**: 누적된 모든 Performance fee 인출
- 내부적으로 `withdrawPerformanceFee` 로직 사용

### `getFeeInfo(address token)`
**설명**: Fee 관련 정보 조회
**반환값**:
- `feeRate`: Performance fee 비율 (basis points)
- `accumulatedFeeAmount`: 누적된 fee 수량
- `totalFeesWithdrawnAmount`: 총 인출된 fee 수량  
- `recipient`: Fee 수취인 주소

---

## 📈 수익률 계산 함수들

### `calculateYield(address token)`
**설명**: 전체 수익률 계산 (fee 포함)
**반환값**:
- `totalValue`: 현재 총 가치
- `principal`: 원금 (예치 - 출금)
- `yieldAmount`: 수익 금액
- `yieldRate`: 수익률 (basis points)

### `calculateNetYield(address token)`
**설명**: 사용자 순 수익률 계산 (fee 제외)
**반환값**:
- `totalValue`: 현재 총 가치
- `principal`: 원금
- `grossYield`: 총 수익
- `feeAmount`: Performance fee 금액
- `netYield`: 순 수익 (사용자 몫)
- `netYieldRate`: 순 수익률 (basis points)

### `getTokenStats(address token)`
**설명**: 토큰 통계 정보
**반환값**:
- `deposited`: 총 예치량
- `withdrawn`: 총 출금량
- `totalSharesSupply`: 총 share 발행량
- `currentValue`: 현재 총 가치

---

## 🔄 리밸런싱 함수

### `rebalance(address token)`
**설명**: 프로토콜 간 자금 리밸런싱
**로직**:
1. 현재 각 프로토콜 잔액 조회
2. 목표 분배 비율과 현재 비율 비교
3. 5% 이상 차이 날 때만 리밸런싱 실행
4. 초과 프로토콜에서 출금 → 부족 프로토콜에 예치

---

## 🔒 내부 유틸리티 함수들

### `_convertToShares(address token, uint256 assets)`
**설명**: Asset을 Share로 변환 (fee 제외 가치 기준)

### `_convertToAssets(address token, uint256 shares)`  
**설명**: Share를 Asset으로 변환 (fee 제외 가치 기준)

### `_getNetValue(address token)`
**설명**: Fee를 제외한 순 자산 가치 계산

### `_depositToProtocols(address token, uint256 amount)`
**설명**: 설정된 비율로 프로토콜에 분산 예치

### `_withdrawFromProtocols(address token, uint256 amount)`
**설명**: 설정된 비율로 프로토콜에서 출금

### `_depositToAave(address token, uint256 amount)`
**설명**: AAVE Pool V3에 예치

### `_depositToMorpho(address token, uint256 amount)`
**설명**: Morpho vault(ERC4626)에 예치

### `_withdrawFromAave(address token, uint256 amount)`
**설명**: AAVE에서 출금

### `_withdrawFromMorpho(address token, uint256 amount)`
**설명**: Morpho vault에서 출금

---

## 📝 이벤트들

| 이벤트명 | 설명 |
|---------|------|
| `TokenSupported` | 토큰 지원 설정 변경 |
| `AllocationSet` | 프로토콜 분배 비율 변경 |
| `SharesMinted` | Share 발행 |
| `SharesRedeemed` | Share 소각/출금 |
| `ProtocolDeposit` | 프로토콜 예치 |
| `PerformanceFeeSet` | Performance fee 비율 변경 |
| `FeeRecipientSet` | Fee 수취인 변경 |
| `PerformanceFeeCollected` | Performance fee 수집 |
| `PerformanceFeeWithdrawn` | Performance fee 인출 |

---

## 💡 핵심 특징

### 1. **Yield-bearing Token 시스템**
- 사용자는 share를 받고, share 가치가 수익률에 따라 증가
- Fee 제외 가치로 share 가격 계산

### 2. **자동 Performance Fee 수집**
- `deposit()`, `redeem()`, `receiveFromBridge()` 호출 시 자동 실행
- 전체 수익 기준으로 정확한 fee 계산

### 3. **Multi-Protocol 분산 투자**
- AAVE V3와 Morpho에 설정 가능한 비율로 분산
- 리밸런싱 기능으로 목표 비율 유지

### 4. **UUPS Upgradeable**
- 프록시 패턴으로 업그레이드 가능
- Owner만 업그레이드 권한 보유

이 컨트랙트는 사용자에게 자동화된 분산 투자와 performance fee가 적용된 수익 분배를 제공합니다.