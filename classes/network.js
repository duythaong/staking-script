import { utils, providers, Wallet, Contract } from "ethers";
import dotenv from "dotenv";
import Message from "./msg.js";
import ABI from "./abis.js";
import Cache from "./cache.js";

dotenv.config();

const msg = new Message();

const data = {
  CPP: process.env.CPP,
  USDC: process.env.USDC,
  STAKING: process.env.STAKING,
  MULTI_TRANSFER: process.env.MULTI_TRANSFER,
  price: utils.parseUnits(`${process.env.GWEI}`, "gwei"), //in gwei
};

export default class Network {
  async load(cache) {
    msg.primary(`[debug::network] Load network..`);
    try {
      this.cache = cache;
      this.node = new providers.JsonRpcProvider(process.env.FUJI_RPC);
      this.wallet = new Wallet(process.env.PRIVATE_KEY);
      this.account = this.wallet.connect(this.node);
      this.network = await this.node.getNetwork();
      this.cpp = new Contract(data.CPP, ABI.cpp, this.node);
      this.staking = new Contract(data.STAKING, ABI.staking, this.node);
      this.multiTransferContract = new Contract(
        data.MULTI_TRANSFER,
        ABI.multiTransfer,
        this.account
      );
      this.balance = parseInt(await this.account.getBalance());
      this.base_nonce = parseInt(
        await this.node.getTransactionCount(this.account.address)
      );
      this.nonce_offset = 0;
      this.first_block = -1;
      msg.primary("Completed!");
    } catch (e) {
      msg.error(`[error::network] ${e}`);
      process.exit();
    }
  }

  async unstake() {
    const accounts = new Cache();
    await accounts.load(`accounts.json`);
    const length = accounts.data.length;
    let ps = [];
    for (let i = 0; i < length; i++) {
      try {
        let wallet = new Wallet(accounts.data[i].privateKey);
        let account = wallet.connect(this.node);
        const contract = new Contract(data.STAKING, ABI.staking, account);
        const [ids] = await contract.getStakingDetails(
          accounts.data[i].address,
          data.USDC
        );
        console.log(accounts.data[i].address)
        console.log(ids)
        if (ids.length > 0) {
          for (let i = 0; i < ids.length; i++) {
            const tx = await contract.unstake(ids[i], {
              gasPrice: data.price,
            });
            ps.push(tx.wait());
            if (i + 1 == ids.length) {
              await Promise.all(ps);
              ps = [];
              msg.success(
                `[debug::transact] TX has been submitted. Waiting for response..`
              );
            }
          }
        }
      } catch (error) {
        console.log(error);
      }
    }
  }

  async stakeee() {
    const accounts = new Cache();
    await accounts.load(`accounts.json`);
    const length = accounts.data.length;
    const stakeAmount = utils.parseUnits(`${1}`, "ether").toHexString();
    let ps = [];
    for (let i = 0; i < length; i++) {
      try {
        let wallet = new Wallet(accounts.data[i].privateKey);
        let account = wallet.connect(this.node);
        const contract = new Contract(data.STAKING, ABI.staking, account);
        const tx = await contract.stake(stakeAmount, {
          gasPrice: data.price,
        });
        ps.push(tx.wait());

        if ((i + 1) % 5 == 0) {
          await Promise.all(ps);
          ps = [];
          msg.success(
            `[debug::transact] TX has been submitted. Waiting for response..`
          );
        }
      } catch (error) {
        console.log(error);
      }
    }
  }

  async multiTransfer() {
    const [, valueAmount] = await this.multiTransferContract.viewAmount();
    const ethPrice = Number(utils.formatEther(valueAmount));
    const accounts = new Cache();
    await accounts.load(`accounts.json`);
    const length = accounts.data.length;
    const usersLength = 100;
    let recipients = [];

    for (let i = 0; i < length; i++) {
      recipients.push(accounts.data[i].address);
      if ((i + 1) % usersLength === 0) {
        try {
          const tx = await this.multiTransferContract.distribute(
            this.cpp.address,
            recipients,
            {
              gasPrice: data.price,
              value: utils
                .parseUnits(`${ethPrice * usersLength}`, "ether")
                .toHexString(),
              nonce: this.getNonce(),
            }
          );
          recipients = [];
          msg.success(
            `[debug::transact] TX has been submitted. Waiting for response..`
          );
          const receipt = await tx.wait();
          msg.success(
            `[User:transfer]: https://testnet.snowtrace.io/tx/${receipt.transactionHash}`
          );
        } catch (error) {
          console.log(error);
        }
      }
    }
  }

  async approve() {
    const accounts = new Cache();
    await accounts.load(`accounts.json`);
    const length = accounts.data.length;
    const approvalAmount = utils.parseUnits(`${10000}`, "ether").toHexString();
    let ps = [];
    for (let i = 0; i < length; i++) {
      try {
        let wallet = new Wallet(accounts.data[i].privateKey);
        let account = wallet.connect(this.node);

        const contract = new Contract(data.CPP, ABI.cpp, account);
        const tx = await contract.approve(data.STAKING, approvalAmount, {
          gasPrice: data.price,
        });
        ps.push(tx.wait());

        if ((i + 1) % 5 == 0) {
          await Promise.all(ps);
          ps = [];
          msg.success(
            `[debug::transact] TX has been submitted. Waiting for response..`
          );
        }
      } catch (error) {
        console.log(error);
      }
    }
  }

  getNonce() {
    let nonce = this.base_nonce + this.nonce_offset;
    this.nonce_offset++;
    return nonce;
  }
}
