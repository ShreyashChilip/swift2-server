const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');

// Your existing code continues here...

const app = express();
app.use(bodyParser.json());

// Solana Devnet connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Replace with your token mint address
const TOKEN_MINT_ADDRESS = 'kiQR5Wuj9qHegtDnH1aumUX9SbDt5haN6kirmUrStdo';
const DISTRIBUTOR_PRIVATE_KEY = [120,56,148,31,132,5,11,165,29,129,28,18,124,191,220,8,37,161,233,62,251,36,198,189,91,69,210,155,158,207,250,206,11,50,202,68,224,240,110,18,165,176,221,155,230,219,242,8,15,98,160,3,76,208,179,196,15,139,56,45,40,23,100,218];
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