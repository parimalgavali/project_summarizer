import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  deleteAudio,
  deleteDocument,
  deleteSummary,
  editSummary,
  generateAudio,
  generateAudioFromDocument,
  getAllAudios,
  getAllDocuments,
  getAllSummaries,
  regenerateSummary,
  updateApproval,
  type Audio,
  type DocumentRecord,
  type Summary,
} from "./api";

export const queryKeys = {
  documents: ["documents"] as const,
  summaries: ["summaries"] as const,
  audios: ["audios"] as const,
};

/** Stable fallback so effects depending on list data don't re-run every render. */
export const EMPTY_LIST: never[] = [];

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents,
    queryFn: async () => (await getAllDocuments()).data,
  });
}

export function useSummaries() {
  return useQuery({
    queryKey: queryKeys.summaries,
    queryFn: async () => (await getAllSummaries()).data,
  });
}

export function useAudios() {
  return useQuery({
    queryKey: queryKeys.audios,
    queryFn: async () => (await getAllAudios()).data,
  });
}

type ListKey = (typeof queryKeys)[keyof typeof queryKeys];

function updateList<T>(client: QueryClient, key: ListKey, update: (items: T[]) => T[]) {
  client.setQueryData<T[]>(key, (items) => (items ? update(items) : items));
}

function withoutMessage<T extends { message?: string }>(response: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { message, ...rest } = response;
  return rest;
}

/** Insert or merge a single summary into the cached summary list. */
export function upsertSummary(client: QueryClient, summary: Summary) {
  updateList<Summary>(client, queryKeys.summaries, (items) => {
    const index = items.findIndex((item) => item.id === summary.id);
    if (index === -1) return [summary, ...items];
    const next = [...items];
    next[index] = { ...next[index], ...summary };
    return next;
  });
}

function removeAudiosForSummaries(client: QueryClient, summaryIds: Set<string>) {
  updateList<Audio>(client, queryKeys.audios, (items) =>
    items.filter((audio) => !summaryIds.has(audio.summary_id))
  );
}

export function useInvalidateDocuments() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.documents });
}

export function useUpsertSummary() {
  const client = useQueryClient();
  return (summary: Summary) => upsertSummary(client, summary);
}

export function useDeleteDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_response, documentId: string) => {
      const cachedSummaries = client.getQueryData<Summary[]>(queryKeys.summaries);
      updateList<DocumentRecord>(client, queryKeys.documents, (items) =>
        items.filter((doc) => doc.id !== documentId)
      );
      if (!cachedSummaries) {
        client.invalidateQueries({ queryKey: queryKeys.audios });
        return;
      }
      const removed = new Set(
        cachedSummaries.filter((s) => s.document_id === documentId).map((s) => s.id)
      );
      updateList<Summary>(client, queryKeys.summaries, (items) =>
        items.filter((summary) => summary.document_id !== documentId)
      );
      removeAudiosForSummaries(client, removed);
    },
  });
}

export function useDeleteSummary() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteSummary,
    onSuccess: (_response, summaryId: string) => {
      updateList<Summary>(client, queryKeys.summaries, (items) =>
        items.filter((summary) => summary.id !== summaryId)
      );
      removeAudiosForSummaries(client, new Set([summaryId]));
    },
  });
}

export function useEditSummary() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ summaryId, text }: { summaryId: string; text: string }) =>
      editSummary(summaryId, text),
    onSuccess: (response) => upsertSummary(client, withoutMessage(response)),
  });
}

export function useRegenerateSummary() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (summaryId: string) => regenerateSummary(summaryId),
    onSuccess: (response) => upsertSummary(client, withoutMessage(response)),
  });
}

export function useUpdateApproval() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      summaryId,
      status,
      customName,
    }: {
      summaryId: string;
      status: "approved" | "rejected" | "final_approved";
      customName?: string;
    }) => updateApproval(summaryId, status, customName),
    onSuccess: (summary) => upsertSummary(client, summary),
  });
}

export function useDeleteAudio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteAudio,
    onSuccess: (_response, audioId: string) =>
      updateList<Audio>(client, queryKeys.audios, (items) =>
        items.filter((audio) => audio.id !== audioId)
      ),
  });
}

export function useGenerateAudio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: generateAudio,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.audios }),
  });
}

export function useGenerateAudioFromDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, formatType }: { documentId: string; formatType: string }) =>
      generateAudioFromDocument(documentId, formatType),
    // Creates both a new (auto-approved) summary and its audio.
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.audios }),
        client.invalidateQueries({ queryKey: queryKeys.summaries }),
      ]),
  });
}
