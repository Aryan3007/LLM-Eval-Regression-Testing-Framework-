Grade whether the output correctly answers the question about FastAPI, using the reference answer as the source of truth.

- Every key point in the reference must be present. Missing one lowers the score.
- Any statement that contradicts the reference, or names an API, parameter or behaviour FastAPI doesn't have, is a serious error.
- If the reference says the docs don't cover the question, the output must say so too. Inventing an answer scores 1.
- Extra correct detail is fine. Do not reward length.
