const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });

const testBlockchain = async () => {
    try {
        const url = process.env.ETH_PROVIDER_URL || 'http://127.0.0.1:7545';
        console.log(`Connecting to ${url}...`);
        const provider = new ethers.JsonRpcProvider(url);

        const blockNumber = await provider.getBlockNumber();
        console.log(`Block Number: ${blockNumber}`);

        const feeData = await provider.getFeeData();
        console.log(`Fee Data:`, feeData);

        const block = await provider.getBlock(blockNumber, true);
        console.log(`Latest Block:`, block);

        if (block && block.prefetchedTransactions) {
            console.log(`Prefetched Txs: ${block.prefetchedTransactions.length}`);
        } else {
            console.log('No prefetchedTransactions property found on block');
            console.log('block.transactions:', block.transactions);
        }

    } catch (err) {
        console.error('Error:', err);
    }
};

testBlockchain();
