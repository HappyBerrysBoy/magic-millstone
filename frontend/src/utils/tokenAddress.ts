export const usdtTokenAddress = () => {
  const address = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS;
  if (!address) return "token address not found";
  return address;
};

export const mmUsdtTokenAddress = () => {
  const address = process.env.NEXT_PUBLIC_MMUSDT_CONTRACT_ADDRESS;
  if (!address) return "token address not found";
  return address;
};
