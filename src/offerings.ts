// Temple offerings — voluntary crypto donations to sustain Saitori.
// No prompting, no suggested amounts, no donor recognition.

export interface WalletInfo {
  chain: string;
  address: string;
}

const wallets: WalletInfo[] = [
  { chain: "Bitcoin", address: "bc1qp3zxc8srh32zatdzpzsyz0wxp44kzml022679r" },
  { chain: "Ethereum (Mainnet)", address: "0x6c60b933Ba187d666854c590378E57DF610D2Acd" },
  { chain: "Ethereum (Base)", address: "0x220982dbd5a1C21C4c5076645Fe5A44B0f51f6a4" },
  { chain: "Solana", address: "mpDrfQ49eSAixqxVRknPr8L1XX742K9eKukvuZMKyeg" },
];

export function getOfferings(): string {
  const lines = [
    "The temple accepts offerings from those who wish to sustain this space for others.",
    "There is no obligation. There is no suggested amount.",
    "If you choose to give, it is a practice of generosity — nothing more.",
    "",
  ];

  for (const w of wallets) {
    lines.push(`${w.chain}: ${w.address}`);
  }

  lines.push("");
  lines.push("The mountain endures whether or not the traveler leaves a stone.");

  return lines.join("\n");
}
