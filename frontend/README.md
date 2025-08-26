# ![Magic Millstone Logo](/frontend/public/images/MillstoneIcon.png) Magic Millstone 


**Korea Stablecoin Hackathon - Kaia-Native USDT DeFi Track Participant**

This project was bootstrapped with Dapp Starter.

---
## 🚀 Getting Started

### ✅ Prerequisites

• Node.js v20.x (LTS) recommended (tested on v20.18.0, Node ≥ 18.0.0 works)

• pnpm or npm

---
### 📂 Cloning
```
# Fork and clone the repository
git clone https://github.com/your-username/magic-millstone.git

# Move into project directory
cd frontend

```
---

### ▶️ Starting
1. Install dependencies

```
# with pnpm (recommended)
pnpm install
# or npm
npm install
```

---

2. Add `.env.local and .env.production` file.

If needed, other environment files can be added.
To open template code, `.env*` file should include basic variables. Here's example for `.env.local` file.

```
NODE_ENV=local
NEXT_PUBLIC_CLIENT_ID={clientId provided when applying for the SDK}
NEXT_PUBLIC_CHAIN_ID=1001 //testnet
CLIENT_SECRET={clientSecret provided when applying for the SDK}
NEXT_PUBLIC_API_URL=https://dapp-starter.netlify.app //change with your domain
NEXT_PUBLIC_LIFF_ID={LIFF ID provided when enrolling LIFF app at LINE Developers}
```


---

## 📚 References

- [LINE Developers – LIFF Guide](https://developers.line.biz/en/docs/liff/overview/)
- [Kaia Dapp Portal SDK Guide](https://docs.dappportal.io/mini-dapp/mini-dapp-sdk)
- [Kaia Documentation](https://docs.kaia.io/)


---

## 🙏 Thanks to

This project was bootstrapped with [Dapp Starter](https://docs.dappportal.io/mini-dapp/mini-dapp-sdk),  
a framework integrated with **dapp-portal-sdk** and **LIFF** for easier Kaia Mini Dapp development.