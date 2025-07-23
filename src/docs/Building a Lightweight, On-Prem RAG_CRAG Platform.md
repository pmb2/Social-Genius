<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# Building a Lightweight, On-Prem RAG/CRAG Platform for Brand-Voice Consistency (2025 Edition)

**Overview**
Retrieval-Augmented Generation (RAG) and its collaborative variant (CRAG) remain the most reliable, cost-efficient strategies for grounding large-language-model (LLM) output in proprietary data while avoiding costly full-model fine-tuning[^1][^2]. For an on-premise, containerized deployment serving “hundreds or thousands” of brand tenants, you can combine modern open-source components—document loaders, parsers, embedding models, vector databases, and multi-agent orchestration frameworks—into a modular stack that is fast, memory-aware, and free of per-token vendor fees.

The pages that follow map out:

- Latest 2025 OSS tooling for every layer of the pipeline.
- Architectural patterns for multi-tenant isolation and horizontal scale.
- Concrete resource sizing formulas and DevOps tips for edge-friendly deployment.
- Reference code snippets plus step-by-step data-flow diagrams.
- A comparison matrix of RAG/CRAG frameworks, embeddings, and vector stores.
- Security notes for OAuth-based social-media ingestion and brand-specific data segregation.


## 1. Architectural Requirements

### 1.1 Functional Goals

- **Voice Consistency:** Generate style-faithful copy, responses, and rewrites using each brand’s corpus as grounding context[^1].
- **Multi-Source Ingestion:** Support drag-and-drop uploads (DOCX, PDF, Markdown), authenticated crawls of brand websites, and OAuth-based pulls from X, LinkedIn, Instagram, TikTok, etc.[^3][^4].
- **Per-Tenant Isolation:** Guarantee that embeddings and documents for Brand A cannot leak into Brand B’s retrieval set, even when hosted on the same physical cluster[^5][^6].
- **Tool-Calling Agents:** Enable LLM agents that can autonomously trigger content grading, profanity redaction, or real-time fact checks via internal micro-services[^7].


### 1.2 Non-Functional Constraints

- **100% FOSS:** No proprietary SaaS fees; permissive Apache 2.0 / MIT licenses recommended[^8][^9].
- **On-Prem / Containerized:** Deploy via Docker Compose → Kubernetes when scale demands[^10].
- **Low Memory Footprint:** Vector DB must unload seldom-used collections or shard horizontally[^11][^12].
- **Streaming Updates:** Brand managers want “same-minute” retrieval of fresh posts without daily batch rebuilds[^13].


## 2. High-Level System Diagram

```
Users  ─────►  Ingestion API ─►  Pre-Processor  ─►   Vector DB        ─►  Retrieval Layer
(OAuth        (FastAPI)           (LlamaParse/      (pgvector |          (LangGraph Router
  flows)                          Firecrawl)          Qdrant |             + BGE Embeds)
                                                       Milvus)

                         ▲                                                     │
                         │                         ────────────────────────────┤
                         │                         │                           │
                   Brand Dashboards ◄─────────────┘                      LLM Agent Orchestrator
                                                                        (CrewAI + LangGraph)
```


## 3. Data Ingestion \& Processing

### 3.1 Document Loaders

| Loader | Format Coverage | Incremental Crawling | License | Best Use Case |
| :-- | :-- | :-- | :-- | :-- |
| LlamaIndex Loaders + LlamaParse | PDF, DOCX, XLSX, HTML tables | Recursive diffing; auto table-to-markdown | MIT | High-fidelity corporate PDFs[^14] |
| Haystack WebBase \& Firecrawl | HTML, JSON-LD, OpenGraph, microdata | Web scraping with sitemap auto-discover | Apache 2.0 | Newsroom \& blog capture[^4] |
| Pathway Streaming Connectors | Kafka/S3/SharePoint/Drive | Exactly-once stream semantics | Apache 2.0 | Real-time doc pipelines[^3] |

