// Modal focus-management tests (Node, no DOM framework in this project).
//   npm run test:ui
// 1. Unit tests for the pure focus decisions in src/components/ui/focusTrap.ts
//    (imported directly; Node 22.18+/24 strips TypeScript types natively).
// 2. Source checks over every Modal/ConfirmDialog call site: closing is guarded
//    while saving and every Cancel button is disabled while saving.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOCUSABLE_SELECTOR, nextTrapIndex, pickRestoreTarget, shouldRestoreFocus } from '../../src/components/ui/focusTrap.ts';

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label} ${detail}`); }
};

// ---- Tab / Shift+Tab decisions -------------------------------------------
check('Tab on last control wraps to first', nextTrapIndex(4, 3, false) === 0);
check('Shift+Tab on first control wraps to last', nextTrapIndex(4, 0, true) === 3);
check('Tab in the middle is left to the browser', nextTrapIndex(4, 1, false) === null);
check('Shift+Tab in the middle is left to the browser', nextTrapIndex(4, 2, true) === null);
check('Tab with focus outside/on container goes to first control', nextTrapIndex(4, -1, false) === 0);
check('Shift+Tab with focus outside/on container goes to last control', nextTrapIndex(4, -1, true) === 3);
check('Single control: Tab stays on it', nextTrapIndex(1, 0, false) === 0);
check('Single control: Shift+Tab stays on it', nextTrapIndex(1, 0, true) === 0);
check('No focusable controls: focus the dialog itself (Tab)', nextTrapIndex(0, -1, false) === -1);
check('No focusable controls: focus the dialog itself (Shift+Tab)', nextTrapIndex(0, -1, true) === -1);

// ---- Focusable selector covers the required control types -----------------
for (const part of ['button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', 'a[href]']) {
  check(`focusable selector includes ${part}`, FOCUSABLE_SELECTOR.includes(part));
}
check('focusable selector excludes tabindex=-1', FOCUSABLE_SELECTOR.includes('[tabindex]:not([tabindex="-1"])'));
check('focusable selector excludes hidden inputs', FOCUSABLE_SELECTOR.includes(':not([type="hidden"])'));

// ---- Restore-target selection --------------------------------------------
const el = (name, { isConnected = true, attrs = [] } = {}) => ({ name, isConnected, hasAttribute: (a) => attrs.includes(a), focus: () => {} });
const trigger = el('trigger'), main = el('main');
check('restore prefers the original trigger when it still exists', pickRestoreTarget([trigger, main]) === trigger);
check('restore falls back to <main> when the trigger was removed', pickRestoreTarget([el('gone', { isConnected: false }), main]) === main);
check('restore skips a trigger that became disabled', pickRestoreTarget([el('t', { attrs: ['disabled'] }), main]) === main);
check('restore skips aria-hidden candidates', pickRestoreTarget([el('t', { attrs: ['aria-hidden'] }), main]) === main);
check('restore with no usable target does nothing (auth pages without <main>)', pickRestoreTarget([null, null]) === null);
check('restore with null trigger uses <main>', pickRestoreTarget([null, main]) === main);

// ---- When restoring is allowed (never steal deliberate focus) --------------
const body = { isConnected: true };
check('restore when focus is on <body>', shouldRestoreFocus(body, body) === true);
check('restore when nothing is focused', shouldRestoreFocus(null, body) === true);
check('restore when focus is on a removed node (closed dialog)', shouldRestoreFocus({ isConnected: false }, body) === true);
check('do NOT restore when the user focused another element', shouldRestoreFocus({ isConnected: true }, body) === false);

// ---- Call-site checks: save-lock and Cancel disabled for every dialog ------
const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.tsx') && !path.includes(join('components', 'ui'))) files.push(path);
  }
};
walk(SRC);

// Cancel buttons: match each <Button ...>Cancel</Button> without crossing into another
// <Button (arrow functions like `() => x` contain '>' so [^>]* is not usable).
const cancelButtons = (text) => [...text.matchAll(/<Button(?:(?!<Button)[\s\S])*?>Cancel<\/Button>/g)].map((m) => m[0]);
const allDisabled = (buttons) => buttons.length > 0 && buttons.every((c) => /disabled=\{/.test(c));
// Self-check: the checker must reject the pre-fix Student Leave footer.
const badFooter = `footer={<><Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button><Button type="submit">Submit</Button></>}`;
const goodFooter = `footer={<><Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button></>}`;
check('checker self-test: detects Cancel without disabled', cancelButtons(badFooter).length === 1 && !allDisabled(cancelButtons(badFooter)));
check('checker self-test: accepts Cancel with disabled', allDisabled(cancelButtons(goodFooter)));

let dialogCount = 0;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const rel = relative(SRC, file).replaceAll('\\', '/');
  const usages = [...source.matchAll(/<(Modal|ConfirmDialog)\b([\s\S]*?)(?=\n\s*>\n|\/>|>\s*\n\s*<)/g)];
  for (const usage of usages) {
    dialogCount += 1;
    const start = usage.index;
    // Inspect the opening tag plus its footer prop (Cancel buttons live there).
    const tagText = source.slice(start, start + 900);
    const onClose = tagText.match(/onClose=\{([^\n]*?)\}\s*(?:\n|title=|onConfirm=|footer=)/)?.[1] || '';
    const guarded = /if \(!\w+\)|!\w+ &&/.test(onClose);
    check(`${rel}: <${usage[1]}> onClose is blocked while saving`, guarded, `onClose=${onClose}`);
    if (usage[1] === 'Modal') {
      const cancels = cancelButtons(tagText);
      check(`${rel}: <Modal> Cancel button(s) disabled while saving`, allDisabled(cancels),
        cancels.length ? cancels.join(' | ') : 'no Cancel button found in footer');
    }
  }
}
check('found all 11 dialog call sites', dialogCount === 11, `found ${dialogCount}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
