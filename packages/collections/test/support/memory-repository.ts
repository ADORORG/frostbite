import type {
  AddItemResult,
  CollectionAggregate,
  CollectionRepository,
  CollectionSummaryRecord,
  CreateResult,
  RemoveItemResult,
  SaveResult,
  UpdateItemResult,
} from "../../src/application/repository.ts";

export interface QueuedResults {
  addItem: AddItemResult;
  create: CreateResult;
  find: CollectionAggregate | null;
  list: readonly CollectionSummaryRecord[];
  removeItem: RemoveItemResult;
  save: SaveResult;
  updateItem: UpdateItemResult;
}

export interface RecordedCall {
  readonly input: object;
  readonly method: string;
}

// Records every call and answers with the result the test queued (a plain "not found" otherwise), so
// service tests assert what the service asked of persistence without a database.
export function createRecordingRepository(
  results: Partial<QueuedResults> = {},
) {
  const calls: RecordedCall[] = [];
  const record = (method: string, input: object): void => {
    calls.push({ input, method });
  };
  const missing = { kind: "not-found" } as const;
  const repository: CollectionRepository = {
    addItem: (input) => {
      record("addItem", input);
      return Promise.resolve(results.addItem ?? missing);
    },
    create: (input) => {
      record("create", input);
      return Promise.resolve(results.create ?? missing);
    },
    find: (input) => {
      record("find", input);
      return Promise.resolve(results.find ?? null);
    },
    listForOwner: (input) => {
      record("listForOwner", input);
      return Promise.resolve(results.list ?? []);
    },
    removeItem: (input) => {
      record("removeItem", input);
      return Promise.resolve(results.removeItem ?? missing);
    },
    save: (input) => {
      record("save", input);
      return Promise.resolve(results.save ?? missing);
    },
    updateItem: (input) => {
      record("updateItem", input);
      return Promise.resolve(results.updateItem ?? missing);
    },
  };
  return { calls, repository };
}