*All rows include chunking utility: RecursiveCharacterTextSplitter (LangChain) or similar.*

### 3.2 Social-Media Pulls

1. **OAuth Flow** → Scoped token for read-only timeline.
2. **Rate-Limited Fetcher** → Pull N most recent posts; write to Kafka topic.
3. **Normalization Worker** → Strip hashtags/mentions into metadata fields.
4. **Vectorization** → Same embedding pipeline as documents.

## 4. Embedding Models (2025 Leaders)

| Model | Dim | Context Max | License | MTEB Avg | GPU Mem (fp16) |
| :-- | :-- | :-- | :-- | :-- | :-- |
| BGE-Large-EN v1.5 | 1,024 | 512 | Apache 2.0 | 64.23%[^15] | 3.5 GB |
| bge-base-en v1.5 | 768 | 512 | Apache 2.0 | 63.55%[^15] | 2.6 GB |
| MiniCoil 4D | 4 | N/A | Apache 2.0 | ↑NDCG vs BM25 (several domains)[^16] | CPU-friendly |
| FastEmbed (Qdrant) | 384–768 | 1,024 | Apache 2.0 | ≈ 62% | CPU-friendly |

**Why BGE-Large?** Ranked above OpenAI embeddings yet incurs \$0/usage off-cloud[^17][^18]. Fine-tune per-brand stylistic nuance via supervised contrastive learning if desired.

## 5. Vector Store Selection

### 5.1 Memory \& Multi-Tenancy

| Store | RAM Behavior | Disk Persistence | Native Multi-Tenant | Notes |
| :-- | :-- | :-- | :-- | :-- |
| pgvector 0.8.0 (Postgres 17) | HNSW pages in shared buffers; auto iterative scans[^19] | WAL + table storage | Row-level policies | 9× faster p99 vs 0.7 with relaxed_order[^19] |
| Qdrant v1.9 | HNSW segment mmap; configurable LRU | RocksDB | Named collections | Supports sparse, dense, multi-vector, named-vector[^20] |
| Milvus 2.4.23 | Disk-backed vector index MMAP[^21] | Object storage | Database → collection | Hot-swappable Pulsar V3[^10] |
| Chroma 0.6 | In-mem HNSW; optional LRU unload[^11] | SQLite + WAL cleanup[^22] | Collection level | Easiest local dev; less robust >10 M vectors[^23] |

**Resource Formula (HNSW):**

`RAM ≈ 4 bytes × #vectors × dim` [^22]
For 5 M 1,024-dim vectors → 20 GB RAM; plan shards accordingly.

### 5.2 Recommended Path

- **Prototype:** Chroma or pgvector (if you already run Postgres) for quick local iteration.
- **Production Scale:** Qdrant Helm chart on k8s with per-brand collections; or Postgres with row-level security + tablespaces for small/medium vector sets. pgvector now rivals dedicated DBs with 70 ms p99 at 10 M rows[^19].


## 6. Retrieval-Augmented Generation Frameworks

| Framework | Retrieval Styles | Live Update Hooks | Plug-in Agents | License | Footprint |
| :-- | :-- | :-- | :-- | :-- | :-- |
| LangGraph (LangChain) | Hybrid, self-corrective, web search routing[^24] | Trigger nodes; pub-sub | Full multi-agent via state machine | MIT | 40 KB + deps |
| CrewAI | Role-goal task graph[^7][^25] | Task callbacks | Built-in executor | MIT | 70 KB |
| Haystack 0.10 “Breakpoints” | BM25 + embeddings hybrid[^26] | Pipeline breakpoints | Minimal | Apache 2.0 | 30 MB |
| LlamaIndex (RAGStack) | Index/graph abstractions; adaptive retriever | Watcher service for auto-re-ingest[^14] | Agents via Llama-Agents | MIT | 15 MB |
| Pathway | Streaming RAG; low-latency indexing[^3] | Continuous | Integrates with LangChain | Apache 2.0 | Rust binary |

**Framework Selection Guidance**


