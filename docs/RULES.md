# Contracts, economics, and design decisions

## Signing a deal

Choose **Deals → Propose a deal** at an action break. Select a partner, titles, release certificates, and cash offered by each side, then any optional clauses. The preview includes third-party equity distributions, sell-on obligations, mortgage-transfer interest, and loan principal.

Submitting creates an offer; it does not move assets. The recipient must accept. In pass-and-play, switch the Controlling selector to that human seat. Offers are rechecked against current cash, ownership, buildings, options, and vetoes when accepted. Rejected or invalid deals do not partially execute. An offer can be withdrawn. Five outstanding offers per proposer are allowed.

New clauses apply to the proposer’s selected offered properties. The other side’s titles transfer subject to existing clauses. To create reciprocal advanced obligations, use two separately agreed deals. Multi-title sale cash is allocated in proportion to the titles’ original list prices, with any whole-dollar remainder assigned to the final title.

## Revenue and equity

A rent is rounded to a whole unit after economy adjustments. Each claim receives the floor of its percentage of that rent. The title owner receives the remainder, so the sum always equals the actual payment. A payer who owns a claim in the visited property pays only their net obligation. Owners landing on their own title do not pay rent to other stakeholders.

- **Royalty:** receives rent only. For example, sell Boardwalk but retain a 20% royalty: a $50 rent becomes $10 to you and $40 to the new owner.
- **Equity retained on a title sale:** receives a percentage of rent and a percentage of later title-sale consideration. A 20% stake receives $60 from a subsequent $300 sale.
- **Equity-only portfolio sale:** check “Sell only the equity stake; keep my titles.” The recipient receives the stated share in every selected property; you retain control and color-set eligibility. You cannot combine this mode with a new royalty, resale fee, or veto. You can sell further stakes in later deals if the cap allows.
- **Aggregate cap:** royalty plus equity percentages cannot exceed 80%. A single new royalty cannot exceed 50%. Percentages are whole numbers. A title owner funds all buildings and taxes and retains the remaining rent.

Equity does not grant voting rights, a share of mortgage advances, a share of building liquidation proceeds, or guaranteed capital repayment. It is a contractual income and ordinary-resale participation, with subordinate rights at bankruptcy. Rights cannot currently be sold separately from these issuance deals. The title holder retains development decisions; inspect their leverage before investing.

## Resale protections

A **sell-on clause** is a fixed, nominal payment per affected property. It is paid by every subsequent seller to the original beneficiary; it is not only a one-time fee. It also applies to swaps and zero-cash gifts, preventing a simple way to evade it. A seller needs enough cash after sale consideration and other distributions to meet the fee, otherwise the transfer fails atomically.

A **veto** names prohibited future buyers. The original beneficiary must remain in the game for the restriction to apply. It blocks normal transfers and option exercise. Default transfers to creditors are not voluntary sales and bypass vetoes; insolvency must first exhaust available building/mortgage liquidity. A bank repossession clears all clauses.

## Purchase options

An option has a fixed nominal strike and no expiration. It may be exercised whenever property management is permitted (between actions or during debt restructuring). A doubles roll or pending auction must finish first.

The underlying title remains with the grantor and continues earning rent, but is reserved: it cannot be resold, mortgaged, or included in another stake deal. Its color group cannot be developed. The option holder may release it for free; otherwise it ends by exercise or the holder’s bankruptcy. These restrictions prevent an option from becoming a promise the seller cannot honor. Negotiate an upfront premium through the ordinary cash fields.

Options may only be granted on unimproved, unmortgaged properties. The strike must cover outstanding equity and sell-on obligations from the sale itself. At exercise, existing equity/sell-on claims are paid before the title changes. An option survives a player-creditor takeover but is cleared by bank foreclosure.

**Why no expiry?** The requested feature is an anytime fixed-price purchase. An indefinite option is powerful under inflation, so the reservation cost and an agreed premium provide the tradeoff. Optional expirations would be a reasonable later extension, but are not needed to enforce the requested contract.

## Investor loans

The proposer is the lender; the recipient is the borrower. Principal is delivered at signing, in addition to any other negotiated cash. Choose 0–25% fixed interest and a term of 1–5 of the borrower’s GO crossings. Repayment equals the rounded principal × (1 + interest / 100), with no periodic compounding. Only one outstanding loan per lender–borrower pair is allowed.

Early repayment costs the same contracted amount. At maturity, repayment becomes a normal debt before the landing action proceeds. The borrower may liquidate property or negotiate to pay it. If they cannot, ordinary creditor bankruptcy rules apply. A lender’s surviving receivable transfers to their player creditor or to the bank if that lender fails. Loan amounts do not inflate.

These are ordinary game creditor claims, not a real-world model of secured priority, liens, bankruptcy courts, or collective creditor voting.

## Inflation and business cycles

The shared lap count is the minimum laps completed by surviving players. When it increases, multiply the price index by (1 + inflation rate). Removing an eliminated player can therefore allow the current economic year to catch up. The index does not rise merely because one fast player crosses repeatedly.

Example: with three players and laps `[2, 1, 0]`, no increase has happened yet. When the third reaches lap 1, the index becomes 1.10. It becomes 1.21 once everybody has completed lap 2. At each crossing the player first collects the current indexed salary, then tax/grant/loan obligations are computed, and the economy advances if that crossing completes a shared lap. The subsequent landing uses the new index.

Indexed: bank list prices, base rents, GO salary, ordinary taxes/fines, card cash/repair effects, construction, building resale base values, and newly originated mortgages. Nominal: existing cash, mortgage principal, option strike, loan repayment, fixed sell-on obligations, and offered cash prices. Percentage shares naturally follow actual revenue.

