import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("defai-programs", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("defai_swap is deployed", async () => {
    const programId = new anchor.web3.PublicKey("877w653ayrjqM6fT5yjCuPuTABo8h7N6ffF3es1HRrxm");
    const accountInfo = await provider.connection.getAccountInfo(programId);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo?.executable).to.be.true;
    console.log("✅ defai_swap is deployed");
  });

  it("defai_staking is deployed", async () => {
    const programId = new anchor.web3.PublicKey("CvDs2FSKiNAmtdGmY3LaVcCpqAudK3otmrG3ksmUBzpG");
    const accountInfo = await provider.connection.getAccountInfo(programId);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo?.executable).to.be.true;
    console.log("✅ defai_staking is deployed");
  });

  it("defai_estate is deployed", async () => {
    const programId = new anchor.web3.PublicKey("J8qubfQ5SdvYiJLo5V2mMspZp9as75RePwstVXrtJxo8");
    const accountInfo = await provider.connection.getAccountInfo(programId);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo?.executable).to.be.true;
    console.log("✅ defai_estate is deployed");
  });

  it("defai_app_factory is deployed", async () => {
    const programId = new anchor.web3.PublicKey("4HsYtGADv25mPs1CqicceHK1BuaLhBD66ZFjZ8jnJZr3");
    const accountInfo = await provider.connection.getAccountInfo(programId);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo?.executable).to.be.true;
    console.log("✅ defai_app_factory is deployed");
  });
});