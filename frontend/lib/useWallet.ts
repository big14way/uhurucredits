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
        // Try to get wallet address; may be available immediately or after walletAuth
        const addr = MiniKit.user?.walletAddress;
        if (addr) setMiniKitAddress(addr);
      }
    } catch { setIsInWorldApp(false); }
  }, []);

  // MiniKit takes priority; otherwise use wagmi
  const address: string = miniKitAddress || wagmiAddress || ZERO_ADDRESS;
  const hasWallet = isInWorldApp || isConnected;

  function connectWallet() {
    connect({ connector: injected() });
  }

  return {
    address,
    hasWallet,
    isInWorldApp,
    isConnected: hasWallet,
    connectWallet,
    disconnect,
  };
}
