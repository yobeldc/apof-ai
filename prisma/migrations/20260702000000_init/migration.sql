-- CreateTable
CREATE TABLE "case_decisions" (
    "id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_domain" TEXT NOT NULL DEFAULT 'putusan3.mahkamahagung.go.id',
    "nomor_putusan" TEXT,
    "tingkat_proses" TEXT,
    "klasifikasi" TEXT,
    "kata_kunci" TEXT,
    "tahun" INTEGER,
    "tanggal_register" TEXT,
    "tanggal_putusan" TEXT,
    "tanggal_musyawarah" TEXT,
    "lembaga_peradilan" TEXT,
    "jenis_lembaga_peradilan" TEXT,
    "pengadilan" TEXT,
    "provinsi" TEXT,
    "hakim" TEXT,
    "panitera" TEXT,
    "pihak" TEXT,
    "pemohon" TEXT,
    "termohon" TEXT,
    "terdakwa" TEXT,
    "penggugat" TEXT,
    "tergugat" TEXT,
    "amar_putusan" TEXT,
    "ringkasan_singkat" TEXT,
    "full_text" TEXT,
    "ai_summary" TEXT,
    "ai_summary_json" TEXT,
    "pdf_url" TEXT,
    "local_pdf_path" TEXT,
    "raw_html_path" TEXT,
    "has_pdf" BOOLEAN NOT NULL DEFAULT false,
    "has_full_text" BOOLEAN NOT NULL DEFAULT false,
    "extraction_status" TEXT NOT NULL DEFAULT 'pending',
    "confidence_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "indexed_at" TIMESTAMP(3),

    CONSTRAINT "case_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_urls" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "source_page" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "job_id" TEXT,

    CONSTRAINT "discovered_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "config_json" TEXT NOT NULL DEFAULT '{}',
    "progress_total" INTEGER NOT NULL DEFAULT 0,
    "progress_done" INTEGER NOT NULL DEFAULT 0,
    "progress_failed" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "logs" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_notes" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_cases" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "collection_name" TEXT NOT NULL DEFAULT 'Default',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "document_pages" (
    "id" TEXT NOT NULL,
    "case_decision_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "case_decision_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "parent_section" TEXT,
    "section_title" TEXT,
    "section_kind" TEXT,
    "page_start" INTEGER,
    "page_end" INTEGER,
    "paragraph_start" INTEGER,
    "paragraph_end" INTEGER,
    "text" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "legal_terms_json" TEXT NOT NULL DEFAULT '[]',
    "cited_articles_json" TEXT NOT NULL DEFAULT '[]',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk_embeddings" (
    "id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "vector_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_analyses" (
    "id" TEXT NOT NULL,
    "case_decision_id" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'deterministic',
    "breakdown_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_query_logs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "filters_json" TEXT NOT NULL DEFAULT '{}',
    "retrieved_json" TEXT NOT NULL DEFAULT '[]',
    "answer" TEXT,
    "abstained" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_decisions_source_url_key" ON "case_decisions"("source_url");

-- CreateIndex
CREATE INDEX "case_decisions_tahun_idx" ON "case_decisions"("tahun");

-- CreateIndex
CREATE INDEX "case_decisions_klasifikasi_idx" ON "case_decisions"("klasifikasi");

-- CreateIndex
CREATE INDEX "case_decisions_pengadilan_idx" ON "case_decisions"("pengadilan");

-- CreateIndex
CREATE INDEX "case_decisions_extraction_status_idx" ON "case_decisions"("extraction_status");

-- CreateIndex
CREATE UNIQUE INDEX "discovered_urls_normalized_url_key" ON "discovered_urls"("normalized_url");

-- CreateIndex
CREATE INDEX "discovered_urls_status_idx" ON "discovered_urls"("status");

-- CreateIndex
CREATE INDEX "discovered_urls_job_id_idx" ON "discovered_urls"("job_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs"("status");

-- CreateIndex
CREATE INDEX "case_notes_case_id_idx" ON "case_notes"("case_id");

-- CreateIndex
CREATE INDEX "saved_cases_collection_name_idx" ON "saved_cases"("collection_name");

-- CreateIndex
CREATE UNIQUE INDEX "saved_cases_case_id_collection_name_key" ON "saved_cases"("case_id", "collection_name");

-- CreateIndex
CREATE INDEX "document_pages_case_decision_id_idx" ON "document_pages"("case_decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_pages_case_decision_id_page_number_key" ON "document_pages"("case_decision_id", "page_number");

-- CreateIndex
CREATE INDEX "document_chunks_case_decision_id_idx" ON "document_chunks"("case_decision_id");

-- CreateIndex
CREATE INDEX "document_chunks_parent_section_idx" ON "document_chunks"("parent_section");

-- CreateIndex
CREATE INDEX "document_chunks_section_title_idx" ON "document_chunks"("section_title");

-- CreateIndex
CREATE INDEX "document_chunks_section_kind_idx" ON "document_chunks"("section_kind");

-- CreateIndex
CREATE INDEX "chunk_embeddings_model_idx" ON "chunk_embeddings"("model");

-- CreateIndex
CREATE UNIQUE INDEX "chunk_embeddings_chunk_id_provider_model_key" ON "chunk_embeddings"("chunk_id", "provider", "model");

-- CreateIndex
CREATE UNIQUE INDEX "case_analyses_case_decision_id_key" ON "case_analyses"("case_decision_id");

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_cases" ADD CONSTRAINT "saved_cases_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_case_decision_id_fkey" FOREIGN KEY ("case_decision_id") REFERENCES "case_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_case_decision_id_fkey" FOREIGN KEY ("case_decision_id") REFERENCES "case_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk_embeddings" ADD CONSTRAINT "chunk_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "document_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_analyses" ADD CONSTRAINT "case_analyses_case_decision_id_fkey" FOREIGN KEY ("case_decision_id") REFERENCES "case_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

