// Text Selection Hook - Click and drag text selection with offset tracking

import { useState, useCallback, useRef, useEffect } from "react";
import { useMouse, type MouseEvent } from "../../calendar/hooks/use-mouse";
import type { PositionMapping, SelectionState, DocumentSelection } from "../types";

export interface UseTextSelectionOptions {
  enabled: boolean;
  positionMap: PositionMapping[];
  content: string;
  scrollOffset?: number;
  startRow?: number; // Row where content starts (for header offset)
  startCol?: number; // Column where content starts (for centering/border offset)
  onSelectionChange?: (selection: DocumentSelection | null) => void;
}

export interface UseTextSelectionResult {
  selection: SelectionState;
  selectionData: DocumentSelection | null;
}

// Find source offset from terminal position
function terminalToOffset(
  x: number,
  y: number,
  positionMap: PositionMapping[]
): number | null {
  // Try exact match first
  const exact = positionMap.find(
    (p) => p.terminalRow === y && p.terminalCol === x
  );
  if (exact) return exact.sourceOffset;

  // Find closest on same row
  const rowEntries = positionMap.filter((p) => p.terminalRow === y);
  if (rowEntries.length === 0) {
    // Try closest row
    const rows = [...new Set(positionMap.map((p) => p.terminalRow))].sort(
      (a, b) => a - b
    );
    const closestRow = rows.reduce((prev, curr) =>
      Math.abs(curr - y) < Math.abs(prev - y) ? curr : prev
    );
    const closestRowEntries = positionMap.filter(
      (p) => p.terminalRow === closestRow
    );
    if (closestRowEntries.length === 0) return null;

    // Get start or end of that row depending on whether we're above or below
    if (y < closestRow) {
      return Math.min(...closestRowEntries.map((p) => p.sourceOffset));
    } else {
      return Math.max(...closestRowEntries.map((p) => p.sourceOffset));
    }
  }

  // Find closest column on this row
  const closest = rowEntries.reduce((prev, curr) =>
    Math.abs(curr.terminalCol - x) < Math.abs(prev.terminalCol - x)
      ? curr
      : prev
  );
  return closest.sourceOffset;
}

// Calculate line and column from offset
function offsetToLineCol(
  offset: number,
  content: string
): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

export function useTextSelection(
  options: UseTextSelectionOptions
): UseTextSelectionResult {
  const { enabled, positionMap, content, scrollOffset = 0, startRow = 0, startCol = 0, onSelectionChange } = options;

  const [selection, setSelection] = useState<SelectionState>({
    isSelecting: false,
    anchorOffset: null,
    focusOffset: null,
    startOffset: null,
    endOffset: null,
  });

  // Track if mouse button is held down
  const mouseDownRef = useRef(false);

  // Build selection data from state
  const getSelectionData = useCallback(
    (state: SelectionState): DocumentSelection | null => {
      if (state.startOffset === null || state.endOffset === null) return null;
      if (state.startOffset === state.endOffset) return null;

      const start = state.startOffset;
      const end = state.endOffset;
      const selectedText = content.slice(start, end);

      const startPos = offsetToLineCol(start, content);
      const endPos = offsetToLineCol(end, content);

      return {
        selectedText,
        startOffset: start,
        endOffset: end,
        startLine: startPos.line,
        endLine: endPos.line,
        startColumn: startPos.column,
        endColumn: endPos.column,
      };
    },
    [content]
  );

  // Current selection data
  const selectionData = getSelectionData(selection);

  // Ref for callback to avoid stale closures
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  // Handle mouse down - start selection
  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;

      // Adjust coordinates for content offset
      // x: subtract startCol (centering + border + padding)
      // y: add scrollOffset (scrolled lines)
      const adjustedX = event.x - startCol;
      const adjustedY = event.y + scrollOffset;
      const offset = terminalToOffset(adjustedX, adjustedY, positionMap);
      if (offset === null) return;

      mouseDownRef.current = true;

      setSelection({
        isSelecting: true,
        anchorOffset: offset,
        focusOffset: offset,
        startOffset: offset,
        endOffset: offset,
      });
    },
    [enabled, positionMap, scrollOffset, startCol]
  );

  // Handle mouse move - extend selection
  const handleMove = useCallback(
    (event: MouseEvent) => {
      if (!enabled || !mouseDownRef.current) return;

      // Adjust coordinates for content offset
      const adjustedX = event.x - startCol;
      const adjustedY = event.y + scrollOffset;
      const offset = terminalToOffset(adjustedX, adjustedY, positionMap);
      if (offset === null) return;

      setSelection((prev) => {
        if (prev.anchorOffset === null) return prev;

        const start = Math.min(prev.anchorOffset, offset);
        const end = Math.max(prev.anchorOffset, offset);

        const newState = {
          ...prev,
          isSelecting: true,
          focusOffset: offset,
          startOffset: start,
          endOffset: end,
        };

        // Notify on change
        const data = getSelectionData(newState);
        onSelectionChangeRef.current?.(data);

        return newState;
      });
    },
    [enabled, positionMap, scrollOffset, getSelectionData]
  );

  // Handle mouse up - finalize selection
  const handleRelease = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;

      mouseDownRef.current = false;

      setSelection((prev) => {
        const newState = {
          ...prev,
          isSelecting: false,
        };

        // Send final selection
        const data = getSelectionData(newState);
        if (data && data.startOffset !== data.endOffset) {
          onSelectionChangeRef.current?.(data);
        }

        return newState;
      });
    },
    [enabled, getSelectionData]
  );

  // Use mouse hook
  useMouse({
    enabled,
    onClick: handleClick,
    onMove: handleMove,
    onRelease: handleRelease,
  });

  return { selection, selectionData };
}

export { terminalToOffset, offsetToLineCol };
