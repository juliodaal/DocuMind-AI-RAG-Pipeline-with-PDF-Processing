import { inngest } from "./client";
import { ingestDocument } from "@/lib/ingestion/pipeline";

export const ingestDocumentFn = inngest.createFunction(
  {
    id: "ingest-document",
    name: "Ingest document",
    triggers: [{ event: "document/uploaded" }],
    retries: 2,
    concurrency: { limit: 5 },
  },
  async ({ event, step }) => {
    const data = event.data as { documentId: string; orgId: string; uploaderId: string };

    const result = await step.run("ingest-pipeline", async () => {
      return await ingestDocument(data.documentId);
    });

    return result;
  },
);

export const inngestFunctions = [ingestDocumentFn];
