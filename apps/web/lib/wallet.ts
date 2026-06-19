'use client';

// Check if MetaMask is available
export function hasMetaMask(): boolean {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

// Request wallet connection
export async function connectWallet(): Promise<string> {
  if (!hasMetaMask()) throw new Error('MetaMask not installed');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

// Get current connected account
export async function getAccount(): Promise<string | null> {
  if (!hasMetaMask()) return null;
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return accounts[0] || null;
}

// Sign a message
export async function signMessage(message: string, address: string): Promise<string> {
  return window.ethereum.request({
    method: 'personal_sign',
    params: [message, address],
  });
}

// Full auth flow
export async function walletAuth(): Promise<{ token: string; user: any; isNew: boolean }> {
  const address = await connectWallet();

  // Step 1: Get nonce
  const nonceRes = await fetch(`/api/auth/wallet?address=${address}`);
  const { nonce } = await nonceRes.json();

  // Step 2: Sign
  const signature = await signMessage(nonce, address);

  // Step 3: Verify
  const authRes = await fetch('/api/auth/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, signature }),
  });

  if (!authRes.ok) throw new Error('Authentication failed');
  return authRes.json();
}

// Add ethereum type
declare global {
  interface Window {
    ethereum?: any;
  }
}
