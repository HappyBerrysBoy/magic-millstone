# 🌐 메인넷 Fork 사용 가이드

이 가이드는 Hardhat을 사용하여 이더리움 메인넷을 로컬에서 fork하여 사용하는 방법을 설명합
니다.

## 📋 설정 단계

### 1. RPC URL 준비

메인넷에 액세스하기 위한 RPC URL이 필요합니다:

**Alchemy (추천):**

```
https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

**Infura:**

```
https://mainnet.infura.io/v3/YOUR_PROJECT_ID
```

**무료 공용 RPC (제한적):**

```
https://eth.public-rpc.com
https://ethereum.publicnode.com
```

### 2. .env 파일 설정

`.env` 파일에 다음 내용을 추가하세요:

```bash
# 메인넷 Fork 활성화
FORK_MAINNET=true

# RPC URL (본인의 API 키로 교체)
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# 테스트용 니모닉
MNEMONIC=test test test test test test test test test test test junk
```

## 🚀 사용 방법

### 1. Fork 모드로 Hardhat 네트워크 시작

```bash
# Fork 활성화하여 로컬 네트워크 시작
yarn hardhat node

# 또는 환경변수와 함께
FORK_MAINNET=true yarn hardhat node
```

### 2. 스크립트 실행

```bash
# Fork된 네트워크에서 테스트 스크립트 실행
yarn hardhat run scripts/test-mainnet-fork.ts --network localhost

# 또는 hardhat 네트워크 직접 사용
yarn hardhat run scripts/test-mainnet-fork.ts --network hardhat
```

### 3. 콘솔에서 상호작용

```bash
# Fork된 네트워크에서 Hardhat 콘솔 시작
yarn hardhat console --network localhost
```

## 🔧 고급 기능

### 1. 특정 블록에서 Fork

`hardhat.config.ts`에서 특정 블록 번호 설정:

```typescript
forking: {
  url: process.env.MAINNET_RPC_URL,
  blockNumber: 18500000, // 특정 블록에서 fork
}
```

### 2. 계정 Impersonation

다른 계정의 상태를 가져와서 테스트:

```typescript
// 특정 주소를 impersonate
await ethers.provider.send('hardhat_impersonateAccount', [address]);
const signer = await ethers.getSigner(address);

// 해당 계정으로 트랜잭션 실행
await contract.connect(signer).someFunction();
```

### 3. 시간 조작

```typescript
// 시간 이동 (1일 = 86400초)
await ethers.provider.send('evm_increaseTime', [86400]);
await ethers.provider.send('evm_mine', []);
```

### 4. 잔액 설정

```typescript
// 특정 주소에 ETH 설정
await ethers.provider.send('hardhat_setBalance', [
  address,
  ethers.toQuantity(ethers.parseEther('1000')), // 1000 ETH
]);
```

## 💡 활용 사례

### 1. 실제 DeFi 프로토콜 테스트

- Uniswap, AAVE, Compound 등 실제 프로토콜과 상호작용
- 실제 유동성과 토큰을 사용한 테스트

### 2. 고래(Whale) 계정 활용

- 대량의 토큰을 보유한 계정을 impersonate
- 실제 시장 조건에서 테스트

### 3. 복잡한 시나리오 테스트

- 여러 프로토콜 간 상호작용
- 시간 경과에 따른 상태 변화 확인

## ⚠️ 주의사항

### 1. 성능

- Fork는 실제 메인넷 상태를 다운로드하므로 느릴 수 있음
- 특정 블록에서 fork하면 초기 로딩 시간 단축 가능

### 2. 제한사항

- 실제 네트워크가 아니므로 완전히 동일하지 않을 수 있음
- RPC 제공업체의 요청 제한에 주의

### 3. 보안

- Fork 환경에서만 실제 메인넷 주소를 impersonate
- 실제 메인넷에서는 절대 사용하지 마세요

## 🛠️ 트러블슈팅

### 1. RPC 오류

```bash
Error: could not detect network
```

- RPC URL 확인
- API 키 유효성 검증
- 네트워크 연결 상태 확인

### 2. 메모리 부족

```bash
JavaScript heap out of memory
```

- Node.js 메모리 증가: `NODE_OPTIONS="--max-old-space-size=8192"`
- 특정 블록에서 fork 설정

### 3. 느린 속도

- 캐시된 fork 사용
- 더 빠른 RPC 제공업체 사용 (Alchemy, Infura)

## 📚 추가 자료

- [Hardhat Network 공식 문서](https://hardhat.org/hardhat-network/)
- [Fork 설정 가이드](https://hardhat.org/hardhat-network/guides/mainnet-forking.html)
- [Alchemy 시작하기](https://www.alchemy.com/)
- [Infura 시작하기](https://infura.io/)
