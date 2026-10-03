// Shared geometry so Rack rows line up with Beat Editor rows (docs/UI_DESIGN.md → Beat Editor:
// "rows align with Rack rows (same 44 px height, same order) so the Rack acts as the row header").

export const ROW_H = 44;
export const CHIPS_H = 36; // Beat chips row above the editor
export const MAIN_GAP = 12;
export const PANEL_PAD = 16;
export const STEP_NUMS_H = 20;
export const STEP_NUMS_GAP = 8;

/** Distance from the top of the main column to the first editor row. The Rack header uses the same height. */
export const FIRST_ROW_TOP = CHIPS_H + MAIN_GAP + PANEL_PAD + STEP_NUMS_H + STEP_NUMS_GAP;

export const PAD_GAP = 4;
export const GROUP_GAP = 10;
