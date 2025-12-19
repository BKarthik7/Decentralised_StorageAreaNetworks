const fs = require('fs');
const path = require('path');
const solc = require('solc');

async function compile() {
    console.log('Compiling StorageMetadata.sol...');

    const contractPath = path.join(__dirname, '../../contracts/StorageMetadata.sol');

    if (!fs.existsSync(contractPath)) {
        console.error('Contract file not found at:', contractPath);
        process.exit(1);
    }

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
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        let hasError = false;
        output.errors.forEach(err => {
            console.error(err.formattedMessage);
            if (err.severity === 'error') hasError = true;
        });
        if (hasError) process.exit(1);
    }

    // Optional: Write ABI to file if needed for frontend build in CI
    const contractFile = output.contracts['StorageMetadata.sol']['StorageMetadata'];
    const abiPath = path.join(__dirname, '../../frontend/src/artifacts/StorageMetadata.json');

    // Ensure dir exists
    const dir = path.dirname(abiPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(abiPath, JSON.stringify({ abi: contractFile.abi }, null, 2));
    console.log(`Compilation successful. ABI written to ${abiPath}`);
}

compile().catch(err => {
    console.error(err);
    process.exit(1);
});
