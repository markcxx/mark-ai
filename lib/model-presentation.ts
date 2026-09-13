export type ModelPresentation = {
  displayName: string;
  description: string;
  isNew: boolean;
  newUntil: string | null;
  sortOrder: number;
  newRevision: string;
};

export const DEFAULT_MODEL_PRESENTATION: ModelPresentation = {
  displayName: "",
  description: "",
  isNew: false,
  newUntil: null,
  sortOrder: 0,
  newRevision: "",
};

export type ModelPresentationInput = Omit<ModelPresentation, "newRevision">;

export function parseModelPresentation(input: unknown): ModelPresentationInput | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (
    typeof value.displayName !== "string" ||
    value.displayName.length > 80 ||
    typeof value.description !== "string" ||
    value.description.length > 160 ||
    typeof value.isNew !== "boolean" ||
    typeof value.sortOrder !== "number" ||
    !Number.isInteger(value.sortOrder) ||
    value.sortOrder < 0 ||
    value.sortOrder > 9999 ||
    (value.newUntil !== null &&
      (typeof value.newUntil !== "string" || !Number.isFinite(Date.parse(value.newUntil))))
  )
    return null;
  return {
    displayName: value.displayName.trim(),
    description: value.description.trim(),
    isNew: value.isNew,
    sortOrder: value.sortOrder,
    newUntil: value.newUntil === null ? null : new Date(value.newUntil as string).toISOString(),
  };
}

export function isNewModel(
  presentation?: Pick<ModelPresentation, "isNew" | "newUntil">,
  now = Date.now(),
) {
  return Boolean(
    presentation?.isNew &&
    (presentation.newUntil === null || Date.parse(presentation.newUntil) > now),
  );
}

type PresentedModel = { id: string; provider: string; presentation?: ModelPresentation };

export function getNewModels<T extends PresentedModel>(models: T[], now = Date.now()): T[] {
  return models
    .filter((model) => isNewModel(model.presentation, now))
    .sort(
      (a, b) =>
        (a.presentation?.sortOrder ?? 0) - (b.presentation?.sortOrder ?? 0) ||
        a.provider.localeCompare(b.provider) ||
        a.id.localeCompare(b.id),
    );
}

export const getNewModelToken = (model: PresentedModel) =>
  JSON.stringify([model.provider, model.id, model.presentation?.newRevision]);

export function hasUndismissedModels(models: PresentedModel[], dismissed: string[]) {
  return models.some((model) => !dismissed.includes(getNewModelToken(model)));
}

/** Provider overrides belong to users and must not inherit site promotional metadata. */
export function withModelPresentations<T extends PresentedModel>(
  models: T[],
  entries: (ModelPresentation & { modelId: string; provider: string })[],
  privateProviders: Set<string>,
): T[] {
  const map = new Map(
    entries.map((entry) => [JSON.stringify([entry.provider, entry.modelId]), entry]),
  );
  return models.map((model) => {
    const entry = map.get(JSON.stringify([model.provider, model.id]));
    if (!entry || privateProviders.has(model.provider)) return model;
    const { displayName, description, isNew, newUntil, sortOrder, newRevision } = entry;
    return {
      ...model,
      presentation: { displayName, description, isNew, newUntil, sortOrder, newRevision },
    };
  });
}
