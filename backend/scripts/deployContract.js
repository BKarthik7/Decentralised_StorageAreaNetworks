const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

async function deploy() {
    console.log('Starting deployment to Ganache...');

    // 1. Compile Contract
    const contractPath = path.join(__dirname, '../../contracts/StorageMetadata.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    const input = {
        language: 'Solidity',
        sources: {
            'StorageMetadata.sol': {
                content: source,
            },
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            evmVersion: 'paris',
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    console.log('Compiling...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        output.errors.forEach(err => console.error(err.formattedMessage));
        if (output.errors.some(e => e.severity === 'error')) process.exit(1);
    }

    const contractFile = output.contracts['StorageMetadata.sol']['StorageMetadata'];
    const abi = contractFile.abi;
    const bytecode = contractFile.evm.bytecode.object;

    // 2. Connect to Ganache
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:7545');
    // Use first signer
    const signer = await provider.getSigner(0);
    console.log('Deploying with account:', await signer.getAddress());

    // 3. Deploy
    const factory = new ethers.ContractFactory(abi, bytecode, signer);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log('Contract deployed at:', address);

    // 4. Update .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    // Update or Append CONTRACT_ADDRESS
    const regex = /^CONTRACT_ADDRESS=.*$/m;
    const newEntry = `CONTRACT_ADDRESS=${address}`;

    if (envContent.match(regex)) {
        envContent = envContent.replace(regex, newEntry);
    } else {
        envContent += `\n${newEntry}`;
    }

    // Ensure ETH_PROVIDER_URL is set
    if (!envContent.includes('ETH_PROVIDER_URL')) {
        envContent += `\nETH_PROVIDER_URL=http://127.0.0.1:7545`;
    } else {
        // Force update to 7545 if it exists but is different
        envContent = envContent.replace(/ETH_PROVIDER_URL=.*/g, 'ETH_PROVIDER_URL=http://127.0.0.1:7545');
    }

    fs.writeFileSync(envPath, envContent);
    console.log('Updated backend/.env');
}

deploy().catch(console.error);