| Use Case | Pick This | Rationale |
| :-- | :-- | :-- |
| Rapid PoC with few agents | CrewAI | Declarative “mission” YAML, minimal boilerplate[^7] |
| Production multi-agent with branching retries | LangGraph | Deterministic state machine, cyclical loops[^24] |
| Real-time doc streams (newsrooms) | Pathway | <100 ms reindex[^3] |
| Classic search-plus-write RAG | LlamaIndex | Batteries-included loaders + caching[^27] |

## 7. LLM Backbone Choices

| Model | Params (active) | Context Window | Tool Calling | License | Inference Cost (8-bit) |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Llama 3 70B | 70B | 16 K (128 K in 3.1) | Yes | Apache 2.0 | ≈14 GB VRAM |
| Mixtral 8×22B | 39B active[^28] | 64 K | Yes | Apache 2.0 | ≈22 GB VRAM |
| Phi-3 Mini 3.8B | 3.8B | 4 K/128 K[^29] | Yes (ONNX) | MIT | 4 GB VRAM |
| Phi-3 Medium 14B | 7 B active | 128 K | Yes | MIT | 9 GB VRAM |

**Recommended Tiering**

- **Edge / Laptop:** Phi-3 Mini—fast, 4 GB VRAM; ideal for single-brand offline drafting[^30][^29].
- **GPU Node (A6000/RTX 4090):** Mixtral 8×22B with gguf Q4_K_M quant; tool-calling support native[^31].
- **Central Infer-Cluster:** Llama 3.1 405B for complex sentiment style matching; shard via vLLM (served in container) if you have H100s[^32].


## 8. Multi-Tenant Data Design

### 8.1 Storage Layout

- **Single Physical Cluster** → Namespace per client.
- **Vector DB:** collection = `brand_slug`.
- **Postgres row-level security**:

```sql
ALTER TABLE docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_isolation
  USING (brand_id = current_setting('app.brand_id')::uuid);
```


### 8.2 Memory Isolation Tips

| Vector Store | Isolation Feature | Garbage-Collect Stale | Citation |
| :-- | :-- | :-- | :-- |
| Qdrant | per-collection HNSW; `optimizers.memmap_threshold` | Automatic segment compaction | [^20] |
| Chroma | LRU cache with env vars `CHROMA_CACHE_SIZE_GB` \& `CHROMA_LRU_ACTIVE` | Manual unload API or script[^11] | [^11] |
| pgvector | Independent tables; shared-buffer eviction by Postgres | VACUUM; autovacuum tuned | [^19] |

## 9. Retrieval Strategies

### 9.1 Adaptive Routing (LangGraph)

1. **Query Classifier Node** → Tag as “brand-policy,” “recent news,” or “creative rewrite.”
2. **Route:**
    - No retrieval (style question)
    - Single-shot RAG
    - Iterative self-corrective loop with summarizer.
3. **Answer Formatter**.

### 9.2 CRAG for Collaborative Signals

- Merge brand’s historical ad-copy embeddings with live engagement metrics (likes, CTR) into a CF matrix[^33][^34].
- Re-rank candidate snippets using user collaborative filter to bias toward successful tone.


## 10. Proposed Container Topology

| Service | Image | Replicas | Key Env Vars |
| :-- | :-- | :-- | :-- |
| `ingest-api` | `python:3.12-slim` | 4 | RABBIT_URL, OAUTH_SECRET |
| `parser-worker` | `llamaparse:latest` | 6 | PARSE_THREADS=2 |
| `vector-db` | `qdrant/qdrant:v1.9` | 3 (sharded) | QDRANT__ENABLED=true |
| `embedding` | `bge-large:gguf-q5` | N per GPU | NUM_SHARDS |
| `rag-orchestrator` | `langgraph:0.0.12` | 4 |  |
| `llm-gateway` | `vllm/vllm:llama3-70b` | 2 | MODEL_NAME=llama-3-70b |

