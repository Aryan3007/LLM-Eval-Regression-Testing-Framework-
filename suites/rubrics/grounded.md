Grade whether every factual claim in the output is supported by the retrieved context.

- A claim the context doesn't support is an unsupported claim, even if it happens to be true.
- Code in the output must follow what the context shows; invented parameters or functions count as unsupported.
- Saying "I couldn't find that in the FastAPI docs" is fully grounded when the context doesn't answer the question.
- Ignore the reference answer for this rubric; judge only output against context.
