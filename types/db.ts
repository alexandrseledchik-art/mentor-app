export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          industry: string;
          is_active: boolean;
          name: string;
          onboarding_completed: boolean;
          primary_goal: string | null;
          revenue_range: string | null;
          team_size: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          industry: string;
          is_active?: boolean;
          name: string;
          onboarding_completed?: boolean;
          primary_goal?: string | null;
          revenue_range?: string | null;
          team_size: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          industry?: string;
          is_active?: boolean;
          name?: string;
          onboarding_completed?: boolean;
          primary_goal?: string | null;
          revenue_range?: string | null;
          team_size?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnosis_answers: {
        Row: {
          answer_label: string | null;
          answer_value: number;
          created_at: string;
          diagnosis_session_id: string;
          id: string;
          question_id: string;
        };
        Insert: {
          answer_label?: string | null;
          answer_value: number;
          created_at?: string;
          diagnosis_session_id: string;
          id?: string;
          question_id: string;
        };
        Update: {
          answer_label?: string | null;
          answer_value?: number;
          created_at?: string;
          diagnosis_session_id?: string;
          id?: string;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diagnosis_answers_diagnosis_session_id_fkey";
            columns: ["diagnosis_session_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diagnosis_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnosis_question_sets: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          title: string;
          version: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          title: string;
          version?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          title?: string;
          version?: number;
        };
        Relationships: [];
      };
      diagnosis_questions: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          dimension: string;
          id: string;
          input_type: string;
          is_required: boolean;
          meta: Json;
          options: Json;
          order_index: number | null;
          position: number;
          question_text: string | null;
          question_set_id: string;
          title: string;
          weight: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          dimension: string;
          id?: string;
          input_type?: string;
          is_required?: boolean;
          meta?: Json;
          options?: Json;
          order_index?: number | null;
          position: number;
          question_text?: string | null;
          question_set_id: string;
          title: string;
          weight?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          dimension?: string;
          id?: string;
          input_type?: string;
          is_required?: boolean;
          meta?: Json;
          options?: Json;
          order_index?: number | null;
          position?: number;
          question_text?: string | null;
          question_set_id?: string;
          title?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "diagnosis_questions_question_set_id_fkey";
            columns: ["question_set_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_question_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnosis_sessions: {
        Row: {
          answers: Json | null;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          current_step: number | null;
          id: string;
          question_set_id: string;
          score_overall: number | null;
          started_at: string | null;
          status: string;
          summary_key: string | null;
          total_score: number | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          answers?: Json | null;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          current_step?: number | null;
          id?: string;
          question_set_id: string;
          score_overall?: number | null;
          started_at?: string | null;
          status?: string;
          summary_key?: string | null;
          total_score?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          answers?: Json | null;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          current_step?: number | null;
          id?: string;
          question_set_id?: string;
          score_overall?: number | null;
          started_at?: string | null;
          status?: string;
          summary_key?: string | null;
          total_score?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "diagnosis_sessions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diagnosis_sessions_question_set_id_fkey";
            columns: ["question_set_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_question_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diagnosis_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      result_snapshots: {
        Row: {
          company_id: string;
          created_at: string;
          diagnosis_session_id: string;
          dimension_scores: Json;
          id: string;
          overall_score: number | null;
          recommended_tools: Json;
          strongest_zones: Json;
          summary: Json;
          user_id: string;
          weakest_zones: Json;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          diagnosis_session_id: string;
          dimension_scores: Json;
          id?: string;
          overall_score?: number | null;
          recommended_tools: Json;
          strongest_zones: Json;
          summary: Json;
          user_id: string;
          weakest_zones: Json;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          diagnosis_session_id?: string;
          dimension_scores?: Json;
          id?: string;
          overall_score?: number | null;
          recommended_tools?: Json;
          strongest_zones?: Json;
          summary?: Json;
          user_id?: string;
          weakest_zones?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "result_snapshots_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "result_snapshots_diagnosis_session_id_fkey";
            columns: ["diagnosis_session_id"];
            isOneToOne: true;
            referencedRelation: "diagnosis_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "result_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tool_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          position: number;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          position?: number;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          position?: number;
          slug?: string;
        };
        Relationships: [];
      };
      symptom_tool_map: {
        Row: {
          id: string;
          priority: number;
          symptom_id: string;
          tool_id: string;
        };
        Insert: {
          id?: string;
          priority?: number;
          symptom_id: string;
          tool_id: string;
        };
        Update: {
          id?: string;
          priority?: number;
          symptom_id?: string;
          tool_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "symptom_tool_map_symptom_id_fkey";
            columns: ["symptom_id"];
            isOneToOne: false;
            referencedRelation: "symptoms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "symptom_tool_map_tool_id_fkey";
            columns: ["tool_id"];
            isOneToOne: false;
            referencedRelation: "tools";
            referencedColumns: ["id"];
          },
        ];
      };
      symptoms: {
        Row: {
          id: string;
          reason: string | null;
          section: string;
          slug: string;
          title: string;
        };
        Insert: {
          id?: string;
          reason?: string | null;
          section: string;
          slug: string;
          title: string;
        };
        Update: {
          id?: string;
          reason?: string | null;
          section?: string;
          slug?: string;
          title?: string;
        };
        Relationships: [];
      };
      tools: {
        Row: {
          category_id: string;
          content: Json;
          created_at: string;
          estimated_minutes: number | null;
          format: string;
          id: string;
          is_featured: boolean;
          problem: string | null;
          slug: string;
          stage: string | null;
          summary: string;
          title: string;
        };
        Insert: {
          category_id: string;
          content?: Json;
          created_at?: string;
          estimated_minutes?: number | null;
          format: string;
          id?: string;
          is_featured?: boolean;
          problem?: string | null;
          slug: string;
          stage?: string | null;
          summary: string;
          title: string;
        };
        Update: {
          category_id?: string;
          content?: Json;
          created_at?: string;
          estimated_minutes?: number | null;
          format?: string;
          id?: string;
          is_featured?: boolean;
          problem?: string | null;
          slug?: string;
          stage?: string | null;
          summary?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tools_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "tool_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          first_name: string;
          id: string;
          language_code: string | null;
          last_name: string | null;
          photo_url: string | null;
          telegram_user_id: number;
          telegram_username: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          first_name: string;
          id?: string;
          language_code?: string | null;
          last_name?: string | null;
          photo_url?: string | null;
          telegram_user_id: number;
          telegram_username?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_name?: string;
          id?: string;
          language_code?: string | null;
          last_name?: string | null;
          photo_url?: string | null;
          telegram_user_id?: number;
          telegram_username?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          active_company_id: string | null;
          active_diagnosis_session_id: string | null;
          created_at: string;
          id: string;
          last_completed_diagnosis_session_id: string | null;
          last_visited_route: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_company_id?: string | null;
          active_diagnosis_session_id?: string | null;
          created_at?: string;
          id?: string;
          last_completed_diagnosis_session_id?: string | null;
          last_visited_route?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_company_id?: string | null;
          active_diagnosis_session_id?: string | null;
          created_at?: string;
          id?: string;
          last_completed_diagnosis_session_id?: string | null;
          last_visited_route?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_active_company_id_fkey";
            columns: ["active_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspaces_active_diagnosis_session_id_fkey";
            columns: ["active_diagnosis_session_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspaces_last_completed_diagnosis_session_id_fkey";
            columns: ["last_completed_diagnosis_session_id"];
            isOneToOne: false;
            referencedRelation: "diagnosis_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspaces_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
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
}
