import { columns, hiddenRows, rows } from "../rules/constants.ts";

// The screen's size and where everything lies on it, in screen pixels. The board is the middle; the piece held is on its left and the
// pieces to come on its right. One row above the board shows dimly, so a new piece rises into view instead of appearing half cut.
export const cell = 8;
export const visibleRows = rows - hiddenRows;
export const boardWidth = columns * cell;
export const boardHeight = visibleRows * cell;
export const boardLeft = 32;
export const boardTop = 16;
export const screenWidth = 144;
export const screenHeight = boardTop + boardHeight + 8;

// The small boxes at the sides: each holds a piece drawn at this size, in a box this wide.
export const mini = 6;
export const panelWidth = 28;
export const panelHeight = 4 * mini;
export const holdLeft = 2;
export const nextLeft = screenWidth - panelWidth - 2;
export const panelTop = boardTop;
export const panelGap = 8;
