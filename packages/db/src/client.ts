import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";

import * as schema from "./schema";

// Demo mode check - set DEMO_MODE=true to skip SST database connection
const isDemoMode = process.env.DEMO_MODE === "true";

let db: ReturnType<typeof drizzle> | null = null;

if (!isDemoMode) {
  // Only import and use SST Resource in non-demo mode
  // This dynamic import pattern helps with build-time tree-shaking
  const { Resource } = require("sst") as typeof import("sst");

  const client = new RDSDataClient({});
  db = drizzle(client, {
    database: Resource.MyPostgres.database,
    secretArn: Resource.MyPostgres.secretArn,
    resourceArn: Resource.MyPostgres.clusterArn,
    schema,
  });
}

export { db };
