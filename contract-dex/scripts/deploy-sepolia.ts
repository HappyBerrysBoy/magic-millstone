import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying Magic Millstone AI Vault to Sepolia ===\n');

  // Check if private key is configured
  if (!process.env.SEPOLIA_PRIVATE_KEY) {
    throw new Error('SEPOLIA_PRIVATE_KEY environment variable is not set');
  }

  // Get signers
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer balance:', ethers.formatEther(balance), 'ETH');

  if (balance < ethers.parseEther('0.01')) {
    throw new Error('Insufficient balance for deployment. Need at least 0.01 ETH');
  }

  try {
    // 1. Deploy MockERC20 tokens (USDT, USDC)
    console.log('\n1. Deploying MockERC20 tokens...');

    const MockERC20 = await ethers.getContractFactory('MockERC20');

    const usdt = await MockERC20.deploy(
      'Tether USD (Test)',
      'USDT',
      6,
      ethers.parseUnits('1000000000', 6),
    );
    await usdt.waitForDeployment();
    console.log('USDT deployed to:', usdt.target);

    const usdc = await MockERC20.deploy(
      'USD Coin (Test)',
      'USDC',
      6,
      ethers.parseUnits('1000000000', 6),
    );
    await usdc.waitForDeployment();
    console.log('USDC deployed to:', usdc.target);

    // 2. Deploy MockLendingProtocol
    console.log('\n2. Deploying MockLendingProtocol...');

    const MockLendingProtocol = await ethers.getContractFactory('MockLendingProtocol');
    const mockProtocol = await MockLendingProtocol.deploy();
    await mockProtocol.waitForDeployment();
    console.log('MockLendingProtocol deployed to:', mockProtocol.target);

    // 3. Deploy MillstoneAIVault implementation
    console.log('\n3. Deploying MillstoneAIVault implementation...');

    const MillstoneAIVault = await ethers.getContractFactory('MillstoneAIVault');
    const implementation = await MillstoneAIVault.deploy();
    await implementation.waitForDeployment();
    console.log('MillstoneAIVault implementation deployed to:', implementation.target);

    // 4. Deploy EIP1967Proxy
    console.log('\n4. Deploying EIP1967Proxy...');

    const EIP1967Proxy = await ethers.getContractFactory('EIP1967Proxy');
    const initData = implementation.interface.encodeFunctionData('initialize', [
      deployer.address,
    ]);
    const proxy = await EIP1967Proxy.deploy(implementation.target, initData);
    await proxy.waitForDeployment();
    console.log('EIP1967Proxy deployed to:', proxy.target);

    // 5. Create vault instance through proxy
    const vault = MillstoneAIVault.attach(proxy.target);

    // 6. Initial setup
    console.log('\n5. Initial setup...');

    // Set fee recipient
    await vault.setFeeRecipient(deployer.address);
    console.log('Fee recipient set to:', deployer.address);

    // Set performance fee rate (10%)
    await vault.setPerformanceFeeRate(1000);
    console.log('Performance fee rate set to 10%');

    // Set supported tokens
    await vault.setSupportedToken(usdt.target, true);
    await vault.setSupportedToken(usdc.target, true);
    console.log('USDT and USDC set as supported tokens');

    // Set bridge authorization for deployer (for testing)
    await vault.setBridgeAuthorization(deployer.address, true);
    console.log('Bridge authorization set for deployer');

    // Set protocol allocations (70% AAVE, 30% Morpho)
    await vault.setProtocolAllocations(usdt.target, 7000, 3000);
    await vault.setProtocolAllocations(usdc.target, 7000, 3000);
    console.log('Protocol allocations set (70% AAVE, 30% Morpho)');

    // Set security parameters
    await vault.setMaxRateIncrease(usdt.target, 1000); // 10% daily max
    await vault.setMaxRateIncrease(usdc.target, 1000);
    await vault.setBridgeLimit(deployer.address, ethers.parseUnits('1000000', 6)); // 1M daily limit
    console.log('Security parameters configured');

    console.log('\n=== Deployment Summary ===');
    console.log('Network: Sepolia');
    console.log('Deployer:', deployer.address);
    console.log('USDT Token:', usdt.target);
    console.log('USDC Token:', usdc.target);
    console.log('MockLendingProtocol:', mockProtocol.target);
    console.log('MillstoneAIVault Implementation:', implementation.target);
    console.log('MillstoneAIVault Proxy:', proxy.target);
    console.log('=======================================================');

    // Save deployment info
    const deploymentInfo = {
      network: 'sepolia',
      deployer: deployer.address,
      usdt: usdt.target,
      usdc: usdc.target,
      mockProtocol: mockProtocol.target,
      implementation: implementation.target,
      proxy: proxy.target,
      timestamp: new Date().toISOString(),
    };

    console.log('\nDeployment completed successfully!');
    console.log('You can now interact with the vault at:', proxy.target);
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
