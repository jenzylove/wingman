"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { wagmiConfig } from "@/lib/wallet/wagmi";
import { SolanaWalletProvider } from "@/lib/wallet/solana";

export default function Providers({ children, initialState }: { children: React.ReactNode; initialState?: State }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={client}>
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
