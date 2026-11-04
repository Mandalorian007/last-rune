# Workstream: card-fit (Gate 2, before blind review 8)

## Problem
The PM saw this in `docs/design/screens/local/dense-board-2/se/12-the-last-rune-aim.png` on main. On the iPhone SE (667×320) at The Last Rune, the held-gem card reads "Channel  Carries the charge straight through," and stops: the rest of the sentence is clipped. The dot legend ("The dot on a gauge: …") sits under it in the same lane and takes the height. The clipping predates dense-board-2.

Text that is cut mid-sentence breaks D-027 (intuitiveness) outright.

## Do
1. Find every place in the phone altar column where a card can clip its text: the held-gem card, the teach cards, the verdict, the dot legend and the Capacitor warning. Check all four phones and every altar, including when two cards are stacked (held card plus dot legend; teach card plus legend).
2. Fix it so no card ever clips. Options, in this order of preference:
   - give the dot legend its turn: show it on its own, never stacked under the held card;
   - shorten copy where it is long, keeping the rules exact (D-043: no numbers in the legend);
   - let the column grow down into free space.

   Do not shrink text below `--tc-text-min`. Do not shrink the board: dense-board.spec minimums must hold (The Last Rune: SE 32, iPhone 34, Pro Max 38.5, Android 36).
3. Add an e2e check in altar-column.spec: in the phone column, every visible card's text is not clipped (scrollHeight ≤ clientHeight + 1, and the card stays inside the column), across the altar states that stack cards.

## Done when
- check, check:boundaries, build and test:e2e are green.
- `SHOTS=card-fit` is regenerated, and you looked at The Last Rune, Capacitor Bay and Relay Tower on SE and iPhone.
- Commit to ws/card-fit and never merge. Log here.

## Log
