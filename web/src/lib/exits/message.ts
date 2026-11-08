// The text a Base rider signs to choose which wallets trigger their exit. Shared by browser and server.
export const armMessage = (id: bigint | string, watch: string[]) =>
  [`Wingman: watch these wallets for exit ${id}`, ...[...watch].map((w) => w.toLowerCase()).sort()].join("\n");
