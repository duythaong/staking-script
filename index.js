import Cache from "./classes/cache.js";
import Message from "./classes/msg.js";
import Network from "./classes/network.js";

const msg = new Message();
const cache = new Cache();
const network = new Network();

// main
(async () => {
  let startingTick = Math.floor(new Date().getTime() / 1000);
  msg.primary("[debug::main] Testing has been started.");
  if (network.balance == 0) {
    msg.error(
      `[error::init] You don't have any AVAX in your account. (used for gas fee)`
    );
    process.exit();
  }

  await network.load(cache);

  // await network.multiTransfer(); // staking
  // await network.approve();
  await network.stakeee();

  // save cache just to be sure
  // await cache.save();

  msg.success(
    `Finished in ${
      Math.floor(new Date().getTime() / 1000) - startingTick
    } seconds.`
  );

  process.exit();
})();
