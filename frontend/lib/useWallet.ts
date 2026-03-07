"use client";

import { useState, useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function useWallet() {
  const { address: wagmiAddress, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [isInWorldApp, setIsInWorldApp] = useState(false);
  const [miniKitAddress, setMiniKitAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const installed = MiniKit.isInstalled();
      setIsInWorldApp(installed);
      if (installed) {
        // MiniKit v4: walletAddress is a top-level property
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addr = (MiniKit as any).walletAddress ?? MiniKit.user?.walletAddress;
        if (addr) setMiniKitAddress(addr);
      }
    } catch { setIsInWorldApp(false); }
  }, []);

  // Call this to authenticate and get wallet address inside World App
  async function connectWithWorldApp(): Promise<boolean> {
    try {
      const result = await MiniKit.commandsAsync.walletAuth({
        nonce: Math.random().toString(36).slice(2, 18),
        statement: "Sign in to Uhuru Credit to access micro-loans",
        expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notBefore: new Date(Date.now() - 1000),
      });
      if (result.finalPayload.status === "success") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addr = (result.finalPayload as any).address;
        if (addr) {
          setMiniKitAddress(addr);
          return true;
        }
      }
    } catch { /* silently fail */ }
    return false;
  }

  function connectWallet() {
    connect({ connector: injected() });
  }

  const address: string = miniKitAddress || wagmiAddress || ZERO_ADDRESS;
  // hasWallet is true only when we actually have a usable address
  const hasWallet = (isInWorldApp && !!miniKitAddress) || isConnected;

  return {
    address,
    hasWallet,
    isInWorldApp,
    miniKitAddress,
    isConnected: hasWallet,
    connectWallet,
    connectWithWorldApp,
    disconnect,
  };
}