## 11. Deployment \& DevOps Notes

1. **Kubernetes Helm Charts** exist for Qdrant, Milvus, pgvector-operator (CRD), and Pathway; integrate into GitOps pipeline.
2. **GPU Scheduling:** Use `nvidia.com/gpu` resource requests; apply node-selectors to keep Mixtral pods on 24 GB cards.
3. **Horizontal Autoscaling:** Scale `orchestrator` by CPU; scale embedding workers by Kafka lag.
4. **Backup:** Postgres WAL → pgBackRest; Qdrant has snapshot API.

## 12. Security \& Compliance

- **OAuth Tokens:** Store encrypted in HashiCorp Vault; rotate weekly.
- **PII Scrubbing:** Pre-processor regex pass; implement profanity/opinion filters per SEC compliance.
- **RBAC:** Kubernetes ServiceAccounts per namespace; Postgres RLS plus schema permission.
- **Audit Trail:** All RAG prompt-context pairs logged to separate immutable bucket.


## 13. Performance Sizing Example

Assumptions: 1,000 brands, 40,000 docs each, average 2 chunks per doc.


| Component | Quantity | Memory/Disk Each | Total |
| :-- | :-- | :-- | :-- |
| Embeddings | 80 M × 1,024 dims | 4 bytes × dim = 4.1 GB per 1 M | ≈ 330 GB RAM[^22] |
| Vector Shards | 10 (Qdrant) | 64 GB RAM nodes | 640 GB cluster |
| Postgres Metadata | 80 M rows | 500 bytes | 40 GB disk |
| Llama 3-70B VLLM | 2 GPUs × 80 GB A100 | – | 160 GB VRAM |

Scale horizontally: +1 Qdrant shard per 100 M vectors.

## 14. End-to-End Example Code Snippet

```python
# Ingest a LinkedIn company feed, chunk, embed, and upsert
from crewai import Agent, Task, Crew
from langchain_community.vectorstores import Qdrant
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders.social import LinkedInLoader
from sentence_transformers import SentenceTransformer

brand = "acme_inc"
loader = LinkedInLoader(oauth_token=env["LI_TOKEN"])
posts = loader.load(brand_url="https://linkedin.com/company/acme_inc")
chunks = RecursiveCharacterTextSplitter(chunk_size=400).split_documents(posts)

embedder = SentenceTransformer("BAAI/bge-large-en-v1.5")
q_client = Qdrant(url="http://vector-db:6333", prefer_grpc=True)
vstore = Qdrant(vector_size=1024, client=q_client,
                collection_name=brand)

docs, vecs = zip(*[(c.page_content, embedder.encode(c.page_content, normalize_embeddings=True))
                   for c in chunks])
vstore.add_texts(docs, embeddings=vecs, metadata=[c.metadata for c in chunks])
```


## 15. Migration Path from Prototype to Scale

| Stage | Prototype (Week 1) | Beta (Month 1) | Production (Quarter 1) |
| :-- | :-- | :-- | :-- |
| Vector DB | Chroma-in-container | pgvector single node | Qdrant k8s cluster |
| LLM | Phi-3 Mini local | Mixtral 8×22B quant | Llama 3-70B on GPU |
| Framework | LlamaIndex QuickStart | LangGraph adaptive | LangGraph + CrewAI hybrid |
| CI/CD | Docker Compose | GitHub Actions → K3s | ArgoCD, Helm, Vault |

## 16. Cost-Minimization Checklist

- Quantize embeddings to `halfvec` (2-byte) where recall drop ≤1%[^19].
- Enable Qdrant HNSW `on_disk=true` for cold brands.
- Run Mixtral with sparse MoE → 39 B active params = 40% less GPU than dense 70 B[^9].
- Use ONNX Runtime + CPU for Phi-3 Mini; avoids GPU tax for low-traffic tenants[^29].


## 17. CRAG Extension for Performance-Based Re-ranking

