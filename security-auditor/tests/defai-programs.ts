import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("defai-programs", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("defai_swap is deployed", async () => {
    const programId = new anchor.web3.PublicKey("3WeYbjGoiTQ6qZ8s9Ek6sUZCy2FzG7b9NbGfbVCtHS2n");
    const accountInfo = await provider.connection.getAccountInfo(programId);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo?.executable).to.be.true;
    console.log("✅ defai_swap is deployed");
  });

  it("defai_staking is deployed", async () => {
    const programId = new anchor.web3.PublicKey("3sKj7jgDkiT3hroWho3YZSWAfcmpXXucNKipN4vC3EFM");
    const accountInfo = await provider.connection.getAccountInfo(programId);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo?.executable).to.be.true;
    console.log("✅ defai_staking is deployed");
  });

  it("defai_estate is deployed", async () => {
    const programId = new anchor.web3.PublicKey("2zkarMr8w1k6t1jjcZvmcfVPoFnKy3b1kbxEZH6aATJi");
    const accountInfo = await provider.connection.getAccountInfo(programId);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo?.executable).to.be.true;
    console.log("✅ defai_estate is deployed");
  });

  it("defai_app_factory is deployed", async () => {
    const programId = new anchor.web3.PublicKey("Ckp11QQpgdP8poYAPVdVjaA5yqfk9Kc4Bd3zmKfzhFAZ");
    const accountInfo = await provider.connection.getAccountInfo(programId);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo?.executable).to.be.true;
    console.log("✅ defai_app_factory is deployed");
  });
});