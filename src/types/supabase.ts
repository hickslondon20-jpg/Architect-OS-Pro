export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ose_knowledge_pages: {
        Row: {
          id: string;
          user_id: string;
          page_type: string;
          page_title: string;
          content: string;
          category: string | null;
          source_file_ids: string[];
          last_updated: string;
          updated_at: string;
          pinecone_vector_id: string | null;
          word_count: number;
          status: string | null;
          canonical_key: string | null;
          page_kind: string | null;
          domain: string | null;
          confidence: number | null;
          effective_date: string | null;
          observed_date: string | null;
          review_date: string | null;
          embedding: string | null;
          origin_thread_id: string | null;
          synthesis_job_id: string | null;
          recall_count: number;
          last_recalled_at: string | null;
          promotion_state: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          page_type: string;
          page_title: string;
          content?: string;
          category?: string | null;
          source_file_ids?: string[];
          last_updated?: string;
          updated_at?: string;
          pinecone_vector_id?: string | null;
          word_count?: number;
          status?: string | null;
          canonical_key?: string | null;
          page_kind?: string | null;
          domain?: string | null;
          confidence?: number | null;
          effective_date?: string | null;
          observed_date?: string | null;
          review_date?: string | null;
          embedding?: string | null;
          origin_thread_id?: string | null;
          synthesis_job_id?: string | null;
          recall_count?: number;
          last_recalled_at?: string | null;
          promotion_state?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          page_type?: string;
          page_title?: string;
          content?: string;
          category?: string | null;
          source_file_ids?: string[];
          last_updated?: string;
          updated_at?: string;
          pinecone_vector_id?: string | null;
          word_count?: number;
          status?: string | null;
          canonical_key?: string | null;
          page_kind?: string | null;
          domain?: string | null;
          confidence?: number | null;
          effective_date?: string | null;
          observed_date?: string | null;
          review_date?: string | null;
          embedding?: string | null;
          origin_thread_id?: string | null;
          synthesis_job_id?: string | null;
          recall_count?: number;
          last_recalled_at?: string | null;
          promotion_state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ose_knowledge_pages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ose_page_links: {
        Row: {
          id: string;
          user_id: string;
          from_page_id: string;
          to_page_id: string;
          relation: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          from_page_id: string;
          to_page_id: string;
          relation?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          from_page_id?: string;
          to_page_id?: string;
          relation?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ose_page_links_from_page_id_fkey";
            columns: ["from_page_id"];
            isOneToOne: false;
            referencedRelation: "ose_knowledge_pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ose_page_links_to_page_id_fkey";
            columns: ["to_page_id"];
            isOneToOne: false;
            referencedRelation: "ose_knowledge_pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ose_page_links_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