1. **Collaborative Filter:** Matrix factorization on historical engagement signals (likes, clicks)[^33].
2. **Retriever Hook:** For each answer candidate, compute CF score and blend with cosine similarity.
3. **LangGraph Node:** Weighted re-rank before passing to LLM.
4. **A/B Evaluation:** Use NDCG@10 to validate improved recall vs plain RAG.

## 18. Common Pitfalls \& Remedies

| Pitfall | Symptom | Fix |
| :-- | :-- | :-- |
| All vectors loaded in Chroma, OOM | Container kills at 10 M vectors | Switch to LRU cache strategy[^11] or migrate to Qdrant |
| pgvector filter returns <k results | Incorrect cost planner | Use pgvector 0.8 relaxed_order iterative scanning[^19] |
| Vector drift after brand tone change | Re-writes ignore new style guide | Trigger full re-embedding via Pathway DAG on doc_change event[^3] |
| Agent loops infinitely | CrewAI role mis-defined | Guard via LangGraph max_iter node \& heartbeat |

## 19. Security Hardening Cheat-Sheet

- **Network:** Isolate vector DB on internal subnet; expose only gRPC via mTLS.
- **Secrets:** Use sealed-secrets to inject OAuth keys at runtime.
- **LLM Output:** Run a profanity \& PII detection pass; open-source models like Detoxify.
- **Audit:** Immutable log of prompt, context, and answer saved in MinIO bucket for 180 days.


## 20. Key Takeaways

- **RAG/CRAG Still King in 2025:** Even with 128 K-token context windows, grounded retrieval delivers accuracy and compliance at lower VRAM budgets[^1][^2].
- **BGE v1.5 + Qdrant = Sweet Spot:** Competitive embeddings + scalable Rust vector store yield high recall and simple ops[^20][^15].
- **LangGraph + CrewAI Pairing:** LangGraph ensures deterministic orchestration; CrewAI provides human-like role clarity for brand-voice tooling[^7][^24].
- **Full FOSS Compliance:** All recommended components carry Apache 2.0 or MIT licenses, satisfying zero-vendor-lock mandate[^8][^9][^32].

Deploying the above stack positions your application to offer per-brand stylistic fidelity, streaming freshness, and enterprise-grade isolation—while staying lightweight enough to run on commodity MCP servers or edge GPU nodes.

<div style="text-align: center">⁂</div>

[^1]: https://squirro.com/squirro-blog/state-of-rag-genai

[^2]: https://research.aimultiple.com/retrieval-augmented-generation/

[^3]: https://pathway.com/blog/langchain-integration

[^4]: https://www.firecrawl.dev/blog/best-open-source-rag-frameworks

[^5]: https://dev.to/shiviyer/performance-tips-for-developers-using-postgres-and-pgvector-l7g

[^6]: https://www.shakudo.io/blog/top-9-vector-databases

[^7]: https://www.linkedin.com/pulse/architecting-multi-agent-systems-langgraph-crewai-confedo-ai-oy9cf

[^8]: https://ai.meta.com/blog/meta-llama-3/

[^9]: https://the-decoder.com/mistrals-mixtral-8x22b-sets-new-records-for-open-source-llms/

[^10]: https://milvus.io/docs/upgrade-pulsar-v3.md

[^11]: https://cookbook.chromadb.dev/strategies/memory-management/

[^12]: https://www.linkedin.com/posts/m-aruna-a73797247_ai-chromadb-vectorsearch-activity-7300122341890498562-6Zou

[^13]: https://github.com/langchain-ai/langchain/discussions/24410

[^14]: https://docs.datastax.com/en/ragstack/examples/llama-astra.html

[^15]: https://zilliz.com/ai-models/bge-base-en-v1.5

[^16]: https://qdrant.tech/articles/minicoil/

[^17]: https://replicate.com/blog/run-bge-embedding-models

[^18]: https://www.together.ai/models/bge-large-en-v1-5

[^19]: https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/

[^20]: https://www.oracle.com/database/vector-database/qdrant/

