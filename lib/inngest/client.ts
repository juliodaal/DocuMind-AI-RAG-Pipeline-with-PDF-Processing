import { Inngest } from "inngest";

export type DocumentUploadedEvent = {
  name: "document/uploaded";
  data: {
    documentId: string;
    orgId: string;
    uploaderId: string;
  };
};

export const inngest = new Inngest({ id: "documind-ai" });
