# 🚀 Sepolia 테스트넷 배포 가이드

## 📋 사전 준비

### 1. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 입력하세요:

```bash
# Sepolia 배포용 Private Key (0x 접두사 포함)
SEPOLIA_PRIVATE_KEY=your_private_key_here

# Sepolia RPC URL (선택 사항 - 기본값 사용 가능)
SEPOLIA_RPC_URL=https://sepolia.gateway.tenderly.co

# Etherscan API Key (컨트랙트 검증용 - 선택 사항)
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

### 2. Sepolia ETH 확보

배포자 계정에 최소 **0.01 ETH** 이상의 Sepolia ETH가 필요합니다.

무료 Faucet에서 받을 수 있습니다:

- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
- [Chainlink Sepolia Faucet](https://faucets.chain.link/sepolia)

### 3. 의존성 설치

```bash
yarn install
```

## 🔧 배포 방법

### 1. 컴파일 확인

```bash
yarn hardhat compile
```

### 2. Sepolia 배포 실행

```bash
yarn hardhat run scripts/deploy-sepolia.ts --network sepolia
```

### 3. 배포 결과 확인

배포가 성공하면 다음과 같은 정보가 출력됩니다:

```
🎉 ==================== 배포 완료 ====================
🌐 네트워크: sepolia
👤 배포자: 0x...
💎 USDT 토큰: 0x...
💎 USDC 토큰: 0x...
🏦 MockLendingProtocol: 0x...
🏗️  MillstoneAIVault 구현체: 0x...
🎯 MillstoneAIVault 프록시: 0x...
=======================================================
```

## 🔍 컨트랙트 검증 (선택 사항)

Etherscan에서 컨트랙트 소스코드를 공개하려면:

```bash
# MillstoneAIVault 구현체 검증
npx hardhat verify --network sepolia <구현체_주소>

# 프록시 검증
npx hardhat verify --network sepolia <프록시_주소> <구현체_주소> "<초기화_데이터>"

# ERC20 토큰들 검증
npx hardhat verify --network sepolia <USDT_주소> "Tether USD (Test)" "USDT" 6 1000000000000
npx hardhat verify --network sepolia <USDC_주소> "USD Coin (Test)" "USDC" 6 1000000000000

# MockLendingProtocol 검증
npx hardhat verify --network sepolia <렌딩프로토콜_주소>
```

## 🧪 배포 후 테스트

### 1. 기본 상호작용

```typescript
// vault 인스턴스 생성
const vault = await ethers.getContractAt('MillstoneAIVault', '<프록시_주소>');

// 토큰 받기 (브릿지 시뮬레이션)
const amount = ethers.parseUnits('100', 6); // 100 USDT
await usdt.approve(vault.address, amount);
await vault.receiveFromBridge(usdt.address, amount);

// 잔액 확인
const [contractBalance, protocolBalance, totalBalance] = await vault.getTokenBalance(
  usdt.address,
);

// 출금 요청
const requestId = await vault.requestWithdraw(usdt.address, ethers.parseUnits('50', 6));

// 출금 클레임 (대기 기간 후)
await vault.claimWithdraw(requestId);
```

### 2. 관리자 기능

```typescript
// 새 렌딩 프로토콜 추가
await vault.addLendingProtocol(usdt.address, newProtocolAddress);

// 특정 프로토콜에 예치
await vault.depositToSpecificProtocol(usdt.address, protocolAddress, amount);

// 프로토콜별 잔액 확인
const balance = await vault.getTokenBalanceInProtocol(usdt.address, protocolAddress);
```

## 🔧 문제 해결

### 가스비 부족

- 가스 가격이 높을 때는 `hardhat.config.ts`에서 `gasPrice` 조정
- 또는 배포 시 `--gas-price` 옵션 사용

### RPC 연결 문제

- `.env`에서 `SEPOLIA_RPC_URL` 변경
- 다른 RPC 프로바이더 사용 (Infura, Alchemy 등)

### Private Key 오류

- Private Key가 `0x`로 시작하는지 확인
- 계정에 충분한 ETH가 있는지 확인

## 📚 추가 정보

- [Hardhat 문서](https://hardhat.org/)
- [OpenZeppelin 업그레이드 가이드](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Sepolia 테스트넷 정보](https://ethereum.org/en/developers/docs/networks/#sepolia)
