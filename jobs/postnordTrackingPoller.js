const { initDatabase } = require("../services/db");
const { runPostNordActiveSyncJob } = require("../services/jobSyncService");

async function run() {
  try {
    console.log("Starting PostNord tracking poller");

    await initDatabase();

    const result = await runPostNordActiveSyncJob({
      limit: 50,
      maxAgeDays: 30
    });

    console.log("Tracking sync result:");
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Tracking poller failed:");
    console.error(error);

    process.exit(1);
  }
}

run();
