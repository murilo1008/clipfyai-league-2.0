export type EditableWord = {
  id: number;
  punctuatedText: string;
  hidden: boolean;
  edited: boolean;
  startMs: number;
  endMs: number;
  reset?: boolean;
};
export function captionChanges(
  before: EditableWord[],
  current: EditableWord[],
) {
  const original = new Map(before.map((word) => [word.id, word]));
  return current.flatMap((word) => {
    const previous = original.get(word.id);
    if (!previous) return [];
    const textChanged =
      word.reset || word.punctuatedText.trim() !== previous.punctuatedText;
    const visibilityChanged = word.hidden !== previous.hidden;
    if (!textChanged && !visibilityChanged) return [];
    const patch: {
      id: number;
      punctuatedText?: string | null;
      hidden?: boolean;
    } = { id: word.id };
    if (textChanged)
      patch.punctuatedText = word.reset ? null : word.punctuatedText.trim();
    if (visibilityChanged) patch.hidden = word.hidden;
    return [patch];
  });
}
export function invalidCaptionChange(
  changes: ReturnType<typeof captionChanges>,
) {
  return changes.some(
    (change) =>
      change.punctuatedText !== undefined &&
      change.punctuatedText !== null &&
      (change.punctuatedText.length < 1 || change.punctuatedText.length > 64),
  );
}

export function canApplyTranscriptVersion(
  clipVersion: number | null,
  expectedVersion: number | null,
) {
  return (
    expectedVersion === null ||
    (clipVersion !== null && clipVersion >= expectedVersion)
  );
}

export function canRenderTranscriptVersion(
  transcriptClipVersion: number | null | undefined,
  currentClipVersion: number,
  waitingForSavedTranscript: boolean,
) {
  return (
    !waitingForSavedTranscript &&
    transcriptClipVersion !== null &&
    transcriptClipVersion !== undefined &&
    transcriptClipVersion >= currentClipVersion
  );
}

export function transcriptVersionError(clipVersion: number | null | undefined) {
  return clipVersion === null
    ? "O League ainda não confirma as edições de legenda. Aguarde a atualização do serviço antes de salvar."
    : null;
}
