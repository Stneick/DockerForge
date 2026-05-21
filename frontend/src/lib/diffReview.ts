import type { editor, IRange } from "monaco-editor";

/** Reset the modified side to match the original (undo all edits). */
export function revertAllChanges(diff: editor.IStandaloneDiffEditor): string | null {
  const models = diff.getModel();
  if (!models) return null;
  const next = models.original.getValue();
  models.modified.setValue(next);
  return next;
}

/** Revert a single diff hunk on the modified model (undo change). */
export function revertLineChange(
  diff: editor.IStandaloneDiffEditor,
  change: editor.ILineChange,
): void {
  const models = diff.getModel();
  if (!models) return;

  const { original, modified } = models;
  const modifiedEd = diff.getModifiedEditor();

  if (change.charChanges?.length) {
    const edits = [...change.charChanges]
      .sort((a, b) => {
        const byLine = b.modifiedStartLineNumber - a.modifiedStartLineNumber;
        if (byLine !== 0) return byLine;
        return b.modifiedStartColumn - a.modifiedStartColumn;
      })
      .map((cc) => ({
        range: {
          startLineNumber: cc.modifiedStartLineNumber,
          startColumn: cc.modifiedStartColumn,
          endLineNumber: cc.modifiedEndLineNumber,
          endColumn: cc.modifiedEndColumn,
        },
        text: originalSlice(original, cc),
        forceMoveMarkers: true,
      }));
    modifiedEd.pushUndoStop();
    modifiedEd.executeEdits("diffReview", edits);
    modifiedEd.pushUndoStop();
    return;
  }

  modifiedEd.pushUndoStop();
  modifiedEd.executeEdits("diffReview", [
    {
      range: modifiedRangeFromLineChange(modified, change),
      text: originalTextFromLineChange(original, change),
      forceMoveMarkers: true,
    },
  ]);
  modifiedEd.pushUndoStop();
}

function originalSlice(original: editor.ITextModel, cc: editor.ICharChange): string {
  if (cc.originalEndLineNumber === 0) return "";
  return original.getValueInRange({
    startLineNumber: cc.originalStartLineNumber,
    startColumn: cc.originalStartColumn,
    endLineNumber: cc.originalEndLineNumber,
    endColumn: cc.originalEndColumn,
  });
}

function modifiedRangeFromLineChange(
  modified: editor.ITextModel,
  change: editor.ILineChange,
): IRange {
  if (change.modifiedEndLineNumber === 0) {
    const line = Math.max(1, change.modifiedStartLineNumber);
    return { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 };
  }
  const start = Math.max(1, change.modifiedStartLineNumber);
  const end = Math.max(start, change.modifiedEndLineNumber);
  return {
    startLineNumber: start,
    startColumn: 1,
    endLineNumber: end,
    endColumn: modified.getLineMaxColumn(end),
  };
}

function originalTextFromLineChange(
  original: editor.ITextModel,
  change: editor.ILineChange,
): string {
  if (change.originalEndLineNumber === 0) return "";
  const start = Math.max(1, change.originalStartLineNumber);
  const end = Math.max(start, change.originalEndLineNumber);
  return original.getValueInRange({
    startLineNumber: start,
    startColumn: 1,
    endLineNumber: end,
    endColumn: original.getLineMaxColumn(end),
  });
}
