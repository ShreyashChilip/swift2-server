const { Connection, Keypair, PublicKey, Transaction, TOKEN_PROGRAM_ID } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');

const app = express();
app.use(bodyParser.json());

// Solana Devnet connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Replace with your token mint address
const TOKEN_MINT_ADDRESS = 'mnts9NMk2ZPtcUjtcRtHgXz2ungkrrCQzXsCFPTGTae';
const DISTRIBUTOR_PRIVATE_KEY = [222,166,197,173,241,181,236,124,196,160,132,79,248,166,26,24,138,96,170,17,35,45,215,205,179,162,243,153,154,235,114,18,11,121,114,199,106,39,220,170,6,7,72,219,188,118,16,144,81,229,69,178,93,45,136,87,87,58,29,160,21,173,137,255];
const distributorKeypair = Keypair.fromSecretKey(Uint8Array.from(DISTRIBUTOR_PRIVATE_KEY));

// API to update user scores
app.post('/update-scores', (req, res) => {
  const { scores } = req.body;

  if (!Array.isArray(scores)) {
    return res.status(400).send('Invalid input format');
  }

  userScores = scores;
  res.send('Scores updated successfully');
});

// Dummy function to handle token distribution (replace with actual logic)
async function distributeTokens() {
  // Add your logic for distributing tokens periodically, if required.
  console.log("Token distribution logic goes here.");
}

// Schedule token distribution at midnight every day
cron.schedule('0 0 * * *', () => {
  distributeTokens().catch((error) => {
    console.error('Error during token distribution:', error.message);
  });
});

// API endpoint to transfer tokens based on wallet and carbon score
app.post('/transfer-tokens', async (req, res) => {
  const { wallet, carbonScore } = req.body;

  if (!wallet || !carbonScore || carbonScore <= 0) {
    return res.status(400).send('Invalid input: wallet address or carbon score is missing/invalid');
  }

  try {
    const mintPublicKey = new PublicKey(TOKEN_MINT_ADDRESS);
    const tokensToDistribute = carbonScore * 10; // Adjust multiplier as needed

    // Get or create the recipient's associated token account
    const recipientWallet = new PublicKey(wallet);
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(connection, distributorKeypair, mintPublicKey, recipientWallet);

    // Get the distributor's associated token account
    const distributorTokenAccount = await getOrCreateAssociatedTokenAccount(connection, distributorKeypair, mintPublicKey, distributorKeypair.publicKey);

    const transaction = new Transaction().add(
      createTransferInstruction(
        distributorTokenAccount.address,
        recipientTokenAccount.address,
        distributorKeypair.publicKey,
        tokensToDistribute * 1e9 // Convert tokens to smallest unit
      )
    );

    // Send the transaction
    const signature = await connection.sendTransaction(transaction, [distributorKeypair]);

    return res.status(200).json({
      message: 'Tokens transferred successfully',
      transaction: signature
    });
  } catch (error) {
    console.error('Token transfer failed:', error.message);
    return res.status(500).send('Error during token transfer');
  }
});

// Start server on the specified port
const PORT = process.env.PORT || 3030;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});