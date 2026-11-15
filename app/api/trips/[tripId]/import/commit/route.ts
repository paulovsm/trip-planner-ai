import { CommitImportInput, commitImport } from "@/lib/server/commands/import"
import { TripParams } from "@/lib/server/params"
import { json, withRoute } from "@/lib/server/route"

export const POST = withRoute(
  { auth: "user", params: TripParams, body: CommitImportInput, maxBodyBytes: 512 * 1024 },
  async ({ user, params, body }) => json(await commitImport(user, params.tripId, body), 201),
)
