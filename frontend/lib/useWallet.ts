"use client";

import { MiniKit } from "@worldcoin/minikit-js";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function useWallet() {
  const { address: wagmiAddress, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const isInWorldApp = typeof window !== "undefined" && MiniKit.isInstalled();
  const miniKitAddress = isInWorldApp ? MiniKit.user?.walletAddress : undefined;

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
