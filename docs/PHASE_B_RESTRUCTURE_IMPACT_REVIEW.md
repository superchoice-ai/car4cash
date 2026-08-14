# Phase B Historical Impact Review — restructure

- **Repository:** `superchoice-ai/tansub`
- **Environment reviewed:** Lovable/Supabase demo environment; not production
- **Current status:** **DEFERRED / UNSUPPORTED / OUT OF PHASE B SCOPE**
- **Implementation status:** NOT AUTHORIZED / MUST NOT BE IMPLEMENTED
- **Approval Engine status:** Must remain fail-closed
- **Authority:** The user's confirmed business rule overrides enum/schema/roadmap presence

## 1. Confirmed decision

`restructure` is not an active Phase B workflow.

Once a contract has at least one payment event, the debt-bearing terms below are locked:

- principal or loan amount;
- interest rate;
- term or installment count;
- cancellation or deletion of the loan request/contract.

Non-debt-bearing information may still be corrected through the normal approval workflow because it does not change the customer's debt obligation. Account payoff/closure is contract completion, not restructuring.

## 2. Interpretation guard

The word `restructure` may still exist in an enum, migration, schema, old document, roadmap, UI draft, or code branch. That presence is historical/technical evidence only. It must never be interpreted as authorization to design or implement a restructuring workflow.

Any future proposal to reactivate `restructure` requires the user to explicitly change the confirmed business rule first. After that confirmation, a new full-project Impact Review must start from zero before any design or implementation.

## 3. Why this file is retained

This file is retained as lesson-learned evidence so that people and AI do not repeat the earlier interpretation error. Earlier dependency findings are not an approved design and must not be used as an implementation backlog.

## 4. Current required behavior

1. Do not add `restructure` to the Approval Engine whitelist.
2. Do not create restructure UI, RPC, migration, table, schedule versioning, or executor.
3. Reject any `restructure` request fail-closed.
4. Keep current payment and debt-bearing edit restrictions unchanged.
5. Do not include restructure fixtures or regression work in the active Phase B plan.

## 5. Conclusion

`restructure` is deliberately skipped. Active Phase B contains only `contract_cancel` and `payment_void`. This document records a prohibition, not a future implementation plan.