[^21]: https://zilliz.com/blog/whats-new-in-milvus-2-3-2-and-2-3-3

[^22]: https://cookbook.chromadb.dev/core/resources/

[^23]: https://github.com/chroma-core/chroma/issues/1323

[^24]: https://langchain-ai.github.io/langgraph/tutorials/rag/langgraph_adaptive_rag/

[^25]: https://fr.scribd.com/document/799281971/Exploration-of-LLM-Multi-Agent-Application-Implementation-Based-on-LangGraph-CrewAI-18241v1

[^26]: https://haystack.deepset.ai/cookbook/hybrid_rag_pipeline_with_breakpoints

[^27]: https://www.meilisearch.com/blog/llamaindex-rag

[^28]: https://mistral.ai/news/mixtral-8x22b/?bxid=\&cndid=\&esrc=

[^29]: https://onnxruntime.ai/docs/genai/tutorials/phi3-python.html

[^30]: https://www.datacamp.com/tutorial/phi-3-tutorial

[^31]: https://mistral.ai/fr/news/mixtral-8x22b

[^32]: https://ai.meta.com/blog/meta-llama-3-1/

[^33]: https://paperswithcode.com/paper/collaborative-retrieval-for-large-language

[^34]: https://arxiv.org/abs/2502.14137

[^35]: https://pathway.com/rag-frameworks/

[^36]: https://www.semanticscholar.org/paper/The-Critical-Agent-Dialogue-(-CrAg-)-Project-Isard-Brockmann/c78e60ad2aad59ef5dc64f96ab1e74ca8d09b3c1

[^37]: https://www.datastax.com/press-release/datastax-and-lamaIndex-partner-to-make-building-rag-applicationseasier-than-ever-for-genai-developers

[^38]: https://opensourceconnections.com/haystack-us-2025-call-for-papers/

[^39]: https://www.datastax.com/jp/press-release/datastax-and-lamaIndex-partner-to-make-building-rag-applicationseasier-than-ever-for-genai-developers

[^40]: https://www.youtube.com/watch?v=nwUhGeX6jaI

[^41]: https://huggingface.co/learn/cookbook/en/advanced_rag

[^42]: https://paperswithcode.com/paper/document-haystacks-vision-language-reasoning

[^43]: https://huggingface.co/datasets/crag-mm-2025/crag-mm-single-turn-public/blob/v0.1.2/README.md

[^44]: https://qdrant.tech/blog/fastllm-announcement/

[^45]: https://www.instaclustr.com/education/vector-database/top-10-open-source-vector-databases/

[^46]: https://airbyte.com/data-engineering-resources/postgresql-as-a-vector-database

[^47]: https://www.reddit.com/r/vectordatabase/comments/1hzovpy/best_vector_database_for_rag/

[^48]: https://liambeeton.com/programming/building-a-lightweight-rag-system-with-llamaindex-ollama-and-qdrant

[^49]: https://milvus.io/docs/v2.3.x/release_notes.md

[^50]: https://lakefs.io/blog/12-vector-databases-2023/

[^51]: https://milvus.io/docs/v2.4.x/release_notes.md

[^52]: https://aws.amazon.com/blogs/database/load-vector-embeddings-up-to-67x-faster-with-pgvector-and-amazon-aurora/

[^53]: https://techcommunity.microsoft.com/blog/azuredevcommunityblog/getting-started---generative-ai-with-phi-3-mini-a-guide-to-inference-and-deploym/4121315

[^54]: https://sourceforge.net/projects/bge-large-en-v1-5/

[^55]: https://en.wikipedia.org/wiki/Llama_(language_model)

[^56]: https://mistral.ai/news/mixtral-8x22b

[^57]: https://www.youtube.com/watch?v=scWYv1nsZ4o

[^58]: https://www.llama.com

[^59]: https://simonwillison.net/2024/May/21/phi-3-models-small-medium-and-vision/

[^60]: https://www.turing.com/resources/ai-agent-frameworks