The visible, repeating cycle has five phases:

1. **Steady market:** base multipliers and 10% redemption interest.
2. **Building boom:** new construction costs 85% of the indexed base cost.
3. **Expansion:** rents are 110% of the indexed base rent.
4. **Credit squeeze:** new mortgages advance 80% of normal proceeds; redemption interest is 20%.
5. **Recession:** rents are 85% of the indexed base rent.

No surprise economic-event cards are used. The cycle is deterministic and fully visible, adding planning instead of another source of unavoidable bad luck. Construction discounts do not lower a building’s standard half-base liquidation value; there is still no immediate buy/sell profit at the 15% discount.

## Reducing runaway leads

At each GO crossing, a player’s real-estate tax is:

```
max(0, round(0.04 × (player property value − median property value − 500 × price index)))
```

Property value is the indexed title list price plus indexed base building cost, reduced by outstanding mortgage principal. Equity capital value is allocated to the relevant holders. Royalties and options are not assigned a speculative capital value. The median uses only surviving players and averages the middle pair for an even count. Cash is not itself taxed by this assessment.

A recovery grant of rounded `$75 × index` is paid at GO when the player’s net worth is below 75% of the surviving players’ median net worth. Net worth includes cash, property/equity capital value, loan receivables, and outstanding loan repayment obligations. Signed but unaccepted offers do not count.

The tax is progressive and the grant is modest: leaders keep their useful investments, while a trailing player gains a little negotiating room. Values are intentionally transparent game approximations and not an appraisal of future rent. Players can still discover collusive/tax-minimizing strategies; competitive tournament balance has not been established.

## Reducing randomness without removing dice

Each player starts with two **planning credits**, gains one every **two personal GO crossings** (laps 2, 4, 6, …), and can hold three. Extra refills at the cap are lost. While planning is disabled, credits are preserved but cannot be earned or spent; missed refills are not awarded later. After a normal roll, spend one to move one space further or one space less. The UI shows all three destinations before committing. The original dice still determine doubles; jail escape rolls cannot be adjusted. If no credits remain, the normal move resolves immediately.

Saving a credit for a near miss makes choosing a landing meaningful without allowing unlimited rerolls. Public rent schedules, visible title encumbrances, deterministic cycles, open auctions, and portfolio diversification add more ways to respond to luck.

## Default and accounting

Payments are queued, and recipients are paid only when the payer can actually fund the debt. There is no cash creation from an unpaid rent. During bankruptcy, actual liquidated cash is distributed proportionally among that debt’s recipients, with deterministic whole-unit remainders; the named primary creditor receives remaining titles. Subsequent unpaid debts of the eliminated player are discharged. Default transfers are not ordinary resales, so sell-on and equity sale-proceeds clauses are not triggered by the transfer itself.

Beneficiaries’ own claims and vetoes disappear when they leave the game. Other people’s rights survive a transfer to a player creditor but are wiped at bank foreclosure. A recipient of mortgaged titles owes immediate transfer interest and may themselves need to restructure. The winner is declared once only one player remains.

## Deliberate scope boundaries

- No unrestricted short selling or debt-on-debt trading: these would encourage leverage loops and make a family board game much harder to read.
- No global arbitrary rule scripting. Economy modules and each contract type are individually configurable at setup or by the host during play, and contracts use a bounded, validated vocabulary.
- No public matchmaking, player accounts, host migration, or voice chat. Cloudflare tunnels provide remote access; a seatless TV host and read-only display support family play. The authoritative server still runs on the host computer.
- Bots negotiate ordinary cash and title transactions; they do not price advanced derivative contracts. Those are meant for human negotiation.
- Sequential auctions and action-break management make the shared digital state unambiguous. Scarcity auctions begin at the final available house/hotel rather than collecting all simultaneous building requests.
- The six original figures are a drone, lighthouse, fox, comet, crystal and robot. Import your own detailed figures if desired.

## Changing names and choosing rules

Use **Rename player** under the Controlling/Playing as line, or **Table options → Rename player**. Names are 1–22 characters and can change during play. LAN players can rename their own seat; a local host can rename the selected pass-and-play seat. Names change for all clients and persist with the saved game. Titles, contracts, loans, and reconnection credentials remain tied to the same player ID. The event log records the change.

The lobby has a visible **Special rules** checklist. During a game, open **Table options → Special rules checklist**. Only the host can apply changes; other players can view the settings. Inflation, cycles, planning credits, property tax, grants, royalties, equity/portfolio stakes, sell-on payments, resale vetoes, purchase options, and loans can each be disabled. Investor contracts also has a master switch. Core rules, including auctions after declining a purchase, stay enabled.

Changes affect future events. Accumulated inflation, outstanding debts, credit balances, and signed agreements are preserved; existing options can still be exercised and existing loans repaid. Disabling inflation freezes the current index rather than resetting prices. Disabling contract types stops new issuance. Applying rule changes clears all unsigned offers, so players can renegotiate under the new settings. Finish a pending movement choice before changing rules. Changing settings is a host decision visible to everyone in the log; discuss it with the group first.

**Table options → Rule recommendations & why** explains every implemented addition. The same recommendations are available through **Why these rules?** in the lobby.

## Additional ideas for later (not implemented)

- **Expiring options:** a 2–3 buyer-lap option could cost less and reduce indefinite title reservations. The current requested anytime option remains available.
- **Right of first refusal:** the former owner may match a genuine resale offer instead of banning named buyers. This protects a seller while keeping trading more open; it needs an extra response window.
- **Public infrastructure projects:** players jointly fund a district improvement and share its benefit. This gives rivals a reason to cooperate, but contribution thresholds and benefits need balancing.
