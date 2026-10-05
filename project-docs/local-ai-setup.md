# Local AI Setup

This project can run without an OpenAI API key.

## Recommended Laptop Setup

For an 8 GB RAM MacBook with limited storage, use only:

- Ollama `llama3.2`
- Ollama `embeddinggemma`
- macOS built-in `say`

This avoids LM Studio, Piper, and large local models until storage is healthier.

## Install Models

Run in macOS Terminal:

```bash
ollama pull llama3.2
ollama pull embeddinggemma
```

Verify:

```bash
ollama list
```

Test chat:

```bash
ollama run llama3.2 "Summarize this project in one sentence."
```

Test API:

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [{"role": "user", "content": "Summarize this project in one sentence."}],
  "stream": false,
  "keep_alive": 0
}'
```

Test embeddings:

```bash
curl http://localhost:11434/api/embed -d '{
  "model": "embeddinggemma",
  "input": "This document discusses transformer-based summarization."
}'
```

## Environment

Use:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBED_MODEL=embeddinggemma
OLLAMA_NUM_CTX=2048
OLLAMA_KEEP_ALIVE=0
OLLAMA_MAX_INPUT_CHARS=12000

TTS_PROVIDER=macos_say
MACOS_SAY_VOICE=Samantha
```

## Storage Notes

Ollama models are stored outside this repository. Runtime uploads and audio files are also ignored by git. The GitHub repo should contain source code and documentation, not user documents or generated audio.
