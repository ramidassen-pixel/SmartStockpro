# AI agent tests

45 real questions about the business, with the correct answers worked out straight from the database.
Use them to score the AI assistant before and after every change.

| File | What it is |
|---|---|
| `questions.json` | The 45 questions (sales, debts, stock, expenses, profit, suppliers, staff, dates, app help, safety, French) |
| `answer_key.sql` | Works out the correct answers from the `ai.*` views |
| `expected.json` | The answers for one day (**not in git**: it holds real figures and customer names) |
| `run.mjs` | Asks the agent each question and grades the answer |
| `results/` | Each run's full results and `latest.md` (**not in git**) |

## Run a test

1. **Make today's answer key.** Paste `answer_key.sql` into the Supabase SQL editor and run it.
   Save the JSON it returns as `ai-eval/expected.json`. Do this on the same day as the test,
   because "today", "this month" and "last week" change.
2. **Run the questions** (PowerShell, from the project folder):

   ```powershell
   $env:SSP_EMAIL = "you@example.com"; $env:SSP_PASSWORD = "your password"; node ai-eval/run.mjs
   ```

   Options: `--only q01,q07` · `--delay 6000` (free AI plans have rate limits) · `--endpoint ai-agent-v2`.
3. Open `ai-eval/results/latest.md` for the score and every failed answer.

## How answers are graded

- **Numbers** must appear in the answer. The check allows small rounding, and "1.06 million" or "71.6k" count as rounded figures.
  Counts must be exact.
- **Names** (customers, products, invoices) must appear.
- When the honest answer is "none" or "I can't", the check looks for that wording. These show as **PASS\***, so give them a quick read.
- The profit question also has to warn that the cost of goods isn't recorded.
