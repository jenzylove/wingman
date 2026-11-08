"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

/** The slice of Phantom's injected provider that Wingman uses. */
interface PhantomProvider {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  isConnected: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signMessage(message: Uint8Array, display?: "utf8" | "hex"): Promise<{ signature: Uint8Array; publicKey: PublicKey }>;
  on(event: "connect" | "disconnect" | "accountChanged", handler: (arg?: PublicKey | null) => void): void;
  removeListener?(event: string, handler: (arg?: PublicKey | null) => void): void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

function getProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const p = window.phantom?.solana ?? window.solana;
  return p ?? null;
}

export interface SolanaWallet {
  available: boolean;
  publicKey: string | null;
  connecting: boolean;
  error: string | null;
  connect(): Promise<string | null>;
  disconnect(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

const Ctx = createContext<SolanaWallet | null>(null);

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = getProvider();
    setAvailable(!!p);
    if (!p) return;
    const onConnect = (pk?: PublicKey | null) => setPublicKey(pk ? pk.toBase58() : (p.publicKey?.toBase58() ?? null));
    const onDisconnect = () => setPublicKey(null);
    const onChange = (pk?: PublicKey | null) => setPublicKey(pk ? pk.toBase58() : null);
    p.on("connect", onConnect);
    p.on("disconnect", onDisconnect);
    p.on("accountChanged", onChange);
    p.connect({ onlyIfTrusted: true })
      .then((r) => setPublicKey(r.publicKey.toBase58()))
      .catch(() => undefined);
    return () => {
      p.removeListener?.("connect", onConnect);
      p.removeListener?.("disconnect", onDisconnect);
      p.removeListener?.("accountChanged", onChange);
    };
  }, []);

  const connect = useCallback(async () => {
    const p = getProvider();
    if (!p) {
      setError("No Solana wallet found. Install Phantom, then reload.");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      const r = await p.connect();
      const pk = r.publicKey.toBase58();
      setPublicKey(pk);
      return pk;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection was cancelled.");
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const p = getProvider();
    await p?.disconnect().catch(() => undefined);
    setPublicKey(null);
  }, []);

  const signTransaction = useCallback(async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
    const p = getProvider();
    if (!p || !p.publicKey) throw new Error("Connect a Solana wallet first.");
    return p.signTransaction(tx);
  }, []);

  const signMessage = useCallback(async (message: Uint8Array) => {
    const p = getProvider();
    if (!p || !p.publicKey) throw new Error("Connect a Solana wallet first.");
    const r = await p.signMessage(message, "utf8");
    return r.signature;
  }, []);

  const value = useMemo<SolanaWallet>(
    () => ({ available, publicKey, connecting, error, connect, disconnect, signTransaction, signMessage }),
    [available, publicKey, connecting, error, connect, disconnect, signTransaction, signMessage],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSolanaWallet(): SolanaWallet {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSolanaWallet must be used inside SolanaWalletProvider");
  return v;
}
